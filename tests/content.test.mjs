import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePackage as validateBuild } from '../scripts/validate-knowledge.mjs';
import { validatePackage as validateBrowser, contentHash, readiness } from '../src/lib/content.js';

const foundation = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(foundation);
const validators = {
  build: value => validateBuild(value).errors,
  browser: validateBrowser,
};

for (const [name, validate] of Object.entries(validators)) {
  test(`${name}: installed foundation passes integrity validation`, () => {
    assert.deepEqual(validate(foundation), []);
  });
  const corruptions = [
    ['unknown entity endpoint', p => p.relationships[0].to = 'not-installed'],
    ['unknown source', p => p.targets[0].sourceIds = ['not-installed']],
    ['unknown target entity', p => p.targets[0].entityId = 'not-installed'],
    ['missing corrective explanation', p => p.targets[0].explanation = ''],
    ['duplicate target ID', p => p.targets[1].id = p.targets[0].id],
    ['duplicate normalized question', p => p.targets[1].prompt = `  ${p.targets[0].prompt.toUpperCase()} `],
    ['invalid collection membership', p => p.entities[0].collectionIds = ['not-installed']],
    ['timeline with unresolved source', p => p.timelines[0].sourceIds = ['not-installed']],
    ['timeline out of chronological order', p => p.timelines[1].items.reverse()],
    ['presidential succession gap', p => p.timelines[0].items[0].endYear = 1800],
    ['incorrect administration ordinal', p => p.timelines[0].items[4].ordinal = 9],
    ['duplicated Cleveland person', p => p.timelines[0].items[23].entityId = 'benjamin-harrison'],
    ['incorrect declared counts', p => p.entityCount = 1],
    ['unresolvable timeline entity', p => p.timelines[0].items[0].entityId = 'not-installed'],
    ['unsupported schema', p => p.schemaVersion = 99],
    ['invalid semantic version', p => p.version = 'tomorrow'],
    ['invalid generation date', p => p.generatedAt = 'never'],
    ['invalid source URL', p => p.sources[0].url = 'https://'],
    ['fractional learning difficulty', p => p.targets[0].difficulty = 2.5],
    ['unsupported exercise kind', p => p.targets[0].kind = 'unknown'],
    ['invalid recognition options', p => p.targets[0].options = ['wrong', 'wrong']],
    ['missing sections', p => delete p.sources],
    ['malformed timeline entry', p => p.timelines[0].items[0] = null],
    ['malformed entity entry', p => p.entities[0] = null],
  ];
  for (const [description, corrupt] of corruptions) {
    test(`${name}: rejects ${description} without throwing`, () => {
      const packageData = clone();
      corrupt(packageData);
      assert.ok(validate(packageData).length > 0);
    });
  }
  test(`${name}: rejects non-object input without throwing`, () => {
    for (const value of [null, undefined, '', 10]) assert.ok(validate(value).length > 0);
  });
}

test('presidential chronology has 47 administrations, 45 shared people and correct returns', () => {
  const timeline = foundation.timelines.find(x => x.id === 'us-presidential-chronology');
  assert.equal(timeline.items.length, 47);
  assert.equal(new Set(timeline.items.map(x => x.entityId)).size, 45);
  for (const [first, second] of [[22,24],[45,47]]) {
    assert.equal(timeline.items[first - 1].entityId, timeline.items[second - 1].entityId);
    assert.notEqual(timeline.items[first - 1].id, timeline.items[second - 1].id);
  }
  assert.equal(timeline.items[46].year, 2025);
  assert.equal(timeline.items[46].endYear, null);
});

test('overlapping collection views reuse the same memory target', () => {
  const oslo = foundation.targets.filter(x => x.id === 'capital-no');
  assert.equal(oslo.length, 1);
  assert.ok(oslo[0].collectionIds.includes('world-geography'));
  assert.ok(oslo[0].collectionIds.includes('european-capitals'));
  assert.ok(oslo[0].collectionIds.includes('norway'));
  assert.equal(foundation.entities.filter(x => x.label === 'Marie Curie').length, 1);
  assert.equal(foundation.relationships.filter(x => x.from === 'marie-curie' && x.type === 'received').length, 2);
});

test('SHA256 matches a published standard vector and changes with package bytes', async () => {
  assert.equal(await contentHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(await contentHash('{"version":"1.0.0"}'), await contentHash('{"version":"1.0.1"}'));
});

test('readiness measures content signals separately from personal mastery', () => {
  assert.equal(readiness({ targets: [], relationships: [] }).score, 0);
  const content = { targets: [{ entityId: 'a', sourceIds: ['s'], explanation: 'context' }], relationships: [] };
  assert.equal(readiness(content).score, 70);
  content.relationships.push({ from: 'a', to: 'b' });
  assert.equal(readiness(content).score, 100);
  content.targets[0].sourceIds = [];
  assert.equal(readiness(content).score, 60);
});
