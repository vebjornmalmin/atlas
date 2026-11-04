import {formatYear} from './core-curriculum.js';

// «Nærmest i tid»: which of two dated things lies closer in time to a third?
// Distances are measured between the dated years of the anchors (`year`), in years.
export const MAX_DISTANCE_TARGETS = 120;
const MIN_GAP_YEARS = 30;
const MIN_GAP_SHARE = .15;
const MAX_APPEARANCES = 12;

const uncertainty = anchor => anchor.approximate ? (anchor.uncertainty ?? 0) : 0;
const pairKey = (x, y) => [x, y].sort().join('|');
const withSpace = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Distances and the margin between them for an A, B, C triple. */
export function distanceFacts(a, b, c) {
  const db = Math.abs(b.year - a.year), dc = Math.abs(c.year - a.year);
  const near = db <= dc ? b : c, far = near === b ? c : b;
  const dNear = Math.min(db, dc), dFar = Math.max(db, dc);
  const gap = dFar - dNear;
  const margin = gap >= MIN_GAP_YEARS && gap >= MIN_GAP_SHARE * dFar && gap > uncertainty(a) + uncertainty(b) + uncertainty(c);
  return {near, far, dNear, dFar, gap, margin};
}

const when = anchor => `${anchor.approximate ? 'omkring ' : ''}${formatYear(anchor.year)}`;
const span = (years, approximate) => `${approximate ? 'omtrent ' : ''}${withSpace(years)} år`;
const direction = (from, to) => to.year > from.year ? 'etter' : 'før';

/**
 * Build questions «Hva ligger nærmest [A] i tid: [B] eller [C]?».
 * Surprising triples come first: the item that shares A's region is the one further away.
 * Each unordered pair of anchors is used at most once, and no anchor appears too often.
 */
export function buildDistanceTargets(anchors = []) {
  const candidates = [];
  for (const a of anchors) {
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const b = anchors[i], c = anchors[j];
        if (b.id === a.id || c.id === a.id) continue;
        const facts = distanceFacts(a, b, c);
        if (!facts.margin) continue;
        const surprising = facts.far.region === a.region && facts.near.region !== a.region;
        candidates.push({a, b, c, facts, score: surprising ? 2 : 1});
      }
    }
  }
  // A real but not trivial contrast: the farther distance is about one and a half times the nearer one.
  const contrast = ({facts}) => Math.abs(Math.log(facts.dFar / facts.dNear) - Math.log(1.5));
  candidates.sort((x, y) => y.score - x.score || contrast(x) - contrast(y) || [x.a.id, x.b.id, x.c.id].join().localeCompare([y.a.id, y.b.id, y.c.id].join()));

  const usedPairs = new Set(), appearances = new Map(), seen = new Set(), result = [];
  for (const {a, b, c, facts} of candidates) {
    if (result.length >= MAX_DISTANCE_TARGETS) break;
    const [first, second] = [b, c].sort((x, y) => x.id.localeCompare(y.id));
    const keys = [pairKey(a.id, first.id), pairKey(a.id, second.id), pairKey(first.id, second.id)];
    if (keys.some(key => usedPairs.has(key))) continue;
    if ([a, first, second].some(item => (appearances.get(item.id) || 0) >= MAX_APPEARANCES)) continue;
    const id = `distance:${a.id}:${first.id}:${second.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    keys.forEach(key => usedPairs.add(key));
    [a, first, second].forEach(item => appearances.set(item.id, (appearances.get(item.id) || 0) + 1));

    const near = facts.near, far = facts.far;
    const approximate = [a, first, second].some(item => item.approximate);
    const sources = [];
    for (const source of [...a.sources, ...first.sources, ...second.sources]) {
      if (!sources.some(existing => existing.url === source.url)) sources.push(source);
    }
    result.push({
      id,
      mode: 'distance',
      kind: 'connections',
      collectionIds: ['verdenshistorie'],
      prompt: `Hva ligger nærmest ${a.label} i tid: ${first.label} eller ${second.label}?`,
      anchor: a.id,
      options: [first.id, second.id],
      correctId: near.id,
      answer: near.label,
      explanation: `${a.label}: ${when(a)}. ${near.label}: ${when(near)}, ${span(facts.dNear, approximate)} ${direction(a, near)}. ${far.label}: ${when(far)}, ${span(facts.dFar, approximate)} ${direction(a, far)}.`,
      sources,
      sourceIds: [],
      familiarity: Math.max(a.familiarity, first.familiarity, second.familiarity),
      significance: 3
    });
  }
  return result;
}

/** Correct when the learner chose the anchor closer in time. */
export function gradeDistance(target, draft = {}) {
  return {correct: draft.choice === target.correctId};
}

/** A choice is needed before the question can be checked. */
export function distanceReady(target, draft = {}) {
  return Boolean(draft.choice);
}
