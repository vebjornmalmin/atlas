import test from 'node:test';
import assert from 'node:assert/strict';
import {answerPresentation,relatedContext} from '../src/lib/presentation.js';
test('recall controls match years, short names, and explanations without restricting long mistaken answers',()=>{
 assert.equal(answerPresentation({prompt:'I hvilket år?',answer:'1888'}).inputMode,'numeric');
 assert.equal(answerPresentation({prompt:'Hvem malte?',answer:'Vincent van Gogh'}).extended,false);
 assert.equal(answerPresentation({answerFormat:'explanation',answer:'Det var et karakterstudium.'}).extended,true);
 assert.equal(answerPresentation({answer:'x'.repeat(100)}).extended,true);
});
test('context retrieves both incoming and outgoing verified relationships without inventing connections',()=>{
 const data={entities:[{id:'work',label:'Verk'},{id:'artist',label:'Kunstner'}],relationships:[{id:'r',from:'artist',to:'work',context:'Kunstneren laget verket.',sourceIds:['museum']}]};
 assert.deepEqual(relatedContext(data,{entityId:'work'}),[{id:'r',context:'Kunstneren laget verket.',sourceIds:['museum'],entityId:'artist',label:'Kunstner'}]);
 assert.deepEqual(relatedContext(data,{entityId:'missing'}),[]);
});
