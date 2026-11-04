import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {storyOrder,storyCursor,chapterFor,simultaneityTargets,weavePerspectives,PERSPECTIVE_REASON} from '../src/lib/story.js';
import {curriculumProgress,recommendedUnits,buildDailySession} from '../src/lib/progression.js';
import {assessTargets} from '../src/lib/difficulty.js';
import {gradeStructured} from '../src/lib/quiz-formats.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/knowledge/foundation.json', import.meta.url)));
const targets = assessTargets([...data.targets, ...simultaneityTargets(data)]);
const progress = curriculumProgress(data.curriculum, targets, [], []);

test('the story opens dated units in time order and alternates with timeless units', () => {
  const order = storyOrder(data.curriculum.units, progress);
  const dated = order.filter(u => u.years);
  for (let i = 1; i < dated.length; i++) assert.ok(dated[i].years.from >= dated[i - 1].years.from);
  assert.ok(order.slice(0, 6).some(u => !u.years) && order.slice(0, 6).some(u => u.years));
  assert.deepEqual(recommendedUnits(data.curriculum, progress, {story: true}).map(u => u.id), order.map(u => u.id));
});

test('the story continues from the last chapter the learner began', () => {
  const started = data.curriculum.units.find(u => u.id === 'nh-1814');
  const review = card => ({targetId: card, timestamp: '2026-11-01T10:00:00Z', correct: true});
  const reviews = started.cardIds.slice(0, 2).map(review);
  const after = curriculumProgress(data.curriculum, targets, [], reviews);
  assert.equal(storyCursor(data.curriculum, after), 1814);
  const next = storyOrder(data.curriculum.units, after, 1814).find(u => u.years);
  assert.ok(next.years.from >= 1764, `${next.title} ${next.years.from}`);
});

test('a daily session is a chapter with a title, era and span', () => {
  const session = buildDailySession({data, targets, states: [], reviews: [], preferences: {dailyMinutes: 5}});
  const chapter = chapterFor(session.units, data.curriculum);
  assert.ok(chapter?.title);
  assert.ok(chapter.era);
});

test('«samtidig i verden» compares events from two subjects in the same period, graded by date', () => {
  const rows = simultaneityTargets(data);
  assert.ok(rows.length >= 20, String(rows.length));
  for (const t of rows) {
    const [a, b] = t.unitIds.map(id => data.curriculum.units.find(u => u.id === id));
    assert.notEqual(a.domainId, b.domainId);
    const first = t.items.find(i => i.id === t.firstId), other = t.items.find(i => i.id !== t.firstId);
    assert.ok(first.year < other.year);
    assert.equal(gradeStructured(t, {first: t.firstId}).correct, true);
    assert.ok(t.sourceIds.length);
  }
  assert.equal(new Set(rows.map(t => t.id)).size, rows.length);
});

test('perspectives are woven into the chapter only from units the learner has met', () => {
  const unit = data.curriculum.units.find(u => u.id === 'mh-andre-verdenskrig');
  const queue = unit.cardIds.slice(0, 4).map(id => ({target: targets.find(t => t.id === id), reason: 'Unit introduction', unitId: unit.id}));
  const woven = weavePerspectives({queue, units: [unit.id], curriculum: data.curriculum, targets: [...targets], reviews: [], progress, level: 0});
  const added = woven.filter(r => r.reason === PERSPECTIVE_REASON);
  assert.equal(woven.length, queue.length + added.length);
  for (const row of added) if (row.target.unitIds) assert.ok(row.target.unitIds.every(id => id === unit.id || progress.units.get(id).status !== 'new'));
  assert.ok(woven.findIndex(r => r.reason === PERSPECTIVE_REASON) !== 0);
});
