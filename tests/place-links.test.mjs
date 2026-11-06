import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildWorldGraph, placeLinks, lensLinkWeights} from '../src/lib/world-graph.js';

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
  assert.deepEqual(placeLinks(graph, 'no-such-id'), {home: null, links: [], total: 0, lensSees: false});
});

test('examples name the people behind a link, each once', () => {
  const germany = placeLinks(graph, 'geo-usa').links.find(l => l.country === 'germany' || graph.byId.get(l.country).label === 'Tyskland');
  assert.ok(germany);
  const ids = germany.examples.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(germany.examples.every(e => ['person', 'news-event'].includes(graph.byId.get(e.id).type)), germany.examples.map(e => e.label).join(', '));
});

test('a lens puts the kinds of line it weights first and marks the rest', () => {
  const lens = id => graph.lenses.find(l => l.id === id);
  assert.deepEqual(lensLinkWeights(null), {nobel: 0, ideas: 0, news: 0, topic: 0});
  assert.equal(lensLinkWeights(lens('world-system')).nobel, 1);
  assert.equal(lensLinkWeights(lens('networks')).ideas, 1);
  assert.equal(lensLinkWeights(lens('geopolitics')).news, 0.7);
  // Verdenssystem weights Nobel links only: every link it ranks first has one, and later ones have none.
  const world = placeLinks(graph, 'norway', 200, null, {lens: lens('world-system')});
  assert.ok(world.lensSees);
  const firstQuiet = world.links.findIndex(l => !l.lensWeight);
  const seen = firstQuiet < 0 ? world.links : world.links.slice(0, firstQuiet);
  assert.ok(seen.length > 0 && seen.every(l => l.kinds.some(k => k.kind === 'nobel')));
  if (firstQuiet >= 0) assert.ok(world.links.slice(firstQuiet).every(l => !l.lensWeight && !l.kinds.some(k => k.kind === 'nobel')));
  // A lens that weights none of the kinds changes nothing: same links in the same order, none marked.
  const plain = placeLinks(graph, 'norway', 200), civ = placeLinks(graph, 'norway', 200, null, {lens: lens('civilizations')});
  assert.equal(civ.lensSees, false);
  assert.deepEqual(civ.links.map(l => l.country), plain.links.map(l => l.country));
});
