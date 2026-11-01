import {schedulingIndex} from './learning.js';
import {schedulingKey} from './knowledge-model.js';
import {normalizeAnswer} from './exercises.js';

// A unit's foundation unlocks the units that build on it; exploring ahead is still allowed.
export const UNIT_STATUS = {
  new: {label: 'Ikke startet', rank: 0},
  started: {label: 'Påbegynt', rank: 1},
  practiced: {label: 'Lært – repeteres', rank: 2},
  grounded: {label: 'Grunnlaget sitter', rank: 3},
  complete: {label: 'Gjennomført', rank: 4},
  secure: {label: 'Sitter godt', rank: 5}
};
export const SECURE_STABILITY_DAYS = 21;
export const LESSON_PREFIX = 'lesson:';
export const lessonEntryId = unitId => `${LESSON_PREFIX}${unitId}`;
export const isLessonEntry = entry => typeof entry?.id === 'string' && entry.id.startsWith(LESSON_PREFIX);

const independent = review => review.correct === true && !review.usedHint && !review.learnedFirst;

/** Latest answer per card, including free practice, plus its long-term schedule. */
export function cardEvidence(targets, states, reviews) {
  const core = targets.filter(t => t.unitId);
  const latest = new Map(), attempts = new Map();
  for (const review of [...reviews].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (!review.targetId?.startsWith('core:')) continue;
    latest.set(review.targetId, review);
    attempts.set(review.targetId, (attempts.get(review.targetId) || 0) + 1);
  }
  const index = schedulingIndex(targets, states, reviews);
  const result = new Map();
  for (const target of core) {
    const review = latest.get(target.id), state = index.get(schedulingKey(target)) || null;
    result.set(target.id, {attempted: Boolean(review), correct: Boolean(review && independent(review)), attempts: attempts.get(target.id) || 0,
      lastTimestamp: review?.timestamp || '', state, stability: state?.stability || 0, reps: state?.reps || 0, due: state?.due || null});
  }
  return result;
}

export function unitProgress(unit, targetsById, evidence) {
  const cards = unit.cardIds.map(id => targetsById.get(id)).filter(Boolean);
  const rows = cards.map(card => ({card, ...(evidence.get(card.id) || {attempted: false, correct: false, stability: 0, lastTimestamp: ''})}));
  const steps = Object.fromEntries([1, 2, 3, 4].map(step => {
    const inStep = rows.filter(row => row.card.step === step);
    return [step, {total: inStep.length, attempted: inStep.filter(r => r.attempted).length, correct: inStep.filter(r => r.correct).length}];
  }));
  const attempted = rows.filter(r => r.attempted).length, correct = rows.filter(r => r.correct).length;
  const base = rows.filter(r => r.card.step <= 2);
  // Answers given minutes after the lesson prove little; half the foundation must also survive a later review.
  const spaced = base.filter(r => r.correct && r.reps >= 2).length;
  const grounded = base.length > 0 && base.every(r => r.attempted) && base.filter(r => r.correct).length / base.length >= 0.7 && spaced / base.length >= 0.5;
  const complete = grounded && rows.every(r => r.attempted) && correct / rows.length >= 0.8;
  const secure = complete && rows.every(r => r.correct && r.stability >= SECURE_STABILITY_DAYS);
  const practiced = base.length > 0 && base.every(r => r.attempted) && base.filter(r => r.correct).length / base.length >= 0.7;
  const status = secure ? 'secure' : complete ? 'complete' : grounded ? 'grounded' : practiced ? 'practiced' : attempted ? 'started' : 'new';
  const nextStep = [1, 2, 3, 4].find(step => steps[step].total && steps[step].correct < steps[step].total) || null;
  const lastActivity = rows.reduce((latest, r) => r.lastTimestamp > latest ? r.lastTimestamp : latest, '');
  return {unitId: unit.id, total: rows.length, attempted, correct, steps, status, nextStep, lastActivity,
    unseen: rows.filter(r => !r.attempted).map(r => r.card), weak: rows.filter(r => r.attempted && !r.correct).map(r => r.card)};
}

export function curriculumProgress(curriculum, targets, states, reviews) {
  const evidence = cardEvidence(targets, states, reviews);
  const targetsById = new Map(targets.filter(t => t.unitId).map(t => [t.id, t]));
  const units = new Map((curriculum?.units || []).map(unit => [unit.id, unitProgress(unit, targetsById, evidence)]));
  for (const unit of curriculum?.units || []) {
    const progress = units.get(unit.id);
    progress.missing = unit.prerequisites.filter(id => (UNIT_STATUS[units.get(id)?.status]?.rank || 0) < UNIT_STATUS.grounded.rank);
    progress.ready = progress.missing.length === 0;
  }
  const domains = new Map((curriculum?.domains || []).map(domain => {
    const rows = domain.unitIds.map(id => units.get(id)).filter(Boolean);
    const total = rows.reduce((sum, r) => sum + r.total, 0), correct = rows.reduce((sum, r) => sum + r.correct, 0);
    return [domain.id, {domainId: domain.id, total, correct, started: rows.filter(r => r.status !== 'new').length,
      complete: rows.filter(r => UNIT_STATUS[r.status].rank >= UNIT_STATUS.complete.rank).length, units: rows.length}];
  }));
  return {units, domains, evidence};
}

/**
 * Units to continue first: started units by recent activity, then ready units by tier,
 * alternating domains so a new learner meets several subjects early.
 */
export function recommendedUnits(curriculum, progress, {domainIds = []} = {}) {
  const wanted = domainIds.length ? new Set(domainIds) : null;
  const domainOrder = new Map((curriculum?.domains || []).map(d => [d.id, d.order]));
  const units = (curriculum?.units || []).filter(unit => !wanted || wanted.has(unit.domainId));
  const started = units.filter(unit => ['started', 'practiced', 'grounded'].includes(progress.units.get(unit.id)?.status) && progress.units.get(unit.id).unseen.length)
    .sort((a, b) => progress.units.get(b.id).lastActivity.localeCompare(progress.units.get(a.id).lastActivity));
  const fresh = units.filter(unit => progress.units.get(unit.id)?.status === 'new' && progress.units.get(unit.id).ready)
    .sort((a, b) => a.tier - b.tier || domainOrder.get(a.domainId) - domainOrder.get(b.domainId) || a.order - b.order);
  const byDomain = new Map();
  for (const unit of fresh) { if (!byDomain.has(unit.domainId)) byDomain.set(unit.domainId, []); byDomain.get(unit.domainId).push(unit); }
  const interleaved = [];
  const queues = [...byDomain.entries()].sort((a, b) => {
    const tier = Math.min(...a[1].map(u => u.tier)) - Math.min(...b[1].map(u => u.tier));
    return tier || domainOrder.get(a[0]) - domainOrder.get(b[0]);
  }).map(([, list]) => list);
  while (queues.some(list => list.length)) for (const list of queues) if (list.length) interleaved.push(list.shift());
  return [...started, ...interleaved];
}

const disclosure = target => normalizeAnswer([target.explanation, target.cardType === 'explain' ? '' : target.answer].join(' '));
function revealedBy(target, text) {
  if (!text || ['explain', 'order', 'match'].includes(target.cardType)) return false;
  return [target.answer, ...(target.acceptedAnswers || [])].some(answer => {
    const value = normalizeAnswer(answer);
    return value.length >= 3 && ` ${text} `.includes(` ${value} `);
  });
}

/** Next unseen cards in step order; a later step waits until the earlier steps have been tried. */
export function nextCards(unit, unitState, limit, disclosed = '') {
  const unseen = new Set(unitState.unseen.map(card => card.id));
  const cards = unit.cardIds.map(id => unitState.unseen.find(card => card.id === id)).filter(Boolean);
  const result = [];
  let text = disclosed;
  for (const card of cards) {
    if (result.length >= limit) break;
    const blockedByStep = cards.some(other => other.step < card.step && unseen.has(other.id) && !result.includes(other));
    if (blockedByStep) break;
    if (revealedBy(card, text)) continue;
    result.push(card);
    text += ' ' + disclosure(card);
  }
  return result;
}

/** Spread lessons first, then alternate reviews and new cards so a lesson is never followed directly by its own question. */
function arrange(lessons, due, fresh) {
  const queue = [...lessons];
  const pendingFresh = [...fresh], pendingDue = [...due];
  while (pendingDue.length || pendingFresh.length) {
    const lastUnit = queue.at(-1)?.unitId;
    if (pendingDue.length && (!pendingFresh.length || queue.length % 2 === 1)) {
      // Interleave reviews from different units instead of drilling one unit in a row.
      let next = pendingDue.findIndex(row => !row.unitId || row.unitId !== lastUnit);
      queue.push(pendingDue.splice(next < 0 ? 0 : next, 1)[0]);
      continue;
    }
    let index = pendingFresh.findIndex(row => row.unitId !== lastUnit);
    if (index < 0) index = 0;
    queue.push(pendingFresh.splice(index, 1)[0]);
  }
  return queue;
}

export function sessionSize(preferences) {
  return Math.min(20, Math.max(6, Number(preferences?.dailyMinutes || 5) * 2));
}

/**
 * The daily session: due reviews first, then the next steps in up to two active units.
 * A brand-new unit opens with its lesson. Free exploration never blocks this plan.
 */
export function buildDailySession({data, targets, states, reviews, preferences = {}, now = new Date(), unitIds = null}) {
  const curriculum = data?.curriculum;
  const size = sessionSize(preferences);
  const progress = curriculumProgress(curriculum, targets, states, reviews);
  const index = schedulingIndex(targets, states, reviews);
  const coreDomains = new Set((curriculum?.domains || []).map(d => d.id));
  const domainIds = (preferences.collectionIds || []).filter(id => coreDomains.has(id));
  const recentlyAnswered = new Set(reviews.filter(r => now - new Date(r.timestamp) < 6 * 3600000).map(r => r.targetId));
  const dueAll = targets.filter(t => index.has(schedulingKey(t)) && new Date(index.get(schedulingKey(t)).due) <= now && !recentlyAnswered.has(t.id))
    .filter(t => !domainIds.length || !t.unitId || domainIds.includes(t.domainId))
    .filter(t => !unitIds || unitIds.includes(t.unitId))
    .sort((a, b) => new Date(index.get(schedulingKey(a)).due) - new Date(index.get(schedulingKey(b)).due));
  const seenKeys = new Set();
  // Text and multiple-choice variants of one register fact share a review; ask it once.
  const due = dueAll.filter(t => { const keys = [schedulingKey(t), t.factId || t.id]; if (keys.some(k => seenKeys.has(k))) return false; keys.forEach(k => seenKeys.add(k)); return true; });
  const newTarget = preferences.newRatio === 0 ? 0 : Math.max(3, Math.round(size * Number(preferences.newRatio ?? 0.4)));
  const dueRows = due.slice(0, Math.max(0, size - newTarget)).map(target => ({target, reason: 'Due review', unitId: target.unitId}));
  const room = preferences.newRatio === 0 && due.length ? 0 : size - dueRows.length;
  const candidates = unitIds ? unitIds.map(id => curriculum.units.find(u => u.id === id)).filter(Boolean) : recommendedUnits(curriculum, progress, {domainIds});
  const lessons = [], fresh = [];
  let disclosed = dueRows.map(row => disclosure(row.target)).join(' ');
  const perUnit = unitIds?.length === 1 ? room : Math.max(3, Math.ceil(room / 2));
  for (const unit of candidates) {
    if (fresh.length >= room || lessons.length >= 2) break;
    const state = progress.units.get(unit.id);
    if (!state?.unseen.length) continue;
    const cards = nextCards(unit, state, Math.min(perUnit, room - fresh.length), disclosed);
    if (!cards.length) continue;
    if (state.status === 'new') lessons.push({id: lessonEntryId(unit.id), unitId: unit.id, reason: 'Unit lesson'});
    for (const card of cards) fresh.push({target: card, reason: state.status === 'new' ? 'Unit introduction' : 'New knowledge', unitId: unit.id});
    disclosed += ' ' + cards.map(disclosure).join(' ') + ' ' + normalizeAnswer(state.status === 'new' ? [...unit.lesson, ...unit.keyPoints].join(' ') : '');
  }
  // Too little new material left: fill the rest of the session with further due reviews.
  for (const target of due.slice(dueRows.length, dueRows.length + Math.max(0, size - dueRows.length - fresh.length))) dueRows.push({target, reason: 'Due review', unitId: target.unitId});
  const queue = arrange(lessons, dueRows, fresh);
  return {queue, dueCount: due.length, progress, units: [...new Set(fresh.map(row => row.unitId))]};
}

/** Practice a unit that has no new cards left: weakest and least stable first. Does not move long-term reviews. */
export function buildUnitReview({data, targets, states, reviews, unitId, preferences = {}}) {
  const unit = data.curriculum.units.find(u => u.id === unitId);
  const progress = curriculumProgress(data.curriculum, targets, states, reviews);
  const evidence = progress.evidence;
  const cards = unit.cardIds.map(id => targets.find(t => t.id === id)).filter(Boolean)
    .sort((a, b) => Number(evidence.get(a.id)?.correct) - Number(evidence.get(b.id)?.correct) || (evidence.get(a.id)?.stability || 0) - (evidence.get(b.id)?.stability || 0) || a.step - b.step);
  return {queue: cards.slice(0, sessionSize(preferences)).map(target => ({target, reason: 'Extra practice', unitId}))};
}

/** Accept typing slips in longer names, and documented tolerances for years and numbers. */
export function gradeAnswer(target, input) {
  const text = String(input ?? '').trim();
  if (!text) return {correct: null};
  if (['year', 'number'].includes(target.answerFormat)) {
    const value = Number(text.replace(/\s/g, '').replace(/^minus/i, '-').replace(/[−–]/g, '-').replace(',', '.').replace(/[^\d.-]/g, ''));
    const expected = Number(String(target.answer).replace(',', '.'));
    if (!Number.isFinite(value)) return {correct: false};
    const tolerance = Number(target.tolerance || 0);
    const exact = value === expected;
    return {correct: Math.abs(value - expected) <= tolerance, close: !exact && Math.abs(value - expected) <= tolerance, note: !exact && Math.abs(value - expected) <= tolerance ? `Godkjent innenfor ±${tolerance}. Riktig er ${target.answer}.` : ''};
  }
  const given = normalizeAnswer(text);
  const options = [target.answer, ...(target.acceptedAnswers || []), ...(target.aliases || [])].map(normalizeAnswer).filter(Boolean);
  if (options.includes(given)) return {correct: true};
  for (const option of options) {
    const limit = option.length >= 10 ? 2 : option.length >= 5 ? 1 : 0;
    if (limit && distance(given, option, limit) <= limit) return {correct: true, close: true, note: `Godkjent. Skrivemåten er «${target.answer}».`};
  }
  // Surname alone for a person: accept when the last word matches and is distinctive.
  const answerWords = normalizeAnswer(target.answer).split(' ');
  if (answerWords.length > 1 && given.length >= 4 && given === answerWords.at(-1) && /hvem/i.test(target.prompt)) return {correct: true, close: true, note: `Godkjent. Fullt navn: ${target.answer}.`};
  return {correct: false};
}

function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > limit) return limit + 1;
    previous = row;
  }
  return previous[b.length];
}

/** Consecutive days with at least one answer, counting today or yesterday as the latest day. */
export function practiceStreak(reviews, now = new Date()) {
  const key = date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const days = new Set(reviews.map(review => key(new Date(review.timestamp))));
  const day = new Date(now);
  if (!days.has(key(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(key(day))) { streak++; day.setDate(day.getDate() - 1); }
  return streak;
}
