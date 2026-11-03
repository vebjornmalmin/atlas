import {readFile,writeFile} from 'node:fs/promises';
import {foundationTargets} from '../src/lib/foundations.js';
import {buildKnowledgeModel,attachKnowledge} from '../src/lib/knowledge-model.js';
import {assessTargets} from '../src/lib/difficulty.js';
import {learningTargets,learningObjectives,learningPaths} from '../knowledge-build/learning-curriculum.mjs';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const seed=foundationTargets(data);
for(const t of seed)for(const source of t.sources)if(!data.sources.some(s=>s.url===source.url)){
 const id=source.url.includes('emancipation')?'foundation-emancipation':source.url.includes('space-program')?'foundation-kennedy':`foundation-source-${data.sources.length}`;
 data.sources.push({id,...source,license:'Kun fakta og egne sammendrag. Kildetekst og medier videreformidles ikke.'});
}
for(const t of learningTargets){
 for(const collection of t.collectionIds){const e=data.entities.find(e=>e.id===t.entityId);if(!e.collectionIds.includes(collection))e.collectionIds.push(collection);}
 data.targets=data.targets.filter(old=>old.id!==t.id);data.targets.push(t);
}
for(const r of data.relationships){r.evidenceStatus ||= 'documented';
 if(r.type==='held-office'){const term=data.timelines.find(t=>t.id==='us-presidential-chronology')?.items.find(i=>i.entityId===r.from && i.year===r.year);if(term?.endYear)r.endYear=term.endYear;}
}
Object.assign(data,buildKnowledgeModel(data,foundationTargets(data)));
for(const t of data.targets)if(t.sameFactAs){const m=data.exerciseFacts[t.sameFactAs];if(!m)throw new Error('Missing shared fact '+t.sameFactAs);data.exerciseFacts[t.id]={...m};}
for(const t of data.targets)if(t.testedTargetIds)data.exerciseFacts[t.id].claimIds=[...new Set([data.exerciseFacts[t.id].factId,...t.testedTargetIds.flatMap(id=>data.exerciseFacts[id]?.claimIds||[])])];
// Explanatory comparisons retain their own scheduling identity; component claims are references, not inferred mastery.
Object.assign(data,{learningObjectives:learningObjectives.map(o=>({...o,claimIds:[...new Set(o.targetIds.flatMap(id=>data.exerciseFacts[id]?.claimIds||[]))],prerequisiteRationale:o.prerequisites.length?'Disse holdepunktene gjør den neste sammenhengen lettere å forstå.':''})),learningPaths});
data.targets=assessTargets(attachKnowledge(data.targets,data));
Object.assign(data,{version:'1.3.0',generatedAt:'2026-11-02T18:00:00Z',targetCount:data.targets.length});
await writeFile('public/knowledge/foundation.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({claims:data.claims.length,objectives:data.learningObjectives.length,paths:data.learningPaths.length}));
