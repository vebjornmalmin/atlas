import {validateCurriculum} from './connected-learning.js';
import {validateKnowledgeModel} from './knowledge-model.js';
import {validatePerspectives} from './world-graph.js';
/** Validate a complete package before it can replace an installed version. */
export function validateKnowledge(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Package must be an object.'], warnings, counts: {} };
  const sections = ['collections', 'entities', 'relationships', 'targets', 'sources', 'timelines'];
  const maps = {};
  for (const section of sections) {
    maps[section] = new Map();
    if (!Array.isArray(data[section])) { errors.push(`${section} must be an array.`); continue; }
    for (const row of data[section]) {
      if (!row || typeof row.id !== 'string' || !row.id.trim()) { errors.push(`${section}: missing ID.`); continue; }
      if (maps[section].has(row.id)) errors.push(`${section}: duplicate ID ${row.id}.`);
      maps[section].set(row.id, row);
    }
  }
  if (typeof data.id !== 'string' || !data.id) errors.push('Package ID is required.');
  if (!/^\d+\.\d+\.\d+$/.test(data.version || '')) errors.push('Version must use major.minor.patch.');
  if (data.schemaVersion !== 1) errors.push('Unsupported schema version.');
  if (!Number.isFinite(Date.parse(data.generatedAt))) errors.push('Invalid generation timestamp.');
  const text = (row, key, section) => {
    if (typeof row[key] !== 'string' || !row[key].trim()) errors.push(`${section} ${row.id}: missing ${key}.`);
  };
  const refs = (row, key, destination, required = true) => {
    if (!Array.isArray(row[key]) || (required && !row[key].length)) { errors.push(`${row.id}: ${key} must contain references.`); return; }
    if (new Set(row[key]).size !== row[key].length) errors.push(`${row.id}: duplicate ${key}.`);
    for (const ref of row[key]) if (!maps[destination].has(ref)) errors.push(`${row.id}: unknown ${destination} reference ${ref}.`);
  };
  const year = (value, id) => {
    if (value !== undefined && (!Number.isInteger(value) || value < -10000 || value > 10000)) errors.push(`${id}: invalid year.`);
  };
  for (const row of maps.sources.values()) {
    text(row, 'title', 'Source');
    try { if (new URL(row.url).protocol !== 'https:') errors.push(`${row.id}: source must use HTTPS.`); }
    catch { errors.push(`${row.id}: invalid source URL.`); }
    if (!row.license) warnings.push(`${row.id}: reuse status not documented.`);
  }
  for (const row of maps.collections.values()) for (const key of ['title', 'subject', 'description']) text(row, key, 'Collection');
  const labels = new Set();
  for (const row of maps.entities.values()) {
    for (const key of ['label', 'type', 'summary']) text(row, key, 'Entity');
    refs(row, 'collectionIds', 'collections'); refs(row, 'sourceIds', 'sources');
    const label = `${row.type}:${String(row.label).toLowerCase().trim()}`;
    if (labels.has(label)) errors.push(`${row.id}: duplicate entity label/type.`);
    labels.add(label);
  }
  for (const row of maps.relationships.values()) {
    for (const endpoint of ['from', 'to']) if (!maps.entities.has(row[endpoint])) errors.push(`${row.id}: unknown ${endpoint} endpoint.`);
    for (const key of ['type', 'context']) text(row, key, 'Relationship');
    refs(row, 'sourceIds', 'sources'); year(row.year, row.id);
  }
  const prompts = new Set();
  for (const row of maps.targets.values()) {
    if (!maps.entities.has(row.entityId)) errors.push(`${row.id}: unknown target entity.`);
    for (const key of ['prompt', 'answer', 'explanation']) text(row, key, 'Target');
    const normalized = String(row.prompt).trim().toLowerCase();
    if (prompts.has(normalized)) errors.push(`${row.id}: duplicate exact prompt.`);
    prompts.add(normalized);
    refs(row, 'collectionIds', 'collections'); refs(row, 'sourceIds', 'sources');
    if (!Array.isArray(row.acceptedAnswers) || row.acceptedAnswers.some(x => typeof x !== 'string')) errors.push(`${row.id}: invalid accepted answers.`);
    for (const metric of ['difficulty', 'significance']) if (!Number.isInteger(row[metric]) || row[metric] < 1 || row[metric] > 5) errors.push(`${row.id}: ${metric} must be 1–5.`);
    if (!['recall', 'recognition', 'before-after', 'connections'].includes(row.kind)) errors.push(`${row.id}: unsupported exercise kind.`);
    year(row.year, row.id);
    if (row.options && (!Array.isArray(row.options) || !row.options.includes(row.answer) || new Set(row.options).size !== row.options.length)) errors.push(`${row.id}: invalid recognition options.`);
    const entity = maps.entities.get(row.entityId);
    if (entity && Array.isArray(row.collectionIds) && Array.isArray(entity.collectionIds)) for (const c of row.collectionIds) if (!entity.collectionIds.includes(c)) errors.push(`${row.id}: target collection missing from its entity.`);
  }
  for (const row of maps.timelines.values()) {
    text(row, 'title', 'Timeline'); refs(row, 'sourceIds', 'sources'); refs(row, 'collectionIds', 'collections');
    if (!Array.isArray(row.items) || row.items.length < 2) { errors.push(`${row.id}: timeline needs at least two entries.`); continue; }
    const ids = new Set();
    row.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') { errors.push(`${row.id}: invalid timeline entry.`); return; }
      if (!Number.isInteger(item.year)) errors.push(`${row.id}: timeline entry requires a year.`);
      if (!item.id || ids.has(item.id)) errors.push(`${row.id}: duplicate or missing timeline entry ID.`);
      ids.add(item.id); text(item, 'label', 'Timeline entry'); year(item.year, item.id);
      if (item.entityId && !maps.entities.has(item.entityId)) errors.push(`${row.id}: unknown timeline entity ${item.entityId}.`);
      if (index && row.items[index - 1]?.year > item.year) errors.push(`${row.id}: entries out of chronological order.`);
      if (item.endYear !== undefined && item.endYear !== null && (!Number.isInteger(item.endYear) || item.endYear < item.year)) errors.push(`${item.id}: invalid term end.`);
    });
    if (row.id === 'us-presidential-chronology') {
      if (row.items.length !== 47) errors.push('Presidential chronology must have 47 administrations as of October 2026.');
      row.items.forEach((item, i) => {
        if (!item || typeof item !== 'object') return;
        if (item.ordinal !== i + 1) errors.push(`${item.id}: invalid administration ordinal.`);
        if (i < row.items.length - 1 && item.endYear !== row.items[i + 1]?.year) errors.push(`${item.id}: presidential succession gap.`);
      });
      const distinct = new Set(row.items.map(x => x?.entityId));
      if (distinct.size !== 45) errors.push('Presidential chronology must reference 45 distinct people.');
      for (const [a,b] of [[21,23],[44,46]]) if (row.items[a]?.entityId !== row.items[b]?.entityId) errors.push('Non-consecutive administrations must share the same person.');
    }
  }
  const counts = Object.fromEntries(sections.map(x => [x, maps[x].size]));
  for (const [key, section] of [['entityCount','entities'],['relationshipCount','relationships'],['targetCount','targets']]) if (data[key] !== undefined && data[key] !== counts[section]) errors.push(`${key} disagrees with contents.`);
  if (data.curriculum !== undefined) {
    const curriculum = data.curriculum;
    if (!curriculum || !Array.isArray(curriculum.domains) || !Array.isArray(curriculum.units)) errors.push('Curriculum must list domains and units.');
    else {
      const unitIds = new Set(curriculum.units.map(unit => unit?.id));
      if (unitIds.size !== curriculum.units.length) errors.push('Curriculum: duplicate unit ID.');
      for (const domain of curriculum.domains) {
        if (!maps.collections.has(domain?.id)) errors.push(`Curriculum: unknown domain collection ${domain?.id}.`);
        for (const id of domain?.unitIds || []) if (!unitIds.has(id)) errors.push(`Curriculum ${domain.id}: unknown unit ${id}.`);
      }
      for (const unit of curriculum.units) {
        if (!unit?.title || !Array.isArray(unit.lesson) || !unit.lesson.length || !Array.isArray(unit.cardIds) || !unit.cardIds.length) { errors.push(`Curriculum ${unit?.id}: incomplete unit.`); continue; }
        for (const id of unit.cardIds) if (maps.targets.get(id)?.unitId !== unit.id) errors.push(`Curriculum ${unit.id}: unknown card ${id}.`);
        for (const id of unit.prerequisites || []) if (!unitIds.has(id)) errors.push(`Curriculum ${unit.id}: unknown prerequisite ${id}.`);
      }
    }
  }
  errors.push(...validateKnowledgeModel(data),...validateCurriculum(data),...validatePerspectives(data));
  return { valid: errors.length === 0, errors, warnings, counts };
}


export function validatePackage(data) {
  return validateKnowledge(data).errors;
}

export async function contentHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function readiness(data) {
  const total = data.targets.length;
  const sourced = data.targets.filter(t => t.sourceIds?.length).length;
  const explained = data.targets.filter(t => t.explanation).length;
  const connectedEntities = new Set(data.relationships.flatMap(r => [r.from, r.to]));
  const linked = data.targets.filter(t => connectedEntities.has(t.entityId)).length;
  return { total, sourced, explained, linked,
    score: total ? Math.round(100 * (0.4 * sourced / total + 0.3 * explained / total + 0.3 * linked / total)) : 0,
    formula: '40% source coverage + 30% explanation coverage + 30% relationship coverage. This measures the installed package, not complete subject coverage or learning mastery.' };
}
