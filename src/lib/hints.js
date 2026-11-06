// Hints come in steps. The first is the card's written cue, a pointer from context that still
// leaves the answer to be recalled. The second is made from the answer's form: first letter and
// length for a name, the decade for a year, the size for a number, one wrong option removed for a
// multiple-choice question. Every step taken marks the answer as supported, not independent.
import {formatYear} from './core-curriculum.js';

const space = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const plain = value => String(value ?? '').trim();

function isYear(target) {
  if (target?.answerFormat === 'year') return true;
  if (target?.answerFormat) return false;
  return /^\d{3,4}$/.test(plain(target?.answer)) && /år|year|dato|date/i.test(target?.prompt || '');
}

function yearHint(target) {
  const year = Number(plain(target.answer));
  if (!Number.isInteger(year)) return '';
  if ((target.tolerance || 0) >= 10) return `Årstallet er på ${formatYear(Math.floor(year / 100) * 100)}-tallet.`;
  return `Årstallet er i ${formatYear(Math.floor(year / 10) * 10)}-årene.`;
}

function numberHint(target) {
  const value = Math.abs(Number(plain(target.answer).replace(',', '.')));
  if (!Number.isFinite(value)) return '';
  const unit = target.numberUnit ? ` ${target.numberUnit}` : '';
  if (value < 10) return `Svaret er mindre enn 10${unit}.`;
  const low = 10 ** Math.floor(Math.log10(value));
  return `Svaret ligger mellom ${space(low)} og ${space(low * 10)}${unit}.`;
}

function textHint(target) {
  const answer = plain(target.answer);
  const first = answer.match(/\p{L}|\d/u)?.[0];
  if (!first) return '';
  if (answer.length > 40) return `Svaret begynner med «${first.toUpperCase()}».`;
  const words = answer.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `Svaret har ${words.length} ord og begynner med «${first.toUpperCase()}».`;
  const letters = [...answer].filter(c => /\p{L}|\d/u.test(c)).length;
  return `Svaret har ${letters} tegn og begynner med «${first.toUpperCase()}».`;
}

/** The automatic second step, made from the form of the answer. Empty when the format has none. */
export function formHint(target) {
  if (!target || target.answerFormat === 'explanation') return '';
  if (target.mode === 'recognition') return 'Ett av de gale alternativene er fjernet.';
  if (target.mode !== 'recall') return '';
  if (isYear(target)) return yearHint(target);
  if (target.answerFormat === 'number') return numberHint(target);
  return textHint(target);
}

/** All hint steps for a question, written cue first. */
export function hintSteps(target) {
  if (!target || target.mode === 'map') return [];
  return [plain(target.hint), formHint(target)].filter(Boolean);
}

/** True once the step that removes a wrong option has been shown. */
export function removesOption(target, level) {
  const steps = hintSteps(target);
  return target?.mode === 'recognition' && level > 0 && level >= steps.length;
}

/** The wrong option removed by the second step; the same option every time for the same question. */
export function removedOption(target, options) {
  const wrong = options.filter(option => !option.correct).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!wrong.length) return null;
  const seed = [...String(target?.id || '')].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
  return wrong[seed % wrong.length].id;
}
