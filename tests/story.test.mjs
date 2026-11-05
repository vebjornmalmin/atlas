import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {storyOrder,storyCursor,chapterFor,simultaneityTargets,weavePerspectives,PERSPECTIVE_REASON,ERAS,STORY_VIEW,eraView,storyPosition,storyYear,storyTicks,storyLanes,unitsAt,concurrentUnits} from '../src/lib/story.js';
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

test('the story timeline gives the crowded centuries room and the newest decades little', () => {
  assert.equal(storyPosition(STORY_VIEW.from), 0);
  assert.equal(storyPosition(STORY_VIEW.to), 1);
  for (const year of [-3000, -500, 0, 800, 1500, 1814, 1945, 2001]) {
    assert.ok(storyPosition(year) < storyPosition(year + 1));
    assert.ok(Math.abs(storyYear(storyPosition(year)) - year) <= 1, `round trip ${year}`);
  }
  assert.ok(storyPosition(1900) - storyPosition(1500) > .2, '1500–1900 is wide enough to read');
  assert.ok(1 - storyPosition(2000) < .1, '2000 to now stays narrow');
  const ticks = storyTicks().map(t => storyPosition(t) * 360);
  assert.ok(ticks.every((x, i) => i === 0 || x - ticks[i - 1] >= 30), 'year marks do not collide on a phone');
});

test('a zoomed era is linear, with round year marks inside it', () => {
  const view = eraView(ERAS.find(e => e.id === 'nineteenth'));
  assert.equal(storyPosition(1850, view), .5);
  assert.equal(storyYear(.5, view), 1850);
  const ticks = storyTicks(view);
  assert.ok(ticks.length >= 3 && ticks.length <= 6 && ticks.every(t => t >= view.from && t <= view.to));
});

test('timeline lanes keep every dated unit and never overlap spans in a lane', () => {
  const dated = data.curriculum.units.filter(u => u.years);
  const {rows, lanes} = storyLanes(data.curriculum.units, STORY_VIEW, 360);
  assert.equal(rows.length, dated.length);
  assert.ok(lanes > 1 && lanes <= 24, `${lanes} lanes fit the screen`);
  for (let lane = 0; lane < lanes; lane++) {
    const inLane = rows.filter(r => r.lane === lane).sort((a, b) => a.x - b.x);
    inLane.forEach((r, i) => i && assert.ok(r.x >= inLane[i - 1].x + inLane[i - 1].w, `${r.unit.id} overlaps in lane ${lane}`));
  }
  const era = eraView(ERAS.find(e => e.id === 'twentieth'));
  assert.ok(storyLanes(data.curriculum.units, era, 360).rows.every(r => r.unit.years.to >= era.from && r.unit.years.from <= era.to));
});

test('the timeline answers what was under way in a year, and what ran alongside a unit', () => {
  const units = data.curriculum.units;
  const in1916 = unitsAt(units, 1916);
  assert.ok(in1916.length > 1 && in1916.every(u => u.years.from <= 1916 && u.years.to >= 1916));
  const unit = units.find(u => u.years && concurrentUnits(u, units).length);
  for (const other of concurrentUnits(unit, units)) {
    assert.notEqual(other.domainId, unit.domainId);
    assert.ok(other.years.from <= unit.years.to && other.years.to >= unit.years.from);
  }
});
