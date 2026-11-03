import {normalizeAnswer} from './exercises.js';

const countries=['country','country-area'];
const works=['artwork','literary-work'];
export const RELATIONSHIP_RULES = {
  'born-in':[['person'],['place','city','municipality','country','country-area']],
  'died-in':[['person'],['place','city','municipality','country','country-area']],
  'held-office':[['person'],['political-office']], succeeded:[['person'],['person']],
  'capital-of':[['city'],countries], 'in-region':[countries,['region']],
  'formerly-part-of':[['county'],['former-county']], received:[['person','organization'],['award']],
  'recognized-for':[['person','organization'],['concept','literary-work']], 'written-by':[['literary-work'],['person']],
  'created-by':[['artwork'],['person']], 'prepared-for-visit':[['artwork'],['person']],
  'depicts-place':[['artwork'],['place']], 'work-type':[works,['concept']],
  'part-of':[['region','county','city','municipality','event'],['region','country','county','military-operation','space-mission']],
  'located-in':[['country','country-area','city','place'],['region','country','country-area']],
  'birthplace-in-current-country':[['person'],countries], 'awarded-prize':[['person','organization'],['award-event']],
  'award-time-affiliation':[['person'],['organization']], 'located-in-country':[['organization'],countries],
  awarded:[['person','organization'],['award']], 'award-category':[['award-event'],['award']],
  'recognized-contribution':[['award-event'],['concept','literary-work']], 'author-of':[['person'],['literary-work','scholarly-work']],
  'features-character':[['literary-work'],['fictional-character']], 'uses-device':[['literary-work'],['concept']],
  'concerns-document':[['event'],['document']], 'involves-person':[['event'],['person']],
  'took-place-in':[['event'],['place','country','country-area']], adopted:[['organization'],['document']],
  drafted:[['person'],['document']], commanded:[['person'],['military-operation']],
  established:[['event'],['organization']], 'founded-under':[['organization'],['document']],
  'crew-member':[['person'],['space-mission']],
  // Perspective layer.
  borders:[countries,countries], 'knowledge-flow':[countries,countries],
  'shaped-lens':[['person'],['lens']], 'key-work-for':[['scholarly-work','literary-work'],['lens']],
  'uses-concept':[['lens'],['concept']], proposed:[['person'],['concept']], influenced:[['person'],['person']],
  'emplotted-as':[['person'],['concept']], precedes:[['threshold'],['threshold']],
  'views-through':[['lens'],['person','country','country-area','city','region','event','artwork','literary-work','scholarly-work','document','concept','threshold','organization','municipality','county','military-operation','space-mission']],
  mentions:[['news-event'],['country','country-area','person','city','organization','region','municipality','county','event']]
};
export function legacyFactKey(target) {
  if (['map','outline'].includes(target.mode)) return `place:${target.datasetId}:${target.regionId}`;
  return target.baseId || target.id.replace(/:recognition$/, '');
}
export function evidenceKind(target) {
  if(target.answerFormat==='explanation')return 'explanation';
  if(['recognition','outline','map'].includes(target.mode))return 'recognition';
  if(['matching','timeline','before-after','arrows'].includes(target.mode))return 'sequence';
  return 'recall';
}
export function schedulingKey(target) {
  return target.factId ? `${target.factId}/${target.retrievalRole || 'default'}/${evidenceKind(target)}` : legacyFactKey(target);
}
function relationshipFor(target,data) {
  const labels=new Map(data.entities.map(e=>[e.id,normalizeAnswer(e.label)]));
  const accepted=[target.answer,...(target.acceptedAnswers||[])].map(normalizeAnswer);
  const types=/^(artist-)/.test(target.id)?['created-by']:
    /^(author-|culture-author-)/.test(target.id)?['written-by','author-of']:
    /^(capital-|geo-capital-)/.test(target.id)?['capital-of']:
    target.id==='art-purpose-sunflowers'?['prepared-for-visit']:
    target.id==='art-place-water-lily-pond'?['depicts-place']:
    target.id==='art-purpose-pearl-earring'?['work-type']:[];
  const candidates=data.relationships.filter(r=>types.includes(r.type) &&
    ((r.from===target.entityId && (accepted.includes(labels.get(r.to)) || (r.type==='capital-of' && accepted.includes(labels.get(r.from))))) || (r.to===target.entityId && accepted.includes(labels.get(r.from)))));
  return candidates.length && new Set(candidates.map(relationshipFactId)).size===1?candidates[0]:null;
}
function relationshipFactId(r) {
  if(r.type==='author-of')return `fact:authorship:${r.to}:${r.from}`;
  if(r.type==='written-by')return `fact:authorship:${r.from}:${r.to}`;
  return `fact:relationship:${r.id}`;
}
export function attachKnowledge(targets,data) {
  const mappings=data.exerciseFacts || {};
  return targets.map(target=>{
    const legacy=legacyFactKey(target), mapping=mappings[legacy];
    const claims=mapping?.claimIds || target.claimIds || [];
    const composite=['matching','timeline','before-after','arrows'].includes(target.mode);
    return {...target, ...(mapping || {}),claimIds:claims,
      factId: mapping?.factId || target.factId || (composite?`exercise:${legacy}`:`fact:${legacy}`),
      retrievalRole:mapping?.retrievalRole || target.retrievalRole || 'default',legacyFactId:legacy};
  });
}
export function buildKnowledgeModel(data,extraTargets=[]) {
  const claims=new Map();const exerciseFacts={};
  for(const r of data.relationships){
    const id=relationshipFactId(r);
    if(!claims.has(id))claims.set(id,{id,entityIds:[r.from,r.to],relationshipIds:[r.id],statement:r.context,
      sourceIds:[...r.sourceIds],evidenceStatus:r.evidenceStatus || 'documented',
      ...(r.year!==undefined?{date:{startYear:r.year,...(r.endYear!==undefined?{endYear:r.endYear}:{}),precision:'year'}}:{})});
    else claims.get(id).relationshipIds.push(r.id);
  }
  for(const target of [...data.targets,...extraTargets]){
    const r=relationshipFor(target,data);const id=r?relationshipFactId(r):`fact:${legacyFactKey(target)}`;
    if(!claims.has(id))claims.set(id,{id,entityIds:[target.entityId],relationshipIds:[],statement:target.explanation,
      sourceIds:[...target.sourceIds],evidenceStatus:target.evidenceStatus || 'documented',
      ...(/^\d{4}$/.test(target.answer)?{date:{startYear:Number(target.answer),precision:/omtrent|omkring|cirka/i.test(target.prompt+' '+target.explanation)?'approximate':'year'}}:{})});
    else claims.get(id).sourceIds=[...new Set([...claims.get(id).sourceIds,...target.sourceIds])];
    exerciseFacts[target.id]={factId:id,claimIds:[id],retrievalRole:r?(r.type==='capital-of'?(normalizeAnswer(target.answer)===normalizeAnswer(data.entities.find(e=>e.id===r.from)?.label)?r.to:r.from):target.entityId):'default'};
  }
  return {knowledgeModelVersion:1,claims:[...claims.values()],exerciseFacts};
}
export function validateKnowledgeModel(data) {
  if(data.knowledgeModelVersion===undefined)return [];
  const errors=[];
  if(data.knowledgeModelVersion!==1)return ['Unsupported knowledge model version.'];
  const entities=new Map((data.entities||[]).filter(Boolean).map(e=>[e.id,e]));
  const sources=new Set((data.sources||[]).filter(Boolean).map(s=>s.id));
  const relations=new Set((data.relationships||[]).filter(Boolean).map(r=>r.id));
  const claims=new Map();
  if(!Array.isArray(data.claims))return ['Knowledge model requires claims.'];
  for(const c of data.claims){
    if(!c?.id || claims.has(c.id)){errors.push('Duplicate or missing claim ID.');continue;}claims.set(c.id,c);
    if(typeof c.statement!=='string' || !c.statement.trim())errors.push(`${c.id}: missing claim statement.`);
    for(const [field,refs] of [['entityIds',entities],['sourceIds',sources],['relationshipIds',relations]]){
      if(!Array.isArray(c[field]) || (field!=='relationshipIds' && !c[field].length))errors.push(`${c.id}: missing ${field}.`);
      else for(const id of c[field])if(!refs.has(id))errors.push(`${c.id}: unknown ${field} ${id}.`);
    }
    if(!['documented','disputed','uncertain'].includes(c.evidenceStatus))errors.push(`${c.id}: invalid evidence status.`);
    if(c.date && (!Number.isInteger(c.date.startYear) || (c.date.endYear!==undefined && (!Number.isInteger(c.date.endYear) || c.date.endYear<c.date.startYear)) || !['year','range','approximate'].includes(c.date.precision)))errors.push(`${c.id}: invalid claim dates.`);
  }
  for(const r of (data.relationships||[]).filter(Boolean)){
    const rule=RELATIONSHIP_RULES[r.type];
    if(!rule || !rule[0].includes(entities.get(r.from)?.type) || !rule[1].includes(entities.get(r.to)?.type))errors.push(`${r.id}: incompatible relationship type or direction.`);
    if(r.endYear!==undefined && (!Number.isInteger(r.endYear) || !Number.isInteger(r.year) || r.endYear<r.year))errors.push(`${r.id}: invalid relationship dates.`);
    if(r.evidenceStatus && !['documented','disputed','uncertain'].includes(r.evidenceStatus))errors.push(`${r.id}: invalid relationship evidence.`);
  }
  if(!data.exerciseFacts || typeof data.exerciseFacts!=='object')errors.push('Missing exercise fact mappings.');
  for(const [id,m] of Object.entries(data.exerciseFacts||{})){
    if(!m || !claims.has(m.factId) || !Array.isArray(m.claimIds) || !m.claimIds.length || m.claimIds.some(c=>!claims.has(c)))errors.push(`${id}: invalid exercise claim references.`);
  }
  for(const t of (data.targets||[]).filter(Boolean))if(!data.exerciseFacts?.[t.id])errors.push(`${t.id}: missing exercise fact mapping.`);
  return errors;
}
