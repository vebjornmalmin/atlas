import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWorldGraph, lensView, lensOverlap, findPath, shortestBorderPath, relevanceScores, lensesFor, validatePerspectives, newsWeight } from '../src/lib/world-graph.js';
import { buildWorldTargets, gradeBorderWalk } from '../src/lib/world-exercises.js';
import { gradeStructured, structuredReady } from '../src/lib/quiz-formats.js';
import { targetMatches } from '../src/lib/learning.js';
import { assessTargets } from '../src/lib/difficulty.js';
import { WORLD_FORMATS } from '../knowledge-build/lens-projections.mjs';

const data = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const graph = buildWorldGraph(data);
const targets = assessTargets(buildWorldTargets(data, graph));
const snapshot = new Date(`${data.perspectives.news.snapshotDate}T12:00:00Z`);

test('perspective layer passes its own validation and has twenty lenses with real thinkers', () => {
  assert.deepEqual(validatePerspectives(data), []);
  assert.equal(graph.lenses.length, 20);
  for (const lens of graph.lenses) assert.ok(lens.thinkerIds.length, `${lens.id} has thinkers`);
  const broken = structuredClone(data); broken.perspectives.lenses[0].entityId = 'missing';
  assert.match(validatePerspectives(broken).join(' '), /lens entity missing/);
});

test('borders come from the map and include short real borders but not sea crossings', () => {
  const near = id => graph.neighbours.get(id) || [];
  assert.deepEqual(near('norway').sort(), ['finland', 'geo-rus', 'sweden'].sort());
  assert.ok(near('france').includes('geo-bra'), 'France borders Brazil through French Guiana');
  assert.ok(!near('geo-egy').includes('geo-jor'), 'Egypt and Jordan only meet across water');
  assert.ok(!near('geo-gbr').includes('france'), 'the Channel is not a land border');
  assert.equal(data.entities.find(e => e.id === 'norway').geo.distanceKm, 0);
});

test('lenses produce genuinely different views of the same graph', () => {
  const views = graph.lenses.map(l => lensView(graph, l.id, null, snapshot));
  const overlaps = [];
  for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) overlaps.push(lensOverlap(views[i], views[j]));
  const mean = overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
  assert.ok(mean < .35, `mean top-25 overlap ${mean.toFixed(2)} should be low`);
  const people = lensView(graph, 'great-individuals', null, snapshot).ranked.slice(0, 10);
  assert.ok(people.filter(e => e.type === 'person').length >= 8, 'the great-individuals lens leads with people');
  const geo = lensView(graph, 'geopolitics', null, snapshot);
  assert.ok(geo.countryScores.get('geo-rus') > geo.countryScores.get('geo-isl') || !geo.countryScores.has('geo-isl'));
});

test('relevance weights move nearby, current and central nodes in the expected direction', () => {
  const local = relevanceScores(graph, {impact: 0, actuality: 0, locality: 100}, snapshot).scores;
  assert.ok(local.get('oslo') > local.get('geo-aus'));
  const current = relevanceScores(graph, {impact: 0, actuality: 100, locality: 0}, snapshot).scores;
  const inNews = graph.news[0].metadata.primaryEntityId;
  assert.ok(current.get(inNews) > 0);
  const later = new Date(snapshot.getTime() + 60 * 86400000);
  assert.ok(newsWeight(graph.news[0], later) < newsWeight(graph.news[0], snapshot) / 8, 'news fades with a 14-day half-life');
});

test('paths explain connections and border journeys only cross land borders', () => {
  const path = findPath(graph, 'norway', 'italy');
  assert.ok(path?.length >= 1);
  path.forEach((step, i) => { if (i) assert.equal(step.from, path[i - 1].to); });
  const walk = shortestBorderPath(graph, 'norway', 'italy');
  walk.forEach((id, i) => { if (i) assert.ok(graph.neighbours.get(walk[i - 1]).includes(id)); });
  const target = targets.find(t => t.id === 'border-walk:norway:italy');
  const draft = {path: walk.slice(1)};
  assert.ok(structuredReady(target, draft));
  assert.equal(gradeStructured(target, draft, graph.neighbours).correct, true);
  assert.equal(gradeBorderWalk(target, ['italy'], graph.neighbours).valid, false, 'jumping is not a journey');
});

test('all ten learning formats are generated, filterable and graded', () => {
  for (const format of WORLD_FORMATS) {
    const rows = targets.filter(t => t.format === format.id);
    assert.ok(rows.length, `${format.id} has targets`);
    assert.ok(rows.every(t => targetMatches(t, {objective: format.id, depth: 'specialized'})));
    assert.ok(rows.every(t => !t.difficultyFamily.startsWith('unreviewed')), `${format.id} has a reviewed difficulty family`);
  }
  assert.equal(new Set(targets.map(t => t.id)).size, targets.length);
  const pick = targets.find(t => t.mode === 'pick');
  assert.equal(gradeStructured(pick, {choice: pick.correctId}).correct, true);
  assert.ok(pick.choices.every(c => /^[A-Z]{2}$/.test(c.iso2)));
  for (const t of targets.filter(t => t.options)) assert.ok(!t.options.includes(t.answer), `${t.id} distractors exclude the answer`);
});

test('flag questions never name the answer and news questions never reveal the country', () => {
  for (const t of targets) assert.ok(!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(JSON.stringify(t)), `${t.id} has no emoji`);
  for (const t of targets.filter(t => t.format === 'flags' && t.mode === 'recognition')) assert.ok(!t.prompt.includes(t.answer));
  for (const t of targets.filter(t => t.format === 'news-map')) assert.ok(!t.prompt.toLocaleLowerCase('nb').includes(t.answer.toLocaleLowerCase('nb')), t.id);
  for (const t of targets.filter(t => t.format === 'neighbours')) assert.ok(graph.neighbours.get(t.entityId).includes(data.entities.find(e => e.label === t.answer && e.geo).id));
});

test('lenses for a place explain why they see it', () => {
  const lenses = lensesFor(graph, 'geo-rus');
  assert.ok(lenses.length >= 3);
  assert.ok(lenses.some(l => l.reason), 'at least one curated reason for Russia');
});

test('generated questions avoid giveaways and implausible options', () => {
  for (const t of targets.filter(t => t.format === 'perspective-switch')) assert.ok(!/annales|metahistor/i.test(t.prompt), t.id);
  assert.ok(!targets.some(t => t.id === 'news-map:news-2026-10-21-unep-utslippsgap-rapport'), 'a global report has no single country to find');
  const stats = data.perspectives.countryStats;
  const bigHosts = new Set(Object.entries(stats).sort((a, b) => b[1].inflow - a[1].inflow).slice(0, 15).map(([id]) => data.entities.find(e => e.id === id)?.label));
  for (const t of targets.filter(t => t.format === 'knowledge-flow')) assert.ok(t.options.every(o => bigHosts.has(o)), t.id);
});
