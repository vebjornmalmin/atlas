import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { foundationTargets } from '../src/lib/foundations.js';
import { checkAnswer, makeRecognitionOptions } from '../src/lib/exercises.js';
const data = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));

test('foundation questions have valid graph references and one unambiguous option', () => {
  const targets = foundationTargets(data);
  assert.equal(targets.length, 57);
  assert.equal(new Set(targets.map(target => target.id)).size, targets.length);
  for (const target of targets) {
    assert.ok(data.entities.some(entity => entity.id === target.entityId));
    assert.ok(target.collectionIds.every(id => data.collections.some(collection => collection.id === id)));
    assert.ok(target.sourceIds.every(id => data.sources.some(source => source.id === id)));
    assert.equal(target.options.filter(option => option.correct).length, 1);
    assert.equal(new Set(target.options.map(option => option.label)).size, target.options.length);
    assert.ok(target.options.every(option => checkAnswer(target, option.label) === option.correct));
    assert.equal(makeRecognitionOptions(target, targets).filter(option => option.correct).length, 1);
    assert.equal(target.mode, 'recognition');
    assert.equal(target.learningStage, 'foundation');
    assert.equal(target.difficulty, 1);
    assert.ok(target.sources.length);
    assert.ok(target.sources.every(source => source.title && new URL(source.url).protocol === 'https:'));
    assert.ok(target.snapshot.length < 260);
    assert.doesNotMatch(target.prompt, /hvilket år|rett før|rett etter|dato/i);
  }
});

test('foundation questions adapt to available packages without dangling references', () => {
  assert.deepEqual(foundationTargets({}), []);
  const targets = foundationTargets({ ...data, entities: data.entities.filter(entity => entity.id === 'george-washington') });
  assert.equal(targets.length, 2);
  assert.equal(targets[0].entityId, 'george-washington');
  assert.deepEqual(foundationTargets({ ...data, collections: [] }), []);
});

test('historical foundations keep important limits rather than simplifying into false claims', () => {
  const targets = foundationTargets(data);
  assert.match(targets.find(item => item.id === 'foundation:lincoln-emancipation').snapshot, /ikke.*hele USA/);
  assert.match(targets.find(item => item.id === 'foundation:jefferson-declaration').snapshot, /endret teksten/);
  assert.match(targets.find(item => item.id === 'foundation:kennedy-moon').snapshot, /etter hans død/);
  const copy = foundationTargets(data);
  copy[0].options[0].label = 'Endret';
  assert.notEqual(foundationTargets(data)[0].options[0].label, 'Endret');
});


test('every president has an introductory period question using the earliest term', () => {
  const targets = foundationTargets(data);
  const periods = targets.filter(target => target.id.startsWith('foundation:period:'));
  assert.equal(periods.length, 45);
  assert.equal(periods.find(target => target.entityId === 'john-adams').answer, '1700-tallet');
  assert.equal(periods.find(target => target.entityId === 'grover-cleveland').year, 1885);
  assert.equal(periods.find(target => target.entityId === 'donald-trump').year, 2017);
  assert.ok(periods.every(target => target.sourceIds.length && target.sources.length));
});

test('hand-written introductions follow the same multiple-choice rules as the curriculum', async () => {
  const { choiceProblems, answerLeaks } = await import('../src/lib/core-curriculum.js');
  const curated = foundationTargets(data).filter(target => !target.id.startsWith('foundation:period:'));
  assert.equal(curated.length, 12);
  for (const target of curated) {
    const distractors = target.options.filter(option => !option.correct).map(option => option.label);
    const { errors, warnings } = choiceProblems({ prompt: target.prompt, answer: target.answer, distractors });
    assert.deepEqual([...errors, ...warnings, ...answerLeaks(target.prompt, [target.answer])], [], target.id);
    assert.equal(makeRecognitionOptions(target, foundationTargets(data)).length, 4, target.id);
  }
});

test('the shared check catches a question that hints at the answer or too few options', async () => {
  const { choiceProblems } = await import('../src/lib/core-curriculum.js');
  const old = choiceProblems({ prompt: 'Hva erklærte de tretten koloniene med uavhengighetserklæringen?', answer: 'At de var uavhengige av Storbritannia', distractors: ['At de ville bli en del av Frankrike', 'At de opprettet FN'] });
  assert.ok(old.errors.some(e => /3 distraktorer/.test(e)));
  assert.ok(old.warnings.some(w => /ordstammen «uavhen»/.test(w)));
  const shared = choiceProblems({ prompt: 'Hva handlet frigjøringserklæringen om?', answer: 'Frigjøring i opprørsområdene', distractors: ['Frigjøring i hele USA', 'Stemmerett for frigjorte', 'Retur av flyktede slaver'] });
  assert.deepEqual(shared.warnings, []);
});
