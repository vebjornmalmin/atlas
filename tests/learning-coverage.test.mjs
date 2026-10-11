import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {learningCoverage,evidenceOverview} from '../src/lib/learning-coverage.js';
import {attachKnowledge} from '../src/lib/knowledge-model.js';import {foundationTargets} from '../src/lib/foundations.js';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));const targets=attachKnowledge([...data.targets,...foundationTargets(data)],data);
test('every collection has an explicit coverage report and uncurated topics expose gaps',()=>{
 const rows=learningCoverage(data,targets);assert.equal(rows.length,data.collections.length);
 assert.ok(rows.find(r=>r.id==='art').paths);assert.ok(rows.find(r=>r.id==='us-presidents').introductions);
 for(const row of rows.filter(r=>!r.objectives))assert.ok(row.gaps.some(g=>g.includes('kartlagt')));
 assert.ok(rows.every(r=>r.sourced<=r.facts));
});
test('coverage is independent of personal progress and explanations remain self assessments',()=>{
 const target=targets.find(t=>t.id==='learn-vermeer-portrait');
 const before=learningCoverage(data,targets);
 const reviews=[{targetId:target.id,timestamp:'2026-10-11',mode:'recall',correct:true,assessment:'self'}];
 const progress=evidenceOverview(targets,reviews);assert.equal(progress.explained,1);assert.equal(progress.recalled,0);
 assert.deepEqual(learningCoverage(data,targets),before);
});
