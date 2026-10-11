import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openFeedbackDatabase,feedbackRecord,saveFeedback,listFeedback,feedbackText} from '../src/lib/feedback.js';
const screenshot='data:image/png;base64,iVBORw0KGgo=';
test('feedback persists screenshot and a stable context snapshot across reopening',async()=>{
 const name='feedback-'+crypto.randomUUID();let db=await openFeedbackDatabase(name);
 const context={view:'today',target:{id:'stable-question',prompt:'Hva er hovedstaden i Norge?'},viewport:{width:390,height:844}};
 const report=feedbackRecord('  Kartet er vanskelig å trykke på  ',context,screenshot,new Date('2026-10-10T10:00:00Z'));
 context.target.prompt='Changed';await saveFeedback(db,report);db.close();db=await openFeedbackDatabase(name);
 const saved=(await listFeedback(db))[0];assert.equal(saved.screenshot,screenshot);assert.equal(saved.comment,'Kartet er vanskelig å trykke på');assert.equal(saved.context.target.prompt,'Hva er hovedstaden i Norge?');
 assert.match(feedbackText(saved),/stable-question/);assert.ok(!feedbackText(saved).includes('base64'));db.close();
});
test('feedback rejects empty comments or missing screenshots',()=>{
 assert.throws(()=>feedbackRecord(' ',{},screenshot));assert.throws(()=>feedbackRecord('Test',{},''));
});
