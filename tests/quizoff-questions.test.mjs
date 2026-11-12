import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRecognitionIndex} from '../src/lib/exercises.js';
import {knownNameSet} from '../src/lib/progression.js';
import {quizoffPool, quizoffDomains, quizoffMode, pickQuestions, buildQuestion, gradeQuizoff, answerLabel, revealInfo} from '../src/lib/quizoff/questions.js';
import {OPEN_ANSWER_MAX, ANSWER_MAX} from '../src/lib/quizoff/protocol.js';

const rec = (n, unit = 'u1', extra = {}) => ({id: `core:r${n}`, unitId: unit, domainId: 'd1', step: 1, mode: 'recognition', answerFormat: 'choice',
  prompt: `Spørsmål ${n}?`, answer: `Svar ${n}`, acceptedAnswers: [], explanation: `Forklaring ${n}`, options: [`Svar ${n}`, `A${n}`, `B${n}`, `C${n}`], ...extra});
const rcl = (n, unit = 'u1', extra = {}) => ({id: `core:c${n}`, unitId: unit, domainId: 'd1', step: 2, mode: 'recall', answerFormat: 'short',
  prompt: `Hvem ${n}?`, answer: `Navn Navnesen ${n}`, acceptedAnswers: [], explanation: '', ...extra});
const map = list => new Map(list.map(t => [t.id, t]));

test('Pool keeps only eligible core cards and honours domain, step and mode filters', () => {
  const targets = [rec(1), rec(2, 'u1', {id: 'x:2'}), rec(3, 'u1', {options: ['Svar 3', 'A']}), rcl(1), rcl(2, 'u1', {answerFormat: 'explanation'}),
    rcl(3, 'u2', {domainId: 'd2'}), {...rcl(4), mode: 'matching'}, rec(5, 'u1', {step: 3})];
  assert.deepEqual(quizoffPool(targets, {}).map(t => t.id).sort(), ['core:c1', 'core:c3', 'core:r1', 'core:r5']);
  assert.deepEqual(quizoffPool(targets, {domainId: 'd2'}).map(t => t.id), ['core:c3']);
  assert.deepEqual(quizoffPool(targets, {steps: [3]}).map(t => t.id), ['core:r5']);
  assert.deepEqual(quizoffPool(targets, {modes: ['recall']}).map(t => t.id).sort(), ['core:c1', 'core:c3']);
});

test('Recognition without three curated wrong options is left out, even when other cards could fill in', () => {
  const thin = rec(1, 'u1', {options: undefined, collectionIds: ['k'], kind: 'fact'});
  const others = [2, 3, 4].map(n => rec(n, 'u1', {options: undefined, collectionIds: ['k'], kind: 'fact'}));
  assert.equal(quizoffPool([thin, ...others]).length, 0);
  assert.deepEqual(quizoffPool([thin, rec(5)]).map(t => t.id), ['core:r5']);
});

test('Domains need at least ten eligible cards', () => {
  const targets = [...Array.from({length: 10}, (_, i) => rcl(i)), ...Array.from({length: 9}, (_, i) => rcl(i + 20, 'u2', {domainId: 'd2'}))];
  const pack = {curriculum: {domains: [{id: 'd1', title: 'Ett'}, {id: 'd2', title: 'To'}]}};
  assert.deepEqual(quizoffDomains(pack, targets), [{id: 'd1', title: 'Ett', count: 10}]);
});

test('pickQuestions is deterministic, unique, spread over units and mixes modes', () => {
  const targets = [];
  for (let u = 0; u < 5; u++) for (let i = 0; i < 6; i++) targets.push(rec(u * 10 + i, `u${u}`), rcl(u * 10 + i, `u${u}`));
  const pool = quizoffPool(targets);
  const a = pickQuestions(pool, {count: 10, seed: 'x'});
  assert.deepEqual(a, pickQuestions(pool, {count: 10, seed: 'x'}));
  assert.notDeepEqual(a, pickQuestions(pool, {count: 10, seed: 'y'}));
  assert.equal(a.length, 10);
  assert.equal(new Set(a.map(q => q.id)).size, 10);
  const unitOf = id => targets.find(t => t.id === id).unitId;
  assert.equal(new Set(a.slice(0, 5).map(q => unitOf(q.id))).size, 5);
  assert.equal(new Set(a.map(q => unitOf(q.id))).size, 5);
  assert.equal(a.filter(q => q.mode === 'recognition').length, 6);
  assert.deepEqual(pickQuestions(pool, {count: 500, seed: 1}).length, pool.length);
});

test('pickQuestions never takes two cards with the same answer', () => {
  const pool = [rec(1, 'u1', {answer: 'Oslo'}), rec(2, 'u2', {answer: ' oslo '}), rec(3, 'u3', {answer: 'Paris'})];
  const picked = pickQuestions(pool, {count: 3, seed: 7});
  assert.equal(picked.length, 2);
});

test('Questions do not leak the correct option and keep a stable option order', () => {
  const targets = [rec(1), rcl(1), rcl(2, 'u1', {answerFormat: 'year', answer: '1814', tolerance: 1}), rcl(3, 'u1', {answerFormat: 'number', answer: '12'})];
  const byId = map(targets), index = buildRecognitionIndex(targets);
  const q = buildQuestion({id: 'core:r1', mode: 'recognition'}, byId, targets, index);
  assert.equal(q.options.length, 4);
  assert.ok(q.options.every(o => Object.keys(o).sort().join() === 'id,label'));
  assert.deepEqual(q.options, buildQuestion({id: 'core:r1', mode: 'recognition'}, byId, targets, index).options);
  assert.equal(q.input, null);
  const text = buildQuestion({id: 'core:c1', mode: 'recall'}, byId, targets, index);
  assert.equal(text.options, null);
  assert.equal(text.input.inputMode, 'text');
  assert.equal(buildQuestion({id: 'core:c2', mode: 'recall'}, byId, targets, index).input.inputMode, 'numeric');
  assert.equal(buildQuestion({id: 'core:c3', mode: 'recall'}, byId, targets, index).input.inputMode, 'decimal');
});

test('Grading, labels and reveal info', () => {
  const targets = [rec(1), rcl(1), rcl(2, 'u1', {answerFormat: 'year', answer: '1814', tolerance: 1})];
  const byId = map(targets), index = buildRecognitionIndex(targets);
  const r = {id: 'core:r1', mode: 'recognition'}, c = {id: 'core:c1', mode: 'recall'}, y = {id: 'core:c2', mode: 'recall'};
  assert.equal(gradeQuizoff(r, byId, 'core:r1'), true);
  assert.equal(gradeQuizoff(r, byId, 'option-1'), false);
  assert.equal(gradeQuizoff(c, byId, 'navn navnesen 1'), true);
  assert.equal(gradeQuizoff(c, byId, 'Navn Navnesn 1'), true);
  assert.equal(gradeQuizoff(c, byId, 'Noen Andre'), false);
  assert.equal(gradeQuizoff(c, byId, ''), false);
  assert.equal(gradeQuizoff(y, byId, '1815'), true);
  assert.equal(gradeQuizoff(y, byId, '1900'), false);
  assert.equal(answerLabel(r, byId, targets, index, 'core:r1'), 'Svar 1');
  assert.equal(answerLabel(r, byId, targets, index, 'option-1'), 'A1');
  assert.equal(answerLabel(c, byId, targets, index, 'Hei'), 'Hei');
  assert.deepEqual(revealInfo(r, byId), {answer: 'Svar 1', explanation: 'Forklaring 1', criteria: []});
});

test('A card missing on this phone is flagged and grades false', () => {
  const byId = new Map(), entry = {id: 'core:gone', mode: 'recognition'};
  assert.equal(buildQuestion(entry, byId, [], new Map()).missing, true);
  assert.equal(gradeQuizoff(entry, byId, 'core:gone'), false);
  assert.equal(gradeQuizoff({id: 'core:gone', mode: 'recall'}, byId, 'x'), false);
});

test('Real knowledge pack: pool sizes, picking, building and grading', async () => {
  const pack = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
  const targets = pack.targets, byId = new Map(targets.map(t => [t.id, t])), index = buildRecognitionIndex(targets);
  const recognition = quizoffPool(targets, {modes: ['recognition']}), recall = quizoffPool(targets, {modes: ['recall']});
  console.log('pool sizes', {recognition: recognition.length, recall: recall.length, domains: quizoffDomains(pack, targets).length});
  assert.ok(recognition.length > 600);
  assert.ok(recall.length > 400);
  assert.ok(quizoffDomains(pack, targets).length > 0);
  const pool = quizoffPool(targets, {});
  const a = pickQuestions(pool, {count: 20, seed: 'rom'});
  assert.deepEqual(a, pickQuestions(pool, {count: 20, seed: 'rom'}));
  assert.notDeepEqual(a, pickQuestions(pool, {count: 20, seed: 'annen'}));
  assert.equal(a.length, 20);
  assert.equal(new Set(a.map(q => q.id)).size, 20);
  const known = knownNameSet(pack);
  for (const entry of a) {
    const q = buildQuestion(entry, byId, targets, index);
    assert.equal(q.missing, false);
    if (entry.mode === 'recognition') {
      assert.equal(q.options.length, 4);
      assert.deepEqual(q.options, buildQuestion(entry, byId, targets, index).options);
      assert.equal(gradeQuizoff(entry, byId, entry.id, known), true);
      assert.equal(gradeQuizoff(entry, byId, q.options.find(o => o.id !== entry.id).id, known), false);
    } else assert.ok(q.input.inputMode && q.input.label);
  }
  const target = pool.find(t => t.mode === 'recall' && t.answerFormat === 'short' && normalizeLen(t.answer) >= 8 && !t.acceptedAnswers?.length);
  const entry = {id: target.id, mode: 'recall'};
  assert.equal(gradeQuizoff(entry, byId, target.answer, known), true);
  const typo = target.answer.slice(0, 3) + target.answer.slice(4);
  assert.equal(gradeQuizoff(entry, byId, typo, new Set()), true);
});
const normalizeLen = text => String(text).replace(/[^\p{L}\p{N}]/gu, '').length;

const why = (n, unit = `w${n}`, extra = {}) => ({id: `core:w${n}`, unitId: unit, domainId: 'd1', step: 3, mode: 'recall', answerFormat: 'explanation',
  prompt: `Forklar hvorfor ${n}.`, answer: `Fordi modell ${n}.`, acceptedAnswers: [], explanation: `Mer om ${n}.`,
  rubric: [{id: `w${n}-c0`, text: `Kriterium A${n}`}, {id: `w${n}-c1`, text: `Kriterium B${n}`}], ...extra});

test('Open questions: explanation cards with criteria, only when asked for', () => {
  const targets = [rec(1), rcl(1), why(1), why(2, 'w2', {rubric: []}), why(3, 'w3', {id: 'x:w3'})];
  assert.equal(quizoffMode(why(1)), 'open');
  assert.equal(quizoffMode(rcl(1)), 'recall');
  assert.deepEqual(quizoffPool(targets).map(t => t.id).sort(), ['core:c1', 'core:r1'], 'left out by default');
  assert.deepEqual(quizoffPool(targets, {modes: ['recognition', 'recall', 'open']}).map(t => t.id).sort(), ['core:c1', 'core:r1', 'core:w1']);
  assert.deepEqual(quizoffPool(targets, {modes: ['recall']}).map(t => t.id), ['core:c1']);
});

test('pickQuestions with open cards: about one in five, at least one, spread out and never first', () => {
  const targets = [];
  for (let u = 0; u < 20; u++) for (let i = 0; i < 3; i++) targets.push(rec(u * 10 + i, `u${u}`), rcl(u * 10 + i, `u${u}`));
  for (let n = 0; n < 20; n++) targets.push(why(n, `u${n}`));
  const pool = quizoffPool(targets, {modes: ['recognition', 'recall', 'open']});
  for (const [count, open] of [[3, 1], [5, 1], [10, 2], [15, 3], [20, 4]]) {
    for (const seed of ['a', 'b', 'c', 7]) {
      const picked = pickQuestions(pool, {count, seed});
      assert.deepEqual(picked, pickQuestions(pool, {count, seed}), 'deterministic per seed');
      assert.equal(picked.length, count);
      const at = picked.flatMap((q, i) => q.mode === 'open' ? [i] : []);
      assert.equal(at.length, open, `${count} questions, seed ${seed}`);
      assert.ok(!at.includes(0), 'never first');
      // One in each equal stretch of the rest.
      at.forEach((i, k) => assert.ok(i >= 1 + Math.floor(k * (count - 1) / open) && i < 1 + Math.floor((k + 1) * (count - 1) / open)));
      const closed = picked.filter(q => q.mode !== 'open');
      assert.equal(closed.filter(q => q.mode === 'recognition').length, Math.round(closed.length * 0.6), 'the rest split as before');
      assert.ok(picked.filter(q => q.mode === 'open').every(q => targets.find(t => t.id === q.id).answerFormat === 'explanation'));
    }
  }
  assert.ok(pickQuestions(quizoffPool(targets), {count: 10, seed: 'a'}).every(q => q.mode !== 'open'), 'no open cards unless the form asks for them');
});

test('An open question gets a multiline field for 400 characters and never shows the model answer', () => {
  const targets = [rec(1), why(1)];
  const byId = map(targets), index = buildRecognitionIndex(targets), entry = {id: 'core:w1', mode: 'open'};
  const q = buildQuestion(entry, byId, targets, index);
  assert.equal(OPEN_ANSWER_MAX, 400);
  assert.deepEqual(q.input, {inputMode: 'text', label: 'Forklaringen din', placeholder: 'Forklar med egne ord …', multiline: true, max: OPEN_ANSWER_MAX});
  assert.equal(q.options, null);
  assert.ok(!JSON.stringify(q).includes('Fordi modell') && !JSON.stringify(q).includes('Kriterium'));
  assert.deepEqual(buildQuestion({id: 'core:r1', mode: 'recall'}, map([rcl(1, 'u1', {id: 'core:r1'})]), [], index).input.multiline, false);
  assert.equal(buildQuestion({id: 'core:r1', mode: 'recall'}, map([rcl(1, 'u1', {id: 'core:r1'})]), [], index).input.max, ANSWER_MAX);
  assert.deepEqual(revealInfo(entry, byId), {answer: 'Fordi modell 1.', explanation: 'Mer om 1.', criteria: ['Kriterium A1', 'Kriterium B1']});
  assert.equal(gradeQuizoff(entry, byId, 'Fordi modell 1.'), false, 'open answers are decided by the vote');
  assert.equal(answerLabel(entry, byId, targets, index, 'Mitt svar'), 'Mitt svar');
  assert.deepEqual(revealInfo({id: 'core:gone', mode: 'open'}, byId), {answer: '', explanation: '', criteria: []});
});

test('Real knowledge pack: 120 open questions, and every subject area can have them', async () => {
  const pack = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
  const targets = pack.targets, byId = new Map(targets.map(t => [t.id, t])), index = buildRecognitionIndex(targets);
  const modes = ['recognition', 'recall', 'open'];
  assert.equal(quizoffPool(targets, {modes: ['open']}).length, 120);
  assert.equal(quizoffPool(targets, {modes}).length, 1279 + 120);
  assert.equal(quizoffPool(targets).length, 1279, 'the other forms are unchanged');
  for (const domain of quizoffDomains(pack, targets)) {
    const picked = pickQuestions(quizoffPool(targets, {domainId: domain.id, modes}), {count: 15, seed: domain.id});
    assert.equal(picked.length, 15);
    assert.equal(picked.filter(q => q.mode === 'open').length, 3, domain.id);
    for (const entry of picked.filter(q => q.mode === 'open')) {
      const info = revealInfo(entry, byId);
      assert.ok(info.answer && info.criteria.length >= 3);
      assert.equal(buildQuestion(entry, byId, targets, index).input.multiline, true);
    }
  }
});
