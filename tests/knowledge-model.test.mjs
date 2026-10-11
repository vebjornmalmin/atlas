import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildKnowledgeModel,attachKnowledge,validateKnowledgeModel,schedulingKey} from '../src/lib/knowledge-model.js';
import {stateForTarget,scheduleReview} from '../src/lib/learning.js';
import {factKey} from '../src/lib/journey.js';
const base=JSON.parse(await readFile('knowledge-build/base-foundation.json','utf8'));
const data={...base,...buildKnowledgeModel(base)};
test('stable claims survive prompt changes and exercise variants',()=>{
 const t=attachKnowledge([data.targets[0]],data)[0];
 const variant={...t,id:t.id+':recognition',baseId:t.id,mode:'recognition'};
 assert.equal(factKey(t),factKey(variant));assert.notEqual(schedulingKey(t),schedulingKey(variant));
 assert.equal(factKey({...t,prompt:'Ny formulering'}),factKey(t));
 assert.deepEqual(validateKnowledgeModel(data),[]);
});
test('graph validation rejects wrong direction, missing evidence and impossible dates',()=>{
 for(const mutate of [d=>{[d.relationships[0].from,d.relationships[0].to]=[d.relationships[0].to,d.relationships[0].from];},d=>{d.claims[0].sourceIds=['missing'];},d=>{d.claims[0].date={startYear:1900,endYear:1800,precision:'range'};},d=>{d.exerciseFacts[d.targets[0].id].claimIds=['missing'];}]){
  const copy=structuredClone(data);mutate(copy);assert.ok(validateKnowledgeModel(copy).length);
 }
});
test('legacy scheduling survives migration without assuming recognition means recall',()=>{
 const t=attachKnowledge([data.targets[0]],data)[0], choice={...t,mode:'recognition'};
 const state=scheduleReview(t.id,null,3,new Date('2026-10-10')).card;
 assert.equal(stateForTarget(t,[t,choice],[state]),state);
 assert.equal(stateForTarget(choice,[t,choice],[state]),null);
 const reviews=[{targetId:t.id,schedulerId:t.id,mode:'recognition',timestamp:state.last_review}];
 assert.equal(stateForTarget(t,[t,choice],[state],reviews),null);
 assert.equal(stateForTarget(choice,[t,choice],[state],reviews),state);
});
