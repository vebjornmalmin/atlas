// Where the app's content is: every topic, question and other element tied to a present-day country.
// A topic or question is tied to a country when its own text names the country or its capital; a
// register question also through the entity it asks about. Nothing is guessed: names with another
// common meaning are left out, and historical names are not translated into today's countries.

// Other names for a whole present-day country. England and Scotland are part of the United Kingdom.
const ALIASES = {England: 'Storbritannia', Skottland: 'Storbritannia', Wales: 'Storbritannia', 'Nord-Irland': 'Storbritannia', Holland: 'Nederland'};
// Country and capital names that just as often mean something else in the texts: a US state, a river,
// a person or a building (Hagia Sofia).
const AMBIGUOUS = new Set(['Georgia', 'Jordan', 'Niger', 'Sofia', 'Victoria', 'Hamilton', 'Kingston', 'Santiago', 'San José', 'San Juan', 'San Salvador', 'Saint John\'s', 'George Town', 'Georgetown', 'The Valley', 'Road Town', 'Avarua']);

const cache = new WeakMap();
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textOf = values => values.filter(value => typeof value === 'string').join(' \n ');

/** The countries a text names, in the order they first appear. */
export function placesIn(content, text) {
  const found = [];
  for (const match of String(text || '').matchAll(content.pattern)) {
    const country = content.names.get(match[1]);
    if (country && !found.includes(country)) found.push(country);
  }
  return found;
}

export function contentPlaces(graph) {
  if (cache.has(graph)) return cache.get(graph);
  const names = new Map();
  for (const country of graph.countries) names.set(country.label, country.id);
  for (const entity of graph.data.entities) {
    if (entity.type !== 'city' || names.has(entity.label)) continue;
    const country = graph.countryOf.get(entity.id);
    if (country && graph.byId.get(country)?.geo) names.set(entity.label, country);
  }
  for (const [alias, label] of Object.entries(ALIASES)) {
    const country = graph.countries.find(c => c.label === label);
    if (country) names.set(alias, country.id);
  }
  for (const name of AMBIGUOUS) names.delete(name);
  const longestFirst = [...names.keys()].sort((a, b) => b.length - a.length).map(escape);
  // A name stands alone (not part of Sør-Sudan or Guinea-Bissau) and may take the genitive s.
  const pattern = new RegExp(`(?<![\\p{L}-])(${longestFirst.join('|')})s?(?![\\p{L}-])`, 'gu');
  const content = {names, pattern, countries: new Map(), topicCountries: new Map(), max: 0};

  const row = country => {
    if (!content.countries.has(country)) content.countries.set(country, {topics: [], questions: [], entities: 0, total: 0});
    return content.countries.get(country);
  };
  const onMap = id => graph.byId.get(id)?.geo ? id : null;

  const questionsOf = new Map();
  for (const target of graph.data.targets) {
    const places = new Set(placesIn(content, textOf([target.prompt, target.answer, target.explanation])));
    if (!target.unitId) for (const entity of [target.entityId, ...(target.relatedEntityIds || [])]) {
      const country = onMap(graph.countryOf.get(entity));
      if (country) places.add(country);
    }
    for (const country of places) row(country).questions.push(target.id);
    if (target.unitId) {
      if (!questionsOf.has(target.unitId)) questionsOf.set(target.unitId, new Set());
      for (const country of places) questionsOf.get(target.unitId).add(country);
    }
  }
  for (const unit of graph.data.curriculum?.units || []) {
    const places = new Set([...placesIn(content, textOf([unit.title, unit.summary, unit.lesson, ...(unit.keyPoints || [])])), ...(questionsOf.get(unit.id) || [])]);
    if (!places.size) continue;
    content.topicCountries.set(unit.id, [...places]);
    for (const country of places) row(country).topics.push(unit.id);
  }
  for (const [country, members] of graph.members) {
    if (!onMap(country)) continue;
    const count = members.filter(id => id !== country && graph.byId.get(id)?.type !== 'award-event').length;
    if (count) row(country).entities += count;
  }
  for (const value of content.countries.values()) {
    value.total = value.topics.length + value.questions.length + value.entities;
    content.max = Math.max(content.max, value.total);
  }
  cache.set(graph, content);
  return content;
}
