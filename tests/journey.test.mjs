import test from 'node:test';
import assert from 'node:assert/strict';
import {factKey,learningStage,quizProgress,overviewBounds} from '../src/lib/journey.js';
import {selectSession,selectPracticeSession,targetMatches} from '../src/lib/learning.js';
import {saveJournal,readJournal,questionDraft,restoreDraft,dropRetired} from '../src/lib/session-journal.js';
const target=(id,extra={})=>({id,entityId:id,mode:'recall',collectionIds:['history'],difficulty:2,significance:4,answer:id,...extra});
const now=new Date('2026-10-11T09:00:00Z');
test('levels are bands: a typed exact year is too hard for orientation, and a high level leaves out easy questions',()=>{
 const year=target('year',{answer:'1789',answerFormat:'year'}),choice=target('choice',{mode:'recognition'});
 assert.equal(targetMatches(year,{level:1}),false);assert.equal(targetMatches(year,{level:2}),false);
 assert.equal(targetMatches(year,{level:3}),true);
 assert.equal(targetMatches(choice,{level:1}),true);assert.equal(targetMatches(choice,{level:3}),false);
 assert.equal(targetMatches(choice,{level:0}),true);
});
test('recall and recognition of the same fact never appear twice in either quiz',()=>{
 const a=target('a'),b=target('a:recognition',{baseId:'a',mode:'recognition'});
 assert.equal(factKey(a),factKey(b));
 assert.equal(selectSession([a,b],[],{},now).queue.length,1);
 assert.equal(selectPracticeSession([a,b],[],{},'mixed',now).queue.length,1);
});
test('county answer, map and outline cannot reveal one another within one quiz',()=>{
 const rows=[target('county',{collectionIds:['norway'],answer:'Oslo'}),...['map','outline'].map(mode=>target(mode,{mode,datasetId:'norway',regionId:'oslo',answer:'Oslo',collectionIds:['norway']}))];
 assert.equal(selectSession(rows,[],{},now).queue.length,1);
 assert.equal(selectPracticeSession(rows,[],{},'mixed',now).queue.length,1);
 const other=target('bergen',{mode:'outline',datasetId:'norway',regionId:'vestland',answer:'Vestland',collectionIds:['norway']});
 const reviews=[{targetId:'map',timestamp:now.toISOString(),practice:true}];
 assert.equal(selectPracticeSession([...rows,other],[],{level:0},'mixed',now,[],reviews).queue[0].target.id,'bergen');
});
test('a recently answered variant cannot return as new knowledge in todays quiz',()=>{
 const rows=[target('a'),target('a:recognition',{mode:'recognition',baseId:'a'})];
 assert.equal(selectSession(rows,[],{},now,[],[{targetId:'a',timestamp:now.toISOString()}]).queue.length,0);
 assert.equal(selectSession(rows,[{id:'a',due:'2030-01-01'}],{},now).queue.length,0);
});
test('map overview is independent of the answer, even after zoom',()=>{
 const dataset={viewBox:'0 0 720 290'};
 assert.equal(overviewBounds(dataset),'0 0 720 290');
 assert.equal(overviewBounds(dataset,2),'180 72.5 360 145');
 assert.equal(overviewBounds({...dataset,regionId:'oslo'},2),overviewBounds({...dataset,regionId:'bergen'},2));
});
test('free practice counts once per fact; teaching and hints do not count as independent answers',()=>{
 const rows=[target('a'),target('a:recognition',{baseId:'a',mode:'recognition'}),target('b')];
 const reviews=[{targetId:'a',timestamp:'2026-10-10',correct:true,practice:true},{targetId:'a:recognition',timestamp:'2026-10-11',correct:true,learnedFirst:true},{targetId:'b',timestamp:'2026-10-11',correct:true,usedHint:true}];
 assert.deepEqual(quizProgress(rows,reviews),{total:2,answered:2,correct:0,remaining:0});
});
test('reload restores the exact draft, without applying it to another question or session',()=>{
 const values=new Map();const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 const session={sessionId:'one',index:2};const draft=questionDraft('a',{answer:'Påbegynt',revealed:true,selectedRegion:'oslo',timelineOrder:[{id:'b'},{id:'a'}],introduction:false,learnedFirst:true});
 saveJournal(storage,session,draft,true,'today');
 assert.deepEqual(restoreDraft(target('a'),readJournal(storage,session).draft),draft);
 assert.equal(readJournal(storage,{...session,index:3}),null);
 assert.equal(readJournal(storage,{...session,sessionId:'two'}),null);
 assert.equal(restoreDraft(target('b'),draft),null);
});

test('a saved session skips cards retired by a content update and keeps the answers already given',()=>{
 const known=new Set(['a','c','d']),exists=entry=>known.has(entry.id);
 const session={sessionId:'one',status:'active',index:1,queue:[{id:'gone'},{id:'b'},{id:'c'},{id:'old'},{id:'d'}],draft:{targetId:'b',answer:'x'}};
 const pruned=dropRetired(session,exists);
 assert.deepEqual(pruned.queue.map(e=>e.id),['gone','c','d']);
 assert.equal(pruned.index,1);assert.equal(pruned.draft,null);assert.equal(pruned.status,'active');
 const intact={...session,queue:[{id:'a'},{id:'c'}],draft:{targetId:'c'}};
 assert.equal(dropRetired(intact,exists),intact);
 const kept=dropRetired({...session,queue:[{id:'a'},{id:'c'},{id:'old'}]},exists);
 assert.deepEqual(kept.draft,session.draft);
 assert.equal(dropRetired({...session,queue:[{id:'a'},{id:'old'}]},exists).status,'completed');
 assert.equal(dropRetired(null,exists),null);
});

test('map panning reveals all regions without centering a target and is clamped to the dataset',()=>{
 assert.equal(overviewBounds({viewBox:'0 0 720 290'},2,-.5,.5),'0 145 360 145');
 assert.equal(overviewBounds({viewBox:'0 0 720 290'},1,-.5,.5),'0 0 720 290');
});
test('short question support drops filler but preserves disambiguating facts',async()=>{
 const {questionSupport}=await import('../src/lib/presentation.js');
 assert.equal(questionSupport({context:'Knytt et land til byen som har rollen som hovedstad.'}),'');
 assert.equal(questionSupport({context:'Plasser anerkjennelsen på tidslinjen. Spørsmålet gjelder prisåret, ikke nødvendigvis året arbeidet begynte.'}),'Oppgi prisåret, ikke oppdagelsesåret.');
 assert.equal(questionSupport({context:'Her gjelder fylkesinndelingen fra 2024.'}),'Her gjelder fylkesinndelingen fra 2024.');
});

test('incorrect objective answers and newly shown answers are never scheduled as successful recall',async()=>{
 const {effectiveRating}=await import('../src/lib/journey.js');
 assert.equal(effectiveRating(2,{correct:false,learnedFirst:true,mode:'recognition'}),1);
 assert.equal(effectiveRating(4,{correct:false,mode:'map'}),1);
 assert.equal(effectiveRating(2,{correct:null,learnedFirst:true}),1);
 assert.equal(effectiveRating(4,{correct:true,learnedFirst:true}),2);
 assert.equal(effectiveRating(3,{correct:true,usedHint:true}),2);
 assert.equal(effectiveRating(3,{correct:true}),3);
});
