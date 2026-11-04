import {LISTENING_WORKS} from './works.js';

const ERAS = ['barokk', 'wienerklassisisme', 'romantikk', 'nasjonalromantikk', '1900-tallet'];
// Verk som de fleste kjenner igjen; alle andre får familiarity 2, og de mindre kjente får 3.
const VERY_FAMILIAR = new Set(['maanesonaten', 'ode-til-gleden', 'eine-kleine-nachtmusik', 'notteknekkeren', 'svanesjoen', 'bolero', 'blaa-donau', 'morgenstemning', 'dovregubbens-hall', 'vaaren', 'halleluja', 'ouverture-1812', 'tryllefloyten', 'tyrkisk-marsj', 'humlens-flukt', 'galopp-infernal', 'toccata-d-moll', 'clair-de-lune', 'forellkvintetten', 'symfoni-5']);
const LESS_FAMILIAR = new Set(['faun', 'pavane', 'jupiter', 'gymnopedie-1', 'nye-verden', 'revolusjonsetyden', 'nocturne-es-dur', 'solveigs-sang', 'bilder', 'vannmusikk']);

const ERA_LABEL = {
  barokk: 'barokken', wienerklassisisme: 'wienerklassisismen', romantikk: 'romantikken',
  nasjonalromantikk: 'nasjonalromantikken', '1900-tallet': '1900-tallet'
};

/** FNV-1a: stabil hash, så valg og rekkefølge blir det samme ved hver bygging. */
function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function distance(a, b) {
  const eras = Math.abs(ERAS.indexOf(a.era) - ERAS.indexOf(b.era));
  return eras * 1000 + Math.abs(a.year - b.year);
}

function familiarityOf(work) {
  if (VERY_FAMILIAR.has(work.id)) return 1;
  if (LESS_FAMILIAR.has(work.id)) return 3;
  return 2;
}

/**
 * Fire svar: riktig svar pluss tre distraktorer fra samme eller nærliggende epoke.
 * Valget og rekkefølgen er deterministisk, og det riktige svaret står nøyaktig én gang.
 */
export function listeningChoices(work, works = LISTENING_WORKS, ask = 'work') {
  const label = w => (ask === 'composer' ? w.composer : w.title);
  const answer = label(work);
  const seen = new Set([answer]);
  const pool = [];
  const sorted = [...works].filter(w => w.id !== work.id).sort((a, b) => distance(work, a) - distance(work, b) || a.id.localeCompare(b.id));
  for (const candidate of sorted) {
    const text = label(candidate);
    if (seen.has(text)) continue;
    seen.add(text);
    pool.push(text);
    if (pool.length === 6) break;
  }
  const seed = `${ask}:${work.id}`;
  const distractors = pool.sort((a, b) => hash(`${seed}|${a}`) - hash(`${seed}|${b}`)).slice(0, 3);
  const choices = [answer, ...distractors].sort((a, b) => hash(`${seed}|order|${a}`) - hash(`${seed}|order|${b}`));
  if (choices.length !== 4) throw new Error(`Lytteøvelse ${work.id}: fant ikke tre distraktorer.`);
  return choices;
}

function listeningTarget(work, works, ask) {
  const familiarity = familiarityOf(work);
  const answer = ask === 'composer' ? work.composer : work.title;
  const year = `${work.year}${work.approximate ? ' (ca.)' : ''}`;
  return {
    id: ask === 'composer' ? `listen-composer:${work.id}` : `listen:${work.id}`,
    mode: 'listen',
    kind: 'recognition',
    ask,
    workId: work.id,
    title: work.title,
    composer: work.composer,
    year: work.year,
    approximate: Boolean(work.approximate),
    era: work.era,
    commonsSearch: work.commonsSearch,
    collectionIds: ['kunst-musikk'],
    prompt: ask === 'composer' ? 'Hvem skrev verket du hører?' : 'Hvilket verk hører du?',
    answer,
    choices: listeningChoices(work, works, ask),
    explanation: `${work.title} av ${work.composer}, ${year}. Verket er fra ${ERA_LABEL[work.era] ?? work.era}. Innspillingen kommer fra Wikimedia Commons, og utøver og lisens vises etter svaret.`,
    sources: work.sources,
    sourceIds: [],
    difficulty: familiarity === 1 ? 2 : 3,
    significance: 3,
    familiarity,
    requiresNetwork: true
  };
}

export function buildListeningTargets(works = LISTENING_WORKS) {
  const targets = [];
  for (const work of works) {
    targets.push(listeningTarget(work, works, 'work'));
    targets.push(listeningTarget(work, works, 'composer'));
  }
  return targets;
}

export function gradeListening(target, draft = {}) {
  return {correct: draft.choice === target.answer};
}

export function listeningReady(target, draft = {}) {
  return Boolean(draft.choice);
}
