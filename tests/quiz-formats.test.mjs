import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFormatTargets,gradeStructured,structuredReady} from '../src/lib/quiz-formats.js';
import {assessTargets} from '../src/lib/difficulty.js';
import {selectPracticeSession,targetMatches} from '../src/lib/learning.js';
import {effectiveRating} from '../src/lib/journey.js';
import {progressDetails,sessionOutcome} from '../src/lib/progress.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/knowledge/foundation.json',import.meta.url)));
const map=JSON.parse(fs.readFileSync(new URL('../public/maps/world.json',import.meta.url)));
const targets=assessTargets(buildFormatTargets(data,[map]));
test('new formats use existing sources or explicit verified historical sources',()=>{
 const ids=new Set();const sources=new Set(data.sources.map(s=>s.id));
 for(const t of targets){assert.ok(!ids.has(t.id));ids.add(t.id);assert.ok(t.sourceIds.length || t.sources.length);for(const id of t.sourceIds)assert.ok(sources.has(id));}
 assert.equal(targets.filter(t=>t.mode==='arrows').length,8);
 assert.equal(targets.filter(t=>t.mode==='arrows' && t.askYear===false).length,4);
});
test('matching requires every correct pair and rejects missing or duplicate selections',()=>{
 const t=targets.find(t=>t.mode==='matching');const correct=Object.fromEntries(t.pairs.map(p=>[p.id,p.id]));
 assert.equal(gradeStructured(t,correct).correct,true);assert.equal(structuredReady(t,correct),true);
 delete correct[t.pairs[0].id];assert.equal(gradeStructured(t,correct).correct,false);assert.equal(structuredReady(t,correct),false);
 const duplicates=Object.fromEntries(t.pairs.map(p=>[p.id,t.pairs[0].id]));assert.equal(gradeStructured(t,duplicates).correctCount,1);
});
test('drawing the direction alone is an easier level than direction and exact year',()=>{
 const direction=targets.find(t=>t.mode==='arrows' && t.askYear===false),full=targets.find(t=>t.id===direction.baseId);
 assert.ok(direction.level<full.level,`${direction.level} < ${full.level}`);
 assert.equal(structuredReady(direction,{from:direction.from,to:direction.to}),true);
 assert.equal(gradeStructured(direction,{from:direction.from,to:direction.to}).correct,true);
 assert.equal(gradeStructured(direction,{from:direction.to,to:direction.from}).correct,false);
});
test('historical arrows need correct direction and year; partial success is explained',()=>{
 const t=targets.find(t=>t.mode==='arrows' && t.askYear);
 assert.deepEqual(gradeStructured(t,{from:t.from,to:t.to,year:String(t.year)}),{correct:true,directionCorrect:true,yearCorrect:true});
 assert.equal(gradeStructured(t,{from:t.to,to:t.from,year:t.year}).correct,false);
 assert.deepEqual(gradeStructured(t,{from:t.from,to:t.to,year:1945}),{correct:false,directionCorrect:true,yearCorrect:false});
 assert.equal(structuredReady(t,{from:t.from,to:t.to}),false);
 for(const r of t.regions)assert.ok(map.regions.some(m=>m.id===r.id));
});
test('format filters exclude unsupported modes and respect assessed learning depth',()=>{
 for(const mode of ['matching','before-after','arrows']){
 const selected=selectPracticeSession(targets,[],{level:0},mode);
 assert.ok(selected.queue.length);assert.ok(selected.queue.every(q=>q.target.mode===mode));
 for(const q of selected.queue){assert.equal(targetMatches(q.target,{level:q.target.level}),true);if(q.target.level<=2)assert.equal(targetMatches(q.target,{level:q.target.level+2}),false);assert.equal(targetMatches(q.target,{level:0,objective:'recall'}),false);assert.equal(effectiveRating(4,{correct:false,mode}),1);}
 }
});
test('before-after grading distinguishes event order without leaking dates in options',()=>{
 const t=targets.find(t=>t.mode==='before-after');assert.equal(gradeStructured(t,{first:t.firstId}).correct,true);
 assert.equal(gradeStructured(t,{first:t.items.find(i=>i.id!==t.firstId).id}).correct,false);
});
test('retry uses latest fact result and includes supported success without duplicating variants',()=>{
 const t=[{id:'a'},{id:'a:recognition',baseId:'a'},{id:'b'}];
 const reviews=[{targetId:'a',timestamp:'2026-10-10T10:00:00Z',correct:false},{targetId:'a:recognition',timestamp:'2026-10-11T10:00:00Z',correct:true},{targetId:'b',timestamp:'2026-10-11T10:01:00Z',correct:true,usedHint:true}];
 const p=progressDetails(t,reviews,new Date('2026-10-11T12:00:00Z'));assert.deepEqual(p.retryIds,['b']);assert.equal(p.days.at(-1).count,2);
 assert.deepEqual(sessionOutcome(reviews),{independent:1,supported:1,retry:1});
});
test('structured drafts become plain data before archiving or switching quizzes',async()=>{
 const {questionDraft}=await import('../src/lib/session-journal.js');
 const proxy=new Proxy({from:'deu',to:'pol',year:'1939'},{});
 const draft=questionDraft('arrows:poland-1939',{formatDraft:proxy});
 assert.deepEqual(structuredClone(draft).formatDraft,{from:'deu',to:'pol',year:'1939'});
});
test('which-came-first pairs do not reveal the answer through ordinals',()=>{
 for(const t of targets.filter(t=>t.mode==='before-after'))for(const item of t.items)assert.doesNotMatch(item.label,/^\d+\.\s/);
});
