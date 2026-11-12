// End-to-end check of a running quiz-off Worker: node scripts/quizoff-smoke.mjs [base-url]
// Two bots play a 4-question game; one drops its socket mid-game and rejoins with `have`. The last question is open: both
// answer, vote for each other and tie. Its reveal moves on by itself: one bot says so a second early and the room's
// retry does the rest. Both must end with the same log.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PROTOCOL, FORCE_AFTER, TIMEUP_TOLERANCE} from '../src/lib/quizoff/protocol.js';

const base = (process.argv[2] || 'http://127.0.0.1:8799').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws');
const APP = 'smoke', PACK = 'smoke-pack';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('·', ...a);

async function waitFor(check, what, ms = 15000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

function bot(name, code) {
  const b = {name, id:randomUUID(), key:randomUUID() + randomUUID(), events:[], answered:new Set(), voted:new Set(), readied:new Set(), welcomes:0, errors:[], ws:null, paused:false, dropAt:null, waitOn:null, forceOn:null};
  b.seq = () => b.events.at(-1)?.seq ?? 0;
  b.send = msg => b.ws.send(JSON.stringify(msg));
  b.connect = () => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/api/quizoff/rooms/${code}/ws`);
    b.ws = ws;
    ws.onopen = () => { b.send({t:'hello', v:PROTOCOL, player:{id:b.id, name}, key:b.key, app:APP, pack:PACK, have:b.seq()}); };
    ws.onerror = () => reject(new Error(`${name}: socket error`));
    ws.onmessage = ({data}) => {
      if (data === 'pong') { b.pong = true; return; }
      const m = JSON.parse(data);
      if (m.t === 'welcome') { b.welcomes++; b.add(m.events); resolve(); }
      else if (m.t === 'event') b.add([m.event]);
      else if (m.t === 'error') b.errors.push(m);
    };
  });
  b.add = events => {
    for (const e of events) {
      if (e.seq <= b.seq()) continue;
      assert.equal(e.seq, b.seq() + 1, `${name}: gap before seq ${e.seq}`);
      b.events.push(e);
    }
    b.act();
  };
  // Plays from the tail of the log: answer an open question, vote on a ballot, then read the reveal.
  b.act = () => {
    const e = b.events.at(-1);
    if (!e || b.paused || b.ws.readyState !== WebSocket.OPEN) return;
    if (e.t === 'question' && !b.answered.has(e.q)) {
      if (b.dropAt === e.q) { b.dropAt = null; b.paused = true; b.ws.close(); log(`${name} drops its socket at question ${e.q}`); return; }
      b.answered.add(e.q);
      setTimeout(() => b.send({t:'answer', q:e.q, answer:`${name}-${e.q}`}), 30 + Math.random() * 50);
      // Like a phone's countdown: if the round is still open at the deadline, say so.
      setTimeout(() => { if (b.events.at(-1) === e && b.ws.readyState === WebSocket.OPEN) b.send({t:'timeup', q:e.q}); }, Math.max(0, e.deadline - e.at) + 300);
    }
    if (e.t === 'ballot' && !b.voted.has(e.q)) {
      b.voted.add(e.q);
      const other = Object.keys(e.answers).find(id => id !== b.id);
      setTimeout(() => b.send({t:'vote', q:e.q, for:other}), 30 + Math.random() * 50);
      setTimeout(() => { if (b.events.at(-1) === e && b.ws.readyState === WebSocket.OPEN) b.send({t:'timeup', q:e.q}); }, Math.max(0, e.deadline - e.at) + 300);
    }
    if (e.t === 'reveal' && !b.readied.has(e.q)) {
      b.readied.add(e.q);
      // waitOn: tap nothing and let the reveal move on by itself. forceOn: say so one second before the 20 s are up.
      if (b.forceOn === e.q) setTimeout(() => b.send({t:'force', q:e.q}), FORCE_AFTER - 1000);
      else if (b.waitOn !== e.q) setTimeout(() => b.send({t:'ready', q:e.q}), 30 + Math.random() * 50);
    }
  };
  return b;
}

async function main() {
  const asset = await fetch(`${base}/version.json`).catch(() => null) ?? null;
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200, 'the app page is served');
  assert.match(await page.text(), /<html/i);
  log('static page served', asset ? `(version.json ${asset.status})` : '');

  const missing = await fetch(`${base}/api/nothing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'not-found');
  assert.equal((await fetch(`${base}/api/quizoff/rooms`)).status, 405);
  assert.equal((await fetch(`${base}/api/quizoff/rooms`, {method:'POST', body:'{}'})).status, 400);

  const res = await fetch(`${base}/api/quizoff/rooms`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({app:APP, pack:PACK})});
  assert.equal(res.status, 201);
  const {code} = await res.json();
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  log('room', code);

  // Unknown room and wrong version are refused over the socket.
  const refused = async (path, hello) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}${path}`);
    let error = null;
    ws.onopen = () => hello && ws.send(JSON.stringify(hello));
    ws.onmessage = ({data}) => { error = JSON.parse(data); };
    ws.onclose = ({code}) => resolve({error, code});
    ws.onerror = () => {};
    setTimeout(() => reject(new Error('no refusal')), 5000);
  });
  const helloOf = (app, have = 0) => ({t:'hello', v:PROTOCOL, player:{id:randomUUID(), name:'X'}, key:randomUUID(), app, pack:PACK, have});
  const old = await refused(`/api/quizoff/rooms/${code}/ws`, helloOf('old'));
  assert.deepEqual([old.error, old.code], [{t:'error', code:'version', app:APP, pack:PACK}, 4001]);
  const gone = await refused('/api/quizoff/rooms/ZZZQ/ws', helloOf(APP));
  assert.equal(gone.error.code, 'no-room');
  const junk = await refused('/api/quizoff/rooms/12/ws');
  assert.equal(junk.error.code, 'no-room');
  log('refusals: version, no-room, bad code');

  const ola = bot('Ola', code), kari = bot('Kari', code);
  await ola.connect();
  await kari.connect();
  await waitFor(() => ola.events.length === 2 && kari.events.length === 2, 'both joins');

  ola.pong = false;
  ola.ws.send('ping');
  await waitFor(() => ola.pong, 'pong');
  log('ping answered with pong');

  kari.dropAt = 1;
  ola.forceOn = kari.waitOn = ola.waitOn = 3;
  ola.send({t:'start', settings:{count:4, seconds:10, title:'Smoke'}, questions:[{id:'core:a', mode:'recognition'}, {id:'core:b', mode:'recall'}, {id:'core:c', mode:'recall'}, {id:'core:d', mode:'open'}]});

  // Kari is away for question 1; Ola alone closes it and moves on to question 2.
  await waitFor(() => kari.paused, 'Kari dropping');
  await waitFor(() => ola.events.some(e => e.t === 'question' && e.q === 2), 'question 2 without Kari');
  const have = kari.seq();
  kari.paused = false;
  await kari.connect();
  assert.equal(kari.welcomes, 2);
  log(`Kari rejoined with have=${have}, now at seq ${kari.seq()}`);

  await waitFor(() => ola.events.at(-1)?.t === 'finished' && kari.events.at(-1)?.t === 'finished', 'the finish', 60000);
  assert.deepEqual(kari.events, ola.events, 'both bots hold the same log');
  ola.events.forEach((e, i) => assert.equal(e.seq, i + 1));
  const reveals = ola.events.filter(e => e.t === 'reveal');
  assert.equal(reveals.length, 4);
  assert.deepEqual(Object.keys(reveals[1].answers), [ola.id], 'Kari missed question 1');
  assert.ok(reveals[2].answers[kari.id], 'Kari answered after rejoining');
  for (const r of reveals.slice(0, 3)) for (const a of Object.values(r.answers)) assert.ok(a.ms >= 0 && a.ms <= 10000);
  for (const r of reveals.slice(0, 3)) assert.equal('votes' in r, false);
  const ballot = ola.events.find(e => e.t === 'ballot'), open = ola.events.find(e => e.t === 'question' && e.q === 3);
  assert.equal(open.deadline - open.at, 60000, 'an open question has 60 s');
  assert.equal(ballot.q, 3);
  assert.equal(ballot.deadline - ballot.at, 30000);
  assert.deepEqual(Object.keys(ballot.answers).sort(), [ola.id, kari.id].sort());
  assert.deepEqual(reveals[3].votes, {[ola.id]:kari.id, [kari.id]:ola.id}, 'each voted for the other');
  log('open round: ballot with both answers, a vote each, reveal with the votes');
  const finished = ola.events.at(-1), waited = finished.at - reveals[3].at;
  assert.ok(waited >= FORCE_AFTER - TIMEUP_TOLERANCE && waited < FORCE_AFTER + 1500, `moved on ${waited} ms after the reveal`);
  log(`the reveal moved on by itself after ${waited} ms (force a second early, then the room's retry)`);
  assert.deepEqual([...ola.errors, ...kari.errors], []);
  log(`finished with ${ola.events.length} identical events:`, ola.events.map(e => e.t).join(' '));

  ola.send({t:'leave'}); kari.send({t:'leave'});
  await sleep(200);
  const after = await refused(`/api/quizoff/rooms/${code}/ws`, helloOf(APP));
  assert.equal(after.error.code, 'no-room', 'the room is wiped when everyone has left');
  log('room wiped after everyone left');
}

main().then(() => { console.log('quiz-off smoke test passed'); process.exit(0); }, error => { console.error('quiz-off smoke test FAILED:', error); process.exit(1); });
