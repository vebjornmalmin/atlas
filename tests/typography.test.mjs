import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {keepTogether} from '../src/lib/typography.js';
import {normalizeAnswer} from '../src/lib/exercises.js';

test('digit groups and a year with its era never break across lines', () => {
  assert.equal(keepTogether('for over 11 000 år siden'), 'for over 11 000 år siden');
  assert.equal(keepTogether('1 000 000 mennesker'), '1 000 000 mennesker');
  assert.equal(keepTogether('Omkring 4000 f.Kr. begynte'), 'Omkring 4000 f.Kr. begynte');
  assert.equal(keepTogether('år 30 e. Kr.'), 'år 30 e. Kr.');
  assert.equal(keepTogether('1700–500 f.Kr.'), '1700–500 f.Kr.');
  assert.equal(keepTogether('i 1814 ble'), 'i 1814 ble');
});

test('an answer typed with an ordinary space still matches', () => {
  assert.equal(normalizeAnswer(keepTogether('11 000')), normalizeAnswer('11 000'));
});

test('the published package has no breakable digit groups or eras', () => {
  const text = fs.readFileSync(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8');
  assert.deepEqual(text.match(/\d \d{3}(?!\d)|\d [fe]\. ?Kr\./g) || [], []);
});
