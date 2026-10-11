import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {attachKnowledge} from '../src/lib/knowledge-model.js';
import {foundationTargets} from '../src/lib/foundations.js';
import {selectLearningPath,safeLearningQueue,validateCurriculum,objectiveStatus,claimEvidence,selectConnectedSession} from '../src/lib/connected-learning.js';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const targets=attachKnowledge([...data.targets,...foundationTargets(data)],data);
const now=new Date('2026-10-11T19:00:00Z');
const review=(target,extra={})=>({targetId:target.id,mode:target.mode||'recall',correct:true,timestamp:'2026-10-09T19:00:00Z',...extra});
test('curriculum rejects missing prerequisites and cycles',()=>{
 assert.deepEqual(validateCurriculum(data),[]);
 const cycle=structuredClone(data);cycle.learningObjectives[0].prerequisites=[cycle.learningObjectives[0].id];cycle.learningObjectives[0].prerequisiteRationale='Test';assert.ok(validateCurriculum(cycle).some(e=>e.includes('cycle')));
 const missing=structuredClone(data);missing.learningPaths[0].objectiveIds=['missing'];assert.ok(validateCurriculum(missing).length);
});
test('connected paths defer answers disclosed by earlier teaching to another session',()=>{
 const result=selectLearningPath(data,'presidents-moon',targets,[],{},[],now);
 assert.ok(result.queue.length);assert.ok(result.deferredCount>0);
 assert.ok(!result.queue.some(r=>r.target.id==='learn-kennedy-apollo'));
 const rows=[{target:{id:'a',answer:'A',explanation:'Neste svar er 1888.'}},{target:{id:'b',answer:'1888',explanation:'B'}}];assert.equal(safeLearningQueue(rows).length,1);
});
test('recognition and supported answers do not become unaided recall or explanation evidence',()=>{
 const t=targets.find(t=>t.id==='learn-kennedy-goal'),objective=data.learningObjectives.find(o=>o.id==='kennedy-understand');
 assert.equal(objectiveStatus(objective,targets,[review(t,{mode:'recognition'})]),'recognized');
 assert.equal(objectiveStatus(objective,targets,[review(t,{learnedFirst:true})]),'practiced');
 const evidence=claimEvidence(targets,[review(t,{mode:'recognition'})]).get(t.factId);assert.equal(evidence.recall,undefined);
 assert.equal(objectiveStatus(objective,targets,[review(t)]),'recalled');
});
test('connections become available after earlier learning and exploration is never locked',()=>{
 const studied=['learn-kennedy-goal','foundation:apollo-moon'].map(id=>review(targets.find(t=>t.id===id)));
 const queue=selectLearningPath(data,'presidents-moon',targets,[],{},studied,now).queue;
 assert.ok(queue.some(r=>r.target.id==='learn-kennedy-apollo'));
 const lincoln=selectLearningPath(data,'presidents-lincoln',targets,[],{},[],now);
 assert.ok(lincoln.queue.length);
});
test('daily connected selection respects filters and zero new-knowledge preference',()=>{
 const base={collectionIds:['art'],subject:'all',depth:'foundation',dailyMinutes:3,newRatio:0};
 assert.equal(selectConnectedSession(data,targets,[],base,now,data.collections,[]).queue.length,0);
 const result=selectConnectedSession(data,targets,[],{...base,newRatio:0.4},now,data.collections,[]);
 assert.ok(result.queue.length);assert.ok(result.queue.every(r=>r.target.collectionIds.includes('art')));
});
test('teaching a work defers artist identification and accepted-answer spoilers',()=>{
 const rows=[{target:{id:'purpose',entityId:'work',answer:'Dekorasjon',snapshot:'Van Gogh forberedte huset.',collectionIds:['art']}},{target:{id:'artist',entityId:'work',answer:'Vincent van Gogh',acceptedAnswers:['Van Gogh'],collectionIds:['art']}}];
 assert.equal(safeLearningQueue(rows).length,1);
 const art=selectLearningPath(data,'art-nature',targets,[],{},[],now);
 assert.ok(!art.queue.some(row=>row.target.id==='artist-sunflowers'));
});
