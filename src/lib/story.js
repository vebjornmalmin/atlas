// One story through time. New units are opened roughly in chronological order across subjects,
// alternating with timeless units, so each day reads as a chapter: an era, a place, and what
// happened elsewhere at the same time. Perspectives are woven into the session rather than
// living on their own page.
import {levelAccepts} from './levels.js';
import {buildTimelineExercise} from './exercises.js';
import {formatYear} from './core-curriculum.js';

export const ERAS = [
  {id:'prehistory', label:'Forhistorie og oldtid', from:-100000, to:499},
  {id:'middle-ages', label:'Middelalder', from:500, to:1499},
  {id:'early-modern', label:'Tidlig moderne tid', from:1500, to:1799},
  {id:'nineteenth', label:'1800-tallet', from:1800, to:1899},
  {id:'twentieth', label:'1900-tallet', from:1900, to:1999},
  {id:'now', label:'Vår tid', from:2000, to:3000}
];
export const eraOf = year => ERAS.find(e => year >= e.from && year <= e.to) || ERAS[0];
export const unitYear = unit => unit?.years ? unit.years.from : null;
export const yearSpan = unit => !unit?.years ? '' : unit.years.from === unit.years.to ? formatYear(unit.years.from) : `${formatYear(unit.years.from)}–${formatYear(unit.years.to)}`;

/**
 * The order in which ready, unstarted units appear: dated units chronologically, continuing from
 * where the learner's story has reached, with a timeless unit (science, geography, society) between.
 */
export function storyOrder(units, progress, cursor = null) {
  const ready = units.filter(u => progress.units.get(u.id)?.status === 'new' && progress.units.get(u.id).ready);
  const dated = ready.filter(u => u.years).sort((a, b) => a.years.from - b.years.from || a.tier - b.tier || a.order - b.order);
  const timeless = ready.filter(u => !u.years).sort((a, b) => a.tier - b.tier || a.order - b.order);
  // Start the dated thread at the story cursor so the next chapter follows the last one in time.
  const start = cursor === null ? 0 : Math.max(0, dated.findIndex(u => u.years.from >= cursor - 50));
  const thread = start > 0 && start < dated.length ? [...dated.slice(start), ...dated.slice(0, start)] : dated;
  const result = [];
  while (thread.length || timeless.length) {
    if (thread.length) result.push(thread.shift());
    if (timeless.length) result.push(timeless.shift());
  }
  return result;
}

/** How far the story has come: the latest start year among units the learner has begun. */
export function storyCursor(curriculum, progress) {
  const begun = (curriculum?.units || []).filter(u => u.years && progress.units.get(u.id)?.status !== 'new');
  return begun.length ? Math.max(...begun.map(u => u.years.from)) : null;
}

/** A short chapter title for the day: the dated unit's era and span. */
export function chapterFor(unitIds, curriculum) {
  const units = unitIds.map(id => curriculum?.units.find(u => u.id === id)).filter(Boolean);
  const dated = units.find(u => u.years);
  if (!dated) return units.length ? {title: units[0].title, era: 'Tidløst', span: '', year: null} : null;
  return {title: dated.title, era: eraOf(dated.years.from).label, span: yearSpan(dated), year: dated.years.from};
}

/**
 * «Samtidig i verden»: which came first, an event from one unit or one from a unit in another subject
 * that lies close in time? Built from the dated items in the curriculum's ordering cards.
 */
export function simultaneityTargets(data) {
  const curriculum = data?.curriculum;
  if (!curriculum) return [];
  const domainTitle = id => curriculum.domains.find(d => d.id === id)?.title || '';
  const order = data.targets.filter(t => t.unitId && t.cardType === 'order' && t.timeline?.items?.length);
  const itemsOf = new Map();
  for (const card of order) itemsOf.set(card.unitId, [...(itemsOf.get(card.unitId) || []), ...card.timeline.items.map(item => ({...item, card}))]);
  const units = curriculum.units.filter(u => u.years && itemsOf.has(u.id)).sort((a, b) => a.years.from - b.years.from);
  const result = [];
  for (const [i, unit] of units.entries()) {
    const partners = units.filter((other, j) => other.domainId !== unit.domainId && j > i &&
      other.years.from <= unit.years.to + 60 && other.years.to >= unit.years.from - 60).slice(0, 3);
    for (const other of partners) {
      const pairs = [];
      for (const a of itemsOf.get(unit.id)) for (const b of itemsOf.get(other.id)) {
        const gap = Math.abs(a.year - b.year);
        if (gap >= 3 && gap <= 150 && a.label !== b.label) pairs.push({a, b, gap});
      }
      // Two pairs per unit couple: one close in time (harder), one further apart (easier).
      pairs.sort((x, y) => x.gap - y.gap);
      const picks = [pairs[0], pairs.at(-1)].filter(Boolean).filter((p, k, all) => all.findIndex(q => q.a.id === p.a.id && q.b.id === p.b.id) === k);
      for (const {a, b} of picks) {
        const [first, second] = a.year < b.year ? [a, b] : [b, a];
        const id = `story:first:${a.id}:${b.id}`;
        const items = buildTimelineExercise({id, items: [
          {id: a.id, label: `${a.label} · ${domainTitle(unit.domainId)}`, year: a.year},
          {id: b.id, label: `${b.label} · ${domainTitle(other.domainId)}`, year: b.year}]}).items;
        result.push({id, mode: 'before-after', kind: 'before-after', format: 'simultaneity', entityId: `unit:${unit.id}`,
          unitIds: [unit.id, other.id], collectionIds: [unit.domainId, other.domainId], items, firstId: first.id,
          prompt: 'Samtidig i verden: hva skjedde først?',
          answer: `${first.label} (${formatYear(first.year)})`,
          explanation: `${first.label}: ${formatYear(first.year)}. ${second.label}: ${formatYear(second.year)}. Det skiller ${Math.abs(a.year - b.year)} år. ${unit.title} og ${other.title} hører til samme tidsrom, sett fra hvert sitt fag.`,
          sourceIds: [...new Set([...a.card.sourceIds, ...b.card.sourceIds])], difficulty: 3, significance: 3,
          learningStage: 'connections'});
      }
    }
  }
  return result;
}

const LENS_FORMATS = {
  norgeshistorie: ['lens-question', 'perspective-switch', 'thinkers', 'emplotment'],
  verdenshistorie: ['lens-question', 'perspective-switch', 'thinkers', 'emplotment', 'scale'],
  'moderne-historie': ['perspective-switch', 'lens-question', 'knowledge-flow', 'news-map'],
  geografi: ['neighbours', 'border-walk', 'flags', 'news-map'],
  naturvitenskap: ['scale', 'knowledge-flow'],
  biologi: ['scale', 'knowledge-flow'],
  samfunn: ['news-map', 'lens-question', 'knowledge-flow'],
  'kunst-musikk': ['emplotment', 'thinkers'],
  litteratur: ['emplotment', 'thinkers']
};
export const PERSPECTIVE_REASON = 'Perspective';
export const perspectiveLabel = target => target?.format === 'simultaneity' ? 'Samtidig i verden' : target?.mode === 'arrows' ? 'Historisk pil' : target?.mode === 'map' ? 'På kartet' : 'Et annet blikk';

/**
 * Weave up to `count` perspective questions into today's session: the same era from another subject,
 * an arrow on the map from the period, or a question through a historical lens. Only material the
 * learner has met (both units started) is used for comparisons, so the question tests memory.
 */
export function weavePerspectives({queue, units = [], curriculum, targets, reviews = [], progress, level = 0, count = 2, now = new Date()}) {
  if (!units.length || !curriculum) return queue;
  const unitRows = units.map(id => curriculum.units.find(u => u.id === id)).filter(Boolean);
  const started = id => progress?.units.get(id)?.status !== 'new' || units.includes(id);
  const lastSeen = new Map();
  for (const review of reviews) if (!lastSeen.has(review.targetId) || lastSeen.get(review.targetId) < review.timestamp) lastSeen.set(review.targetId, review.timestamp);
  const recent = id => lastSeen.has(id) && now - new Date(lastSeen.get(id)) < 3 * 86400000;
  const fits = t => !queue.some(q => (q.target?.id || q.id) === t.id) && !recent(t.id) && levelAccepts(t, level);
  const order = (a, b) => (lastSeen.get(a.id) || '').localeCompare(lastSeen.get(b.id) || '') || a.id.localeCompare(b.id);
  const picks = [];
  for (const unit of unitRows) {
    if (picks.length >= count) break;
    const span = unit.years;
    const same = targets.filter(t => t.format === 'simultaneity' && t.unitIds.includes(unit.id) && t.unitIds.every(started) && fits(t)).sort(order);
    const arrows = span ? targets.filter(t => t.mode === 'arrows' && t.year >= span.from - 5 && t.year <= span.to + 5 && fits(t)).sort((a, b) => Number(b.askYear === false) - Number(a.askYear === false) || order(a, b)) : [];
    const formats = LENS_FORMATS[unit.domainId] || [];
    const lens = targets.filter(t => formats.includes(t.format) && fits(t)).sort((a, b) => formats.indexOf(a.format) - formats.indexOf(b.format) || order(a, b));
    for (const t of [same[0], arrows[0], lens[0]].filter(Boolean)) {
      if (picks.length >= count || picks.some(p => p.target.id === t.id)) continue;
      picks.push({target: t, reason: PERSPECTIVE_REASON, unitId: unit.id});
      break;
    }
  }
  if (!picks.length) return queue;
  // Place perspectives after the unit's own cards have started, never directly after a lesson.
  const result = [...queue];
  picks.forEach((pick, i) => {
    const lastOfUnit = result.map(r => r.unitId).lastIndexOf(pick.unitId);
    const at = Math.min(result.length, Math.max(2, lastOfUnit >= 0 ? lastOfUnit + 1 : Math.round(result.length * (i + 1) / (picks.length + 1))));
    result.splice(at, 0, pick);
  });
  return result;
}
