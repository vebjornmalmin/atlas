/** Conservative comparison: spelling alternatives must come from curated content. */
export function normalizeAnswer(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss')
    .replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function checkAnswer(target, input) {
  const answer = normalizeAnswer(input);
  if (!answer) return false;
  return [target.answer, ...(target.acceptedAnswers || []), ...(target.aliases || [])]
    .some(value => value != null && normalizeAnswer(value) === answer);
}
function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  // Final mixing so strings that differ only at the end still shuffle evenly.
  value ^= value >>> 16; value = Math.imul(value, 0x85ebca6b); value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35); value ^= value >>> 16;
  return value >>> 0;
}
function answerType(target) {
  if (target.answerType) return target.answerType;
  const prompt = target.prompt?.toLowerCase() || '';
  const answer = normalizeAnswer(target.answer);
  if (/\b(year|date)\b/.test(prompt) && /^\d+$/.test(answer)) return 'year';
  if (/^\d+$/.test(answer)) return 'number';
  if (/capital|hovedstad/.test(prompt)) return 'capital';
  if (/category|prize in|which nobel prize|kategori|pris i|nobelpris/.test(prompt)) return 'prize-category';
  if (/language|språk/.test(prompt)) return 'language';
  if (/\b(who|artist|author|painter|scientist|hvem|kunstner|forfatter|maler|forsker)\b/.test(prompt)) return 'person';
  if (/,/.test(target.answer)) return 'list';
  return 'text';
}
/** Distractors share a retrieval kind, collection, and answer type; curated options take priority. */
export function buildRecognitionIndex(targets) {
  const index = new Map();
  for (const target of targets) for (const collection of target.collectionIds || []) {
    const key = JSON.stringify([target.kind, answerType(target), collection]);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(target);
  }
  return index;
}
function relatedCandidates(target, index) {
  const unique = new Map();
  for (const collection of target.collectionIds || []) {
    const key = JSON.stringify([target.kind, answerType(target), collection]);
    for (const item of index.get(key) || []) if (item.id !== target.id) unique.set(item.id, item);
  }
  return [...unique.values()];
}
export function hasRecognitionOptions(target, index) {
  const accepted = new Set([target.answer, ...(target.acceptedAnswers || [])].map(normalizeAnswer));
  const alternatives = new Set();
  for (const option of target.options || []) {
    const label = typeof option === 'string' ? option : option.label ?? option.answer;
    const normalized = normalizeAnswer(label);
    if (normalized && !accepted.has(normalized)) alternatives.add(normalized);
  }
  if (alternatives.size >= 2) return true;
  for (const item of relatedCandidates(target, index)) {
    const normalized = normalizeAnswer(item.answer);
    if (normalized && !accepted.has(normalized)) alternatives.add(normalized);
    if (alternatives.size >= 2) return true;
  }
  return false;
}
export function makeRecognitionOptions(target, targets, count = 4, index = buildRecognitionIndex(targets)) {
  count = Math.max(1, Math.min(8, Math.floor(count) || 4));
  const accepted = new Set([target.answer, ...(target.acceptedAnswers || [])].map(normalizeAnswer));
  const candidates = [];
  const seen = new Set(accepted);
  const add = (label, id) => {
    const normalized = normalizeAnswer(label);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized); candidates.push({id, label: String(label), correct: false});
  };
  for (const [index, option] of (target.options || []).entries()) {
    const label = typeof option === 'string' ? option : option.label ?? option.answer;
    if (label) add(label, typeof option === 'object' ? option.id ?? `option-${index}` : `option-${index}`);
  }
  const related = relatedCandidates(target, index)
    .sort((a,b) => hash(target.id + a.id) - hash(target.id + b.id));
  for (const item of related) add(item.answer, item.id);
  const options = [{id: target.id, label: target.answer, correct: true}, ...candidates.slice(0, count - 1)];
  return options.sort((a,b) => hash(target.id + ':' + a.id) - hash(target.id + ':' + b.id));
}
export function buildTimelineExercise(timeline) {
  if (!timeline?.items?.length || timeline.items.some(item => !Number.isFinite(item.year)))
    throw new Error('Timeline requires dated items');
  if (new Set(timeline.items.map(item => item.id)).size !== timeline.items.length)
    throw new Error('Timeline item IDs must be unique');
  const sorted = [...timeline.items].sort((a,b) => a.year - b.year || a.id.localeCompare(b.id));
  const items = [...sorted].sort((a,b) => hash(timeline.id + a.id) - hash(timeline.id + b.id));
  if (items.length > 1 && items.every((item,i) => item.id === sorted[i].id)) items.reverse();
  return {...timeline, items, correctOrder: sorted.map(item => item.id)};
}
export function gradeTimeline(order, timeline) {
  const items = timeline.items || [];
  const ids = order.map(item => typeof item === 'string' ? item : item.id);
  const byId = new Map(items.map(item => [item.id, item]));
  const valid = ids.length === items.length && new Set(ids).size === items.length && ids.every(id => byId.has(id));
  const sortedYears = [...items].map(item => item.year).sort((a,b) => a-b);
  const correctCount = valid ? ids.filter((id,i) => byId.get(id).year === sortedYears[i]).length : 0;
  return {correct: valid && correctCount === items.length, correctCount, total: items.length};
}
const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function createMapExercise(dataset, regionId) {
  const region = dataset.regions.find(item => item.id === regionId);
  if (!region) throw new Error('Unknown map region');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="quiz-map" viewBox="${escape(dataset.viewBox)}" role="group" aria-label="${escape(dataset.title)}: select a region">${dataset.regions.map((item,i) => {
    if (!/^[MmLlHhVvCcSsQqTtAaZz\d.,\s+-]+$/.test(item.path)) throw new Error('Invalid map path');
    return `<path data-region="${escape(item.id)}" d="${escape(item.path)}" tabindex="0" role="button" aria-label="Region ${i+1}" fill-rule="evenodd"/>`;
  }).join('')}</svg>`;
  return {id: `map:${dataset.id}:${region.id}`, targetId: region.id, prompt: `Find ${region.label} on the map.`,
    answer: region.label, svg, regions: dataset.regions.map(({id,label}) => ({id,label})), source: dataset.source};
}
export function gradeMapSelection(selectedId, targetId) {
  return typeof selectedId === 'string' && selectedId.length > 0 && selectedId === targetId;
}
