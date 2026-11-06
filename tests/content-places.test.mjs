import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildWorldGraph, placeLinks} from '../src/lib/world-graph.js';
import {contentPlaces, placesIn} from '../src/lib/content-places.js';

const data = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
const graph = buildWorldGraph(data);
const content = contentPlaces(graph);
const id = label => graph.countries.find(c => c.label === label).id;

test('present-day countries and capitals named in a text are found, including the genitive', () => {
  assert.deepEqual(placesIn(content, 'Norges grunnlov og freden i Paris').sort(), [id('Frankrike'), id('Norge')].sort());
  assert.deepEqual(placesIn(content, 'Krigen i Sør-Sudan'), [id('Sør-Sudan')], 'the longer name wins');
  assert.deepEqual(placesIn(content, 'Guinea-Bissau og Ekvatorial-Guinea'), [id('Guinea-Bissau'), id('Ekvatorial-Guinea')]);
  assert.deepEqual(placesIn(content, 'England og Skottland'), [id('Storbritannia')]);
});

test('names with another common meaning are left out instead of guessed', () => {
  assert.deepEqual(placesIn(content, 'Hagia Sofia i Konstantinopel'), []);
  assert.deepEqual(placesIn(content, 'George Washington ble født i Virginia, ikke i Georgia'), []);
  assert.deepEqual(placesIn(content, 'Elva Niger og elva Jordan'), []);
  assert.deepEqual(placesIn(content, 'norsk og fransk'), [], 'adjectives are not places');
});

test('each country gathers the topics, questions and other elements tied to it', () => {
  const norway = content.countries.get('norway');
  assert.ok(norway.topics.length > 20 && norway.questions.length > 100, `${norway.topics.length} ${norway.questions.length}`);
  for (const [country, row] of content.countries) {
    assert.ok(graph.byId.get(country)?.geo, `${country} is on the map`);
    assert.equal(new Set(row.questions).size, row.questions.length);
    assert.ok(row.total === row.topics.length + row.questions.length + row.entities);
  }
  assert.ok(content.countries.size >= 100, `${content.countries.size} countries have something`);
  assert.equal(content.max, Math.max(...[...content.countries.values()].map(r => r.total)));
  const topic = data.curriculum.units.find(u => u.id === 'vh-forste-sivilisasjoner');
  assert.ok((content.topicCountries.get(topic.id) || []).includes(id('Egypt')));
});

test('countries named in the same topic are linked, without direction, with the topic as the reason', () => {
  const {links} = placeLinks(graph, 'norway', 30, content);
  const shared = links.filter(l => l.kinds.some(k => k.kind === 'topic'));
  assert.ok(shared.length >= 5, `${shared.length}`);
  for (const link of shared) {
    assert.equal(link.count, link.out + link.in + link.shared);
    const units = content.countries.get('norway').topics.filter(u => (content.topicCountries.get(u) || []).includes(link.country));
    assert.equal(link.kinds.find(k => k.kind === 'topic').count, units.length);
  }
  assert.ok(shared[0].examples.some(e => e.kind === 'topic' && /^Emnet «.+» nevner både /.test(e.context)));
  assert.ok(links.length > placeLinks(graph, 'norway').links.length, 'many more arrows than from the registers alone');
});

test('building the index is quick and done once', () => {
  const started = performance.now();
  const again = contentPlaces(graph);
  assert.equal(again, content);
  assert.ok(performance.now() - started < 5);
});

test('each kind of line can be switched off on its own', () => {
  const content = contentPlaces(graph);
  const both = placeLinks(graph, 'norway', 200, content);
  const sourcedOnly = placeLinks(graph, 'norway', 200);
  const topicsOnly = placeLinks(graph, 'norway', 200, content, {sourced: false});
  const none = placeLinks(graph, 'norway', 200, null, {sourced: false});
  assert.ok(sourcedOnly.links.length > 0 && topicsOnly.links.length > 0);
  assert.ok(sourcedOnly.links.every(l => l.shared === 0 && l.kinds.every(k => k.kind !== 'topic')));
  assert.ok(topicsOnly.links.every(l => l.out + l.in === 0 && l.kinds.every(k => k.kind === 'topic') && l.examples.every(e => e.kind === 'topic')));
  assert.deepEqual(none, {home: 'norway', links: [], total: 0, lensSees: false});
  const countries = new Set([...sourcedOnly.links, ...topicsOnly.links].map(l => l.country));
  assert.equal(both.total, countries.size);
});
