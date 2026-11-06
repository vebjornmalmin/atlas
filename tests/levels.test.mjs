import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileOf,levelOf,assessLevel,levelAccepts,levelFromDepth,estimateVariants,estimateTolerance,gradeEstimate,yearToPosition,positionToYear,timelineTargets,minimumGap} from '../src/lib/levels.js';
import {assessTargets} from '../src/lib/difficulty.js';
import {selectPracticeSession} from '../src/lib/learning.js';
import {schedulingKey} from '../src/lib/knowledge-model.js';
import {factKey} from '../src/lib/journey.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/knowledge/foundation.json', import.meta.url)));
const base = (id, extra = {}) => ({id, entityId: id, collectionIds: ['history'], significance: 4, difficulty: 2, answer: id, mode: 'recall', ...extra});

test('each axis moves independently: producing, precision, familiarity and structure', () => {
  assert.equal(profileOf(base('a', {mode: 'recognition'})).retrieval, 1);
  assert.equal(profileOf(base('a', {mode: 'map'})).retrieval, 2);
  assert.equal(profileOf(base('a')).retrieval, 3);
  assert.equal(profileOf(base('a', {answer: '1814', answerFormat: 'year'})).precision, 3);
  assert.equal(profileOf(base('a', {learningProfile: {precision: 'broad'}})).precision, 1);
  assert.equal(profileOf(base('nobel-people-1', {})).familiarity, 3);
  assert.equal(profileOf(base('capital-fr', {})).familiarity, 1);
  assert.equal(profileOf(base('a', {answerFormat: 'explanation'})).structure, 3);
});

test('ordering three events centuries apart is easier than ordering five neighbouring presidents', () => {
  const far = {id: 'far', mode: 'timeline', timeline: {items: [{year: 1066}, {year: 1492}, {year: 1969}]}};
  const close = {id: 'close', mode: 'timeline', timeline: {id: 'us-presidential-chronology', items: [1789, 1797, 1801, 1809, 1817].map(year => ({year}))}};
  assert.equal(minimumGap(close.timeline.items), 4);
  assert.ok(levelOf(far) < levelOf(close), `${levelOf(far)} < ${levelOf(close)}`);
  assert.equal(levelOf(close), 4);
});

test('drawing a known connection can be easier than recalling one exact number', () => {
  const arrow = {id: 'arrows:x:direction', mode: 'arrows', askYear: false, significance: 4};
  const year = base('year-x', {answer: '1939', answerFormat: 'year', significance: 3});
  assert.ok(levelOf(arrow) < levelOf(year));
  assert.equal(levelOf(arrow), 1);
});

test('a higher level is a different quiz, not the same quiz plus extras', () => {
  const legacy = data.targets.filter(t => !t.unitId);
  const assessed = assessTargets([...legacy, ...legacy.map(t => ({...t, id: `${t.id}:recognition`, baseId: t.id, mode: 'recognition'}))]);
  const at = level => new Set(selectPracticeSession(assessed, [], {level, dailyMinutes: 10}, 'mixed').queue.map(q => q.target.id));
  const one = at(1), four = at(4);
  assert.ok(one.size && four.size);
  assert.equal([...one].filter(id => four.has(id)).length, 0);
  for (const id of four) assert.ok(assessed.find(t => t.id === id).level >= 3);
});

test('every level has questions in the installed package, and legacy depth settings map onto levels', () => {
  const counts = [1, 2, 3, 4].map(level => assessTargets(data.targets).filter(t => t.level === level).length);
  assert.ok(counts.every(n => n > 20), counts.join(','));
  assert.equal(levelFromDepth('foundation'), 2);
  assert.equal(levelFromDepth('specialized'), 0);
  assert.equal(levelAccepts({level: 1}, 2), true);
  assert.equal(levelAccepts({level: 3}, 2), false);
});

test('estimating a year on the timeline is its own memory, with tolerance growing with age', () => {
  const [variant] = estimateVariants([base('year-q', {answer: '1066', answerFormat: 'year', prompt: 'Hvilket år var slaget ved Hastings?'})]);
  assert.equal(variant.mode, 'estimate');
  assert.match(variant.prompt, /^Omtrent når/);
  assert.equal(variant.tolerance, estimateTolerance(1066));
  assert.ok(estimateTolerance(1066) > estimateTolerance(1989));
  assert.equal(gradeEstimate(1066 + variant.tolerance, variant).correct, true);
  assert.equal(gradeEstimate(1066 + variant.tolerance + 1, variant).correct, false);
  const exact = base('year-q', {answer: '1066', answerFormat: 'year'});
  assert.equal(factKey({...variant, factId: 'f'}), factKey({...exact, factId: 'f'}));
  assert.notEqual(schedulingKey({...variant, factId: 'f'}), schedulingKey({...exact, factId: 'f'}));
  assert.ok(levelOf(variant) < levelOf(exact));
});

test('the logarithmic timeline round-trips and gives recent centuries more room', () => {
  for (const year of [-3000, 0, 1066, 1814, 2001]) assert.ok(Math.abs(positionToYear(yearToPosition(year)) - year) <= Math.max(1, (2026 - year) * .002));
  const width = (a, b) => yearToPosition(b) - yearToPosition(a);
  assert.ok(width(1900, 2000) > width(1000, 1100) * 3);
});

test('timelines come in easy spread versions alongside the historical slices', () => {
  const rows = timelineTargets(data);
  assert.ok(rows.some(t => t.id === 'timeline:us-presidential-chronology:0'));
  const spread = rows.filter(t => t.id.includes(':spread:'));
  assert.ok(spread.length >= 4);
  for (const t of spread) assert.ok(minimumGap(t.timeline.items) >= 12);
  assert.ok(Math.min(...spread.map(levelOf)) < Math.min(...rows.filter(t => !t.id.includes(':spread:')).map(levelOf)));
  assert.ok(assessLevel(spread[0]).profile);
});

test('axis insights find where accuracy falls: here, exact details rather than familiarity', async () => {
  const {axisInsights} = await import('../src/lib/levels.js');
  const rows = [];
  for (let i = 0; i < 6; i++) rows.push(base(`broad-${i}`, {learningProfile: {precision: 'broad'}}), base(`exact-${i}`, {answer: '1814', answerFormat: 'year'}));
  const reviews = rows.map((t, i) => ({targetId: t.id, timestamp: `2026-11-0${1 + (i % 3)}T10:00:00Z`, correct: t.id.startsWith('broad')}));
  const result = axisInsights(rows, reviews);
  assert.equal(result.weakest.axis.id, 'precision');
  assert.equal(result.rows.find(r => r.axis.id === 'precision').steps[0].rate, 1);
  assert.equal(result.rows.find(r => r.axis.id === 'precision').steps[2].rate, 0);
});

test('timeline labels never carry an ordinal that gives the order away', () => {
  for (const t of timelineTargets(data)) for (const item of t.timeline.items) assert.doesNotMatch(item.label, /^\d+\.\s/);
});

test('a quiz about one entity starts on a level that has questions for it', async () => {
  const {levelsWithQuestions, usableLevel} = await import('../src/lib/levels.js');
  const targets = [{level:3}, {level:4}];
  assert.deepEqual(levelsWithQuestions(targets), [3, 4]);
  assert.equal(usableLevel([3, 4], 1), 3);
  assert.equal(usableLevel([3, 4], 4), 4);
  assert.equal(usableLevel([3, 4], 0), 0);
  assert.equal(usableLevel([], 2), 0);
  assert.deepEqual(levelsWithQuestions([{level:1}]), [1, 2]);
});
