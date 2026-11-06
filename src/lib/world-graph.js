// In-memory graph over the installed package. Lenses are weighted projections of the same nodes and
// edges; relevance blends network impact, news actuality and distance from home.
export const DEFAULT_RELEVANCE = {impact: 50, actuality: 25, locality: 25};
const COUNTRY_TYPES = ['country', 'country-area'];
const NORWAY_TYPES = ['municipality', 'county', 'former-county'];

export function distanceKm(a, b) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function buildWorldGraph(data) {
  const byId = new Map(data.entities.map(e => [e.id, e]));
  const adjacency = new Map(data.entities.map(e => [e.id, []]));
  for (const r of data.relationships) {
    if (!adjacency.has(r.from) || !adjacency.has(r.to)) continue;
    adjacency.get(r.from).push({relation: r, other: r.to, outgoing: true});
    adjacency.get(r.to).push({relation: r, other: r.from, outgoing: false});
  }
  const perspectives = data.perspectives || {lenses: [], impact: {}, countryStats: {}, news: {}};
  const norway = byId.get('norway');
  // Each node is placed in at most one present-day country so that lenses can be drawn on the map.
  const countryOf = new Map();
  const firstVia = (id, type, outgoing = true) => adjacency.get(id).find(l => l.relation.type === type && l.outgoing === outgoing)?.other;
  for (const e of data.entities) {
    let country = null;
    if (COUNTRY_TYPES.includes(e.type)) country = e.id;
    else if (NORWAY_TYPES.includes(e.type) || e.collectionIds.includes('norway')) country = norway?.id;
    else if (e.type === 'city') country = firstVia(e.id, 'capital-of');
    else if (e.type === 'person') country = firstVia(e.id, 'birthplace-in-current-country');
    else if (e.type === 'organization') country = firstVia(e.id, 'located-in-country');
    else if (e.type === 'news-event') country = e.metadata?.primaryEntityId;
    else if (e.type === 'scholarly-work') { const author = firstVia(e.id, 'author-of', false); country = author && firstVia(author, 'birthplace-in-current-country'); }
    else if (e.type === 'event') country = firstVia(e.id, 'took-place-in');
    if (country && byId.get(country) && !COUNTRY_TYPES.includes(byId.get(country).type)) country = countryOfPerson(country);
    if (country && byId.has(country)) countryOf.set(e.id, country);
  }
  function countryOfPerson(id) { return firstVia(id, 'birthplace-in-current-country') || null; }
  const news = data.entities.filter(e => e.type === 'news-event').sort((a, b) => b.metadata.date.localeCompare(a.metadata.date));
  const countries = data.entities.filter(e => e.geo);
  const regionToCountry = new Map(countries.map(e => [e.geo.mapRegionId, e.id]));
  const neighbours = new Map(countries.map(c => [c.id, adjacency.get(c.id).filter(l => l.relation.type === 'borders').map(l => l.other)]));
  const members = new Map();
  for (const [id, country] of countryOf) { if (!members.has(country)) members.set(country, []); members.get(country).push(id); }
  return {data, byId, adjacency, countryOf, members, perspectives, lenses: perspectives.lenses || [], news, countries, regionToCountry, neighbours};
}

// Only relations that say something across borders are drawn as connections on the map; borders,
// regions and capitals are geography, and the neighbours are shown already.
const LINK_KINDS = {'knowledge-flow': 'nobel', 'award-time-affiliation': 'nobel', influenced: 'ideas', mentions: 'news'};

/**
 * Countries a place is connected to, strongest first. A country gathers the links of everything placed
 * in it; anything else (a person, a news story) uses its own links, drawn from its country. Nobel
 * links use the national tally where one exists, so laureates are not counted twice. With `content`
 * (from contentPlaces), a country is also linked to the countries named in the same topics; those
 * links have no direction.
 */
// `sourced: false` leaves out the register's own links (Nobel prizes, influence, news); without
// `content` there are no shared-topic links. The map's switches turn each kind off this way.
export function placeLinks(graph, id, limit = 10, content = null, {sourced = true} = {}) {
  const entity = graph.byId.get(id);
  const home = entity?.geo ? id : graph.countryOf.get(id) || null;
  if (!home) return {home: null, links: [], total: 0};
  const sources = entity.geo ? [home, ...(graph.members.get(home) || []).filter(m => m !== home)] : [id];
  const partners = new Map();
  if (sourced) for (const source of sources) for (const link of graph.adjacency.get(source) || []) {
    const kind = LINK_KINDS[link.relation.type];
    const other = kind && graph.countryOf.get(link.other);
    if (!other || other === home || !graph.byId.get(other)?.geo?.mapRegionId) continue;
    if (!partners.has(other)) partners.set(other, {country: other, tally: {}, items: {}, examples: []});
    const p = partners.get(other), direction = link.outgoing ? 'out' : 'in', key = `${kind}:${direction}`;
    if (link.relation.type === 'knowledge-flow') p.tally[key] = (p.tally[key] || 0) + (link.relation.count || 1);
    else {
      p.items[key] = (p.items[key] || 0) + 1;
      // Name the person or story behind the link, not the institution at the other end.
      const ends = [source, link.other].filter(e => e !== home).map(e => graph.byId.get(e)).filter(Boolean);
      const who = ends.find(e => e.type === 'person') || ends.find(e => e.type === 'news-event') || ends[0];
      if (who && p.examples.length < 3 && !p.examples.some(e => e.id === who.id)) p.examples.push({id: who.id, label: who.label, context: link.relation.context, kind, direction});
    }
    if (link.relation.type === 'knowledge-flow' && !p.flowContext) p.flowContext = link.relation.context;
  }
  const shared = {}, topicExamples = {};
  if (content && entity.geo) for (const unitId of content.countries.get(home)?.topics || []) {
    const title = graph.byId.get(`unit:${unitId}`)?.label;
    for (const other of content.topicCountries.get(unitId) || []) {
      if (other === home || !graph.byId.get(other)?.geo?.mapRegionId) continue;
      shared[other] = (shared[other] || 0) + 1;
      if (!topicExamples[other]) topicExamples[other] = [];
      if (title && topicExamples[other].length < 3) topicExamples[other].push({id: `unit:${unitId}`, unitId, label: title, context: `Emnet «${title}» nevner både ${graph.byId.get(home).label} og ${graph.byId.get(other).label}.`, kind: 'topic', direction: 'both'});
    }
  }
  for (const other of Object.keys(shared)) if (!partners.has(other)) partners.set(other, {country: other, tally: {}, items: {}, examples: []});
  const links = [...partners.values()].map(p => {
    const counts = {};
    for (const key of new Set([...Object.keys(p.tally), ...Object.keys(p.items)])) counts[key] = p.tally[key] ?? p.items[key];
    const sum = test => Object.entries(counts).filter(([key]) => test(key)).reduce((total, [, n]) => total + n, 0);
    const kinds = ['nobel', 'ideas', 'news'].map(kind => ({kind, count: sum(key => key.startsWith(`${kind}:`))})).filter(k => k.count);
    const together = shared[p.country] || 0;
    if (together) kinds.push({kind: 'topic', count: together});
    const flow = p.flowContext ? [{id: p.country, label: graph.byId.get(p.country).label, context: p.flowContext, kind: 'nobel', direction: counts['nobel:out'] ? 'out' : 'in'}] : [];
    // Both kinds get an example; the kind with more links comes first.
    const register = p.examples.length ? p.examples : flow, topics = topicExamples[p.country] || [];
    const first = together > sum(() => true) ? topics : register, second = first === topics ? register : topics;
    const examples = [...first.slice(0, second.length ? 2 : 3), ...second].slice(0, 3);
    return {country: p.country, out: sum(key => key.endsWith(':out')), in: sum(key => key.endsWith(':in')), shared: together, count: sum(() => true) + together, kinds, examples};
  }).sort((a, b) => b.count - a.count || graph.byId.get(a.country).label.localeCompare(graph.byId.get(b.country).label, 'nb'));
  return {home, links: links.slice(0, limit), total: links.length};
}

export function newsWeight(item, now = new Date(), halfLife = 14) {
  const age = Math.max(0, (now - new Date(`${item.metadata.date}T12:00:00Z`)) / 86400000);
  return (item.metadata.impact || 3) / 5 * 0.5 ** (age / halfLife);
}

export function actuality(graph, now = new Date()) {
  const halfLife = graph.perspectives.news?.halfLifeDays || 14;
  const score = new Map();
  const raise = (id, value) => score.set(id, Math.min(1, Math.max(score.get(id) || 0, value)));
  for (const item of graph.news) {
    const weight = newsWeight(item, now, halfLife);
    raise(item.id, weight);
    for (const link of graph.adjacency.get(item.id)) {
      if (link.relation.type !== 'mentions') continue;
      raise(link.other, weight);
      // Actuality spills a little to capitals and neighbours of a place in the news.
      for (const near of graph.adjacency.get(link.other)) {
        if (near.relation.type === 'capital-of') raise(near.other, weight * .5);
        if (near.relation.type === 'borders') raise(near.other, weight * .2);
      }
    }
  }
  return score;
}

export function locality(graph, id) {
  const country = graph.byId.get(graph.countryOf.get(id));
  if (!country?.geo) return graph.countryOf.get(id) === 'norway' ? 1 : 0;
  return 1 / (1 + country.geo.distanceKm / 1500);
}

export function relevanceScores(graph, weights = DEFAULT_RELEVANCE, now = new Date()) {
  const total = (weights.impact || 0) + (weights.actuality || 0) + (weights.locality || 0) || 1;
  const current = actuality(graph, now);
  const scores = new Map();
  for (const e of graph.data.entities) {
    const impact = (graph.perspectives.impact?.[e.id] ?? 0) / 100;
    scores.set(e.id, ((weights.impact || 0) * impact + (weights.actuality || 0) * (current.get(e.id) || 0) + (weights.locality || 0) * locality(graph, e.id)) / total);
  }
  return {scores, actuality: current};
}

function affinity(graph, lens, entity) {
  let value = lens.types?.[entity.type] || 0;
  for (const [collection, weight] of Object.entries(lens.collections || {})) if (entity.collectionIds.includes(collection)) value = Math.max(value, weight);
  for (const [attribute, values] of Object.entries(lens.attributes || {})) value += values[entity.metadata?.[attribute]] || 0;
  if (entity.type === 'news-event') value += lens.newsDomains?.[entity.metadata.domain] || 0;
  let edges = 0, exemplar = 0;
  for (const link of graph.adjacency.get(entity.id)) {
    edges += lens.relations?.[link.relation.type] || 0;
    if (link.relation.type === 'views-through' && link.other === lens.entityId) exemplar = 1.5;
    if (link.other === lens.entityId) exemplar = Math.max(exemplar, 1.2);
  }
  // Connections count fully only for node types the lens looks for; otherwise big hubs would dominate every lens.
  return value + Math.log1p(edges) * (value > 0 ? 1 : .3) + exemplar;
}

const ratio = (a, b) => (b ? a / b : null);
function metricScore(lens, stats) {
  if (!stats) return null;
  if (lens.metric === 'flow-balance') return stats.inflow + stats.outflow >= 2 ? (stats.inflow - stats.outflow) / (stats.inflow + stats.outflow) / 2 + .5 : null;
  if (lens.metric === 'recognized-abroad') return stats.born >= 3 ? ratio(stats.outflow, stats.born) : null;
  if (lens.metric === 'women-recognized') return stats.born >= 3 ? ratio(stats.women, stats.born) : null;
  return null;
}
export const METRIC_NOTES = {
  'flow-balance': 'Mørk farge: flere prisvinnere kom inn fra andre land enn landet sendte ut. Lys farge: flere reiste ut. Grått: for få tilfeller.',
  'recognized-abroad': 'Andel av landets prisvinnere som var tilknyttet en institusjon i et annet land da de fikk prisen. Minst tre prisvinnere kreves.',
  'women-recognized': 'Andel kvinner blant Nobelprisvinnere født i landet. Minst tre prisvinnere kreves.',
  'source-depth': 'Hvor mange ulike kilder Atlas har for steder, personer og hendelser knyttet til landet.'
};

/** Scores every node and country under one lens, or under plain relevance when no lens is chosen. */
export function lensView(graph, lensId, weights, now = new Date()) {
  const lens = graph.lenses.find(l => l.id === lensId) || null;
  const blend = lens && !weights ? lens.weights : weights || DEFAULT_RELEVANCE;
  const {scores: relevance, actuality: current} = relevanceScores(graph, blend, now);
  const scores = new Map();
  let maxAffinity = 0;
  const affinities = new Map();
  for (const e of graph.data.entities) {
    const a = lens ? affinity(graph, lens, e) : 1;
    affinities.set(e.id, a); maxAffinity = Math.max(maxAffinity, a);
  }
  for (const e of graph.data.entities) {
    const a = affinities.get(e.id) / (maxAffinity || 1);
    scores.set(e.id, a ? a * (.25 + .75 * relevance.get(e.id)) : 0);
  }
  const countryScores = new Map();
  if (lens?.metric && lens.metric !== 'source-depth') {
    for (const c of graph.countries) { const m = metricScore(lens, graph.perspectives.countryStats?.[c.id]); if (m !== null) countryScores.set(c.id, m); }
  } else {
    // Colour by how much more a lens sees in a country than the neutral view does (lift), damped for small samples,
    // blended with volume. Volume alone would paint every lens like the Nobel register: USA, Britain, Germany, France.
    const sum = new Map(), base = new Map();
    for (const e of graph.data.entities) {
      const country = graph.countryOf.get(e.id); if (!country) continue;
      const value = lens?.metric === 'source-depth' ? e.sourceIds.length * (.5 + .5 * relevance.get(e.id)) : scores.get(e.id);
      sum.set(country, (sum.get(country) || 0) + value);
      base.set(country, (base.get(country) || 0) + .25 + .75 * relevance.get(e.id));
    }
    const max = Math.max(0, ...sum.values());
    const totalSum = [...sum.values()].reduce((a, b) => a + b, 0), totalBase = [...base.values()].reduce((a, b) => a + b, 0);
    const mean = totalSum / (totalBase || 1), damping = 8;
    const lift = new Map([...sum].map(([id, value]) => [id, (value + damping * mean) / (base.get(id) + damping)]));
    const maxLift = Math.max(0, ...lift.values());
    // A country the lens does not see at all stays uncoloured instead of inheriting the average lift.
    for (const [id, value] of sum) if (graph.byId.get(id)?.geo && value > 1e-6) {
      const volume = Math.sqrt(value / (max || 1));
      countryScores.set(id, lens ? .45 * volume + .55 * lift.get(id) / (maxLift || 1) : volume);
    }
  }
  const ranked = graph.data.entities.filter(e => scores.get(e.id) > 0 && e.type !== 'lens' && e.id !== lens?.entityId)
    .sort((a, b) => scores.get(b.id) - scores.get(a.id) || a.label.localeCompare(b.label, 'nb'));
  const seen = lens ? graph.data.entities.filter(e => affinities.get(e.id) >= .5).length : graph.data.entities.length;
  return {lens, weights: blend, scores, relevance, actuality: current, countryScores, ranked,
    coverage: {nodes: seen, share: seen / graph.data.entities.length}};
}

/** Neighbours of a node ordered by how strongly the lens weights the connecting relation. */
export function relatedThrough(graph, id, view, limit = 8) {
  const lens = view?.lens;
  const best = new Map();
  for (const link of graph.adjacency.get(id) || []) {
    const weight = (lens?.relations?.[link.relation.type] ?? (lens ? .1 : .5)) + (view?.scores.get(link.other) || 0);
    const previous = best.get(link.other);
    if (!previous || previous.weight < weight) best.set(link.other, {entity: graph.byId.get(link.other), relation: link.relation, outgoing: link.outgoing, weight});
  }
  return [...best.values()].filter(x => x.entity && x.entity.type !== 'award-event').sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/** Lenses ranked by how much they see in one node: the basis for switching perspective. */
export function lensesFor(graph, id) {
  const entity = graph.byId.get(id); if (!entity) return [];
  return graph.lenses.map(lens => {
    let score = affinity(graph, lens, entity);
    const metric = metricScore(lens, graph.perspectives.countryStats?.[id]);
    if (metric !== null) score += metric;
    const reason = graph.adjacency.get(id).find(l => l.relation.type === 'views-through' && l.other === lens.entityId)?.relation.context;
    return {lens, score, reason};
  }).filter(x => x.score > .3).sort((a, b) => b.score - a.score);
}

class Heap {
  items = [];
  get size() { return this.items.length; }
  push(item) {
    const a = this.items; a.push(item);
    for (let i = a.length - 1, p; i && a[p = (i - 1) >> 1][0] > a[i][0]; i = p) [a[i], a[p]] = [a[p], a[i]];
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

/** Cheapest chain between two nodes; hubs cost more so paths stay meaningful. */
export function findPath(graph, from, to, lens = null, maxCost = 40) {
  if (!graph.byId.has(from) || !graph.byId.has(to)) return null;
  const cost = new Map([[from, 0]]), previous = new Map(), done = new Set();
  const queue = new Heap(); queue.push([0, from]);
  while (queue.size) {
    const [c, id] = queue.pop();
    if (done.has(id)) continue; done.add(id);
    if (id === to) break;
    if (c > maxCost) return null;
    for (const link of graph.adjacency.get(id)) {
      const other = link.other;
      if (done.has(other)) continue;
      const hub = Math.log1p(graph.adjacency.get(other).length) * .45;
      const preferred = lens?.relations?.[link.relation.type] || 0;
      const next = c + Math.max(.2, 1 + hub - preferred * .6);
      if (next < (cost.get(other) ?? Infinity)) { cost.set(other, next); previous.set(other, {from: id, relation: link.relation}); queue.push([next, other]); }
    }
  }
  if (!previous.has(to) && from !== to) return null;
  const steps = [];
  for (let id = to; id !== from; id = previous.get(id).from) steps.unshift({from: previous.get(id).from, to: id, relation: previous.get(id).relation});
  return steps;
}

export function shortestBorderPath(graph, from, to) {
  const previous = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const id = queue.shift(); if (id === to) break;
    for (const next of graph.neighbours.get(id) || []) if (!previous.has(next)) { previous.set(next, id); queue.push(next); }
  }
  if (!previous.has(to)) return null;
  const path = []; for (let id = to; id; id = previous.get(id)) path.unshift(id);
  return path;
}

/** Share of top results two lenses have in common. Low overlap means the lenses genuinely differ. */
export function lensOverlap(viewA, viewB, size = 25) {
  const a = new Set(viewA.ranked.slice(0, size).map(e => e.id)), b = viewB.ranked.slice(0, size).map(e => e.id);
  return b.filter(id => a.has(id)).length / size;
}

export function validatePerspectives(data) {
  const p = data.perspectives;
  if (p === undefined) return [];
  if (!p || p.version !== 1) return ['Unsupported perspective layer.'];
  const errors = [], entities = new Map((data.entities || []).filter(Boolean).map(e => [e.id, e]));
  const ids = new Set();
  for (const lens of p.lenses || []) {
    if (!lens?.id || ids.has(lens.id)) { errors.push('Duplicate or missing lens ID.'); continue; }
    ids.add(lens.id);
    if (entities.get(lens.entityId)?.type !== 'lens') errors.push(`${lens.id}: lens entity missing.`);
    for (const key of ['name', 'question', 'summary', 'critique', 'blindspot']) if (typeof lens[key] !== 'string' || !lens[key].trim()) errors.push(`${lens.id}: missing ${key}.`);
    const w = lens.weights || {};
    if (!['impact', 'actuality', 'locality'].every(k => Number.isFinite(w[k]) && w[k] >= 0 && w[k] <= 100)) errors.push(`${lens.id}: invalid relevance weights.`);
    for (const id of lens.thinkerIds || []) if (entities.get(id)?.type !== 'person') errors.push(`${lens.id}: unknown thinker ${id}.`);
  }
  for (const t of p.thresholds || []) if (entities.get(t.id)?.type !== 'threshold' || !(t.approxYearsAgo > 0)) errors.push(`${t.id}: invalid threshold.`);
  for (const [id, value] of Object.entries(p.impact || {})) if (!entities.has(id) || !Number.isInteger(value) || value < 0 || value > 100) { errors.push(`${id}: invalid impact.`); break; }
  if (p.news && !/^\d{4}-\d{2}-\d{2}$/.test(p.news.snapshotDate || '')) errors.push('News snapshot needs a date.');
  for (const e of entities.values()) {
    if (e.type === 'news-event' && (!/^\d{4}-\d{2}-\d{2}$/.test(e.metadata?.date || '') || !/^https:\/\//.test(e.metadata?.url || ''))) errors.push(`${e.id}: news needs a date and HTTPS link.`);
    if (e.geo && (!Number.isFinite(e.geo.distanceKm) || Math.abs(e.geo.lat) > 90 || Math.abs(e.geo.lon) > 180)) errors.push(`${e.id}: invalid position.`);
  }
  return errors;
}
