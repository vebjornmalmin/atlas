import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCore, mergeCore, validateCoreDomains, taughtBefore} from '../src/lib/core-curriculum.js';
import {buildDailySession, curriculumProgress, gradeAnswer, isLessonEntry, recommendedUnits, buildUnitReview} from '../src/lib/progression.js';
import {attachKnowledge, schedulingKey} from '../src/lib/knowledge-model.js';
import {validatePackage} from '../src/lib/content.js';

const card = (unit, n, step, extra = {}) => ({id: `${unit}-k${n}`, step, type: 'choice', prompt: `Spørsmål ${n} om ${unit}?`, answer: `Svar ${unit} ${n}`,
  distractors: [`Feil a ${n}`, `Feil b ${n}`, `Feil c ${n}`], explain: `Forklaring nummer ${n} som lærer bort noe nytt om emnet.`, ...extra});
const unit = (id, prerequisites = [], tier = 1) => ({id, title: `Emne ${id}`, tier, prerequisites, summary: 'Et emne.',
  lesson: [`Svar ${id} 1 og Svar ${id} 2 og Svar ${id} 3.`, `Svar ${id} 4 og Svar ${id} 5 og Svar ${id} 6 og Svar ${id} 7 og Svar ${id} 8.`],
  keyPoints: ['Ett.', 'To.', 'Tre.'], sources: [{title: 'Kilde', url: `https://snl.no/${id}`}],
  cards: [card(id, 1, 1), card(id, 2, 1), card(id, 3, 1), card(id, 4, 2), card(id, 5, 2), card(id, 6, 3, {type: 'explain', answer: 'Modellsvar.', checklist: ['A', 'B']}),
    card(id, 7, 4, {type: 'year', answer: '1814', distractors: undefined}), card(id, 8, 2)]});
const domains = [
  {domain: {id: 'alfa', title: 'Alfa', subject: 'history', order: 1, description: 'Første fag.'}, units: [unit('a-en'), unit('a-to', ['a-en'], 2)]},
  {domain: {id: 'beta', title: 'Beta', subject: 'science', order: 2, description: 'Andre fag.'}, units: [unit('b-en')]}
];
domains[0].units[0].lesson.push('Året 1814 er viktig.');
domains[0].units[1].lesson.push('Året 1814 er viktig.');
domains[1].units[0].lesson.push('Året 1814 er viktig.');

function fixture() {
  const core = compileCore(domains);
  const data = {curriculum: core.curriculum};
  const targets = attachKnowledge(core.targets, {exerciseFacts: core.exerciseFacts});
  return {core, data, targets};
}
const answer = (target, correct, at = '2026-11-01T08:00:00Z') => ({id: `${target.id}:${at}`, targetId: target.id, timestamp: at, correct, usedHint: false, learnedFirst: false});

test('authored domains validate and compile to stable card targets with lessons', () => {
  const check = validateCoreDomains(domains);
  assert.deepEqual(check.errors, []);
  const {core} = fixture();
  assert.equal(core.targets.length, 24);
  assert.ok(core.targets.every(t => t.id.startsWith('core:') && t.unitId && t.factId === `fact:${t.id}`));
  assert.equal(core.targets.find(t => t.id === 'core:a-en-k1').options.length, 4);
  assert.equal(core.targets.find(t => t.id === 'core:a-en-k6').answerFormat, 'explanation');
  assert.deepEqual(core.curriculum.units.find(u => u.id === 'a-to').prerequisites, ['a-en']);
});

test('the real curriculum compiles into a valid package', () => {
  const files = ['norgeshistorie'].map(name => JSON.parse(readFileSync(new URL(`../knowledge-build/core/${name}.json`, import.meta.url), 'utf8')));
  const base = JSON.parse(readFileSync(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
  const merged = mergeCore(base, compileCore(files.map(f => ({...f, units: f.units.filter(u => u.id === 'nh-vikingtiden')}))));
  assert.deepEqual(validatePackage(merged), []);
  assert.equal(mergeCore(merged, compileCore([])).targets.filter(t => t.unitId).length, 0, 'rebuilding removes previous core rows');
});

test('a new learner starts with lessons from two subjects and never meets a later step first', () => {
  const {data, targets} = fixture();
  const session = buildDailySession({data, targets, states: [], reviews: [], preferences: {dailyMinutes: 5}, now: new Date('2026-11-01T09:00:00Z')});
  const lessons = session.queue.filter(isLessonEntry);
  assert.deepEqual(lessons.map(l => l.unitId).sort(), ['a-en', 'b-en']);
  assert.ok(session.queue.slice(0, 2).every(isLessonEntry), 'lessons come before questions');
  const cards = session.queue.filter(row => !isLessonEntry(row)).map(row => row.target);
  assert.ok(cards.every(t => t.unitId !== 'a-to'), 'a unit waits for its prerequisite');
  for (const id of ['a-en', 'b-en']) {
    const steps = cards.filter(t => t.unitId === id).map(t => t.step);
    assert.deepEqual(steps, [...steps].sort(), 'cards follow the step order');
    assert.equal(steps[0], 1);
  }
  assert.ok(cards.length <= 10, "lessons do not use question slots");
});

test('a unit is grounded when its foundation is answered and has survived a later review, which unlocks the next unit', () => {
  const {data, targets} = fixture();
  const base = targets.filter(t => t.unitId === 'a-en' && t.step <= 2);
  const reviews = base.map(t => answer(t, true));
  const state = (t, reps) => ({id: schedulingKey(t), due: '2026-11-09T08:00:00Z', stability: 5, difficulty: 5, reps, lapses: 0, state: 2, last_review: '2026-11-03T08:00:00Z'});
  const sameDay = curriculumProgress(data.curriculum, targets, base.map(t => state(t, 1)), reviews);
  assert.equal(sameDay.units.get('a-en').status, 'practiced', 'answers straight after the lesson are not yet a foundation');
  assert.equal(sameDay.units.get('a-to').ready, false);
  const progress = curriculumProgress(data.curriculum, targets, base.map(t => state(t, 2)), reviews);
  assert.equal(progress.units.get('a-en').status, 'grounded');
  assert.equal(progress.units.get('a-to').ready, true);
  const order = recommendedUnits(data.curriculum, progress).map(u => u.id);
  assert.equal(order[0], 'a-en', 'unfinished units continue before new ones');
  assert.ok(order.includes('a-to'));
});

test('due reviews come first and lessons are not repeated for started units', () => {
  const {data, targets} = fixture();
  const first = targets.find(t => t.id === 'core:a-en-k1');
  const state = {id: schedulingKey(first), due: '2026-11-02T08:00:00Z', stability: 1, difficulty: 5, reps: 1, lapses: 0, state: 2, last_review: '2026-11-01T08:00:00Z', elapsed_days: 0, scheduled_days: 1, learning_steps: 0};
  const session = buildDailySession({data, targets, states: [state], reviews: [answer(first, true)], preferences: {dailyMinutes: 5}, now: new Date('2026-11-03T09:00:00Z')});
  assert.equal(session.dueCount, 1);
  assert.ok(session.queue.some(row => row.reason === 'Due review' && row.target.id === first.id));
  assert.ok(!session.queue.some(row => isLessonEntry(row) && row.unitId === 'a-en'));
  assert.ok(!session.queue.some(row => row.target?.id === first.id && row.reason !== 'Due review'));
});

test('an answer shown in an explanation is tested in a later session, not straight away', () => {
  const leaky = structuredClone(domains);
  leaky[0].units[0].cards[0].explain = 'Forklaringen nevner Svar a-en 4 som et senere kort spør om.';
  const core = compileCore(leaky);
  const targets = attachKnowledge(core.targets, {exerciseFacts: core.exerciseFacts});
  const session = buildDailySession({data: {curriculum: core.curriculum}, targets, states: [], reviews: [], preferences: {dailyMinutes: 10}, unitIds: ['a-en']});
  const ids = session.queue.filter(row => !isLessonEntry(row)).map(row => row.target.id);
  assert.ok(ids.includes('core:a-en-k1'));
  assert.ok(!ids.includes('core:a-en-k4'));
});

test('unit review orders weak cards first', () => {
  const {data, targets} = fixture();
  const cards = targets.filter(t => t.unitId === 'b-en');
  const reviews = cards.map((t, i) => answer(t, i !== 3));
  const review = buildUnitReview({data, targets, states: [], reviews, unitId: 'b-en'});
  assert.equal(review.queue[0].target.id, cards[3].id);
});

test('grading accepts small typing slips, surnames and documented tolerances', () => {
  const name = {prompt: 'Hvem ledet ferden?', answer: 'Leiv Eiriksson', acceptedAnswers: []};
  assert.equal(gradeAnswer(name, 'Leiv Eirikson').correct, true);
  assert.equal(gradeAnswer(name, 'Eiriksson').correct, true);
  assert.equal(gradeAnswer(name, 'Olav').correct, false);
  assert.equal(gradeAnswer({answer: 'Oslo', acceptedAnswers: []}, 'Osli').correct, false, 'short answers must be exact');
  const year = {answer: '1349', answerFormat: 'year', tolerance: 1};
  assert.equal(gradeAnswer(year, '1350').correct, true);
  assert.equal(gradeAnswer(year, '1352').correct, false);
  assert.equal(gradeAnswer({answer: '15', answerFormat: 'number', tolerance: 0}, '15').correct, true);
  assert.equal(gradeAnswer(name, '').correct, null);
});

test('teaching check finds answers in the lesson or earlier explanations', () => {
  const u = domains[0].units[0];
  assert.equal(taughtBefore(u, u.cards[0]), true);
  const untaught = {...u.cards[3], answer: 'Noe helt ukjent', id: 'x'};
  assert.equal(taughtBefore({...u, cards: [...u.cards, untaught]}, untaught), false);
});

test('streak counts consecutive practice days up to today or yesterday', async () => {
  const {practiceStreak} = await import('../src/lib/progression.js');
  const now = new Date('2026-11-05T12:00:00');
  const at = day => ({timestamp: new Date(`2026-11-0${day}T10:00:00`).toISOString()});
  assert.equal(practiceStreak([at(3), at(4), at(5)], now), 3);
  assert.equal(practiceStreak([at(3), at(4)], now), 2, 'yesterday still counts before today is done');
  assert.equal(practiceStreak([at(2), at(4)], now), 1);
  assert.equal(practiceStreak([], now), 0);
});

test('negative numbers are read from a typographic minus or the word minus', () => {
  const card = {answer: '-18', answerFormat: 'number', tolerance: 0};
  for (const input of ['-18', '−18', 'minus 18', '– 18']) assert.equal(gradeAnswer(card, input).correct, true, input);
  assert.equal(gradeAnswer(card, '18').correct, false);
});

test('due reviews from different units are interleaved', () => {
  const {data, targets} = fixture();
  const cards = [...targets.filter(t => t.unitId === 'a-en').slice(0, 3), ...targets.filter(t => t.unitId === 'b-en').slice(0, 3)];
  const states = cards.map((t, i) => ({id: schedulingKey(t), due: `2026-11-02T0${i}:00:00Z`, stability: 3, difficulty: 5, reps: 2, lapses: 0, state: 2, last_review: '2026-10-30T08:00:00Z'}));
  const session = buildDailySession({data, targets, states, reviews: [], preferences: {dailyMinutes: 3, newRatio: 0}, now: new Date('2026-11-03T09:00:00Z')});
  const units = session.queue.map(row => row.unitId);
  assert.equal(units.length, 6);
  for (let i = 1; i < units.length; i++) assert.notEqual(units[i], units[i - 1], units.join(','));
});

test('after upgrading, reviews of earlier register questions still come back in the daily session', () => {
  const data = JSON.parse(readFileSync(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
  assert.ok(data.curriculum.units.length >= 80);
  const targets = attachKnowledge(data.targets, data);
  const legacy = targets.find(t => t.id === 'capital-norway') || targets.find(t => !t.unitId && /hovedstaden i/.test(t.prompt));
  const state = {id: schedulingKey(legacy), due: '2026-11-02T08:00:00Z', stability: 4, difficulty: 5, reps: 3, lapses: 0, state: 2, last_review: '2026-10-29T08:00:00Z'};
  const reviews = [{id: 'old', targetId: legacy.id, timestamp: '2026-10-29T08:00:00Z', correct: true, rating: 3}];
  const session = buildDailySession({data, targets, states: [state], reviews, preferences: {dailyMinutes: 5}, now: new Date('2026-11-02T09:00:00Z')});
  assert.ok(session.queue.some(row => row.reason === 'Due review' && row.target.id === legacy.id), 'the old review is kept');
  assert.ok(session.queue.some(row => isLessonEntry(row)), 'new curriculum is offered alongside');
  assert.deepEqual(validatePackage(data), []);
});
