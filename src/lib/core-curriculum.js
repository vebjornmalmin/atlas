import {normalizeAnswer} from './exercises.js';

export const CARD_TYPES = ['choice','text','year','number','order','match','explain'];
export const STEP_LABELS = {1:'Oversikt',2:'Kjerne',3:'Sammenheng',4:'Detalj'};
const FILLER = [/konkret holdepunkt/i, /det er viktig å/i, /spennende/i, /!/, /\bselvfølgelig\b/i, /som vi vet/i];
const words = text => String(text || '').trim().split(/\s+/).filter(Boolean);
const sentences = text => String(text || '').split(/(?<=[.?!])\s+/).filter(s => s.trim());
const contentWords = text => normalizeAnswer(text).split(' ').filter(w => w.length >= 4);

/** Accepted answers a learner may type or select for a card. */
export function cardAnswers(card) {
  return [card.answer, ...(card.accept || [])].filter(value => value !== undefined && value !== null && String(value).trim());
}

/** Rough check that a tested answer was taught earlier in the unit. */
export function taughtBefore(unit, card) {
  if (['explain','order','match'].includes(card.type)) return true;
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
    for (const answer of cardAnswers(card)) {
      const value = normalizeAnswer(answer);
      if (value.length >= 4 && new RegExp(`(^| )${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(prompt)) errors.push(`${at}: spørsmålet røper svaret «${answer}».`);
    }
    if (normalizeAnswer(card.explain) === normalizeAnswer(card.answer)) errors.push(`${at}: forklaringen gjentar bare svaret.`);
  }
  if (card.accept !== undefined && (!Array.isArray(card.accept) || card.accept.some(value => typeof value !== 'string'))) errors.push(`${at}: accept må være en liste med tekst.`);
  if (card.type === 'choice') {
    const distractors = card.distractors || [];
    if (distractors.length !== 3) errors.push(`${at}: flervalg skal ha nøyaktig 3 distraktorer.`);
    const keys = [card.answer, ...distractors].map(normalizeAnswer);
    if (new Set(keys).size !== keys.length) errors.push(`${at}: like alternativer.`);
    if (card.answer.length > 95) warnings.push(`${at}: svaralternativet er langt (${card.answer.length} tegn).`);
    const average = distractors.reduce((sum, d) => sum + d.length, 0) / Math.max(1, distractors.length);
    if (distractors.length && card.answer.length > Math.max(25, average * 1.9)) warnings.push(`${at}: riktig svar er mye lengre enn distraktorene og skiller seg ut.`);
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
  if (!taughtBefore(unit, card)) warnings.push(`${at}: svaret «${String(card.answer).slice(0, 50)}» ser ikke ut til å være undervist før det testes.`);
}
