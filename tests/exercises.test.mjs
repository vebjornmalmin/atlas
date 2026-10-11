import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeAnswer,checkAnswer,makeRecognitionOptions,buildTimelineExercise,gradeTimeline,createMapExercise,gradeMapSelection} from '../src/lib/exercises.js';
test('Recall accepts curated aliases and punctuation but rejects wrong names and empty answers', () => {
  assert.equal(normalizeAnswer('  Jon Fósse! '), 'jon fosse');
  const target = {answer:'Marie Curie',acceptedAnswers:['Curie']};
  assert.ok(checkAnswer(target,'MARIE CURIE'));
  assert.ok(checkAnswer(target,'Curie'));
  assert.equal(checkAnswer(target,'Pierre Curie'),false);
  assert.equal(checkAnswer(target,''),false);
  assert.equal(checkAnswer({answer:'1914'},'1915'),false);
});
test('Recognition includes exactly one correct answer and only meaningful unique distractors', () => {
  const target = {id:'a',answer:'Oslo',kind:'capital',collectionIds:['geography']};
  const targets = [target,{...target,id:'b',answer:'Paris'},{...target,id:'c',answer:'Rome'},
    {...target,id:'d',answer:'Rome'},{...target,id:'e',answer:'Albert Einstein',kind:'person'}];
  const options=makeRecognitionOptions(target,targets);
  assert.equal(options.length,3);assert.equal(options.filter(x=>x.correct).length,1);
  assert.equal(new Set(options.map(x=>x.label)).size,3);
  assert.deepEqual(options,makeRecognitionOptions(target,targets));
  assert.ok(!options.some(x=>x.label==='Albert Einstein'));
});
test('Recognition never mixes dates and people in a shared collection', () => {
  const target={id:'year',answer:'1888',prompt:'In which year?',kind:'recall',collectionIds:['art']};
  const options=makeRecognitionOptions(target,[{...target,id:'other-year',answer:'1899'}, {...target,id:'painter',answer:'Claude Monet',prompt:'Who painted this?'}]);
  assert.deepEqual(new Set(options.map(x=>x.label)),new Set(['1888','1899']));
});
test('Timeline begins out of order and accepts ties without inventing precedence', () => {
  const timeline={id:'t',items:[{id:'c',year:2000},{id:'a',year:1800},{id:'b',year:1900}]};
  const exercise=buildTimelineExercise(timeline);
  assert.notDeepEqual(exercise.items.map(x=>x.id),exercise.correctOrder);
  assert.ok(gradeTimeline(['a','b','c'],timeline).correct);
  assert.equal(gradeTimeline(['a','c','b'],timeline).correct,false);
  assert.equal(gradeTimeline(['a','a','c'],timeline).correct,false);
  assert.equal(gradeTimeline(['a','b','unknown'],timeline).correct,false);
  assert.equal(gradeTimeline(['a','b'],timeline).correct,false);
  assert.equal(gradeTimeline(['a','b','c','d'],timeline).correct,false);
  assert.equal(gradeTimeline(['a','b','unknown'],timeline).correctCount,0);
  assert.equal(gradeTimeline(['c','b','a'],timeline).correctCount,1);
  assert.throws(()=>buildTimelineExercise({items:[{id:'a',year:1900},{id:'a',year:1901}]}),/unique/);
  assert.throws(()=>buildTimelineExercise({items:[{id:'a',year:'1900'}]}),/dated/);
  assert.ok(gradeTimeline(['b','a'],{items:[{id:'a',year:1900},{id:'b',year:1900}]}).correct);
});
test('Offline real map datasets render accessible unlabeled paths and exact selection', async () => {
  for (const name of ['world','norway']) {
    const map=JSON.parse(await readFile(new URL(`../public/maps/${name}.json`,import.meta.url)));
    assert.ok(map.source.url.startsWith('https://'));
    assert.ok(map.source.title.length > 3);
    assert.ok(map.source.license.length > 3);
    assert.ok(/^0 0 \d+ \d+$/.test(map.viewBox));
    assert.ok(map.regions.every(x=>x.path.startsWith('M') && x.path.endsWith('Z')));
    assert.ok(map.regions.every(x=>/^[MLZ\d.,+-]+$/.test(x.path)));
    assert.ok(map.regions.every(x=>x.label.trim().length && x.id.trim().length));
    for(const region of map.regions) {
      const numbers=region.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
      assert.equal(numbers.length%2,0);
      assert.ok(numbers.every(Number.isFinite));
      assert.equal((region.path.match(/M/g)||[]).length,(region.path.match(/Z/g)||[]).length);
    }
    assert.equal(new Set(map.regions.map(x=>x.id)).size,map.regions.length);
    const exercise=createMapExercise(map,map.regions[0].id);
    assert.equal((exercise.svg.match(/data-region=/g)||[]).length,map.regions.length);
    assert.ok(exercise.svg.includes('tabindex="0"'));
    assert.ok(!exercise.svg.includes('<text'));
    assert.ok(gradeMapSelection(map.regions[0].id,exercise.targetId));
    assert.equal(gradeMapSelection(map.regions[1].id,exercise.targetId),false);
    if(name==='norway') {
      assert.equal(map.regions.length,15);
      assert.ok(map.regions.every(x=>x.collectionIds.includes('norway')));
      assert.match(map.source.attribution,/Kartverket/);
      assert.equal(map.source.license,'CC BY 4.0');
    }
    assert.throws(()=>createMapExercise(map,'invalid-id'),/Unknown/);
    assert.equal(gradeMapSelection('',exercise.targetId),false);
    if(name==='world')assert.ok(['nor','fra','ita','bra','jpn','egy','usa','ind','aus','deu','esp','zaf'].every(id=>map.regions.some(x=>x.id===id)));
  }
});
