import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildWorldGraph, placeLinks} from '../src/lib/world-graph.js';

const data = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const graph = buildWorldGraph(data);

test('a country links only to other mapped countries, through sourced Nobel, influence and news relations', () => {
  const {links, total} = placeLinks(graph, 'norway');
  assert.ok(links.length > 0 && links.length <= 10, `${links.length}`);
  assert.ok(total >= links.length);
  for (const link of links) {
    assert.notEqual(link.country, 'norway');
    assert.ok(graph.byId.get(link.country).geo?.mapRegionId, `${link.country} is on the map`);
    assert.ok(link.count > 0 && link.count === link.out + link.in + link.shared);
    assert.ok(link.kinds.every(k => ['nobel', 'ideas', 'news', 'topic'].includes(k.kind) && k.count > 0));
    assert.ok(link.examples.length >= 1 && link.examples.length <= 3);
    assert.ok(link.examples.every(e => e.context));
  }
  for (let i = 1; i < links.length; i++) assert.ok(links[i - 1].count >= links[i].count, 'strongest first');
});

test('Nobel links are not counted twice from the national tally and the laureates behind it', () => {
  const flow = data.relationships.find(r => r.type === 'knowledge-flow' && r.from === 'norway');
  const link = placeLinks(graph, 'norway', 200).links.find(l => l.country === flow.to);
  const nobel = link.kinds.find(k => k.kind === 'nobel');
  const laureates = graph.adjacency.get(flow.to).length; // sanity: the partner exists in the graph
  assert.ok(laureates > 0);
  const flows = data.relationships.filter(r => r.type === 'knowledge-flow' && ((r.from === 'norway' && r.to === flow.to) || (r.to === 'norway' && r.from === flow.to)));
  assert.equal(nobel.count, flows.reduce((sum, r) => sum + (r.count || 1), 0));
});

test('a person is linked from the country of birth to where the work was done', () => {
  const medawar = data.entities.find(e => e.label === 'Peter Medawar');
  const {home, links} = placeLinks(graph, medawar.id);
  assert.equal(home, graph.countryOf.get(medawar.id));
  assert.ok(links.some(l => l.out > 0 && l.kinds.some(k => k.kind === 'nobel')));
});

test('places without such relations get nothing to draw', () => {
  const quiet = graph.countries.find(c => placeLinks(graph, c.id).links.length === 0);
  assert.ok(quiet, 'some countries have no drawn links');
  assert.deepEqual(placeLinks(graph, 'no-such-id'), {home: null, links: [], total: 0});
});

test('examples name the people behind a link, each once', () => {
  const germany = placeLinks(graph, 'geo-usa').links.find(l => l.country === 'germany' || graph.byId.get(l.country).label === 'Tyskland');
  assert.ok(germany);
  const ids = germany.examples.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(germany.examples.every(e => ['person', 'news-event'].includes(graph.byId.get(e.id).type)), germany.examples.map(e => e.label).join(', '));
});
