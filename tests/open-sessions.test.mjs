import test from 'node:test';
import assert from 'node:assert/strict';
import {openSessions, doneLabel, DAILY_TITLE, OPEN_SESSION_DAYS} from '../src/lib/session-journal.js';

const now = new Date('2026-11-09T12:00:00');
const at = hours => new Date(now - hours * 3600e3).toISOString();
const quiz = (sessionId, extra = {}) => ({id: sessionId, sessionId, title: 'Fri quiz', status: 'active', index: 1, queue: [{id: 'a'}, {id: 'b'}, {id: 'c'}], results: [], startedAt: at(2), ...extra});

test('a daily session set aside for a free quiz can still be continued the same day', () => {
  const daily = quiz('d1', {title: DAILY_TITLE, index: 3, queue: Array.from({length: 14}, (_, i) => ({id: `q${i}`})), startedAt: at(1), updatedAt: at(0.5)});
  const free = {...quiz('f1', {updatedAt: at(0.1)}), id: 'active'};
  const open = openSessions(free, [daily, {...free, id: 'f1', index: 0}], {now});
  assert.deepEqual(open.map(s => s.sessionId), ['f1', 'd1'], 'newest activity first');
  assert.equal(open[0].index, 1, 'the active copy wins over its archived copy');
  assert.equal(doneLabel(open[1]), '3 av 14 gjort');
});

test('finished, ended and empty sessions are not offered', () => {
  const open = openSessions(null, [quiz('done', {status: 'completed'}), quiz('closed', {status: 'closed'}), quiz('end', {index: 3})], {now});
  assert.deepEqual(open, []);
});

test('a daily session belongs to its day; other quizzes stay open for a while', () => {
  const yesterday = quiz('d0', {title: DAILY_TITLE, startedAt: at(26)});
  const lastWeek = quiz('f7', {startedAt: at(24 * 7)});
  const tooOld = quiz('f60', {startedAt: at(24 * (OPEN_SESSION_DAYS + 1))});
  assert.deepEqual(openSessions(null, [yesterday, lastWeek, tooOld], {now}).map(s => s.sessionId), ['f7']);
});

test('a session whose remaining cards were all retired by a content update is not offered', () => {
  const open = openSessions(null, [quiz('f1')], {now, exists: entry => entry.id === 'a'});
  assert.deepEqual(open, []);
});

test('a second daily session on the same day is recognised as extra, and says what it holds', async () => {
  const {dailyDoneToday, sessionMix} = await import('../src/lib/session-journal.js');
  const done = quiz('d1', {title: DAILY_TITLE, status: 'completed', completedAt: at(1)});
  const yesterday = quiz('d0', {title: DAILY_TITLE, status: 'completed', completedAt: at(30)});
  assert.equal(dailyDoneToday(null, [done], now), true);
  assert.equal(dailyDoneToday(null, [yesterday], now), false);
  assert.equal(dailyDoneToday(quiz('f', {status: 'completed', completedAt: at(1)}), [], now), false, 'a free quiz is not the daily session');
  const extra = quiz('d2', {title: DAILY_TITLE, index: 0, queue: [{id: 'lesson:x'}, {id: 'r1', reason: 'Due review'}, {id: 'n1', reason: 'Unit introduction'}, {id: 'n2', reason: 'New knowledge'}, {id: 'p1', reason: 'Perspektiv'}]});
  assert.deepEqual(sessionMix(extra, {perspectiveReason: 'Perspektiv', answeredToday: new Set(['n2'])}), {review: 1, fresh: 2, perspective: 1, retry: 0, lesson: 1, repeats: 1});
});
