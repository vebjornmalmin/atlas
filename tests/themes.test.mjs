import test from 'node:test';
import assert from 'node:assert/strict';
import {noteToMidi, midiToFrequency, parseTheme, partialFrequency, partialAmplitude, reverbEnvelope} from '../src/lib/listening/synth.js';
import {THEMES} from '../src/lib/listening/themes.js';
import {buildThemeTargets, gradeTheme, themeReady} from '../src/lib/listening/theme-exercises.js';

test('pitch names convert to MIDI numbers', () => {
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C#4'), 61);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.equal(noteToMidi('Eb4'), 63);
  assert.throws(() => noteToMidi('H4'));
});

test('MIDI numbers convert to equal-tempered frequencies', () => {
  assert.equal(midiToFrequency(69), 440);
  assert.equal(midiToFrequency(81), 880);
  assert.ok(Math.abs(midiToFrequency(60) - 261.6256) < 0.001);
});

test('partials are slightly inharmonic and fall in level', () => {
  assert.equal(partialFrequency(100, 1), 100 * Math.sqrt(1 + 0.0004));
  assert.ok(partialFrequency(100, 7) > 700);
  assert.ok(partialAmplitude(2) < partialAmplitude(1));
  assert.ok(reverbEnvelope(1.8) < 0.002);
});

test('parseTheme uses tempo and beats for start and duration, skipping rests', () => {
  const notes = parseTheme({tempo: 60, notes: [['C4', 1], ['R', 1], ['D4', 0.5]]});
  assert.deepEqual(notes, [
    {midi: 60, start: 0, duration: 1},
    {midi: 62, start: 2, duration: 0.5}
  ]);
  const faster = parseTheme({tempo: 120, notes: [['A4', 2]]});
  assert.deepEqual(faster, [{midi: 69, start: 0, duration: 1}]);
});

test('every theme parses into a playable melody', () => {
  for (const theme of THEMES) {
    const notes = parseTheme(theme.melody ?? theme);
    assert.ok(notes.length >= 6, `${theme.id} has ${notes.length} notes`);
    for (const note of notes) {
      assert.ok(note.midi >= 60 && note.midi <= 84, `${theme.id} note ${note.midi} outside C4-C6`);
      assert.ok(note.duration > 0);
    }
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].start >= notes[i - 1].start);
  }
});

test('theme ids are unique and each has sources, familiarity and metadata', () => {
  const ids = new Set();
  for (const theme of THEMES) {
    assert.ok(!ids.has(theme.id), `duplicate ${theme.id}`);
    ids.add(theme.id);
    assert.ok(theme.sources.length > 0);
    for (const source of theme.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.ok(source.title);
    }
    assert.ok([1, 2, 3].includes(theme.familiarity));
    assert.ok(theme.title && theme.composer && theme.era && theme.key);
    assert.equal(typeof theme.year, 'number');
  }
});

test('theme distractors vary, so the unfamiliar option is not always the answer', () => {
  const targets = buildThemeTargets();
  const asDistractor = new Map();
  for (const target of targets) for (const choice of target.choices) if (choice !== target.answer) asDistractor.set(choice, (asDistractor.get(choice) || 0) + 1);
  assert.equal(asDistractor.size, targets.length, 'every title is a distractor somewhere');
  assert.ok(Math.max(...asDistractor.values()) < targets.length - 1, 'no title is a distractor in every other question');
});

test('theme targets have deterministic choices with the answer exactly once', () => {
  const first = buildThemeTargets();
  const second = buildThemeTargets();
  assert.deepEqual(first, second);
  for (const target of first) {
    assert.match(target.id, /^theme:/);
    assert.equal(target.mode, 'theme');
    assert.equal(target.choices.length, 4);
    assert.equal(target.choices.filter(choice => choice === target.answer).length, 1);
    assert.equal(new Set(target.choices).size, 4);
    assert.equal(target.significance, 3);
    assert.deepEqual(target.sourceIds, []);
    assert.ok(target.sources.length > 0);
  }
});

test('grading and readiness depend on the chosen title', () => {
  const [target] = buildThemeTargets();
  assert.equal(themeReady(target, {}), false);
  assert.equal(themeReady(target, {choice: target.choices[0]}), true);
  assert.equal(gradeTheme(target, {choice: target.answer}).correct, true);
  const wrong = target.choices.find(choice => choice !== target.answer);
  assert.equal(gradeTheme(target, {choice: wrong}).correct, false);
});
