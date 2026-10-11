import {factKey,learningStage} from './journey.js';
import {claimEvidence} from './connected-learning.js';
export function evidenceOverview(targets,reviews) {
  const evidence=claimEvidence(targets,reviews);
  const count=kind=>[...evidence.values()].filter(row=>row[kind]?.independent).length;
  return {recognized:count('recognition'),recalled:count('recall'),explained:count('explanation'),ordered:count('sequence')};
}
export function learningCoverage(data,targets=data.targets) {
  const testedClaims=new Set(targets.flatMap(t=>t.claimIds||[]));
  return data.collections.map(collection=>{
    const rows=targets.filter(t=>t.collectionIds?.includes(collection.id));
    const unique=[...new Map(rows.map(t=>[factKey(t),t])).values()];
    const objectives=(data.learningObjectives||[]).filter(o=>o.collectionIds.includes(collection.id));
    const paths=(data.learningPaths||[]).filter(p=>p.collectionIds.includes(collection.id));
    const entities=data.entities.filter(e=>e.collectionIds.includes(collection.id));
    const introductions=rows.filter(t=>Boolean(t.snapshot));
    const connections=rows.filter(t=>t.answerFormat==='explanation' || learningStage(t)==='connections' && t.reasoning!=='identify');
    const exact=unique.filter(t=>t.precision==='exact');
    const entityIds=new Set(rows.map(t=>t.entityId));
    const collectionEntities=new Set(entities.map(e=>e.id));
    const claims=(data.claims||[]).filter(c=>c.entityIds.some(id=>collectionEntities.has(id))); 
    const gaps=[];
    if(!objectives.length)gaps.push('Læringsmål og nødvendige holdepunkter er ikke redaksjonelt kartlagt.');
    if(!introductions.length)gaps.push('Mangler egne introduksjoner som forklarer betydningen.');
    if(!connections.length)gaps.push('Mangler øvelser i forklaring, sammenligning eller rekkefølge.');
    if(!paths.length)gaps.push('Mangler en kuratert læringssti.');
    const incomplete=objectives.filter(o=>!rows.some(t=>o.targetIds.includes(t.baseId||t.id) && t.sourceIds?.length));
    if(incomplete.length)gaps.push(`${incomplete.length} læringsmål mangler kildebelagte øvelser.`);
    if(unique.length && exact.length/unique.length>0.4)gaps.push('En stor del av øvelsene krever eksakte årstall; vurder flere hovedideer.');
    return {id:collection.id,title:collection.title,scope:objectives.length?'Utvalgte læringsmål er gjennomgått.':'Register og øvelser; faglig fullstendighet er ikke vurdert.',
      entities:entities.length,exercises:rows.length,facts:unique.length,introductions:introductions.length,connections:connections.length,
      objectives:objectives.length,paths:paths.length,sourced:unique.filter(t=>t.sourceIds?.length || t.sources?.length).length,
      untestedEntities:entities.filter(e=>!entityIds.has(e.id)).length,untestedClaims:claims.filter(c=>!testedClaims.has(c.id)).length,
      unexplained:unique.filter(t=>!t.explanation).length,gaps};
  });
}
