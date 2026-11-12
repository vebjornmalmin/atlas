import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoom, handle} from '../worker/room-core.js';
import {parseMessage, makeRoomCode} from '../src/lib/quizoff/protocol.js';
import {createQuizoffClient, STORAGE_KEY} from '../src/lib/quizoff/client.js';
import {replay, scoreboard, BASE_POINTS, SPEED_POINTS} from '../src/lib/quizoff/game.js';
import {quizoffPool, pickQuestions, buildQuestion, gradeQuizoff} from '../src/lib/quizoff/questions.js';
import {knownNameSet} from '../src/lib/progression.js';

const pack = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const byId = new Map(pack.targets.map(t => [t.id, t]));
const known = knownNameSet(pack);
const APP = '1.11.0';

// The room as the Durable Object runs it: room-core decides, this delivers. Sockets are plain objects.
function server() {
  const s = {rooms:new Map(), now:1_000_000, sockets:new Map(), n:0};
  const run = (code, input) => {
    const live = [...s.sockets.values()].filter(x => x.code === code && !x.closed);
    const r = handle(s.rooms.get(code) ?? null, live.map(x => ({sid:x.sid, id:x.id, ready:x.ready})), {now:s.now, ...input});
    if (r.wipe) s.rooms.delete(code); else if (r.room) s.rooms.set(code, r.room);
    for (const x of r.sockets) Object.assign(s.sockets.get(x.sid), {id:x.id, ready:x.ready});
    for (const {to, msg} of r.send) s.sockets.get(to)?.deliver(JSON.stringify(msg));
    for (const {sid, code:closeCode} of r.close) { const x = s.sockets.get(sid); if (x && !x.closed) { x.closed = true; x.hangUp(closeCode); } }
  };
  s.fetch = async (url, init) => {
    const body = JSON.parse(init.body), code = makeRoomCode(() => 0.37);
    s.rooms.set(code, createRoom({code, app:body.app, pack:body.pack, now:s.now}));
    return {status:201, ok:true, json:async () => ({code})};
  };
  // What the browser hands the client: a socket whose other end is the room.
  s.WebSocket = class {
    constructor(url) {
      this.readyState = 0;
      const code = url.match(/rooms\/([^/]+)\/ws$/)[1], sid = `s${++s.n}`;
      const end = {sid, code, id:null, ready:-1, closed:false,
        deliver:data => queueMicrotask(() => { if (this.readyState === 1) this.onmessage?.({data}); }),
        hangUp:code => queueMicrotask(() => { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({code}); })};
      this.end = end;
      s.sockets.set(sid, end);
      queueMicrotask(() => { if (this.readyState !== 0) return; this.readyState = 1; this.onopen?.(); });
    }
    send(data) {
      if (this.end.closed) return;
      if (data === 'ping') return this.end.deliver('pong');
      run(this.end.code, {kind:'message', sid:this.end.sid, msg:parseMessage(data)});
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      if (!this.end.closed) { this.end.closed = true; run(this.end.code, {kind:'close', sid:this.end.sid}); }
    }
  };
  // The network drops under a phone: the room sees the socket close, the phone sees it too.
  s.cut = client => { const end = [...s.sockets.values()].find(x => x.id === client.snapshot().you && !x.closed); end.closed = true; run(end.code, {kind:'close', sid:end.sid}); end.hangUp(1006); };
  return s;
}

const memory = () => { const m = new Map(); return {getItem:k => m.get(k) ?? null, setItem:(k, v) => m.set(k, String(v)), removeItem:k => m.delete(k)}; };
const grade = (question, answer) => gradeQuizoff(question, byId, answer, known);
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };

function phone(s, storage = memory()) {
  const client = createQuizoffClient({origin:'https://atlas.test', app:APP, pack:pack.version, storage, WebSocketImpl:s.WebSocket, fetchImpl:s.fetch,
    reduce:(room, you, events) => replay(room, you, events, grade), now:() => s.now});
  client.storage = storage;
  return client;
}
const right = entry => entry.mode === 'recognition' ? entry.id : String(byId.get(entry.id).answer);
const wrong = entry => entry.mode === 'recognition' ? buildQuestion(entry, byId, pack.targets).options.find(o => o.id !== entry.id).id : 'helt feil svar';
const shared = client => { const {you, ...game} = client.snapshot().game; return game; };

test('Three phones play a whole quiz-off through the room and end with the same game', async t => {
  const s = server();
  const questions = pickQuestions(quizoffPool(pack.targets), {count:3, seed:'integration'});
  assert.equal(questions.length, 3);
  const anna = phone(s), bjorn = phone(s), cecilie = phone(s);
  t.after(() => [anna, bjorn, cecilie].forEach(c => c.destroy()));

  await anna.create('Anna');
  const code = anna.snapshot().room.code;
  await bjorn.join(code.toLowerCase(), 'Bjørn');
  await cecilie.join(code, 'Cecilie');
  await settle();
  assert.deepEqual(anna.snapshot().game.players.map(p => p.name), ['Anna', 'Bjørn', 'Cecilie']);
  assert.equal(anna.snapshot().game.host, anna.snapshot().you);

  assert.equal(bjorn.start({count:3, seconds:20, title:'Blandet'}, questions), true);
  await settle();
  assert.equal(anna.snapshot().game.phase, 'lobby', 'only the host starts the game');
  anna.start({count:3, seconds:20, title:'Blandet'}, questions);
  await settle();
  for (const c of [anna, bjorn, cecilie]) assert.equal(c.snapshot().game.phase, 'question');

  // Question 0: Anna right after 5 s, Bjørn wrong, Cecilie right after 10 s. Nobody sees an answer early.
  s.now += 5000; anna.answer(0, right(questions[0])); bjorn.answer(0, wrong(questions[0]));
  await settle();
  assert.equal(cecilie.snapshot().game.phase, 'question');
  assert.deepEqual(cecilie.snapshot().progress.answered.length, 2);
  assert.ok(!cecilie.snapshot().events.some(e => e.t === 'reveal'), 'answers are held back until the round closes');
  s.now += 5000; cecilie.answer(0, right(questions[0]));
  await settle();
  for (const c of [anna, bjorn, cecilie]) assert.equal(c.snapshot().game.phase, 'reveal');
  const you = c => c.snapshot().you;
  assert.equal(anna.snapshot().game.scores[you(anna)].points, BASE_POINTS + Math.round(SPEED_POINTS * 0.75));
  assert.equal(anna.snapshot().game.scores[you(bjorn)].points, 0);
  assert.equal(anna.snapshot().game.scores[you(cecilie)].points, BASE_POINTS + Math.round(SPEED_POINTS * 0.5));
  for (const c of [anna, bjorn, cecilie]) c.ready(0);
  await settle();

  // Question 1: Bjørn's network drops after the others answered. The round waits; he reconnects and answers.
  anna.answer(1, right(questions[1])); cecilie.answer(1, wrong(questions[1]));
  await settle();
  s.cut(bjorn);
  await settle();
  assert.equal(bjorn.snapshot().status, 'reconnecting');
  assert.equal(anna.snapshot().game.phase, 'question');
  bjorn.reconnect();
  await settle();
  assert.equal(bjorn.snapshot().status, 'online');
  s.now += 2000; bjorn.answer(1, right(questions[1]));
  await settle();
  for (const c of [anna, bjorn, cecilie]) assert.equal(c.snapshot().game.phase, 'reveal');
  for (const c of [anna, bjorn, cecilie]) c.ready(1);
  await settle();

  // Question 2: Cecilie answers while offline; the answer is sent when she is back. Anna never answers: the clock ends the round.
  s.cut(cecilie);
  await settle();
  cecilie.answer(2, right(questions[2]));
  bjorn.answer(2, right(questions[2]));
  await settle();
  cecilie.reconnect();
  await settle();
  assert.equal(anna.snapshot().game.phase, 'question', 'Anna has not answered');
  assert.equal(bjorn.timeup(2), true);
  await settle();
  assert.equal(anna.snapshot().game.phase, 'question', 'the room keeps its own clock');
  s.now += 20000; bjorn.timeup(2);
  await settle();
  for (const c of [anna, bjorn, cecilie]) assert.equal(c.snapshot().game.phase, 'reveal');
  assert.deepEqual(Object.keys(anna.snapshot().game.rounds[2].answers).sort(), [you(bjorn), you(cecilie)].sort());
  for (const c of [anna, bjorn, cecilie]) c.ready(2);
  await settle();

  for (const c of [anna, bjorn, cecilie]) assert.equal(c.snapshot().game.phase, 'finished');
  assert.deepEqual(shared(bjorn), shared(anna));
  assert.deepEqual(shared(cecilie), shared(anna));
  assert.deepEqual(scoreboard(bjorn.snapshot().game), scoreboard(anna.snapshot().game));
  assert.deepEqual(bjorn.snapshot().events, anna.snapshot().events);
  assert.deepEqual(anna.snapshot().events.map(e => e.seq), anna.snapshot().events.map((_, i) => i + 1));

  // The app is closed and opened again: a new client on the same storage is back in the same game.
  bjorn.destroy();
  const reopened = phone(s, bjorn.storage);
  t.after(() => reopened.destroy());
  assert.equal(reopened.resume(), true);
  assert.deepEqual(shared(reopened), shared(anna), 'the saved log alone gives the whole game');
  await settle();
  assert.equal(reopened.snapshot().status, 'online');
  assert.deepEqual(reopened.snapshot().events, anna.snapshot().events);

  // Everyone leaves: the room is gone and the phones have forgotten the game.
  for (const c of [anna, reopened, cecilie]) c.leave();
  await settle();
  assert.equal(s.rooms.size, 0);
  assert.equal(anna.storage.getItem(STORAGE_KEY), null);
});

test('A phone with another app or pack version is refused, and so is a late joiner', async t => {
  const s = server();
  const anna = phone(s), bjorn = phone(s), late = phone(s);
  const old = createQuizoffClient({origin:'https://atlas.test', app:'1.10.0', pack:pack.version, storage:memory(), WebSocketImpl:s.WebSocket, fetchImpl:s.fetch, reduce:() => null, now:() => s.now});
  t.after(() => [anna, bjorn, late, old].forEach(c => c.destroy()));
  await anna.create('Anna');
  const code = anna.snapshot().room.code;
  await assert.rejects(old.join(code, 'Gammel'), error => error.code === 'version' && error.app === APP);
  await bjorn.join(code, 'Bjørn');
  anna.start({count:3, seconds:20, title:''}, pickQuestions(quizoffPool(pack.targets), {count:3, seed:'late'}));
  await settle();
  await assert.rejects(late.join(code, 'Sen'), error => error.code === 'started');
  await assert.rejects(late.join('ZZZZ', 'Sen'), error => error.code === 'no-room');
});

test('Three phones play a game with explain-why rounds decided by a vote and end with the same game', async t => {
  const s = server();
  const one = mode => quizoffPool(pack.targets, {modes:[mode]});
  const pickOpen = one('open');
  const questions = [one('recognition')[0], pickOpen[0], one('recall')[3], pickOpen[1], one('recognition')[5]]
    .map(target => ({id:target.id, mode:target.answerFormat === 'explanation' ? 'open' : target.mode}));
  assert.deepEqual(questions.map(q => q.mode), ['recognition', 'open', 'recall', 'open', 'recognition']);
  const anna = phone(s), bjorn = phone(s), cecilie = phone(s);
  t.after(() => [anna, bjorn, cecilie].forEach(c => c.destroy()));
  await anna.create('Anna');
  const code = anna.snapshot().room.code;
  await bjorn.join(code, 'Bjørn');
  await cecilie.join(code, 'Cecilie');
  await settle();
  anna.start({count:5, seconds:15, title:'Blandet'}, questions);
  await settle();
  const all = [anna, bjorn, cecilie], id = c => c.snapshot().you, phases = list => list.map(c => c.snapshot().game.phase);

  // Round 0: everyone right; nobody taps "Neste"; the reveal moves on when a phone says 20 s have passed.
  for (const c of all) c.answer(0, right(questions[0]));
  await settle();
  assert.deepEqual(phases(all), ['reveal', 'reveal', 'reveal']);
  s.now += 19000; bjorn.force(0);
  await settle();
  assert.deepEqual(phases(all), ['reveal', 'reveal', 'reveal'], 'too early');
  s.now += 1000; bjorn.force(0);
  await settle();
  assert.deepEqual(phases(all), ['question', 'question', 'question']);

  // Round 1, open: 60 s whatever the host chose. Cecilie does not answer; the clock closes the question.
  const q1 = anna.snapshot().events.at(-1);
  assert.equal(q1.deadline - q1.at, 60000);
  s.now += 5000; anna.answer(1, 'Fordi jordbruket ga faste gårder.');
  s.now += 5000; bjorn.answer(1, 'Folk slo seg ned.');
  await settle();
  assert.equal(anna.snapshot().game.phase, 'question');
  s.now += 15000; anna.timeup(1);
  await settle();
  assert.equal(anna.snapshot().game.phase, 'question', 'not 15 s: the open question has 60 s');
  s.now += 35000; anna.timeup(1);
  await settle();
  assert.deepEqual(phases(all), ['vote', 'vote', 'vote']);
  assert.deepEqual(bjorn.snapshot().game.ballot, anna.snapshot().game.ballot, 'the same ballot and order on every phone');
  assert.deepEqual([...anna.snapshot().game.ballot.order].sort(), [id(anna), id(bjorn)].sort());
  assert.equal(anna.vote(1, id(anna)), false, 'not for your own answer');
  // Cecilie votes while her network is down; Anna and Bjørn vote for each other. The vote waits for Cecilie.
  s.cut(cecilie);
  await settle();
  assert.equal(cecilie.vote(1, id(anna)), true);
  anna.vote(1, id(bjorn)); bjorn.vote(1, id(anna));
  await settle();
  assert.equal(anna.snapshot().game.phase, 'vote');
  assert.deepEqual([...anna.snapshot().progress.voted].sort(), [id(anna), id(bjorn)].sort());
  assert.ok(!anna.snapshot().events.some(e => e.t === 'reveal' && e.q === 1), 'votes stay hidden until the reveal');
  cecilie.reconnect();
  await settle();
  assert.deepEqual(phases(all), ['reveal', 'reveal', 'reveal'], 'her saved vote was sent after the reconnect and closed the vote');
  const r1 = anna.snapshot().game.rounds.find(r => r.q === 1);
  assert.deepEqual([r1.answers[id(anna)].votes, r1.answers[id(anna)].correct, r1.answers[id(anna)].points], [2, true, 150]);
  assert.deepEqual([r1.answers[id(bjorn)].votes, r1.answers[id(bjorn)].correct, r1.answers[id(bjorn)].points], [1, false, 0]);
  for (const c of all) c.ready(1);
  await settle();

  // Round 2, normal.
  anna.answer(2, right(questions[2])); bjorn.answer(2, wrong(questions[2])); cecilie.answer(2, wrong(questions[2]));
  await settle();
  for (const c of all) c.ready(2);
  await settle();

  // Round 3, open: everyone answers; Anna and Bjørn vote for each other and Cecilie never votes: the clock closes a tie.
  for (const c of all) c.answer(3, `Forklaringen til ${c.snapshot().name}`);
  await settle();
  assert.deepEqual(phases(all), ['vote', 'vote', 'vote']);
  anna.vote(3, id(bjorn)); bjorn.vote(3, id(anna));
  await settle();
  // Bjørn closes the app mid-vote and opens it again: same vote screen, his vote kept.
  bjorn.destroy();
  const reopened = phone(s, bjorn.storage);
  t.after(() => reopened.destroy());
  assert.equal(reopened.resume(), true);
  await settle();
  assert.equal(reopened.snapshot().game.phase, 'vote');
  assert.deepEqual(reopened.snapshot().myVotes, {1:id(anna), 3:id(anna)});
  const players = [anna, reopened, cecilie];
  s.now += 29000; reopened.timeup(3);
  await settle();
  assert.equal(anna.snapshot().game.phase, 'vote');
  s.now += 1000; reopened.timeup(3);
  await settle();
  assert.deepEqual(phases(players), ['reveal', 'reveal', 'reveal']);
  const r3 = anna.snapshot().game.rounds.find(r => r.q === 3);
  assert.deepEqual(Object.fromEntries(Object.entries(r3.answers).map(([k, v]) => [k, [v.votes, v.correct, v.points]])),
    {[id(anna)]:[1, true, 150], [id(reopened)]:[1, true, 150], [id(cecilie)]:[0, false, 0]});
  s.now += 20000; cecilie.force(3);
  await settle();

  // Round 4, normal, then the result after the last automatic move-on.
  for (const c of players) c.answer(4, right(questions[4]));
  await settle();
  s.now += 20000; anna.force(4);
  await settle();
  assert.deepEqual(phases(players), ['finished', 'finished', 'finished']);
  assert.deepEqual(shared(reopened), shared(anna));
  assert.deepEqual(shared(cecilie), shared(anna));
  assert.deepEqual(reopened.snapshot().events, anna.snapshot().events);
  assert.deepEqual(anna.snapshot().events.map(e => e.seq), anna.snapshot().events.map((_, i) => i + 1));
  assert.deepEqual(anna.snapshot().events.filter(e => e.t === 'ballot').map(e => e.q), [1, 3]);
  const board = scoreboard(anna.snapshot().game);
  assert.equal(board.find(r => r.id === id(anna)).correct, 5, 'open wins count as right');
  assert.equal(board[0].id, id(anna));
});
