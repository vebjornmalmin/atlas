import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const media=JSON.parse(await readFile('public/knowledge/media.json','utf8'));
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
test('every image question resolves to a licensed local exact-version asset in the knowledge graph',async()=>{
 const ids=new Set();let bytes=0;
 for(const item of media){
  assert.ok(!ids.has(item.entityId));ids.add(item.entityId);
  assert.ok(data.entities.some(e=>e.id===item.entityId && e.type==='artwork'));
  assert.match(item.sourceUrl,/^https:\/\/commons.wikimedia.org\/wiki\/File:/);assert.match(item.museumUrl,/^https:\/\//);
  assert.match(item.license,/PD-Art/);assert.ok(item.credit && item.context);
  const image=await readFile('public'+item.url);assert.equal(image[0],255);assert.equal(image[1],216);
  assert.equal((await stat('public'+item.url)).size,item.bytes);bytes+=image.length;
 }
 for(const target of data.targets.filter(t=>t.imageQuestion))assert.ok(ids.has(target.entityId));
 assert.equal(data.targets.filter(t=>t.imageQuestion).length,5);assert.ok(bytes<1000000);
});
