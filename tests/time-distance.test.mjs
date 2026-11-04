import test from 'node:test';
import assert from 'node:assert/strict';
import {TIME_ANCHORS} from '../knowledge-build/time-anchors.mjs';
import {buildDistanceTargets, distanceFacts, gradeDistance, distanceReady, MAX_DISTANCE_TARGETS} from '../src/lib/time-distance.js';

const byId = new Map(TIME_ANCHORS.map(anchor => [anchor.id, anchor]));
const targets = buildDistanceTargets(TIME_ANCHORS);

test('anchors are unique, sourced and dated within the present', () => {
  const ids = new Set();
  for (const anchor of TIME_ANCHORS) {
    assert.ok(!ids.has(anchor.id), `duplicate id ${anchor.id}`);
    ids.add(anchor.id);
    assert.ok(anchor.label && /[a-zæøå]/i.test(anchor.label), `label ${anchor.id}`);
    assert.ok(Number.isInteger(anchor.year) && anchor.year <= 2026, `year ${anchor.id}`);
    if (anchor.endYear !== undefined) assert.ok(anchor.endYear >= anchor.year && anchor.endYear <= 2026, `endYear ${anchor.id}`);
    assert.ok(anchor.approximate === undefined || typeof anchor.approximate === 'boolean', `approximate ${anchor.id}`);
    if (anchor.approximate) assert.ok(anchor.uncertainty > 0, `uncertainty required for ${anchor.id}`);
    assert.ok([1, 2, 3].includes(anchor.familiarity), `familiarity ${anchor.id}`);
    assert.ok(['person', 'building', 'event', 'institution', 'work'].includes(anchor.kind), `kind ${anchor.id}`);
    assert.ok(Array.isArray(anchor.sources) && anchor.sources.length > 0, `sources ${anchor.id}`);
    for (const source of anchor.sources) {
      assert.ok(source.title && /^https:\/\/(snl\.no|lille\.snl\.no)\//.test(source.url), `source ${anchor.id}`);
    }
  }
  assert.ok(TIME_ANCHORS.length >= 30);
});

test('anchors span several continents and eras', () => {
  const regions = new Set(TIME_ANCHORS.map(anchor => anchor.region));
  assert.ok(regions.size >= 4);
  assert.ok(TIME_ANCHORS.some(anchor => anchor.year < -3000));
  assert.ok(TIME_ANCHORS.some(anchor => anchor.year > 1900));
});

test('every target has a correct option that is clearly closer, with margin beyond uncertainty', () => {
  assert.ok(targets.length > 0);
  for (const target of targets) {
    assert.equal(target.mode, 'distance');
    const a = byId.get(target.anchor);
    const [b, c] = target.options.map(id => byId.get(id));
    assert.ok(a && b && c, target.id);
    const facts = distanceFacts(a, b, c);
    assert.equal(facts.near.id, target.correctId, target.id);
    assert.equal(target.answer, facts.near.label);
    assert.ok(facts.gap >= 30, `absolute margin ${target.id}`);
    assert.ok(facts.gap >= 0.15 * facts.dFar, `relative margin ${target.id}`);
    const uncertainty = [a, b, c].reduce((sum, item) => sum + (item.approximate ? item.uncertainty : 0), 0);
    assert.ok(facts.gap > uncertainty, `margin beyond uncertainty ${target.id}`);
    assert.ok(target.explanation.includes(a.label) && target.explanation.includes(facts.near.label));
    assert.equal(target.significance, 3);
    assert.deepEqual(target.collectionIds, ['verdenshistorie']);
    assert.equal(target.familiarity, Math.max(a.familiarity, b.familiarity, c.familiarity));
    assert.ok(target.sources.length > 0);
    assert.deepEqual(target.sourceIds, []);
  }
});

test('ids are stable across runs and follow distance:<a>:<b>:<c>', () => {
  const again = buildDistanceTargets(TIME_ANCHORS);
  assert.deepEqual(again.map(target => target.id), targets.map(target => target.id));
  assert.deepEqual(again, targets);
  for (const target of targets) {
    assert.match(target.id, /^distance:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/);
    assert.equal(target.id, `distance:${target.anchor}:${target.options.join(':')}`);
  }
  assert.equal(new Set(targets.map(target => target.id)).size, targets.length);
});

test('no question asks about the same item twice or reuses the same pair', () => {
  const pairs = new Set();
  for (const target of targets) {
    const items = [target.anchor, ...target.options];
    assert.equal(new Set(items).size, 3, target.id);
    for (const [x, y] of [[items[0], items[1]], [items[0], items[2]], [items[1], items[2]]]) {
      const key = [x, y].sort().join('|');
      assert.ok(!pairs.has(key), `pair reused in ${target.id}`);
      pairs.add(key);
    }
  }
});

test('the count is within the cap and the list is not empty', () => {
  assert.ok(targets.length > 0 && targets.length <= MAX_DISTANCE_TARGETS);
  assert.ok(targets.length <= 120);
});

test('grading and readiness use the chosen anchor', () => {
  const target = targets[0];
  assert.equal(distanceReady(target, {}), false);
  assert.equal(distanceReady(target, {choice: target.options[0]}), true);
  assert.deepEqual(gradeDistance(target, {choice: target.correctId}), {correct: true});
  const wrong = target.options.find(id => id !== target.correctId);
  assert.deepEqual(gradeDistance(target, {choice: wrong}), {correct: false});
});
