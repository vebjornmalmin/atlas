import {normalizeAnswer} from './exercises.js';
import {assessDifficulty} from './difficulty.js';

export const formatYear = year => year < 0 ? `${-year} f.Kr.` : String(year);
export const CARD_TYPES = ['choice','text','year','number','order','match','explain'];
export const STEP_LABELS = {1:'Oversikt',2:'Kjerne',3:'Sammenheng',4:'Detalj'};
const FILLER = [/konkret holdepunkt/i, /det er viktig å/i, /spennende/i, /!/, /\bselvfølgelig\b/i, /som vi vet/i];
const words = text => String(text || '').trim().split(/\s+/).filter(Boolean);
const sentences = text => String(text || '').split(/(?<=[.?!])\s+/).filter(s => s.trim());
const contentWords = text => normalizeAnswer(text).split(' ').filter(w => w.length >= 4);

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Answers that stand verbatim in the question. */
export function answerLeaks(prompt, answers) {
  const question = normalizeAnswer(prompt);
  return answers.map(String).filter(answer => {
    const value = normalizeAnswer(answer);
    return value.length >= 4 && new RegExp(`(^| )${escapeRegExp(value)}( |$)`).test(question);
  }).map(answer => `spørsmålet røper svaret «${answer}».`);
}

/**
 * Shared rules for every multiple-choice question, curriculum and hand-written introductions alike:
 * three distractors, no duplicates, no answer standing out by length, and no word stem that the
 * question shares with the right answer alone. A stem shared with a distractor is no clue.
 */
export function choiceProblems({prompt, answer, distractors = []}) {
  const errors = [], warnings = [];
  if (distractors.length !== 3) errors.push('flervalg skal ha nøyaktig 3 distraktorer.');
  const keys = [answer, ...distractors].map(normalizeAnswer);
  if (new Set(keys).size !== keys.length) errors.push('like alternativer.');
  if (answer.length > 95) warnings.push(`svaralternativet er langt (${answer.length} tegn).`);
  const average = distractors.reduce((sum, d) => sum + d.length, 0) / Math.max(1, distractors.length);
  if (distractors.length && answer.length > Math.max(25, average * 1.9)) warnings.push('riktig svar er mye lengre enn distraktorene og skiller seg ut.');
  const stems = text => new Set(normalizeAnswer(text).split(' ').filter(w => w.length >= 6).map(w => w.slice(0, 6)));
  const asked = stems(prompt), elsewhere = new Set(distractors.flatMap(d => [...stems(d)]));
  const hints = [...stems(answer)].filter(stem => asked.has(stem) && !elsewhere.has(stem));
  if (hints.length) warnings.push(`spørsmålet og bare det riktige svaret deler ordstammen «${hints[0]}».`);
  return {errors, warnings};
}

/**
 * A hint narrows the search without handing over the answer: no accepted answer, year or pair
 * partner in the hint, nothing that repeats the question, and a length that reads in a glance.
 */
export function hintProblems(card) {
  const errors = [], warnings = [];
  const hint = typeof card.hint === 'string' ? card.hint.trim() : '';
  if (!hint) { errors.push('mangler hint.'); return {errors, warnings}; }
  if (hint.length > 220) errors.push(`hintet er for langt (${hint.length} tegn).`);
  else if (hint.length > 160) warnings.push(`hintet er langt (${hint.length} tegn).`);
  if (!/[.?]$/.test(hint)) warnings.push('hintet bør slutte med punktum.');
  if (normalizeAnswer(hint) === normalizeAnswer(card.prompt)) errors.push('hintet gjentar spørsmålet.');
  if (['choice','text','year','number'].includes(card.type)) {
    errors.push(...answerLeaks(hint, cardAnswers(card)).map(problem => problem.replace('spørsmålet', 'hintet')));
    if (['year','number'].includes(card.type) && new RegExp(`(^|[^\\d])${escapeRegExp(String(card.answer))}([^\\d]|$)`).test(hint)) errors.push(`hintet røper svaret «${card.answer}».`);
    if (['choice','text'].includes(card.type)) {
      const stems = text => new Set(normalizeAnswer(text).split(' ').filter(w => w.length >= 6).map(w => w.slice(0, 6)));
      const asked = stems(hint), shared = [...stems(card.answer)].filter(stem => asked.has(stem));
      if (shared.length) warnings.push(`hintet og svaret deler ordstammen «${shared[0]}».`);
    }
  }
  if (card.type === 'match') for (const pair of card.pairs || []) if (normalizeAnswer(hint).includes(normalizeAnswer(pair.left)) && normalizeAnswer(hint).includes(normalizeAnswer(pair.right))) errors.push(`hintet røper paret «${pair.left} – ${pair.right}».`);
  if (card.type === 'order' && (card.items || []).some(item => new RegExp(`(^|[^\\d])${Math.abs(item.year)}([^\\d]|$)`).test(hint))) errors.push('hintet røper et årstall i rekkefølgen.');
  return {errors: [...new Set(errors)], warnings};
}

/** Accepted answers a learner may type or select for a card. */
export function cardAnswers(card) {
  return [card.answer, ...(card.accept || [])].filter(value => value !== undefined && value !== null && String(value).trim());
}

/** Rough check that a tested answer was taught earlier in the unit. */
export function taughtBefore(unit, card) {
  // Step 3 asks the learner to reason from what was taught, so the answer need not appear verbatim.
  if (['explain','order','match'].includes(card.type) || (card.step === 3 && card.type === 'choice')) return true;
  const cards = unit.cards || [];
  const index = cards.indexOf(card);
  const earlier = cards.filter((other, i) => other !== card && (other.step < card.step || (other.step === card.step && i < index)));
  const taught = normalizeAnswer([...(unit.lesson || []), ...(unit.keyPoints || []), ...earlier.flatMap(other => [other.explain, other.type === 'explain' ? '' : other.answer])].join(' '));
  if (card.type === 'year' || card.type === 'number') return taught.includes(normalizeAnswer(card.answer));
  if (cardAnswers(card).some(answer => normalizeAnswer(answer).length >= 3 && taught.includes(normalizeAnswer(answer)))) return true;
  const answerWords = contentWords(card.answer);
  if (!answerWords.length) return false;
  const stems = new Set(taught.split(' ').filter(w => w.length >= 4).map(w => w.slice(0, 5)));
  return answerWords.filter(w => stems.has(w.slice(0, 5))).length / answerWords.length >= 0.6;
}

/** Structural errors stop the build; warnings need editorial judgement. */
export function validateCoreDomains(domains, {requireKnownPrerequisites = true, mediaIds = null} = {}) {
  const errors = [], warnings = [];
  const unitIds = new Set(), cardIds = new Set(), prompts = new Map(), domainIds = new Set();
  const allUnits = domains.flatMap(file => file.units || []);
  for (const unit of allUnits) unitIds.add(unit.id);
  const seenUnits = new Set();
  for (const file of domains) {
    const domain = file.domain || {};
    if (!/^[a-z][a-z0-9-]+$/.test(domain.id || '')) errors.push(`Fagområde mangler gyldig id.`);
    if (domainIds.has(domain.id)) errors.push(`${domain.id}: fagområdet finnes to ganger.`);
    domainIds.add(domain.id);
    for (const key of ['title','subject','description']) if (typeof domain[key] !== 'string' || !domain[key].trim()) errors.push(`${domain.id}: mangler ${key}.`);
    if (!Number.isInteger(domain.order)) errors.push(`${domain.id}: mangler order.`);
    if (!Array.isArray(file.units) || !file.units.length) errors.push(`${domain.id}: ingen emner.`);
    for (const unit of file.units || []) {
      const at = `${unit.id}`;
      if (!/^[a-z][a-z0-9-]+$/.test(unit.id || '')) errors.push(`${at}: ugyldig emne-ID.`);
      if (seenUnits.has(unit.id)) errors.push(`${at}: emne-ID-en er brukt før.`);
      seenUnits.add(unit.id);
      if (!unit.title?.trim() || !unit.summary?.trim()) errors.push(`${at}: mangler tittel eller sammendrag.`);
      if (![1,2,3].includes(unit.tier)) errors.push(`${at}: tier må være 1, 2 eller 3.`);
      if (!Array.isArray(unit.prerequisites)) errors.push(`${at}: prerequisites må være en liste.`);
      for (const id of unit.prerequisites || []) {
        if (id === unit.id) errors.push(`${at}: emnet kan ikke kreve seg selv.`);
        else if (!unitIds.has(id)) (requireKnownPrerequisites ? errors : warnings).push(`${at}: ukjent forkunnskap ${id}.`);
      }
      if (unit.years && (!Number.isInteger(unit.years.from) || !Number.isInteger(unit.years.to) || unit.years.to < unit.years.from)) errors.push(`${at}: ugyldige årstall.`);
      if (!Array.isArray(unit.lesson) || unit.lesson.length < 2 || unit.lesson.length > 4) errors.push(`${at}: leksjonen skal ha 2–4 avsnitt.`);
      for (const paragraph of unit.lesson || []) if (words(paragraph).length > 95) warnings.push(`${at}: et leksjonsavsnitt har ${words(paragraph).length} ord (maks ca. 70).`);
      if (!Array.isArray(unit.keyPoints) || unit.keyPoints.length < 3 || unit.keyPoints.length > 6) errors.push(`${at}: keyPoints skal ha 3–5 punkter.`);
      if (!Array.isArray(unit.sources) || !unit.sources.length) errors.push(`${at}: mangler kilder.`);
      for (const source of unit.sources || []) {
        try { if (new URL(source.url).protocol !== 'https:' || !source.title?.trim()) throw new Error(); }
        catch { errors.push(`${at}: ugyldig kilde ${source?.url}.`); }
      }
      for (const text of [...(unit.lesson || []), unit.summary]) for (const pattern of FILLER) if (pattern.test(text || '')) warnings.push(`${at}: fyllfrase eller utropstegn i leksjonen: «${text.slice(0, 60)}…»`);
      const cards = unit.cards || [];
      if (cards.length < 8 || cards.length > 16) errors.push(`${at}: ${cards.length} kort (skal være 10–14).`);
      for (const step of [1,2,3]) if (!cards.some(card => card.step === step)) errors.push(`${at}: mangler kort på steg ${step}.`);
      if (!cards.some(card => card.step === 3 && ['explain','order','match'].includes(card.type))) warnings.push(`${at}: steg 3 bør ha et forklarings-, rekkefølge- eller koblingskort.`);
      for (const card of cards) validateCard(unit, card, errors, warnings, {cardIds, prompts, mediaIds});
    }
  }
  const byId = new Map(allUnits.map(unit => [unit.id, unit]));
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visited.has(id) || !byId.has(id)) return;
    if (visiting.has(id)) { errors.push(`${id}: sirkulære forkunnskaper.`); return; }
    visiting.add(id); for (const next of byId.get(id).prerequisites || []) visit(next); visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return {errors, warnings, counts: {domains: domains.length, units: allUnits.length, cards: allUnits.reduce((sum, unit) => sum + (unit.cards?.length || 0), 0)}};
}

function validateCard(unit, card, errors, warnings, {cardIds, prompts, mediaIds}) {
  const at = `${card.id || unit.id + ':?'}`;
  if (card.media !== undefined && mediaIds && !mediaIds.has(card.media)) errors.push(`${at}: ukjent bilde ${card.media}.`);
  if (!card.id?.startsWith(`${unit.id}-`)) errors.push(`${at}: kort-ID skal begynne med «${unit.id}-».`);
  if (cardIds.has(card.id)) errors.push(`${at}: kort-ID-en er brukt før.`);
  cardIds.add(card.id);
  if (![1,2,3,4].includes(card.step)) errors.push(`${at}: steg må være 1–4.`);
  if (!CARD_TYPES.includes(card.type)) { errors.push(`${at}: ukjent korttype ${card.type}.`); return; }
  if (!card.prompt?.trim()) errors.push(`${at}: mangler spørsmål.`);
  else if (!/[?.]$/.test(card.prompt.trim())) warnings.push(`${at}: spørsmålet bør slutte med ? eller punktum.`);
  const promptKey = normalizeAnswer(card.prompt);
  if (prompts.has(promptKey)) errors.push(`${at}: samme spørsmål som ${prompts.get(promptKey)}.`);
  prompts.set(promptKey, card.id);
  if (!card.explain?.trim() || card.explain.trim().length < 30) errors.push(`${at}: forklaringen etter svaret mangler eller er for kort.`);
  else if (sentences(card.explain).length > 4) warnings.push(`${at}: forklaringen er lang (${sentences(card.explain).length} setninger).`);
  for (const pattern of FILLER) if (pattern.test(`${card.prompt} ${card.explain}`)) warnings.push(`${at}: fyllfrase eller utropstegn.`);
  const prompt = normalizeAnswer(card.prompt);
  if (!['explain','order','match'].includes(card.type)) {
    if (typeof card.answer !== 'string' || !card.answer.trim()) { errors.push(`${at}: mangler svar.`); return; }
    for (const problem of answerLeaks(card.prompt, cardAnswers(card))) errors.push(`${at}: ${problem}`);
    if (normalizeAnswer(card.explain) === normalizeAnswer(card.answer)) errors.push(`${at}: forklaringen gjentar bare svaret.`);
  }
  if (card.accept !== undefined && (!Array.isArray(card.accept) || card.accept.some(value => typeof value !== 'string'))) errors.push(`${at}: accept må være en liste med tekst.`);
  if (card.type === 'choice') {
    const checked = choiceProblems(card);
    errors.push(...checked.errors.map(problem => `${at}: ${problem}`));
    warnings.push(...checked.warnings.map(problem => `${at}: ${problem}`));
  }
  if (card.type === 'text') {
    if (words(card.answer).length > 5 || card.answer.length > 45) errors.push(`${at}: tekstsvar skal være kort (1–4 ord). Bruk choice eller explain.`);
  }
  if (card.type === 'year') {
    if (!/^\d{3,4}$/.test(card.answer)) errors.push(`${at}: årstall skal være 3–4 sifre etter vår tidsregning.`);
    if (card.tolerance !== undefined && (!Number.isInteger(card.tolerance) || card.tolerance < 0 || card.tolerance > 50)) errors.push(`${at}: ugyldig tolerance.`);
  }
  if (card.type === 'number') {
    if (!/^-?\d+([.,]\d+)?$/.test(card.answer)) errors.push(`${at}: tallsvar skal være et tall.`);
    if (card.tolerance !== undefined && !(Number(card.tolerance) >= 0)) errors.push(`${at}: ugyldig tolerance.`);
  }
  if (card.type === 'order') {
    const items = card.items || [];
    if (items.length < 3 || items.length > 5) errors.push(`${at}: rekkefølge skal ha 3–5 elementer.`);
    if (items.some(item => !item?.label?.trim() || !Number.isInteger(item.year))) errors.push(`${at}: hvert element trenger label og year.`);
    if (new Set(items.map(item => item.year)).size !== items.length) errors.push(`${at}: rekkefølgen er ikke entydig (like årstall).`);
  }
  if (card.type === 'match') {
    const pairs = card.pairs || [];
    if (pairs.length < 3 || pairs.length > 4) errors.push(`${at}: kobling skal ha 3–4 par.`);
    if (pairs.some(pair => !pair?.left?.trim() || !pair?.right?.trim())) errors.push(`${at}: hvert par trenger left og right.`);
    if (new Set(pairs.map(pair => normalizeAnswer(pair.right))).size !== pairs.length || new Set(pairs.map(pair => normalizeAnswer(pair.left))).size !== pairs.length) errors.push(`${at}: parene er ikke entydige.`);
  }
  if (card.type === 'explain') {
    if (!card.answer?.trim() || card.answer.length > 420) errors.push(`${at}: modellsvaret mangler eller er for langt.`);
    if (!Array.isArray(card.checklist) || card.checklist.length < 2 || card.checklist.length > 4) errors.push(`${at}: forklaringskort trenger 2–4 sjekkpunkter.`);
  }
  const hinted = hintProblems(card);
  errors.push(...hinted.errors.map(problem => `${at}: ${problem}`));
  warnings.push(...hinted.warnings.map(problem => `${at}: ${problem}`));
  if (!taughtBefore(unit, card)) warnings.push(`${at}: svaret «${String(card.answer).slice(0, 50)}» ser ikke ut til å være undervist før det testes.`);
}

const KIND = {choice:'recognition',text:'recall',year:'recall',number:'recall',order:'before-after',match:'connections',explain:'connections'};
const MODE = {choice:'recognition',text:'recall',year:'recall',number:'recall',order:'timeline',match:'matching',explain:'recall'};
const STAGE = {1:'foundation',2:'foundation',3:'connections',4:'details'};
const sourceId = url => `core-source:${url.replace(/^https:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase()}`;
export const coreTargetId = cardId => `core:${cardId}`;
export const unitEntityId = unitId => `unit:${unitId}`;

function targetAnswer(card) {
  if (card.type === 'order') return [...card.items].sort((a, b) => a.year - b.year).map(item => `${item.label} (${formatYear(item.year)})`).join(' → ');
  if (card.type === 'match') return card.pairs.map(pair => `${pair.left} – ${pair.right}`).join(' · ');
  return String(card.answer);
}

/** Compile authored domains into package rows. Card IDs become stable target and fact IDs. */
export function compileCore(domains) {
  const collections = [], entities = [], targets = [], claims = [], exerciseFacts = {}, sources = new Map();
  const curriculum = {version: 1, domains: [], units: []};
  for (const file of [...domains].sort((a, b) => a.domain.order - b.domain.order)) {
    const domain = file.domain;
    collections.push({id: domain.id, title: domain.title, subject: domain.subject, description: domain.description, core: true, order: domain.order});
    curriculum.domains.push({id: domain.id, title: domain.title, subject: domain.subject, description: domain.description, order: domain.order, unitIds: file.units.map(unit => unit.id)});
    file.units.forEach((unit, unitIndex) => {
      const sourceIds = unit.sources.map(source => {
        const id = sourceId(source.url);
        if (!sources.has(id)) sources.set(id, {id, title: source.title, url: source.url, license: 'Fakta og egne formuleringer. Kildeteksten gjengis ikke.'});
        return id;
      });
      const entityId = unitEntityId(unit.id);
      entities.push({id: entityId, label: unit.title, type: 'topic', summary: unit.summary, collectionIds: [domain.id], sourceIds});
      const cardIds = unit.cards.map(card => coreTargetId(card.id));
      curriculum.units.push({id: unit.id, domainId: domain.id, title: unit.title, tier: unit.tier, order: unitIndex,
        prerequisites: [...unit.prerequisites], summary: unit.summary, lesson: [...unit.lesson], keyPoints: [...unit.keyPoints],
        ...(unit.years ? {years: {...unit.years}} : {}), sourceIds, cardIds});
      for (const card of unit.cards) {
        const id = coreTargetId(card.id), factId = `fact:${id}`;
        const answer = targetAnswer(card);
        const target = {
          id, unitId: unit.id, domainId: domain.id, step: card.step, cardType: card.type, entityId, collectionIds: [domain.id],
          prompt: card.prompt, answer, acceptedAnswers: [...(card.accept || [])], explanation: card.explain,
          sourceIds: [...sourceIds], kind: KIND[card.type], mode: MODE[card.type],
          difficulty: Math.min(5, card.step + (unit.tier > 1 ? 1 : 0)), significance: Math.max(1, 6 - card.step - (unit.tier === 3 ? 1 : 0)),
          learningStage: STAGE[card.step], learningProfile: {reviewed: true, stage: STAGE[card.step],
            precision: ['year','number'].includes(card.type) ? 'exact' : card.type === 'match' || card.type === 'order' ? 'complete' : 'broad',
            reasoning: card.type === 'explain' ? 'explain' : card.type === 'order' ? 'order' : card.type === 'match' ? 'compare' : card.step === 3 ? 'explain' : 'identify'},
          factId, claimIds: [factId], retrievalRole: 'default', legacyFactId: id,
          ...(unit.years ? {year: unit.years.from} : {}),
          ...(card.hint ? {hint: card.hint} : {}),
          ...(card.media ? {media: card.media} : {})
        };
        if (card.type === 'choice') target.options = [String(card.answer), ...card.distractors];
        if (card.type === 'explain') Object.assign(target, {answerFormat: 'explanation', rubric: card.checklist.map((text, i) => ({id: `${card.id}-c${i}`, text}))});
        if (card.type === 'year') Object.assign(target, {answerFormat: 'year', tolerance: card.tolerance || 0});
        if (card.type === 'number') Object.assign(target, {answerFormat: 'number', tolerance: Number(card.tolerance || 0), ...(card.unit ? {numberUnit: card.unit} : {})});
        if (card.type === 'text') target.answerFormat = 'short';
        if (card.type === 'order') target.timeline = {id, title: card.prompt, items: card.items.map((item, i) => ({id: `${card.id}-${i}`, label: item.label, year: item.year}))};
        if (card.type === 'match') target.pairs = card.pairs.map((pair, i) => ({id: `${card.id}-${i}`, label: pair.left, answer: pair.right}));
        targets.push({...target, ...assessDifficulty(target)});
        claims.push({id: factId, entityIds: [entityId], relationshipIds: [], statement: card.explain, sourceIds: [...sourceIds], evidenceStatus: 'documented'});
        exerciseFacts[id] = {factId, claimIds: [factId], retrievalRole: 'default'};
      }
    });
  }
  return {collections, entities, targets, claims, exerciseFacts, sources: [...sources.values()], curriculum};
}

/** Replace any previously compiled core rows so the build is idempotent. */
/** Rows owned by the curriculum; they are replaced whenever the curriculum is recompiled. */
export const isCore = id => id.startsWith('core:') || id.startsWith('unit:') || id.startsWith('fact:core:') || id.startsWith('core-source:');

export function mergeCore(data, core) {
  const coreCollections = new Set(core.collections.map(c => c.id));
  const exerciseFacts = Object.fromEntries(Object.entries(data.exerciseFacts || {}).filter(([id]) => !isCore(id)));
  const merged = {...data,
    collections: [...data.collections.filter(c => !c.core && !coreCollections.has(c.id)), ...core.collections],
    entities: [...data.entities.filter(e => !isCore(e.id)), ...core.entities],
    targets: [...data.targets.filter(t => !isCore(t.id)), ...core.targets],
    sources: [...data.sources.filter(s => !isCore(s.id)), ...core.sources],
    claims: [...(data.claims || []).filter(c => !isCore(c.id)), ...core.claims],
    exerciseFacts: {...exerciseFacts, ...core.exerciseFacts},
    curriculum: core.curriculum};
  return {...merged, entityCount: merged.entities.length, targetCount: merged.targets.length, relationshipCount: merged.relationships.length};
}

/** Apply curated name corrections to register rows; the earlier form stays an accepted answer. */
export function applyCorrections(data, corrections) {
  const pairs = Object.entries(corrections.labels || {});
  const swap = text => typeof text === 'string' ? pairs.reduce((value, [from, to]) => value.replace(new RegExp(`(^|[^\\p{L}])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'gu'), `$1${to}`), text) : text;
  const entities = data.entities.map(e => ({...e, label: swap(e.label), summary: swap(e.summary)}));
  const targets = data.targets.map(t => {
    const answer = swap(t.answer);
    const accepted = [...new Set([...(t.acceptedAnswers || []).map(a => a), ...(answer !== t.answer ? [t.answer] : []), ...(corrections.accept?.[answer] || [])])].filter(a => a !== answer);
    return {...t, prompt: swap(t.prompt), answer, explanation: swap(t.explanation), acceptedAnswers: accepted, ...(t.options ? {options: t.options.map(swap)} : {})};
  });
  const relationships = data.relationships.map(r => ({...r, context: swap(r.context)}));
  const claims = (data.claims || []).map(c => ({...c, statement: swap(c.statement)}));
  const timelines = data.timelines.map(t => ({...t, items: t.items.map(item => ({...item, label: swap(item.label)}))}));
  return {...data, entities, targets, relationships, claims, timelines};
}
