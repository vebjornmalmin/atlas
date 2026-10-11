import {factKey,exposureKey} from './journey.js';
import {evidenceKind} from './knowledge-model.js';
import {selectSession,targetMatches} from './learning.js';

export function claimEvidence(targets,reviews) {
  const byId=new Map(targets.map(t=>[t.id,t])), result=new Map();
  for(const review of [...reviews].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){
    const target=byId.get(review.targetId);
    const id=review.factId || (target && factKey(target));if(!id)continue;
    const kind=review.evidenceKind || (target?evidenceKind({...target,mode:review.mode||target.mode}):'recall');
    const evidence=result.get(id)||{};
    evidence[kind]={timestamp:review.timestamp,independent:review.correct===true && !review.usedHint && !review.learnedFirst,assessment:review.assessment||'answer'};
    result.set(id,evidence);
  }
  return result;
}
export function objectiveStatus(objective,targets,reviews) {
  const evidence=claimEvidence(targets,reviews), rows=targets.filter(t=>objective.targetIds.includes(t.baseId||t.id));
  const attempted=rows.some(t=>evidence.has(factKey(t)));
  const recalled=rows.some(t=>{const e=evidence.get(factKey(t));return e?.recall?.independent || e?.explanation?.independent || e?.sequence?.independent;});
  const recognized=rows.some(t=>evidence.get(factKey(t))?.recognition?.independent);
  return recalled?'recalled':recognized?'recognized':attempted?'practiced':'new';
}
export function prerequisiteSupport(data,objective,targets,reviews) {
  return (objective.prerequisites||[]).map(id=>data.learningObjectives.find(o=>o.id===id)).filter(Boolean)
    .filter(o=>!['recalled','recognized'].includes(objectiveStatus(o,targets,reviews)))
    .map(o=>({id:o.id,title:o.title,text:o.introduction}));
}
const disclosedText=t=>[t.answer,t.explanation,t.snapshot,t.followUp].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase('nb');
export function safeLearningQueue(rows) {
  const selected=[], seen=new Set();let disclosed='';
  for(const row of rows){
    const t=row.target,key=exposureKey(t);
    if(seen.has(key))continue;
    const answer=String(t.answer||'').normalize('NFKC').toLocaleLowerCase('nb');
    const sharesClaims=selected.some(r=>(r.target.claimIds||[]).some(id=>(t.claimIds||[]).includes(id)));
    const leaked=sharesClaims || (answer.length>=4 && disclosed.includes(answer)) || (t.answerFormat==='explanation' && selected.some(r=>r.objectiveId && (t.prerequisiteObjectiveIds||[]).includes(r.objectiveId)));
    if(leaked)continue;
    selected.push(row);seen.add(key);disclosed+=' '+disclosedText(t);
  }
  return selected;
}
export function selectLearningPath(data,pathId,targets,states,preferences,reviews=[],now=new Date()) {
  const path=data.learningPaths?.find(p=>p.id===pathId);if(!path)return {queue:[],deferredCount:0};
  const objectives=new Map((data.learningObjectives||[]).map(o=>[o.id,o]));
  const recent=new Set(reviews.filter(r=>now-new Date(r.timestamp)<86400000).map(r=>r.factId || factKey(targets.find(t=>t.id===r.targetId)||{id:r.targetId})));
  const rows=[];
  for(const id of path.objectiveIds){
    const o=objectives.get(id);if(!o)continue;
    const status=objectiveStatus(o,targets,reviews);
    if(status==='recalled')continue;
    const candidates=targets.filter(t=>o.targetIds.includes(t.baseId||t.id) && (status!=='recognized' || evidenceKind(t)!=='recognition'))
      .sort((a,b)=>(status==='new'?Number(Boolean(b.snapshot))-Number(Boolean(a.snapshot)) || Number(evidenceKind(b)==='recognition')-Number(evidenceKind(a)==='recognition'):Number(evidenceKind(a)==='recognition')-Number(evidenceKind(b)==='recognition')) || a.id.localeCompare(b.id));
    // A learner can explore ahead; unfamiliar prerequisites are offered as support, not a lock.
    const target=candidates.find(t=>!recent.has(factKey(t)));
    if(target)rows.push({target:{...target,prerequisiteObjectiveIds:o.prerequisites},objectiveId:o.id,reason:status==='new'?'Connected introduction':'Connected recall',support:prerequisiteSupport(data,o,targets,reviews)});
  }
  const queue=safeLearningQueue(rows).slice(0,Math.min(10,Math.max(3,Number(preferences.dailyMinutes||5)*2)));
  return {queue,deferredCount:Math.max(0,rows.length-queue.length)};
}
export function selectConnectedSession(data,targets,states,preferences,now,collections,reviews) {
  const baseline=selectSession(targets,states,preferences,now,collections,reviews);
  if(!data.learningPaths?.length || preferences.objective && preferences.objective!=='mixed')return baseline;
  const eligiblePaths=data.learningPaths.filter(path=>path.collectionIds.some(id=>collections.some(c=>c.id===id && (preferences.subject==='all' || !preferences.subject || c.subject===preferences.subject))) && (!preferences.collectionIds?.length || path.collectionIds.some(id=>preferences.collectionIds.includes(id))));
  const objectives=new Map(data.learningObjectives.map(o=>[o.id,o]));
  const recent=new Set(reviews.filter(r=>now-new Date(r.timestamp)<86400000).map(r=>r.factId || (targets.find(t=>t.id===r.targetId) && factKey(targets.find(t=>t.id===r.targetId)))));
  const additions=[];
  for(const path of eligiblePaths){
    const objective=path.objectiveIds.map(id=>objectives.get(id)).find(o=>o && !['recalled','recognized'].includes(objectiveStatus(o,targets,reviews)));
    if(!objective)continue;
    const candidate=targets.find(t=>objective.targetIds.includes(t.baseId||t.id) && !recent.has(factKey(t)) && targetMatches(t,preferences,collections));
    if(candidate)additions.push({target:candidate,objectiveId:objective.id,reason:'Connected introduction',support:prerequisiteSupport(data,objective,targets,reviews)});
  }
  const due=baseline.queue.filter(r=>r.reason==='Due review');
  const room=baseline.queue.length-due.length;
  const queue=safeLearningQueue([...due,...additions,...baseline.queue.filter(r=>r.reason!=='Due review')]).slice(0,due.length+room);
  return {...baseline,queue};
}
export function validateCurriculum(data) {
  if(!data.learningObjectives && !data.learningPaths)return [];
  const errors=[], objectives=new Map(),targets=new Set([...data.targets.filter(Boolean).map(t=>t.id),...Object.keys(data.exerciseFacts||{})]),claims=new Set((data.claims||[]).filter(Boolean).map(c=>c.id));
  for(const o of data.learningObjectives||[]){
    if(!o.id || objectives.has(o.id))errors.push('Duplicate or missing learning objective.');
    objectives.set(o.id,o);
    if(!o.title || !o.introduction || !o.targetIds?.length || !o.claimIds?.length)errors.push(`${o.id}: incomplete learning objective.`);
    for(const id of o.targetIds||[])if(!targets.has(id))errors.push(`${o.id}: unknown exercise ${id}.`);
    for(const id of o.claimIds||[])if(!claims.has(id))errors.push(`${o.id}: unknown claim ${id}.`);
    for(const id of o.collectionIds||[])if(!data.collections.some(c=>c.id===id))errors.push(`${o.id}: unknown collection.`);
    if(o.prerequisites?.length && !o.prerequisiteRationale)errors.push(`${o.id}: missing prerequisite rationale.`);
  }
  const visiting=new Set(),visited=new Set();
  function visit(id){if(visiting.has(id)){errors.push(`${id}: prerequisite cycle.`);return;}if(visited.has(id))return;
    const o=objectives.get(id);if(!o){errors.push(`Unknown prerequisite ${id}.`);return;}visiting.add(id);
    for(const prereq of o.prerequisites||[])visit(prereq);visiting.delete(id);visited.add(id);
  }
  for(const id of objectives.keys())visit(id);
  const paths=new Set();
  for(const path of data.learningPaths||[]){
    if(!path.id || paths.has(path.id))errors.push('Duplicate or missing learning path.');paths.add(path.id);
    if(!path.title || !path.objectiveIds?.length)errors.push(`${path.id}: incomplete path.`);
    for(const id of path.objectiveIds||[])if(!objectives.has(id))errors.push(`${path.id}: unknown objective ${id}.`);
  }
  return errors;
}
