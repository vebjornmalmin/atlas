import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, handle, alarm, progressOf} from '../worker/room-core.js';
import {PROTOCOL, CODE_ALPHABET, MESSAGE_MAX, FINISHED_TTL, ROOM_TTL, ACTIVE_WINDOW, OPEN_SECONDS, VOTE_SECONDS, REVEAL_SECONDS, FORCE_AFTER, makeRoomCode, isRoomCode, cleanName, checkHello, checkStart, checkAnswer, checkVote, checkTimeup, checkReady, checkForce, checkLeave, checkMessage, parseMessage} from '../src/lib/quizoff/protocol.js';

const APP = '1.11.0', PACK = 'pack-1', KEY = 'k'.repeat(24);
const QS = n => Array.from({length:n}, (_, i) => ({id:`core:q${i}`, mode:i % 2 ? 'recall' : 'recognition'}));
const START = (count = 3, seconds = 20) => ({t:'start', settings:{count, seconds, title:'Test'}, questions:QS(count)});

// A room plus its sockets, driven the way the Durable Object drives room-core.
function sim(now = 1000) {
  const s = {room:createRoom({code:'ABCD', app:APP, pack:PACK, now}), sockets:[], now, inbox:{}, closed:{}, writes:1, n:0};
  s.run = input => {
    const r = handle(s.room, s.sockets, {now:s.now, ...input});
    if (r.wipe) s.room = null; else s.room = r.room;
    s.sockets = r.sockets;
    if (r.persist) s.writes++;
    for (const {to, msg} of r.send) (s.inbox[to] ??= []).push(msg);
    for (const c of r.close) s.closed[c.sid] = c;
    s.last = r;
    return r;
  };
  s.open = () => { const sid = `s${++s.n}`; s.sockets.push({sid, id:null, ready:-1}); return sid; };
  s.msg = (sid, msg) => s.run({kind:'message', sid, msg});
  s.hello = (id, {name = id.toUpperCase(), key = KEY + id, have = 0, app = APP, pack = PACK, v = PROTOCOL} = {}) => {
    const sid = s.open();
    s.msg(sid, {t:'hello', v, player:{id, name}, key, app, pack, have});
    return sid;
  };
  s.drop = sid => s.run({kind:'close', sid});
  s.got = sid => s.inbox[sid] ?? [];
  s.events = () => s.room.events;
  s.lastOf = (sid, t) => s.got(sid).filter(m => m.t === t).at(-1);
  // The log as a phone sees it: welcome events then event messages.
  s.log = sid => s.got(sid).flatMap(m => m.t === 'welcome' ? m.events : m.t === 'event' ? [m.event] : []);
  return s;
}
const types = events => events.map(e => e.t);

test('protocol: room codes use the 24-letter alphabet without I and O', () => {
  assert.equal(CODE_ALPHABET.length, 24);
  assert.ok(!CODE_ALPHABET.includes('I') && !CODE_ALPHABET.includes('O'));
  let i = 0; const seq = [0, 0.5, 0.999999, 0.04];
  assert.equal(makeRoomCode(() => seq[i++]), 'ANZA');
  for (let k = 0; k < 200; k++) assert.ok(isRoomCode(makeRoomCode()));
  assert.equal(makeRoomCode(() => 1), 'ZZZZ');
  for (const bad of ['abcd', 'ABCO', 'ABC', 'ABCDE', 'AB1D', 12, null]) assert.equal(isRoomCode(bad), false);
});

test('protocol: names are trimmed, single-spaced and 1–20 characters', () => {
  assert.equal(cleanName('  Ola   Nordmann '), 'Ola Nordmann');
  assert.equal(cleanName('Åse\u0000'), 'Åse');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName('x'.repeat(20)), 'x'.repeat(20));
  assert.equal(cleanName('x'.repeat(21)), '');
  assert.equal(cleanName('😀'.repeat(20)), '😀'.repeat(20));
  assert.equal(cleanName(42), '');
});

test('protocol: message validators accept the contract and reject the rest', () => {
  const hello = {t:'hello', v:1, player:{id:'0b6f-4c1e', name:'Ola'}, key:KEY, app:APP, pack:PACK, have:3, extra:1};
  assert.deepEqual(checkHello(hello), {t:'hello', v:1, player:{id:'0b6f-4c1e', name:'Ola'}, key:KEY, app:APP, pack:PACK, have:3});
  assert.equal(checkHello({...hello, have:undefined}).have, 0);
  assert.equal(checkHello({...hello, v:2}).v, 2, 'any integer version reaches the room so it can answer version');
  for (const bad of [{...hello, key:'short'}, {...hello, player:{id:'a b', name:'x'}}, {...hello, have:-1}, {...hello, app:''}, {...hello, player:null}])
    assert.equal(checkHello(bad), null);

  assert.deepEqual(checkStart(START(3)), START(3));
  assert.equal(checkStart({...START(3), settings:{count:3, seconds:20}}).settings.title, '');
  assert.equal(checkStart({...START(3), questions:QS(4)}), null, 'questions.length must equal count');
  assert.equal(checkStart(START(2)), null);
  assert.equal(checkStart(START(21)), null);
  assert.equal(checkStart(START(3, 9)), null);
  assert.equal(checkStart(START(3, 61)), null);
  assert.equal(checkStart({...START(3), settings:{count:3, seconds:20, title:'x'.repeat(61)}}), null);
  assert.equal(checkStart({...START(3), questions:[...QS(2), {id:'core:x', mode:'timeline'}]}), null);
  assert.equal(checkStart({...START(3), questions:[...QS(2), {id:'x'.repeat(201), mode:'recall'}]}), null);

  assert.deepEqual(checkAnswer({t:'answer', q:0, answer:'Oslo'}), {t:'answer', q:0, answer:'Oslo'});
  assert.equal(checkAnswer({t:'answer', q:0, answer:''}), null);
  assert.equal(checkAnswer({t:'answer', q:0, answer:'  '}), null);
  assert.equal(checkAnswer({t:'answer', q:0, answer:'x'.repeat(400)}).answer.length, 400, 'open answers go up to 400');
  assert.equal(checkAnswer({t:'answer', q:0, answer:'x'.repeat(401)}), null);
  assert.deepEqual(checkVote({t:'vote', q:1, for:'b-2', extra:1}), {t:'vote', q:1, for:'b-2'});
  for (const bad of [{t:'vote', q:1}, {t:'vote', q:1, for:''}, {t:'vote', q:1, for:'a b'}, {t:'vote', q:20, for:'a'}, {t:'vote', for:'a'}])
    assert.equal(checkVote(bad), null);
  assert.equal(checkMessage({t:'vote', q:0, for:'a'}).t, 'vote');
  assert.deepEqual(checkStart({...START(3), questions:[...QS(2), {id:'core:x', mode:'open'}]}).questions[2].mode, 'open');
  assert.equal(checkAnswer({t:'answer', q:-1, answer:'x'}), null);
  assert.equal(checkAnswer({t:'answer', q:1.5, answer:'x'}), null);
  assert.deepEqual(checkTimeup({t:'timeup', q:2}), {t:'timeup', q:2});
  assert.deepEqual(checkReady({t:'ready', q:2}), {t:'ready', q:2});
  assert.deepEqual(checkForce({t:'force', q:2}), {t:'force', q:2});
  assert.equal(checkForce({t:'force'}), null);
  assert.deepEqual(checkLeave({t:'leave'}), {t:'leave'});
  assert.equal(checkMessage({t:'toString'}), null);
  assert.equal(checkMessage({t:'answer', q:0, answer:'a'}).t, 'answer');

  assert.deepEqual(parseMessage('{"t":"leave"}'), {t:'leave'});
  for (const bad of ['ping', '[1]', 'null', '{', new ArrayBuffer(2), 'x'.repeat(MESSAGE_MAX + 1)]) assert.equal(parseMessage(bad), null);
  assert.equal(parseMessage(JSON.stringify({t:'answer', q:0, answer:'é'.repeat(8190)})), null, 'the limit is in bytes');
});

test('a full game with three players: lobby, rounds, reveals and finish', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  assert.equal(s.lastOf(a, 'welcome').you, 'a');
  assert.deepEqual(s.lastOf(c, 'welcome').online, ['a', 'b', 'c']);
  assert.deepEqual(s.lastOf(a, 'presence').online, ['a', 'b', 'c']);
  assert.deepEqual(types(s.events()), ['joined', 'joined', 'joined']);
  s.msg(a, START(3, 20));
  assert.equal(s.room.phase, 'question');
  assert.deepEqual(types(s.events()).slice(3), ['started', 'question']);
  assert.equal(s.events()[4].deadline, s.events()[4].at + 20000);
  for (let q = 0; q < 3; q++) {
    s.now += 1000; s.msg(a, {t:'answer', q, answer:'A'});
    s.now += 1000; s.msg(b, {t:'answer', q, answer:'B'});
    s.now += 1000; s.msg(c, {t:'answer', q, answer:'C'});
    const reveal = s.events().at(-1);
    assert.equal(reveal.t, 'reveal');
    assert.deepEqual(reveal.answers, {a:{answer:'A', ms:1000}, b:{answer:'B', ms:2000}, c:{answer:'C', ms:3000}});
    for (const sid of [a, b, c]) s.msg(sid, {t:'ready', q});
    assert.equal(s.events().at(-1).t, q < 2 ? 'question' : 'finished');
  }
  assert.equal(s.room.phase, 'finished');
  assert.equal(s.last.alarm, s.now + FINISHED_TTL);
  for (const sid of [a, b, c]) assert.deepEqual(s.log(sid), s.events(), 'every phone ends with the whole log');
  assert.deepEqual(types(s.events()), ['joined', 'joined', 'joined', 'started', 'question', 'reveal', 'question', 'reveal', 'question', 'reveal', 'finished']);
});

test('seq has no gaps and every event carries the room clock', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  for (let q = 0; q < 3; q++) {
    s.now += 500; s.msg(a, {t:'answer', q, answer:'x'});
    s.now += 11000; s.msg(b, {t:'timeup', q});
    s.now += 1000; s.msg(a, {t:'ready', q}); s.msg(b, {t:'ready', q});
  }
  s.events().forEach((e, i) => { assert.equal(e.seq, i + 1); assert.equal(typeof e.at, 'number'); });
  assert.equal(s.events().at(-1).t, 'finished');
});

test('answers stay hidden until the reveal; progress names who answered', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'Hemmelig'});
  assert.ok(!JSON.stringify(s.got(b)).includes('Hemmelig'));
  assert.deepEqual(s.lastOf(b, 'progress'), {t:'progress', q:0, answered:['a'], voted:[], ready:[]});
  // A phone joining mid-round learns progress but not the answer.
  const b2 = s.hello('b', {have:5});
  assert.ok(!JSON.stringify(s.got(b2)).includes('Hemmelig'));
  assert.deepEqual(s.lastOf(b2, 'welcome').progress, {q:0, answered:['a'], voted:[], ready:[]});
  s.msg(b2, {t:'answer', q:0, answer:'Svar'});
  assert.equal(s.lastOf(b2, 'event').event.answers.a.answer, 'Hemmelig');
});

test('the first answer wins; later ones and answers to other rounds are ignored', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'first'});
  const w = s.writes;
  s.msg(a, {t:'answer', q:0, answer:'second'});
  s.msg(a, {t:'answer', q:1, answer:'future'});
  assert.equal(s.writes, w, 'ignored answers cost no write');
  s.msg(b, {t:'answer', q:0, answer:'b'});
  assert.equal(s.events().at(-1).answers.a.answer, 'first');
  s.msg(a, {t:'answer', q:0, answer:'after reveal'});
  assert.equal(s.room.round.answers.a.answer, 'first');
});

test('answer time is measured by the room and clamped to the round length', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  s.now += 4321; s.msg(a, {t:'answer', q:0, answer:'x', ms:1});
  s.now += 5679 + 200; s.msg(b, {t:'answer', q:0, answer:'y'});
  const {answers} = s.events().at(-1);
  assert.equal(answers.a.ms, 4321, 'a phone cannot backdate');
  assert.equal(answers.b.ms, 10000, 'clamped to seconds*1000 within the tolerance');
});

test('an answer arriving after the deadline closes the round instead of counting', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  s.now += 10251; s.msg(b, {t:'answer', q:0, answer:'late'});
  assert.equal(s.events().at(-1).t, 'reveal');
  assert.deepEqual(s.events().at(-1).answers, {});
});

test('timeup is refused before the deadline and accepted from 250 ms before it', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  const {deadline} = s.events().at(-1);
  s.now = deadline - 6000; s.msg(a, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'question'); assert.equal(s.last.retryAt, 0, 'far too early: no retry');
  s.now = deadline - 251; s.msg(a, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'question'); assert.equal(s.last.retryAt, deadline, 'nearly there: the room retries at the deadline');
  s.run({kind:'clock', phase:'question', q:0, now:deadline - 300});
  assert.equal(s.room.phase, 'question');
  s.now = deadline - 250; s.msg(b, {t:'timeup', q:1});
  assert.equal(s.room.phase, 'question', 'timeup for another round is ignored');
  s.msg(b, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(s.events().at(-1).answers, {});
  s.msg(a, {t:'timeup', q:0});
  assert.equal(types(s.events()).filter(t => t === 'reveal').length, 1);
});

test('the room clock retry closes the round at the deadline', () => {
  const s = sim();
  const a = s.hello('a'); s.hello('b');
  s.msg(a, START(3, 10));
  const {deadline} = s.events().at(-1);
  s.now = deadline - 1000; s.msg(a, {t:'timeup', q:0});
  s.run({kind:'clock', phase:'question', q:0, now:s.last.retryAt});
  assert.equal(s.room.phase, 'reveal');
});

test('a dropped player is waited for until the deadline; a player offline when the round opens is not', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'});
  s.msg(b, {t:'answer', q:0, answer:'y'});
  s.drop(c);
  assert.equal(s.room.phase, 'question', 'a short break does not cost the question');
  assert.deepEqual(s.lastOf(a, 'presence').online, ['a', 'b']);
  const c2 = s.hello('c', {have:s.events().at(-1).seq});
  s.msg(c2, {t:'answer', q:0, answer:'z'});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(Object.keys(s.events().at(-1).answers).sort(), ['a', 'b', 'c']);
  s.drop(c2);
  s.msg(a, {t:'ready', q:0}); s.msg(b, {t:'ready', q:0});
  assert.equal(s.room.round.q, 1, 'the offline player does not hold up the next question');
  s.msg(a, {t:'answer', q:1, answer:'x'}); s.msg(b, {t:'answer', q:1, answer:'y'});
  assert.equal(s.room.phase, 'reveal', 'c was offline when the round opened, so the round does not wait');
});

test('a player who returns during a round is waited for; without them the round ends at the deadline', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'}); s.drop(b);
  assert.equal(s.room.phase, 'question');
  s.now += 20000;
  s.msg(a, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(Object.keys(s.events().at(-1).answers), ['a']);
  s.msg(a, {t:'ready', q:0});
  assert.equal(s.room.round.q, 1);
  const b2 = s.hello('b', {have:0});
  s.msg(a, {t:'answer', q:1, answer:'x'});
  assert.equal(s.room.phase, 'question', 'b came back during the round');
  s.msg(b2, {t:'answer', q:1, answer:'y'});
  assert.equal(s.room.phase, 'reveal');
  s.drop(b2); s.drop(a);
  assert.equal(s.room.phase, 'reveal');
});

test('the next question opens when every online player is ready, re-checked on disconnect', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  s.msg(a, START());
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:'x'});
  s.msg(a, {t:'ready', q:0});
  s.msg(b, {t:'ready', q:1});
  assert.deepEqual(s.lastOf(c, 'progress'), {t:'progress', q:0, answered:['a', 'b', 'c'], voted:[], ready:['a']});
  s.msg(b, {t:'ready', q:0});
  assert.equal(s.room.phase, 'reveal');
  s.drop(c);
  assert.equal(s.room.phase, 'question');
  assert.equal(s.room.round.q, 1);
});

test('with nobody online a revealed round waits', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'});
  s.msg(b, {t:'answer', q:0, answer:'y'});
  s.drop(b);
  assert.equal(s.room.phase, 'reveal');
  s.drop(a);
  assert.equal(s.room.phase, 'reveal');
  const a2 = s.hello('a', {have:6});
  s.msg(a2, {t:'ready', q:0});
  assert.equal(s.room.phase, 'question');
});

test('force is refused until 250 ms before 20 s after the reveal and works from then', () => {
  assert.equal(REVEAL_SECONDS, 20); assert.equal(FORCE_AFTER, 20000);
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'}); s.msg(b, {t:'answer', q:0, answer:'y'});
  const revealed = s.now;
  s.msg(a, {t:'ready', q:0});
  s.now = revealed + 10000; s.msg(a, {t:'force', q:0});
  assert.equal(s.room.phase, 'reveal'); assert.equal(s.last.retryAt, 0, 'far too early: no retry');
  s.now = revealed + 19749; s.msg(a, {t:'force', q:0});
  assert.equal(s.room.phase, 'reveal');
  s.now = revealed + 19750; s.msg(a, {t:'force', q:1});
  assert.equal(s.room.phase, 'reveal', 'force names the revealed round');
  s.msg(a, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'reveal', 'timeup does not end a reveal');
  s.msg(a, {t:'force', q:0});
  assert.equal(s.room.phase, 'question');
  assert.equal(s.room.round.q, 1);
  s.msg(b, {t:'force', q:0});
  assert.equal(s.room.round.q, 1, 'a second force for the same reveal does nothing');
});

test('a force that comes slightly early gets one retry from the room at 20 s', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'}); s.msg(b, {t:'answer', q:0, answer:'y'});
  const due = s.now + FORCE_AFTER;
  s.now = due - 1000; s.msg(b, {t:'force', q:0});
  assert.equal(s.room.phase, 'reveal');
  assert.equal(s.last.retryAt, due);
  const w = s.writes;
  s.run({kind:'clock', phase:'question', q:0, now:due});
  assert.equal(s.room.phase, 'reveal', 'a retry for another phase does nothing');
  assert.equal(s.writes, w);
  s.run({kind:'clock', phase:'reveal', q:0, now:due});
  assert.equal(s.room.phase, 'question');
  assert.equal(s.room.round.q, 1);
  s.run({kind:'clock', phase:'reveal', q:0, now:due + 5});
  assert.equal(s.room.round.q, 1, 'a stale retry does nothing');
});

test('rejoining with have gets exactly the missing events; the old socket is replaced', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'});
  s.drop(b);
  const have = s.log(b).at(-1).seq;
  s.now += 500; s.msg(a, {t:'ready', q:0});
  s.now += 500; s.msg(a, {t:'answer', q:1, answer:'z'});
  const b2 = s.hello('b', {have});
  const welcome = s.lastOf(b2, 'welcome');
  assert.deepEqual(welcome.events, s.events().filter(e => e.seq > have));
  assert.deepEqual(welcome.events.map(e => e.seq), [have + 1, have + 2, have + 3].filter(n => n <= s.events().length));
  assert.equal(welcome.now, s.now);
  assert.deepEqual([...s.log(b), ...welcome.events], s.events());
  assert.deepEqual(s.lastOf(a, 'presence').online, ['a', 'b']);

  const b3 = s.hello('b', {have:s.events().length});
  assert.deepEqual(s.lastOf(b3, 'welcome').events, []);
  assert.deepEqual(s.closed[b2], {sid:b2, code:4000, reason:'replaced'});
  assert.equal(s.sockets.filter(x => x.id === 'b').length, 1);
});

test('a second socket keeps the ready flag of the one it replaces', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  s.msg(a, START());
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:'x'});
  s.msg(a, {t:'ready', q:0});
  s.hello('a', {have:9});
  s.msg(b, {t:'ready', q:0}); s.msg(c, {t:'ready', q:0});
  assert.equal(s.room.round.q, 1);
});

test('hello refusals: wrong key, version, started, full, name, unknown room, bad', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  const k = s.hello('a', {key:'x'.repeat(24)});
  assert.deepEqual(s.got(k), [{t:'error', code:'key'}]);
  assert.equal(s.closed[k].code, 4001);
  assert.ok(s.sockets.some(x => x.sid === a), 'the real player keeps the seat');

  const v1 = s.hello('c', {app:'0.9.0'});
  assert.deepEqual(s.got(v1), [{t:'error', code:'version', app:APP, pack:PACK}]);
  assert.equal(s.lastOf(s.hello('c', {pack:'old'}), 'error').code, 'version');
  assert.equal(s.lastOf(s.hello('c', {v:PROTOCOL + 1}), 'error').code, 'version');
  assert.equal(s.lastOf(s.hello('c', {name:'   '}), 'error').code, 'name');
  assert.equal(s.lastOf(s.hello('z', {have:12}), 'error').code, 'no-room', 'a phone from an earlier room with this code');

  const bad = s.open(); s.msg(bad, {t:'answer', q:0, answer:'x'});
  assert.deepEqual(s.got(bad), [{t:'error', code:'bad'}]);
  assert.ok(s.closed[bad]);
  s.msg(a, null);
  assert.deepEqual(s.lastOf(a, 'error'), {t:'error', code:'bad'});
  assert.ok(!s.closed[a], 'a malformed message from a player is not fatal');

  s.msg(a, START());
  const late = s.hello('d');
  assert.deepEqual(s.got(late), [{t:'error', code:'started'}]);
  assert.equal(s.room.players.length, 2);
  void b;

  const none = {sockets:[{sid:'x', id:null, ready:-1}]};
  const r = handle(null, none.sockets, {kind:'message', sid:'x', msg:{t:'hello', v:1, player:{id:'a', name:'A'}, key:KEY, app:APP, pack:PACK, have:0}, now:1});
  assert.deepEqual(r.send, [{to:'x', msg:{t:'error', code:'no-room'}}]);
  assert.equal(r.persist, false, 'a missing room never writes');
});

test('the 9th player is refused', () => {
  const s = sim();
  for (let i = 0; i < 8; i++) assert.equal(s.lastOf(s.hello(`p${i}`), 'welcome').you, `p${i}`);
  const ninth = s.hello('p8');
  assert.deepEqual(s.got(ninth), [{t:'error', code:'full'}]);
  s.msg(s.sockets[0].sid, {t:'leave'});
  assert.equal(s.lastOf(s.hello('p8'), 'welcome').you, 'p8', 'a seat frees when someone leaves');
});

test('start needs two players, the host, or any player while the host is offline', () => {
  const s = sim();
  const a = s.hello('a');
  s.msg(a, START());
  assert.equal(s.room.phase, 'lobby', 'one player cannot start');
  const b = s.hello('b');
  s.msg(b, START());
  assert.equal(s.room.phase, 'lobby', 'a non-host cannot start while the host is online');
  s.msg(a, {...START(), questions:QS(2)});
  assert.equal(s.room.phase, 'lobby');
  s.drop(a);
  s.msg(b, START(4, 15));
  assert.equal(s.room.phase, 'question');
  assert.deepEqual(s.events().at(-2), {seq:3, at:s.now, t:'started', settings:{count:4, seconds:15, title:'Test'}, questions:QS(4)});
  s.msg(b, START());
  assert.equal(types(s.events()).filter(t => t === 'started').length, 1);
});

test('the host passes on when the first player leaves the lobby', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  s.msg(a, {t:'leave'});
  assert.deepEqual(s.events().at(-1), {seq:4, at:s.now, t:'left', player:'a'});
  assert.equal(s.closed[a].code, 1000);
  s.msg(c, START());
  assert.equal(s.room.phase, 'lobby');
  s.msg(b, START());
  assert.equal(s.room.phase, 'question');
  assert.equal(s.lastOf(s.hello('a'), 'error').code, 'no-room', 'a player who left cannot come back');
});

test('leaving mid-round no longer holds up the round', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c');
  s.msg(a, START());
  s.msg(a, {t:'answer', q:0, answer:'x'}); s.msg(b, {t:'answer', q:0, answer:'y'});
  s.msg(c, {t:'leave'});
  assert.deepEqual(types(s.events()).slice(-2), ['left', 'reveal']);
  s.msg(c, {t:'ready', q:0});
  s.msg(a, {t:'ready', q:0}); s.msg(b, {t:'ready', q:0});
  assert.equal(s.room.round.q, 1);
});

test('everyone leaving finishes the game and wipes the room', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START());
  s.msg(a, {t:'leave'});
  assert.equal(s.room.phase, 'question');
  const log = s.events().slice();
  const r = s.msg(b, {t:'leave'});
  assert.equal(r.wipe, true);
  assert.equal(r.persist, false);
  assert.deepEqual(types(r.room.events.slice(log.length)), ['left', 'finished']);
  assert.equal(s.room, null);
});

test('leaving after the finish adds nothing to the log', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  for (let q = 0; q < 3; q++) { s.msg(a, {t:'answer', q, answer:'x'}); s.msg(b, {t:'answer', q, answer:'x'}); s.msg(a, {t:'ready', q}); s.msg(b, {t:'ready', q}); }
  const n = s.events().length;
  s.msg(a, {t:'leave'});
  assert.equal(s.events().length, n);
  assert.equal(s.msg(b, {t:'leave'}).wipe, true);
});

test('players can reconnect after the finish and get the log', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b');
  s.msg(a, START(3, 10));
  for (let q = 0; q < 3; q++) { s.msg(a, {t:'answer', q, answer:'x'}); s.msg(b, {t:'answer', q, answer:'x'}); s.msg(a, {t:'ready', q}); s.msg(b, {t:'ready', q}); }
  s.drop(b);
  const b2 = s.hello('b');
  assert.deepEqual(s.lastOf(b2, 'welcome').events, s.events());
  assert.deepEqual(s.lastOf(b2, 'welcome').progress, {q:null, answered:[], voted:[], ready:[]});
});

test('row writes: one per join, start, answer, advance and finish', () => {
  const s = sim();
  const ids = ['a', 'b', 'c', 'd'], sids = ids.map(id => s.hello(id));
  s.msg(sids[0], START(10, 20));
  for (let q = 0; q < 10; q++) {
    for (const sid of sids) s.msg(sid, {t:'answer', q, answer:'x'});
    for (const sid of sids) s.msg(sid, {t:'ready', q});
  }
  assert.equal(s.room.phase, 'finished');
  // creation 1 + joins 4 + start 1 + answers 40 (the last one also reveals) + 9 next questions + finish 1
  assert.equal(s.writes, 56);
});

test('cleanup alarm: 6 hours after creation, 30 minutes after the finish, re-armed while active', () => {
  const room = createRoom({code:'ABCD', app:APP, pack:PACK, now:0});
  assert.deepEqual(alarm(room, ROOM_TTL, 0), {wipe:true});
  assert.deepEqual(alarm({...room, active:ROOM_TTL - 600e3}, ROOM_TTL, 0), {alarm:ROOM_TTL - 600e3 + ACTIVE_WINDOW});
  assert.deepEqual(alarm(room, ROOM_TTL, ROOM_TTL - 1000), {alarm:ROOM_TTL - 1000 + ACTIVE_WINDOW}, 'activity seen only in memory counts');
  assert.deepEqual(alarm(room, ROOM_TTL - 1, ROOM_TTL - 2 * ACTIVE_WINDOW), {alarm:ROOM_TTL});
  const done = {...room, phase:'finished', finishedAt:1000};
  assert.deepEqual(alarm(done, 1000 + FINISHED_TTL), {wipe:true});
  assert.deepEqual(alarm(done, 2000), {alarm:1000 + FINISHED_TTL});
  assert.deepEqual(alarm(null, 0), {wipe:true});
});

test('room-core does not change the state it is given', () => {
  const s = sim();
  const a = s.hello('a'); s.hello('b');
  const before = structuredClone(s.room), sockets = structuredClone(s.sockets);
  handle(s.room, s.sockets, {kind:'message', sid:a, msg:START(), now:5000});
  assert.deepEqual(s.room, before);
  assert.deepEqual(s.sockets, sockets);
  assert.deepEqual(progressOf(s.room, s.sockets), {q:null, answered:[], voted:[], ready:[]});
});

// Open questions: explain-why, decided by the players' vote.
const MODED = (modes, seconds = 20) => ({t:'start', settings:{count:modes.length, seconds, title:'Test'}, questions:modes.map((mode, i) => ({id:`core:q${i}`, mode}))});
// Three players in a game whose first question is open; everyone answers.
function openRound(players = ['a', 'b', 'c'], modes = ['open', 'recall', 'recognition']) {
  const s = sim();
  const sids = Object.fromEntries(players.map(id => [id, s.hello(id)]));
  s.msg(sids[players[0]], MODED(modes));
  return {s, ...sids};
}

test('an open question lasts 60 s whatever the host chose, then goes to a 30 s vote with everyone\'s answers', () => {
  assert.equal(OPEN_SECONDS, 60); assert.equal(VOTE_SECONDS, 30);
  const {s, a, b, c} = openRound();
  const question = s.events().at(-1);
  assert.equal(question.deadline, question.at + 60000);
  s.now += 1000; s.msg(a, {t:'answer', q:0, answer:'Fordi A'});
  s.now += 1000; s.msg(b, {t:'answer', q:0, answer:'x'.repeat(400)});
  assert.ok(!JSON.stringify(s.got(c)).includes('Fordi A'), 'answers stay hidden while the question is open');
  s.now += 1000; s.msg(c, {t:'answer', q:0, answer:'Fordi C'});
  const ballot = s.events().at(-1);
  assert.equal(s.room.phase, 'vote');
  assert.deepEqual(ballot, {seq:ballot.seq, at:s.now, t:'ballot', q:0, deadline:s.now + 30000,
    answers:{a:{answer:'Fordi A', ms:1000}, b:{answer:'x'.repeat(400), ms:2000}, c:{answer:'Fordi C', ms:3000}}});
  assert.deepEqual(s.lastOf(a, 'progress'), {t:'progress', q:0, answered:['a', 'b', 'c'], voted:[], ready:[]});
  s.msg(a, {t:'vote', q:0, for:'b'});
  assert.deepEqual(s.lastOf(c, 'progress'), {t:'progress', q:0, answered:['a', 'b', 'c'], voted:['a'], ready:[]});
  assert.ok(!s.got(c).some(m => m.t === 'event' && m.event.seq > ballot.seq), 'votes stay hidden until the reveal');
  assert.ok(!JSON.stringify(s.got(c).filter(m => m.t === 'progress')).includes('"for"'));
  s.msg(b, {t:'vote', q:0, for:'a'});
  s.msg(c, {t:'vote', q:0, for:'b'});
  const reveal = s.events().at(-1);
  assert.equal(reveal.t, 'reveal');
  assert.deepEqual(reveal.votes, {a:'b', b:'a', c:'b'});
  assert.deepEqual(reveal.answers, ballot.answers);
  assert.equal(s.room.phase, 'reveal');
  // The next, normal question has the host's length, no vote and no votes in its reveal.
  for (const sid of [a, b, c]) s.msg(sid, {t:'ready', q:0});
  assert.equal(s.events().at(-1).deadline, s.events().at(-1).at + 20000);
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:1, answer:'y'});
  assert.equal(s.events().at(-1).t, 'reveal');
  assert.equal('votes' in s.events().at(-1), false);
  assert.ok(!types(s.events()).slice(-3).includes('ballot'), 'the vote phase is only for open questions');
});

test('an answer over 200 characters counts only on an open question', () => {
  const {s, a, b} = openRound(['a', 'b'], ['recall', 'open', 'recall']);
  const w = s.writes;
  s.msg(a, {t:'answer', q:0, answer:'x'.repeat(201)});
  assert.equal(s.writes, w, 'refused without a write');
  assert.deepEqual(s.room.round.answers, {});
  s.msg(a, {t:'answer', q:0, answer:'x'.repeat(200)}); s.msg(b, {t:'answer', q:0, answer:'y'});
  for (const sid of [a, b]) s.msg(sid, {t:'ready', q:0});
  s.msg(a, {t:'answer', q:1, answer:'x'.repeat(400)});
  assert.equal(s.room.round.answers.a.answer.length, 400);
});

test('votes are refused for yourself, for a player without an answer, twice, outside the vote and for another round', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c'), d = s.hello('d');
  s.msg(a, MODED(['open', 'recall', 'recall']));
  s.msg(a, {t:'vote', q:0, for:'b'});
  assert.equal(s.room.phase, 'question', 'no vote while the question is open');
  s.msg(a, {t:'answer', q:0, answer:'A'}); s.msg(b, {t:'answer', q:0, answer:'B'}); s.msg(c, {t:'answer', q:0, answer:'C'});
  s.now += 60000; s.msg(d, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'vote');
  assert.deepEqual(Object.keys(s.events().at(-1).answers), ['a', 'b', 'c'], 'd did not answer');
  const w = s.writes;
  for (const [sid, msg] of [[a, {t:'vote', q:0, for:'a'}], [a, {t:'vote', q:0, for:'d'}], [a, {t:'vote', q:0, for:'zz'}], [a, {t:'vote', q:1, for:'b'}]]) s.msg(sid, msg);
  assert.equal(s.writes, w, 'refused votes cost no write');
  assert.deepEqual(s.room.round.votes, {});
  s.msg(a, {t:'vote', q:0, for:'b'});
  s.msg(a, {t:'vote', q:0, for:'c'});
  assert.deepEqual(s.room.round.votes, {a:'b'}, 'one vote, final');
  assert.equal(s.writes, w + 1);
  s.msg(d, {t:'vote', q:0, for:'c'});
  assert.deepEqual(s.room.round.votes, {a:'b', d:'c'}, 'a player who did not answer still votes');
  s.msg(b, {t:'vote', q:0, for:'a'}); s.msg(c, {t:'vote', q:0, for:'a'});
  assert.equal(s.room.phase, 'reveal');
  s.msg(c, {t:'vote', q:0, for:'b'});
  assert.deepEqual(s.events().at(-1).votes, {a:'b', d:'c', b:'a', c:'a'}, 'no votes after the reveal');
});

test('an open question with one answer or none skips the vote', () => {
  const one = openRound();
  one.s.msg(one.a, {t:'answer', q:0, answer:'Bare jeg'});
  one.s.now += 60000; one.s.msg(one.b, {t:'timeup', q:0});
  assert.deepEqual(types(one.s.events()).slice(-2), ['question', 'reveal']);
  assert.deepEqual(one.s.events().at(-1).votes, {});
  assert.deepEqual(Object.keys(one.s.events().at(-1).answers), ['a']);

  const none = openRound();
  none.s.now += 59750; none.s.msg(none.b, {t:'timeup', q:0});
  assert.deepEqual(types(none.s.events()).slice(-2), ['question', 'reveal']);
  assert.deepEqual(none.s.events().at(-1), {seq:none.s.events().at(-1).seq, at:none.s.now, t:'reveal', q:0, answers:{}, votes:{}});
});

test('timeup closes the vote from 250 ms before its deadline, with a retry for one that comes slightly early', () => {
  const {s, a, b, c} = openRound();
  for (const sid of [a, b]) s.msg(sid, {t:'answer', q:0, answer:`svar ${sid}`});
  s.now += 60000; s.msg(c, {t:'timeup', q:0});
  const {deadline} = s.events().at(-1);
  s.msg(a, {t:'vote', q:0, for:'b'});
  s.now = deadline - 6000; s.msg(c, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'vote'); assert.equal(s.last.retryAt, 0);
  s.now = deadline - 251; s.msg(c, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'vote'); assert.equal(s.last.retryAt, deadline);
  s.run({kind:'clock', phase:'vote', q:0, now:deadline});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(s.events().at(-1).votes, {a:'b'}, 'b and c did not vote; the clock closed it');
});

test('a vote arriving after the deadline closes the vote instead of counting', () => {
  const {s, a, b, c} = openRound();
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:`svar ${sid}`});
  const {deadline} = s.events().at(-1);
  s.now = deadline + 251; s.msg(a, {t:'vote', q:0, for:'b'});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(s.events().at(-1).votes, {});
});

test('a voter who drops keeps the vote and is waited for; one who returns during the vote is added', () => {
  const {s, a, b, c} = openRound();
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:`svar ${sid}`});
  s.msg(a, {t:'vote', q:0, for:'b'});
  s.drop(a);
  s.msg(b, {t:'vote', q:0, for:'a'});
  assert.equal(s.room.phase, 'vote');
  s.drop(c);
  assert.equal(s.room.phase, 'vote', 'c dropped before voting and is still waited for');
  const a2 = s.hello('a', {have:s.events().at(-1).seq});
  assert.deepEqual(s.lastOf(a2, 'welcome').progress, {q:0, answered:['a', 'b', 'c'], voted:['a', 'b'], ready:[]});
  const c2 = s.hello('c', {have:s.events().at(-1).seq});
  s.msg(c2, {t:'vote', q:0, for:'a'});
  assert.deepEqual(s.events().at(-1).votes, {a:'b', b:'a', c:'a'}, 'the vote cast before the drop counts');
});

test('the vote waits for players online when it opens and players who return, not for players who left', () => {
  const s = sim();
  const a = s.hello('a'), b = s.hello('b'), c = s.hello('c'), d = s.hello('d');
  s.msg(a, MODED(['open', 'recall', 'recall']));
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:`svar ${sid}`});
  s.drop(d);
  s.now += 60000; s.msg(a, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'vote');
  assert.deepEqual(s.room.round.waitFor, ['a', 'b', 'c'], 'd was offline when the vote opened');
  s.msg(a, {t:'vote', q:0, for:'b'}); s.msg(b, {t:'vote', q:0, for:'c'});
  const d2 = s.hello('d', {have:s.events().at(-1).seq});
  s.msg(c, {t:'leave'});
  assert.equal(s.room.phase, 'vote', 'd came back and is waited for; c left and is not');
  s.msg(d2, {t:'vote', q:0, for:'c'});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(s.events().at(-1).votes, {a:'b', b:'c', d:'c'}, 'a left player\'s answer keeps its votes');
});

test('with nobody online the vote waits for its deadline instead of closing empty', () => {
  const {s, a, b, c} = openRound();
  for (const sid of [a, b, c]) s.msg(sid, {t:'answer', q:0, answer:`svar ${sid}`});
  for (const sid of [a, b, c]) s.drop(sid);
  assert.equal(s.room.phase, 'vote');
  const {deadline} = s.events().at(-1);
  const a2 = s.hello('a', {have:s.events().at(-1).seq});
  s.now = deadline; s.msg(a2, {t:'timeup', q:0});
  assert.equal(s.room.phase, 'reveal');
  assert.deepEqual(s.events().at(-1).votes, {});
});

test('row writes with open questions: one per answer and per vote; the last of each also writes the ballot or reveal', () => {
  const s = sim();
  const ids = ['a', 'b', 'c', 'd'], sids = ids.map(id => s.hello(id));
  const modes = ['recognition', 'recall', 'open', 'recognition', 'recall', 'recognition', 'open', 'recall', 'recognition', 'recall'];
  s.msg(sids[0], MODED(modes));
  for (let q = 0; q < 10; q++) {
    for (const sid of sids) s.msg(sid, {t:'answer', q, answer:'x'});
    if (modes[q] === 'open') sids.forEach((sid, i) => s.msg(sid, {t:'vote', q, for:ids[(i + 1) % 4]}));
    // The reveal moves on by itself: one force, or every player's "Neste"; both cost the one write of the next question.
    if (q % 2) { s.now += FORCE_AFTER; s.msg(sids[1], {t:'force', q}); }
    else for (const sid of sids) s.msg(sid, {t:'ready', q});
  }
  assert.equal(s.room.phase, 'finished');
  assert.equal(types(s.events()).filter(t => t === 'ballot').length, 2);
  // creation 1 + joins 4 + start 1 + answers 40 + votes 8 + 9 next questions + finish 1
  assert.equal(s.writes, 64);
});
