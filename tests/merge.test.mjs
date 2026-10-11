import {assessTargets} from '../src/lib/difficulty.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeKnowledge} from '../scripts/merge-knowledge.mjs';
import {buildRecognitionIndex,hasRecognitionOptions,makeRecognitionOptions} from '../src/lib/exercises.js';
const base=JSON.parse(await readFile('knowledge-build/base-foundation.json','utf8'));
test('merge preserves historical IDs and maps shared entities before resolving cross-domain links',()=>{
 const entity=base.entities[0];
 const relation=base.relationships.find(row=>row.from===entity.id||row.to===entity.id);
 const alias={...entity,id:'import-alias'};
 const patch={entities:[alias],relationships:[{...relation,id:'import-link',from:'import-alias'}]};
 const merged=mergeKnowledge(base,[patch]);
 assert.equal(merged.entities.length,base.entities.length);
 assert.equal(merged.relationships.find(row=>row.id==='import-link').from,entity.id);
 assert.deepEqual(merged.targets,assessTargets(base.targets));
 assert.deepEqual(mergeKnowledge(base,[patch,patch]),merged);
});
test('merge refuses competing answers to the same prompt',()=>{
 assert.throws(()=>mergeKnowledge(base,[{targets:[{...base.targets[0],id:'conflict',answer:'Wrong'}]}]),/Conflicting answer/);
});
test('indexed recognition keeps the same distractors and eligibility as direct generation',()=>{
 const index=buildRecognitionIndex(base.targets);
 for(const target of base.targets){
  assert.deepEqual(makeRecognitionOptions(target,base.targets,4,index),makeRecognitionOptions(target,base.targets));
  assert.equal(hasRecognitionOptions(target,index),makeRecognitionOptions(target,base.targets).length>=3);
 }
});
test('geography answer pools distinguish administrative levels',()=>{
 const target={id:'region-1',kind:'connections',collectionIds:['geography'],answerType:'region',answer:'Nord-Europa',acceptedAnswers:[]};
 const targets=[target,{...target,id:'region-2',answer:'Sør-Europa'},{...target,id:'region-3',answer:'Vest-Europa'},{...target,id:'county',answerType:'county',answer:'Nordland'}];
 const options=makeRecognitionOptions(target,targets);
 assert.equal(options.length,3);
 assert.ok(!options.some(row=>row.label==='Nordland'));
});
test('merged publication preserves every original target identity and valid graph links',async()=>{
 const published=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
 const ids=new Set(published.targets.map(row=>row.id));
 for(const target of base.targets) assert.ok(ids.has(target.id));
 const entityIds=new Set(published.entities.map(row=>row.id));
 for(const row of published.relationships){assert.ok(entityIds.has(row.from));assert.ok(entityIds.has(row.to));}
});
test('culture recall context does not print the answer before retrieval',async()=>{
 const patch=JSON.parse(await readFile('knowledge-build/culture-history.json','utf8'));
 for(const target of patch.targets){
  const context=(target.context||'').normalize('NFKC').toLowerCase();
  for(const answer of [target.answer,...target.acceptedAnswers]) if(answer.length>4) assert.ok(!context.includes(answer.normalize('NFKC').toLowerCase()),`${target.id}: answer in context`);
 }
});
