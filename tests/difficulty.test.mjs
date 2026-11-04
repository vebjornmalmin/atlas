import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessDifficulty,assessTargets} from '../src/lib/difficulty.js';
import {foundationTargets} from '../src/lib/foundations.js';
import {selectPracticeSession} from '../src/lib/learning.js';
const data=JSON.parse(fs.readFileSync('public/knowledge/foundation.json'));
test('every published question and introduction has a reviewed family and rationale',()=>{
 for(const target of [...data.targets,...foundationTargets(data)]){const a=assessDifficulty(target);assert.notEqual(a.difficultyFamily,'unreviewed',target.id);assert.ok(a.difficultyReason.length>20);}
 for(const target of data.targets)assert.deepEqual({...target,...assessDifficulty(target)},target);
});
test('all 46 presidential succession questions stay advanced in both recall and multiple choice',()=>{
 const rows=data.targets.filter(t=>t.kind==='before-after' && !t.unitId);assert.equal(rows.length,46);
 for(const row of rows)for(const mode of ['recall','recognition']){const a=assessDifficulty({...row,mode,id:mode==='recognition'?row.id+':recognition':row.id,baseId:row.id});assert.equal(a.difficulty,5);assert.equal(a.learningStage,'connections');}
 const targets=assessTargets([...data.targets,...foundationTargets(data)]);
 for(const level of [1,2]){const quiz=selectPracticeSession(targets,[],{collectionIds:['us-presidents'],level},'mixed');assert.ok(quiz.queue.length);assert.ok(quiz.queue.every(q=>q.target.kind!=='before-after'));}
});
test('a graph connection need not be advanced and a short answer need not be easy',()=>{
 assert.equal(assessDifficulty(data.targets.find(t=>t.id.startsWith('geo-capital-reverse'))).difficulty,3);
 assert.equal(assessDifficulty(data.targets.find(t=>t.id.startsWith('nobel-year'))).difficulty,5);
 assert.equal(assessDifficulty(data.targets.find(t=>t.answerType==='person-list')).difficulty,5);
 assert.equal(assessDifficulty({id:'future-unknown',answer:'Kort'}).learningStage,'details');
});
