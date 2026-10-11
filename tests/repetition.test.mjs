import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleReview,selectSession} from '../src/lib/learning.js';
const now=new Date('2026-10-11T09:00:00Z');
const t={id:'fact',answer:'Nynorsk',collectionIds:['literature'],significance:4,difficulty:2,learningStage:'foundation',mode:'recall'};
test('future repetitions use days; short learning steps happen inside the quiz',()=>{
 const card=scheduleReview(t.id,null,3,now).card;
 assert.ok(new Date(card.due)-now>=86400000,'A remembered first answer should not require another quiz in ten minutes');
});
test('switching from multiple choice to text recall retains the due repetition',()=>{
 const variant={...t,id:'fact:recognition',baseId:'fact',mode:'recognition'};
 const state=scheduleReview(variant.id,null,3,new Date('2026-10-01T09:00:00Z')).card;
 const result=selectSession([t,variant],[state],{objective:'recall'},now);
 assert.equal(result.queue.length,1,'The same fact is due even when the exercise format changes');
 assert.equal(result.queue[0].target.id,t.id);
});
import {advanceSession,retryTargets,nextActionNote} from '../src/lib/repetition.js';
import {stateForTarget} from '../src/lib/learning.js';
import {sessionOutcome} from '../src/lib/progress.js';
const quiz=()=>({queue:[{id:'a'},{id:'b'},{id:'c'}],index:0,results:[],status:'active'});
const failed={id:'a',rating:1,correct:false};
const passed=id=>({id,rating:3,correct:true});
test('unknown answers return after the original questions, with no time delay',()=>{
 let q=advanceSession(quiz(),failed);assert.deepEqual(q.queue.map(x=>x.id),['a','b','c','a']);assert.equal(q.queue[3].sessionRetry,true);
 q=advanceSession(q,passed('b'));q=advanceSession(q,passed('c'));assert.equal(q.status,'active');assert.equal(q.queue[q.index].id,'a');
 q=advanceSession(q,passed('a'));assert.equal(q.status,'completed');assert.deepEqual(retryTargets(q.results),[]);
 assert.deepEqual(sessionOutcome(q.results),{independent:3,supported:0,retry:0});
});
test('correct answers with hints or newly revealed teaching still return',()=>{
 for(const help of [{usedHint:true},{learnedFirst:true},{correct:null}]){const q=advanceSession(quiz(),{...passed('a'),...help});assert.equal(q.queue.length,4);assert.match(nextActionNote(quiz(),{...passed('a'),...help}),/slutten/);}
 assert.equal(advanceSession(quiz(),{...passed('a'),rating:2}).queue.length,3);
});
test('the last unknown question keeps the quiz open; retries are bounded and survive serialization',()=>{
 let q={queue:[{id:'a'}],index:0,results:[],status:'active'};
 for(let i=0;i<3;i++)q=JSON.parse(JSON.stringify(advanceSession(q,failed)));
 assert.equal(q.status,'completed');assert.equal(q.queue.length,3);assert.deepEqual(retryTargets(q.results),['a']);
});
test('new Easy cannot defer the first review for eight days; intervals grow after spaced successful usage',()=>{
 const card=scheduleReview('fact',null,4,now).card;assert.equal(new Date(card.due)-now,86400000);
 const second=scheduleReview('fact',card,3,new Date(card.due)).card;
 const third=scheduleReview('fact',second,3,new Date(second.due)).card;
 assert.ok(new Date(third.due)-new Date(second.due)>new Date(second.due)-new Date(card.due));
 assert.ok(third.reps>card.reps);
});
test('latest historical variant is reused, then the shared canonical state takes priority',()=>{
 const variant={...t,id:'fact:recognition',baseId:'fact'};
 const older=scheduleReview('fact',null,3,new Date('2026-10-01')).card;
 const recent=scheduleReview(variant.id,older,3,new Date('2026-10-05')).card;
 assert.equal(stateForTarget(t,[t,variant],[older,recent]).id,variant.id);
 const canonical=scheduleReview(t.id,recent,3,new Date('2026-10-10')).card;
 assert.equal(stateForTarget(variant,[t,variant],[canonical,recent]).id,t.id);
});
