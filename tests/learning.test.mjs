import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {foundationTargets} from '../src/lib/foundations.js';
import { scheduleReview, hydrateCard, Rating, selectSession, targetMatches, memorySummary, reminderCalendar } from '../src/lib/learning.js';
const foundation = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-10T08:00:00Z');
const target = (id, extra = {}) => ({ id, collectionIds: ['history'], significance: 4, difficulty: 2, mode: 'recall', ...extra });

test('FSRS differentiates forgotten and remembered targets and persists scheduling fields', () => {
  const again = scheduleReview('a', undefined, Rating.Again, now);
  const good = scheduleReview('a', undefined, Rating.Good, now);
  assert.ok(new Date(again.card.due) > now);
  assert.ok(new Date(good.card.due) >= new Date(again.card.due));
  assert.ok(good.card.stability > again.card.stability);
  assert.equal(good.card.reps, 1);
  assert.equal(good.card.id, 'a');
  assert.equal(good.card.last_review, now.toISOString());
  assert.throws(() => scheduleReview('a', undefined, 0, now), /Invalid recall/);
});

test('serialized scheduling state rehydrates and supports subsequent reviews', () => {
  const first = JSON.parse(JSON.stringify(scheduleReview('a', undefined, Rating.Good, now).card));
  const hydrated = hydrateCard(first);
  assert.ok(hydrated.due instanceof Date);
  assert.ok(hydrated.last_review instanceof Date);
  const second = scheduleReview('a', first, Rating.Good, new Date(first.due)).card;
  assert.equal(second.reps, 2);
  assert.ok(new Date(second.due) > new Date(first.due));
  assert.ok(Number.isFinite(second.stability));
});

test('sessions prioritize oldest due review, interleave new knowledge, and exclude future easy reviews', () => {
  const targets = [target('later'), target('oldest'), target('easy'), target('new-1'), target('new-2')];
  const states = [
    { id: 'later', due: '2026-10-09T00:00:00Z' },
    { id: 'oldest', due: '2026-09-01T00:00:00Z' },
    { id: 'easy', due: '2027-01-01T00:00:00Z' }
  ];
  const session = selectSession(targets, states, { dailyMinutes: 3, newRatio: .4 }, now);
  assert.equal(session.queue[0].target.id, 'oldest');
  assert.equal(session.queue[0].reason, 'Due review');
  assert.equal(session.dueCount, 2);
  const ids = session.queue.map(q => q.target.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes('easy'), false);
  assert.ok(ids.includes('later'));
  assert.ok(session.queue.some(q => q.reason === 'New knowledge'));
  assert.equal(selectSession([target('easy')], states, {}, now).queue.length, 0);
});

test('consolidation only sessions do not introduce fresh knowledge', () => {
  const targets = [target('due'), target('fresh')];
  const states = [{ id: 'due', due: '2026-10-01T00:00:00Z' }];
  const session = selectSession(targets, states, { newRatio: 0 }, now);
  assert.deepEqual(session.queue.map(q => q.target.id), ['due']);
  assert.equal(selectSession(targets, [], { newRatio: 0 }, now).queue.length, 0);
});

test('shared target progress follows the learner across collections', () => {
  const shared = target('shared', { collectionIds: ['history', 'science'] });
  const state = { id: 'shared', due: '2027-01-01T00:00:00Z', stability: 30, lapses: 0, reps: 3 };
  for (const collectionId of shared.collectionIds) {
    const session = selectSession([shared], [state], { collectionIds: [collectionId] }, now);
    assert.equal(session.eligibleCount, 1);
    assert.equal(session.newCount, 0);
    assert.equal(session.queue.length, 0);
  }
  assert.deepEqual(memorySummary([shared], [state, { ...state, id: 'removed' }], now),
    { total: 1, introduced: 1, strong: 1, difficult: 0, due: 0, new: 0 });
});

test('focus filters collections, subjects, period, depth, and exercise objective independently', () => {
  const collections = [{ id: 'history', subject: 'history' }, { id: 'science', subject: 'science' }];
  const historical = target('event', { year: 1945 });
  assert.equal(targetMatches(historical, { collectionIds: ['science'] }, collections), false);
  assert.equal(targetMatches(historical, { subject: 'science' }, collections), false);
  assert.equal(targetMatches(historical, { subject: 'history', fromYear: 1900, toYear: 1950 }, collections), true);
  assert.equal(targetMatches(historical, { fromYear: 1950 }, collections), false);
  assert.equal(targetMatches(historical, { toYear: 1900 }, collections), false);
  assert.equal(targetMatches(target('deep', { difficulty: 5 }), { depth: 'foundation' }), false);
  assert.equal(targetMatches(target('deep', { difficulty: 5 }), { depth: 'advanced' }), true);
  assert.equal(targetMatches(target('map', { mode: 'map' }), { objective: 'geography' }), true);
  assert.equal(targetMatches(historical, { objective: 'geography' }), false);
  assert.equal(targetMatches(target('sequence', { mode: 'timeline' }), { objective: 'chronology', depth:'advanced' }), true);
  assert.equal(targetMatches(target('link', { kind: 'connections' }), { objective: 'connections', depth:'advanced' }), true);
  assert.equal(targetMatches(target('recognition', { mode: 'recognition' }), { objective: 'recall' }), false);
});

test('installed foundation produces unique meaningful exercises from selected collection', () => {
  const collection = foundation.collections[0];
  const result = selectSession([...foundationTargets(foundation),...foundation.targets], [], { collectionIds: [collection.id], dailyMinutes: 5 }, now, foundation.collections);
  assert.ok(result.queue.length > 0);
  assert.ok(result.queue.every(q => q.target.collectionIds.includes(collection.id)));
  assert.equal(new Set(result.queue.map(q => q.target.id)).size, result.queue.length);
});

test('calendar export is a daily floating-local-time event with notification and CRLF', () => {
  const localNow = new Date(2026, 9, 10, 12, 30);
  const calendar = reminderCalendar('09:15', localNow);
  assert.match(calendar, /^BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.match(calendar, /DTSTART:20261011T091500\r\n/);
  assert.match(calendar, /RRULE:FREQ=DAILY\r\n/);
  assert.match(calendar, /BEGIN:VALARM\r\nTRIGGER:PT0M/);
  assert.match(calendar, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  assert.equal(calendar.replace(/\r\n/g, '').includes('\n'), false);
  assert.throws(() => reminderCalendar('invalid', localNow), /valid reminder time/);
  for (const invalid of ['24:00', '99:99', '09:60', '9:00', '']) {
    assert.throws(() => reminderCalendar(invalid, localNow), /valid reminder time/);
  }
  assert.match(reminderCalendar('23:59', localNow), /DTSTART:20261010T235900/);
});

test('mixed new sessions include interactive forms instead of only high-scoring text recall',()=>{
 const targets=['recall','recognition','map','outline','timeline'].map((mode,index)=>target(mode,{mode,datasetId:'world',regionId:mode,significance:5-index}));
 const selected=selectSession(targets,[],{dailyMinutes:3,depth:'advanced'},now);
 assert.equal(new Set(selected.queue.map(row=>row.target.mode)).size,5);
});
test('extra practice remains available when scheduled cards are not due and rotates past recent practice',async()=>{
 const {selectPracticeSession}=await import('../src/lib/learning.js');
 const targets=Array.from({length:8},(_,i)=>target(`p${i}`,{mode:'recognition'}));
 const states=targets.map(row=>({id:row.id,due:'2030-01-01T00:00:00Z'}));
 const prefs={dailyMinutes:3,newRatio:0};
 assert.equal(selectSession(targets,states,prefs,now).queue.length,0);
 const first=selectPracticeSession(targets,states,prefs,'recognition',now);
 assert.equal(first.queue.length,6);
 const reviews=first.queue.map(row=>({targetId:row.target.id,practice:true,timestamp:now.toISOString()}));
 const next=selectPracticeSession(targets,states,prefs,'recognition',now,[],reviews);
 assert.ok(!reviews.some(row=>row.targetId===next.queue[0].target.id));
 assert.ok(next.queue.every(row=>row.target.mode==='recognition'));
 assert.equal(selectPracticeSession(targets,states,prefs,'geography',now).queue.length,0);
});
test('the timeline quiz selects reorderable timelines rather than chronological text questions',async()=>{
 const {selectPracticeSession}=await import('../src/lib/learning.js');
 const targets=[target('text',{kind:'before-after',mode:'recall'}),target('interactive',{kind:'before-after',mode:'timeline'})];
 assert.deepEqual(selectPracticeSession(targets,[],{},'chronology',now).queue.map(row=>row.target.id),['interactive']);
});
