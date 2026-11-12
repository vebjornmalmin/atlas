// Every quiz-off room decision, as pure functions over plain data. The Durable Object only stores, sends and closes.
// room: durable state (null when the room does not exist). sockets: [{sid, id, ready}], id null until welcomed, ready = last q read.
// Phases: lobby → question → (vote, open questions with two or more answers) → reveal → question … → finished.
import {PROTOCOL, MAX_PLAYERS, MIN_PLAYERS, ANSWER_MAX, OPEN_SECONDS, VOTE_SECONDS, TIMEUP_TOLERANCE, FORCE_AFTER, FINISHED_TTL, ROOM_TTL, ACTIVE_WINDOW, CLOSE, cleanName, checkMessage} from '../src/lib/quizoff/protocol.js';

// Phones' early timeups and forces within this window get one retry from the room at the deadline.
export const RETRY_WINDOW = 5000;

export function createRoom({code, app, pack, now}) {
  return {code, app, pack, created:now, active:now, phase:'lobby', players:[], events:[], settings:null, modes:[], round:null, revealedAt:0, finishedAt:0};
}
export const lastSeq = room => room?.events.at(-1)?.seq ?? 0;
export const activePlayers = room => room.players.filter(p => !p.left);
export const hostOf = room => activePlayers(room)[0] ?? null;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// input: {kind:'message', sid, msg, now} | {kind:'close', sid, now} | {kind:'clock', phase, q, now}. msg: parsed object or null.
// retryAt: when set, the shell runs {kind:'clock'} for the room's current phase and q at that time.
// → {room, sockets, send:[{to:sid, msg}], close:[{sid, code, reason}], persist, alarm, wipe, retryAt}
export function handle(room, sockets, input) {
  const c = {room:room && structuredClone(room), sockets:sockets.map(s => ({...s})), now:input.now, send:[], close:[], persist:false, alarm:0, wipe:false, retryAt:0};
  if (input.kind === 'close') onClose(c, input.sid);
  else if (input.kind === 'clock') onClock(c, input.phase, input.q);
  else onMessage(c, input.sid, input.msg);
  if (c.persist && c.room) c.room.active = c.now;
  return {room:c.room, sockets:c.sockets, send:c.send, close:c.close, persist:c.persist && !c.wipe, alarm:c.alarm, wipe:c.wipe, retryAt:c.retryAt};
}

// Cleanup alarm. seen: last activity the shell saw in memory (messages that cause no write).
export function alarm(room, now, seen = 0) {
  if (!room) return {wipe:true};
  if (room.phase === 'finished') return now >= room.finishedAt + FINISHED_TTL ? {wipe:true} : {alarm:room.finishedAt + FINISHED_TTL};
  const active = Math.max(room.active, seen);
  if (now - active < ACTIVE_WINDOW) return {alarm:active + ACTIVE_WINDOW};
  if (now < room.created + ROOM_TTL) return {alarm:room.created + ROOM_TTL};
  return {wipe:true};
}

export function onlineIds(sockets) { return [...new Set(sockets.filter(s => s.id).map(s => s.id))]; }
// Who has answered, voted and tapped "Neste" in the current round; never what.
export function progressOf(room, sockets) {
  const r = room?.round;
  if (!r || !['question', 'vote', 'reveal'].includes(room.phase)) return {q:null, answered:[], voted:[], ready:[]};
  const ready = room.phase === 'reveal' ? onlineIds(sockets.filter(s => s.ready === r.q)) : [];
  return {q:r.q, answered:Object.keys(r.answers), voted:Object.keys(r.votes ?? {}), ready};
}
const timed = phase => phase === 'question' || phase === 'vote';

const sock = (c, sid) => c.sockets.find(s => s.sid === sid);
const to = (c, sid, msg) => c.send.push({to:sid, msg});
const broadcast = (c, msg, except) => { for (const s of c.sockets) if (s.id && s.sid !== except) to(c, s.sid, msg); };
function drop(c, sid, code, reason) {
  c.sockets = c.sockets.filter(s => s.sid !== sid);
  c.close.push({sid, code, reason});
}
function fatal(c, sid, code, extra) { to(c, sid, {t:'error', code, ...extra}); drop(c, sid, CLOSE.error, code); }
function emit(c, event) {
  const e = {seq:lastSeq(c.room) + 1, at:c.now, ...event};
  c.room.events.push(e);
  c.persist = true;
  broadcast(c, {t:'event', event:e});
}
const presence = (c, except) => broadcast(c, {t:'presence', online:onlineIds(c.sockets)}, except);
const progress = c => broadcast(c, {t:'progress', ...progressOf(c.room, c.sockets)});
const onlineActive = c => { const on = new Set(onlineIds(c.sockets)); return activePlayers(c.room).filter(p => on.has(p.id)); };

function onMessage(c, sid, raw) {
  const s = sock(c, sid);
  if (!s) return;
  if (!c.room) return fatal(c, sid, 'no-room');
  const msg = checkMessage(raw);
  if (!s.id) return msg?.t === 'hello' ? hello(c, s, msg) : fatal(c, sid, 'bad');
  if (!msg || msg.t === 'hello') return to(c, sid, {t:'error', code:'bad'});
  const player = c.room.players.find(p => p.id === s.id);
  if (!player || player.left) return drop(c, sid, CLOSE.normal, 'left');
  ({start, answer, vote, timeup, ready, force, leave})[msg.t](c, player, msg, s);
}

function hello(c, s, msg) {
  const {room} = c;
  if (msg.v !== PROTOCOL || msg.app !== room.app || msg.pack !== room.pack) return fatal(c, s.sid, 'version', {app:room.app, pack:room.pack});
  let player = room.players.find(p => p.id === msg.player.id);
  if (player) {
    if (player.key !== msg.key) return fatal(c, s.sid, 'key');
    // Left for good: the phone should forget this game.
    if (player.left) return fatal(c, s.sid, 'no-room');
  } else {
    // A phone that holds events but is unknown here belongs to an earlier room with this code.
    if (msg.have > 0) return fatal(c, s.sid, 'no-room');
    if (room.phase !== 'lobby') return fatal(c, s.sid, 'started');
    if (activePlayers(room).length >= MAX_PLAYERS) return fatal(c, s.sid, 'full');
    const name = cleanName(msg.player.name);
    if (!name) return fatal(c, s.sid, 'name');
    player = {id:msg.player.id, name, key:msg.key, left:false};
    room.players.push(player);
    emit(c, {t:'joined', player:{id:player.id, name}});
  }
  let ready = -1;
  for (const old of c.sockets.filter(o => o.id === player.id && o.sid !== s.sid)) { ready = Math.max(ready, old.ready); drop(c, old.sid, CLOSE.replaced, 'replaced'); }
  s.id = player.id;
  s.ready = ready;
  if (timed(room.phase) && !room.round.waitFor.includes(player.id)) room.round.waitFor.push(player.id);
  to(c, s.sid, {t:'welcome', room:{code:room.code, app:room.app, pack:room.pack}, you:player.id, now:c.now,
    events:room.events.filter(e => e.seq > msg.have), online:onlineIds(c.sockets), progress:progressOf(room, c.sockets)});
  presence(c, s.sid);
}

function start(c, player, msg) {
  const {room} = c;
  if (room.phase !== 'lobby' || activePlayers(room).length < MIN_PLAYERS) return;
  const host = hostOf(room);
  if (player.id !== host.id && onlineIds(c.sockets).includes(host.id)) return;
  room.settings = msg.settings;
  room.count = msg.questions.length;
  room.modes = msg.questions.map(q => q.mode);
  emit(c, {t:'started', settings:msg.settings, questions:msg.questions});
  openQuestion(c, 0);
}

const isOpen = (room, q) => room.modes?.[q] === 'open';

function openQuestion(c, q) {
  const seconds = isOpen(c.room, q) ? OPEN_SECONDS : c.room.settings.seconds;
  const deadline = c.now + seconds * 1000;
  c.room.phase = 'question';
  // waitFor: players the phase waits for until the deadline. A dropped socket does not remove a player, so a short
  // network break never costs the question; players offline when it opens are added if they return in time.
  // deadline and waitFor belong to the phase: the vote replaces both.
  c.room.round = {q, openedAt:c.now, deadline, answers:{}, waitFor:onlineActive(c).map(p => p.id)};
  emit(c, {t:'question', q, deadline});
}

function answer(c, player, msg) {
  const {room} = c, r = room.round;
  if (room.phase !== 'question' || r.q !== msg.q) return;
  // The deadline passed and no phone said so: close now instead of taking the late answer.
  if (c.now > r.deadline + TIMEUP_TOLERANCE) return closeQuestion(c);
  if (r.answers[player.id] || (!isOpen(room, r.q) && msg.answer.length > ANSWER_MAX)) return;
  r.answers[player.id] = {answer:msg.answer, ms:clamp(c.now - r.openedAt, 0, r.deadline - r.openedAt)};
  c.persist = true;
  if (!maybeClose(c)) progress(c);
}

// One vote per player, for an answer on the ballot that is not their own. Final once counted.
function vote(c, player, msg) {
  const {room} = c, r = room.round;
  if (room.phase !== 'vote' || r.q !== msg.q) return;
  if (c.now > r.deadline + TIMEUP_TOLERANCE) return reveal(c);
  if (r.votes[player.id] || msg.for === player.id || !r.answers[msg.for]) return;
  r.votes[player.id] = msg.for;
  c.persist = true;
  if (!maybeClose(c)) progress(c);
}

// timeup closes a question or a vote; force moves on from a reveal. Both from TIMEUP_TOLERANCE before the phase's
// deadline, with one retry by the room when they come at most RETRY_WINDOW early.
function timeup(c, player, msg) { if (timed(c.room.phase)) clock(c, c.room.phase, msg.q, true); }
function force(c, player, msg) { clock(c, 'reveal', msg.q, true); }
function onClock(c, phase, q) { if (c.room) clock(c, phase, q, false); }
function clock(c, phase, q, retry) {
  const {room} = c, r = room.round;
  if (room.phase !== phase || r?.q !== q) return;
  const due = phase === 'reveal' ? room.revealedAt + FORCE_AFTER : r.deadline;
  if (c.now >= due - TIMEUP_TOLERANCE) return phase === 'question' ? closeQuestion(c) : phase === 'vote' ? reveal(c) : advance(c);
  if (retry && due - c.now <= RETRY_WINDOW) c.retryAt = due;
}

function ready(c, player, msg, s) {
  const {room} = c;
  if (room.phase !== 'reveal' || room.round.q !== msg.q || s.ready === msg.q) return;
  s.ready = msg.q;
  if (!maybeAdvance(c)) progress(c);
}

function leave(c, player, msg, s) {
  const {room} = c;
  player.left = true;
  for (const o of c.sockets.filter(o => o.id === player.id)) drop(c, o.sid, CLOSE.normal, 'left');
  if (room.phase === 'finished') {
    // The log is closed; the flag only lets an empty room go early.
    if (!activePlayers(room).length) c.wipe = true;
    return;
  }
  emit(c, {t:'left', player:player.id});
  if (!activePlayers(room).length) { finish(c); c.wipe = true; return; }
  presence(c);
  recheck(c);
}

function onClose(c, sid) {
  const s = sock(c, sid);
  if (!s) return;
  c.sockets = c.sockets.filter(o => o.sid !== sid);
  if (!s.id || !c.room || c.sockets.some(o => o.id === s.id)) return;
  presence(c);
  recheck(c);
}

function recheck(c) {
  if (timed(c.room.phase)) maybeClose(c);
  else if (c.room.phase === 'reveal') maybeAdvance(c);
}

// A question or a vote closes early when everyone it waits for has answered or voted, and at least one has.
function maybeClose(c) {
  const {room} = c, r = room.round, done = room.phase === 'vote' ? r.votes : r.answers;
  if (!timed(room.phase) || !Object.keys(done).length) return false;
  if (!activePlayers(room).filter(p => r.waitFor.includes(p.id)).every(p => done[p.id])) return false;
  if (room.phase === 'question') closeQuestion(c); else reveal(c);
  return true;
}

// An open question with two or more answers goes to the vote; everything else straight to the reveal.
function closeQuestion(c) {
  const {room} = c, r = room.round;
  if (!isOpen(room, r.q) || Object.keys(r.answers).length < 2) return reveal(c);
  const deadline = c.now + VOTE_SECONDS * 1000;
  room.phase = 'vote';
  Object.assign(r, {deadline, votes:{}, waitFor:onlineActive(c).map(p => p.id)});
  emit(c, {t:'ballot', q:r.q, answers:r.answers, deadline});
  progress(c);
}

function reveal(c) {
  const {room} = c, r = room.round;
  room.phase = 'reveal';
  room.revealedAt = c.now;
  emit(c, {t:'reveal', q:r.q, answers:r.answers, ...(isOpen(room, r.q) ? {votes:r.votes ?? {}} : {})});
  progress(c);
  maybeAdvance(c);
}

function maybeAdvance(c) {
  const {room} = c, on = onlineActive(c);
  if (room.phase !== 'reveal' || !on.length) return false;
  const readyIds = new Set(c.sockets.filter(s => s.ready === room.round.q).map(s => s.id));
  if (!on.every(p => readyIds.has(p.id))) return false;
  advance(c);
  return true;
}

function advance(c) {
  const q = c.room.round.q + 1;
  if (q < c.room.count) openQuestion(c, q); else finish(c);
}

function finish(c) {
  const {room} = c;
  if (room.phase === 'finished') return;
  room.phase = 'finished';
  room.finishedAt = c.now;
  emit(c, {t:'finished'});
  c.alarm = c.now + FINISHED_TTL;
}
