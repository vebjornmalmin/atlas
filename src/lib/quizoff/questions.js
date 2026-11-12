import {buildRecognitionIndex, makeRecognitionOptions, normalizeAnswer} from '../exercises.js';
import {gradeAnswer} from '../progression.js';
import {answerPresentation} from '../presentation.js';
import {ANSWER_MAX, OPEN_ANSWER_MAX} from './protocol.js';

const RECALL_FORMATS = ['short', 'year', 'number'];
// The quiz-off mode of a card: an explanation card is an open question, decided by the players' vote.
export const quizoffMode = target => target?.mode === 'recognition' ? 'recognition' : target?.mode === 'recall' && target.answerFormat === 'explanation' ? 'open' : target?.mode;
const optionLabel = option => typeof option === 'string' ? option : option?.label ?? option?.answer;

function curatedAlternatives(target) {
  const accepted = new Set([target.answer, ...(target.acceptedAnswers || [])].map(normalizeAnswer));
  const alternatives = new Set();
  for (const option of target.options || []) {
    const normalized = normalizeAnswer(optionLabel(option));
    if (normalized && !accepted.has(normalized)) alternatives.add(normalized);
  }
  return alternatives.size;
}

/** Eligible core cards for a quiz-off, filtered by subject area, step and mode ('recognition', 'recall', 'open'). */
export function quizoffPool(targets, {domainId = '', steps = null, modes = ['recognition', 'recall']} = {}) {
  const pool = [];
  for (const target of targets || []) {
    if (!String(target?.id || '').startsWith('core:') || target.answer == null || !target.prompt) continue;
    if (domainId && target.domainId !== domainId) continue;
    if (steps && !steps.includes(target.step)) continue;
    const mode = quizoffMode(target);
    if (!modes.includes(mode)) continue;
    if (mode === 'recall') { if (!RECALL_FORMATS.includes(target.answerFormat)) continue; }
    // Curated options only: options borrowed from other cards could differ between phones.
    else if (mode === 'recognition') { if (curatedAlternatives(target) < 3) continue; }
    // The vote screen shows the model answer and its criteria.
    else if (mode === 'open') { if (!target.rubric?.length) continue; }
    else continue;
    pool.push(target);
  }
  return pool;
}

/** Subject areas with enough eligible cards for a quiz-off. */
export function quizoffDomains(pack, targets) {
  const counts = new Map();
  for (const target of quizoffPool(targets)) counts.set(target.domainId, (counts.get(target.domainId) || 0) + 1);
  return (pack?.curriculum?.domains || [])
    .map(domain => ({id: domain.id, title: domain.title, count: counts.get(domain.id) || 0}))
    .filter(domain => domain.count >= 10);
}

function prng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const char of String(seed)) { h = Math.imul(h ^ char.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => { // mulberry32
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// Where the open questions go: never first, one in each equal stretch of the rest, at a random place in it.
function openSlots(count, open, random) {
  const slots = new Set(), rest = count - 1;
  for (let i = 0; i < open; i++) {
    const from = 1 + Math.floor(i * rest / open), to = 1 + Math.floor((i + 1) * rest / open);
    slots.add(from + Math.floor(random() * (to - from)));
  }
  return slots;
}

/** Deterministic selection: one card per unit before any unit repeats, mixed modes, no repeated answers.
 *  With open cards in the pool, about one question in five is open (at least one), spread out and never first. */
export function pickQuestions(pool, {count, seed}) {
  const random = prng(seed);
  const units = new Map();
  for (const target of shuffle(pool, random)) {
    const key = target.unitId || '';
    if (!units.has(key)) units.set(key, {recognition: [], recall: [], open: []});
    units.get(key)[quizoffMode(target)].push(target);
  }
  const unitList = shuffle([...units.keys()].sort(), random).map(key => units.get(key));
  const closed = pool.filter(target => quizoffMode(target) !== 'open');
  const openTotal = pool.length - closed.length;
  const wantOpen = openTotal && closed.length && count > 1 ? Math.min(openTotal, count - 1, Math.max(1, Math.round(count / 5))) : 0;
  const slots = openSlots(count, wantOpen, random);
  const total = closed.length;
  const recognitionTotal = closed.filter(target => target.mode === 'recognition').length;
  const normal = count - slots.size;
  const wantRecognition = recognitionTotal && recognitionTotal < total ? Math.round(normal * 0.6) : normal;
  const modes = shuffle(Array.from({length: normal}, (_, i) => i < wantRecognition ? 'recognition' : 'recall'), random);
  const wanted = Array.from({length: count}, (_, i) => slots.has(i) ? 'open' : modes.shift());
  const picked = [], seenAnswers = new Set();
  let used = new Set();
  const take = (unit, mode) => {
    const list = unit[mode];
    while (list.length) {
      const target = list.pop(), key = normalizeAnswer(target.answer);
      if (seenAnswers.has(key)) continue;
      seenAnswers.add(key);
      return target;
    }
    return null;
  };
  // An open slot looks for an open card in any unit before it settles for another mode; other slots never take open cards.
  const fallback = {recognition: ['recall'], recall: ['recognition'], open: []};
  const fromUnit = (unit, mode) => {
    let target = take(unit, mode);
    for (const other of fallback[mode]) target ||= take(unit, other);
    return target;
  };
  const find = mode => {
    for (const attempt of [0, 1]) {
      for (const unit of unitList) {
        if (used.has(unit)) continue;
        const target = fromUnit(unit, mode);
        if (target) { used.add(unit); return target; }
      }
      if (attempt) break;
      used = new Set(); // every unit has given one: start the next round
    }
    for (const unit of unitList) { const target = fromUnit(unit, mode); if (target) return target; }
    return null;
  };
  for (const mode of wanted) {
    const target = (mode === 'open' && find('open')) || find(mode === 'open' ? 'recall' : mode);
    if (!target) break;
    picked.push({id: target.id, mode: quizoffMode(target)});
  }
  return picked;
}

const optionsFor = (target, targets, index) => makeRecognitionOptions(target, targets, 4, index || buildRecognitionIndex(targets));

/** What a phone shows for one question; never says which option is right. */
export function buildQuestion(entry, byId, targets, index) {
  const target = byId?.get(entry.id);
  if (!target) return {id: entry.id, mode: entry.mode, prompt: '', options: null, input: null, missing: true};
  const base = {id: entry.id, mode: entry.mode, prompt: target.prompt, missing: false};
  if (entry.mode === 'recognition') {
    const options = optionsFor(target, targets, index).map(({id, label}) => ({id, label}));
    return {...base, options, input: null};
  }
  if (entry.mode === 'open') return {...base, options: null, input: {inputMode: 'text', label: 'Forklaringen din', placeholder: 'Forklar med egne ord …', multiline: true, max: OPEN_ANSWER_MAX}};
  const {inputMode, label, placeholder} = answerPresentation(target);
  return {...base, options: null, input: {inputMode, label, placeholder, multiline: false, max: ANSWER_MAX}};
}

export function gradeQuizoff(entry, byId, answer, knownNames = null) {
  const target = byId?.get(entry.id);
  if (!target || entry.mode === 'open') return false; // open answers are decided by the vote, in the reducer
  if (entry.mode === 'recognition') return answer === target.id;
  return gradeAnswer(target, answer, knownNames).correct === true;
}

/** Display text for a stored answer: the option label for recognition, the typed text for recall. */
export function answerLabel(entry, byId, targets, index, answer) {
  if (entry.mode !== 'recognition') return String(answer ?? '');
  const target = byId?.get(entry.id);
  if (!target) return '';
  if (answer === target.id) return String(target.answer);
  return optionsFor(target, targets, index).find(option => option.id === answer)?.label ?? '';
}

/** The model answer and explanation; for an open question also the criteria the vote compares against. */
export function revealInfo(entry, byId) {
  const target = byId?.get(entry.id);
  const criteria = entry.mode === 'open' ? (target?.rubric || []).map(c => String(c?.text ?? '')).filter(Boolean) : [];
  return {answer: target ? String(target.answer) : '', explanation: target?.explanation || '', criteria};
}
