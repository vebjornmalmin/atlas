import test from 'node:test';
import assert from 'node:assert/strict';
import {formHint, hintSteps, removesOption, removedOption} from '../src/lib/hints.js';
import {hintProblems} from '../src/lib/core-curriculum.js';

test('the written cue comes first and the form of the answer second', () => {
  const target = {id: 'core:a', mode: 'recall', answerFormat: 'short', answer: 'Hippokrates', hint: 'Han kom fra øya Kos.'};
  assert.deepEqual(hintSteps(target), ['Han kom fra øya Kos.', 'Svaret har 11 tegn og begynner med «H».']);
  assert.equal(formHint({...target, answer: 'Niels Bohr'}), 'Svaret har 2 ord og begynner med «N».');
});

test('years get the decade, or the century when the card tolerates a rough answer', () => {
  assert.equal(formHint({mode: 'recall', answerFormat: 'year', answer: '1814'}), 'Årstallet er i 1810-årene.');
  assert.equal(formHint({mode: 'recall', answerFormat: 'year', answer: '793'}), 'Årstallet er i 790-årene.');
  assert.equal(formHint({mode: 'recall', answerFormat: 'year', answer: '1350', tolerance: 25}), 'Årstallet er på 1300-tallet.');
});

test('numbers get their size, with the unit', () => {
  assert.equal(formHint({mode: 'recall', answerFormat: 'number', answer: '4'}), 'Svaret er mindre enn 10.');
  assert.equal(formHint({mode: 'recall', answerFormat: 'number', answer: '15000', numberUnit: 'km'}), 'Svaret ligger mellom 10 000 og 100 000 km.');
});

test('multiple choice removes the same wrong option every time, never the right one', () => {
  const target = {id: 'core:b', mode: 'recognition', answer: 'A', hint: 'Tenk på legen.'};
  const options = [{id: 'x', label: 'B', correct: false}, {id: 'y', label: 'A', correct: true}, {id: 'z', label: 'C', correct: false}];
  assert.equal(removesOption(target, 1), false);
  assert.equal(removesOption(target, 2), true);
  const removed = removedOption(target, options);
  assert.ok(['x', 'z'].includes(removed));
  assert.equal(removedOption(target, [...options].reverse()), removed);
});

test('structured cards and explanations only have the written cue, maps none', () => {
  assert.deepEqual(hintSteps({mode: 'timeline', hint: 'Én hendelse er fra oldtiden.'}), ['Én hendelse er fra oldtiden.']);
  assert.deepEqual(hintSteps({mode: 'recall', answerFormat: 'explanation', answer: 'Lang tekst.', hint: 'Tenk på økonomien.'}), ['Tenk på økonomien.']);
  assert.deepEqual(hintSteps({mode: 'timeline'}), []);
  assert.deepEqual(hintSteps({mode: 'map', hint: 'Nord.'}), []);
});

test('the validator stops hints that give the answer away', () => {
  assert.deepEqual(hintProblems({type: 'year', prompt: 'Når?', answer: '1814', hint: 'Det skjedde i 1814.'}).errors, ['hintet røper svaret «1814».']);
  assert.ok(hintProblems({type: 'text', prompt: 'Hva?', answer: 'Anatomi', accept: ['Anatomien'], hint: 'Svaret er anatomien.'}).errors.length);
  assert.ok(hintProblems({type: 'order', prompt: 'Ordne.', items: [{label: 'a', year: -400}, {label: 'b', year: 150}], hint: 'Den første var rundt 400 f.Kr.'}).errors.length);
  assert.ok(hintProblems({type: 'match', prompt: 'Koble.', pairs: [{left: 'Ibsen', right: 'Et dukkehjem'}], hint: 'Ibsen skrev Et dukkehjem.'}).errors.length);
  assert.deepEqual(hintProblems({type: 'choice', prompt: 'Hvem?', answer: 'Galen', hint: 'Han var romersk lege.'}), {errors: [], warnings: []});
  assert.deepEqual(hintProblems({type: 'choice', prompt: 'Hvem?', answer: 'Galen'}).warnings, ['mangler hint.']);
});
