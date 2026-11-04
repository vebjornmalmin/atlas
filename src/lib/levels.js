// Four axes of difficulty. A question is hard for different reasons: having to produce the answer
// yourself, needing an exact detail, meeting something unfamiliar, or holding many things in mind.
// Drawing a connection you understand can be easier than recalling one number, so the axes are
// weighted separately instead of treating «connections» as the top of one ladder.
export const AXES = [
  {id:'retrieval', label:'Henting', steps:['Gjenkjenne','Plassere','Hente fram'],
    note:'Å velge blant alternativer er lettere enn å plassere på kart eller tidslinje, og det er lettere enn å skrive svaret selv.'},
  {id:'precision', label:'Presisjon', steps:['Omtrent','Bestemt','Eksakt'],
    note:'Omtrent når noe skjedde er lettere enn navnet, og navnet er lettere enn det eksakte årstallet eller hele lista.'},
  {id:'familiarity', label:'Kjennskap', steps:['Kjent','Mindre kjent','Smalt'],
    note:'Kjente land, personer og verk er lettere å hente fram enn det du sjelden møter.'},
  {id:'structure', label:'Sammenheng', steps:['Ett holdepunkt','To ting','Et mønster'],
    note:'Å holde flere ting i hodet samtidig, som en rekkefølge eller en rute, krever mer enn ett enkelt faktum.'}
];
const WEIGHTS = {retrieval:.8, precision:1.4, familiarity:1.4, structure:.6};
const THRESHOLDS = [1.5, 3.3, 5.8];

export const LEVELS = [
  {id:1, name:'Orientering', note:'Kjente ting og grove rammer. Velg, koble og plasser omtrent.'},
  {id:2, name:'Holdepunkter', note:'Navn og steder du henter fram, piler og rekkefølger med god avstand.'},
  {id:3, name:'Presisjon', note:'Årstall, mindre kjente steder og rekkefølger som ligger tett.'},
  {id:4, name:'Ekspert', note:'Hele lister, smal kunnskap, tette tidslinjer og eksakte detaljer.'}
];
export const levelName = level => LEVELS.find(l => l.id === level)?.name || 'Alle nivåer';

// Countries most Norwegian adults meet often in news, travel and school.
export const FAMILIAR_ISO3 = new Set(['nor','swe','dnk','fin','isl','gbr','irl','fra','deu','esp','prt','ita','nld','bel','che','aut','pol','grc','tur','rus','ukr','usa','can','mex','bra','arg','chn','jpn','ind','aus','egy','zaf','nga','ken','isr','irn','irq','sau','kor','idn','tha','vnm','pak','afg','cub','chl']);

const clamp = n => Math.max(1, Math.min(3, Math.round(n)));
const isYear = answer => /^-?\d{1,4}$/.test(String(answer ?? '').trim());

/** Smallest gap in years between neighbouring items; close dates are harder to order (the distance effect). */
export function minimumGap(items = []) {
  const years = items.map(i => i.year).filter(Number.isFinite).sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < years.length; i++) gap = Math.min(gap, years[i] - years[i - 1]);
  return gap;
}
const gapPrecision = gap => !Number.isFinite(gap) ? 2 : gap >= 50 ? 1 : gap >= 12 ? 2 : 3;

function familiarity(target) {
  if (Number.isFinite(target.familiarity)) return clamp(target.familiarity);
  const id = target.baseId || target.id || '';
  if (target.unitId) {
    const bySignificance = target.significance >= 4 ? 1 : target.significance === 3 ? 2 : 3;
    return clamp(Math.max(bySignificance, target.step >= 3 ? 2 : 1));
  }
  if (target.format === 'flags') return target.familiar ? 1 : 3;
  if (target.format) return 2;
  if (/^(nobel-|science-contribution-)/.test(id) || /nobel/.test(target.timeline?.id || '')) return 3;
  if (/^(president-|culture-|geo-region-|geo-municipality-)/.test(id) || /presidential/.test(target.timeline?.id || '')) return 2;
  if (/^(capital-|art-|artist-|author-|learn-|foundation:|fosse-)/.test(id)) return 1;
  if (id.startsWith('geo-capital-')) return target.familiarCountry ? 1 : 2;
  if (target.mode === 'arrows' || target.mode === 'matching') return 1;
  if (['map', 'outline'].includes(target.mode)) return 2;
  const s = target.significance ?? 3;
  return s >= 4 ? 1 : s === 3 ? 2 : 3;
}

function retrieval(target) {
  if (['recognition', 'pick', 'before-after', 'matching'].includes(target.mode) || target.cardType === 'choice') return 1;
  if (['map', 'arrows', 'timeline', 'estimate', 'border-walk'].includes(target.mode)) return 2;
  return 3;
}

function precision(target) {
  if (target.mode === 'estimate' || target.mode === 'matching') return 1;
  if (target.mode === 'map') return 1;
  if (target.mode === 'arrows') return target.askYear === false ? 1 : 3;
  if (target.mode === 'timeline') return gapPrecision(minimumGap(target.timeline?.items));
  if (target.mode === 'before-after') return gapPrecision(minimumGap(target.items));
  const declared = target.learningProfile?.precision;
  if (declared === 'complete' || /person-list|city-list/.test(target.answerType || '')) return 3;
  if (['year', 'number'].includes(target.answerFormat) || (isYear(target.answer) && target.mode !== 'recognition')) return 3;
  if (target.mode === 'recognition' && isYear(target.answer)) return 2;
  if (declared === 'broad') return 1;
  if (declared === 'exact') return 3;
  return 2;
}

function structure(target) {
  if (target.mode === 'timeline') return (target.timeline?.items?.length || 0) >= 4 ? 3 : 2;
  if (target.mode === 'border-walk') return (target.shortest || 0) >= 3 ? 3 : 2;
  if (['before-after', 'arrows', 'matching'].includes(target.mode) || target.kind === 'before-after') return 2;
  if (target.answerFormat === 'explanation' || /person-list|city-list/.test(target.answerType || '')) return 3;
  if (target.learningProfile?.reasoning === 'compare' || target.kind === 'connections') return 2;
  return 1;
}

export function profileOf(target) {
  return {retrieval: retrieval(target), precision: precision(target), familiarity: familiarity(target), structure: structure(target)};
}
export function loadOf(profile) {
  return Object.entries(WEIGHTS).reduce((sum, [axis, weight]) => sum + weight * (profile[axis] - 1), 0);
}
export function levelFromLoad(load) {
  return 1 + THRESHOLDS.filter(limit => load >= limit).length;
}
export function levelOf(target) {
  return target.level || levelFromLoad(loadOf(profileOf(target)));
}
export function assessLevel(target) {
  const profile = profileOf(target), load = loadOf(profile);
  return {profile, load: Math.round(load * 10) / 10, level: levelFromLoad(load)};
}

/**
 * Legacy depth settings map onto the new levels. «Grunnlag» offered typed names as well as
 * recognition, which is now level 2 (it includes level 1); «specialized» meant everything installed.
 */
export function levelFromDepth(depth) {
  return {foundation: 2, intermediate: 3, advanced: 4, specialized: 0}[depth] ?? (Number.isInteger(depth) ? depth : 2);
}
export function preferredLevel(preferences = {}) {
  if (Number.isInteger(preferences.level)) return preferences.level;
  return levelFromDepth(preferences.depth);
}
/**
 * A quiz at level N uses level N first and fills with level N-1. It never pulls harder questions
 * in, so a higher level is genuinely harder rather than the same quiz with a few extras.
 */
export function levelAccepts(target, level) {
  if (!level) return true;
  const actual = levelOf(target);
  return actual === level || actual === level - 1;
}
export const levelDistance = (target, level) => level ? Math.abs(levelOf(target) - level) : 0;

/** Explain what makes this particular question hard, in one short line. */
export function profileSummary(profile) {
  const hardest = AXES.filter(axis => profile[axis.id] === 3).map(axis => axis.label.toLocaleLowerCase('nb'));
  if (!hardest.length) return 'Ingen av aksene er krevende her.';
  return `Krevende: ${hardest.join(', ')}.`;
}

// Time feels logarithmic: the further back, the coarser our mental timeline. Placing a year on such a
// scale gives a tolerance proportional to its age, so «around 1066» and «around 1989» feel equally fair.
export const PRESENT_YEAR = 2026;
export const ESTIMATE_SHARE = .08;
export function estimateTolerance(year, present = PRESENT_YEAR) {
  return Math.max(3, Math.round((present - year) * ESTIMATE_SHARE));
}
export function gradeEstimate(guess, target) {
  const value = Number(guess);
  if (!Number.isFinite(value)) return {correct: false, off: null};
  const off = Math.round(value - target.year);
  return {correct: Math.abs(off) <= target.tolerance, off};
}
/** Position (0–1) of a year on a logarithmic line from `earliest` to the present. */
export function yearToPosition(year, earliest = -3500, present = PRESENT_YEAR) {
  const span = Math.log(present - earliest + 1), age = Math.max(1, present - year + 1);
  return 1 - Math.log(age) / span;
}
export function positionToYear(position, earliest = -3500, present = PRESENT_YEAR) {
  const span = Math.log(present - earliest + 1);
  return Math.round(present + 1 - Math.exp((1 - Math.min(1, Math.max(0, position))) * span));
}

/** Easier ways into the same fact: estimate a year on the timeline before typing it exactly. */
export function estimateVariants(targets) {
  return targets.filter(t => !t.baseId && t.mode !== 'recognition' && !['map','outline','timeline','estimate'].includes(t.mode) &&
      (t.answerFormat === 'year' || (isYear(t.answer) && /år|når/i.test(t.prompt || '') && Number(t.answer) > 999)) && Number(t.answer) <= PRESENT_YEAR)
    .map(t => {
      const year = Number(t.answer);
      return {...t, id: `${t.id}:estimate`, baseId: t.id, mode: 'estimate', year, tolerance: estimateTolerance(year),
        answer: String(t.answer), retrievalRole: 'estimate',
        prompt: t.prompt.replace(/^(I hvilket år|Hvilket år|Når)/, 'Omtrent når')};
    });
}

/**
 * Timelines at several levels: three items far apart are easy to order, five neighbouring
 * presidents are not. Consecutive slices keep their historical IDs.
 */
export function timelineTargets(data) {
  const prompt = id => id === 'nobel-scientific-recognition-timeline' ? 'Plasser disse tildelingene fra tidligst til senest etter Nobelprisåret.' : `Plasser disse ${id === 'us-presidential-chronology' ? 'presidentperiodene' : 'hendelsene'} fra tidligst til senest.`;
  // Presidents are labelled «16. Abraham Lincoln»; the ordinal would give the order away.
  const plain = items => items.map(i => ({...i, label: String(i.label).replace(/^\d+\.\s+/, '')}));
  const make = (t, id, rawItems) => { const items = plain(rawItems); return {id, entityId: items[0].entityId, collectionIds: t.collectionIds, prompt: prompt(t.id),
    answer: [...items].sort((a, b) => a.year - b.year).map(i => `${i.label} (${i.year})`).join(' → '), acceptedAnswers: [],
    explanation: 'Datoene bestemmer rekkefølgen. Hendelser fra samme år kan stå i valgfri rekkefølge.', sourceIds: t.sourceIds,
    difficulty: 3, significance: 3, kind: 'before-after', mode: 'timeline', timeline: {...t, id: id.replace(/^timeline:/, ''), items}}; };
  return (data.timelines || []).flatMap(t => {
    const sorted = [...t.items].sort((a, b) => a.year - b.year);
    const slices = Array.from({length: Math.ceil(sorted.length / 5)}, (_, i) => sorted.slice(i * 5, i * 5 + 5))
      .map((items, i) => items.length >= 2 ? make(t, `timeline:${t.id}:${i}`, items) : null).filter(Boolean);
    const spread = [];
    if (sorted.length >= 6) {
      const stride = Math.floor(sorted.length / 3);
      for (let start = 0; start < Math.min(stride, 6); start++) {
        const items = [0, 1, 2].map(k => sorted[start + k * stride]).filter(Boolean);
        if (items.length === 3 && minimumGap(items) >= 12) spread.push(make(t, `timeline:${t.id}:spread:${start}`, items));
      }
    }
    return [...slices, ...spread];
  });
}

/**
 * Where it gets hard for this learner: accuracy of the latest unaided answer per axis step.
 * The axis with the steepest fall from easy to hard steps is the one to train.
 */
export function axisInsights(targets, reviews, minimum = 4) {
  const byId = new Map(targets.map(t => [t.id, t]));
  const latest = new Map();
  for (const review of [...reviews].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) if (byId.has(review.targetId)) latest.set(review.targetId, review);
  const rows = AXES.map(axis => ({axis, steps: [1, 2, 3].map(step => ({step, answered: 0, correct: 0, rate: null}))}));
  for (const [id, review] of latest) {
    const target = byId.get(id), profile = target.profile || profileOf(target);
    for (const row of rows) {
      const cell = row.steps[profile[row.axis.id] - 1];
      cell.answered++;
      if (review.correct === true && !review.usedHint && !review.learnedFirst) cell.correct++;
    }
  }
  for (const row of rows) {
    for (const cell of row.steps) cell.rate = cell.answered >= minimum ? cell.correct / cell.answered : null;
    const measured = row.steps.filter(c => c.rate !== null);
    row.drop = measured.length >= 2 ? measured[0].rate - measured.at(-1).rate : null;
  }
  const weakest = rows.filter(r => r.drop !== null && r.drop > .1).sort((a, b) => b.drop - a.drop)[0] || null;
  return {rows, weakest, answered: latest.size};
}
