import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import 'fake-indexeddb/auto';
import { openDatabase, STORES, all, get, put, installPackage, recordReview, exportDatabase, restoreDatabase, logEvent } from '../src/lib/storage.js';
import { scheduleReview, Rating } from '../src/lib/learning.js';
const foundation = JSON.parse(await readFile(new URL('../public/knowledge/foundation.json', import.meta.url), 'utf8'));
async function database(t) { const db = await openDatabase(`test-${crypto.randomUUID()}`); t.after(() => db.close()); return db; }
const now = new Date('2026-10-10T08:00:00Z');

test('first launch creates stores and useful graph, scheduling, and history indexes', async t => {
  const db = await database(t);
  assert.deepEqual([...db.objectStoreNames].sort(), [...STORES].sort());
  const tx = db.transaction(STORES);
  assert.equal(tx.objectStore('targets').index('collections').multiEntry, true);
  assert.equal(tx.objectStore('entities').index('collections').keyPath, 'collectionIds');
  assert.equal(tx.objectStore('states').index('due').keyPath, 'due');
  assert.equal(tx.objectStore('reviews').index('targetId').keyPath, 'targetId');
  assert.equal(tx.objectStore('reviews').index('timestamp').keyPath, 'timestamp');
  assert.equal(tx.objectStore('relationships').index('from').keyPath, 'from');
  assert.equal(tx.objectStore('relationships').index('to').keyPath, 'to');
});

test('content replacement changes graph atomically and preserves personal memory', async t => {
  const db = await database(t);
  await installPackage(db, foundation);
  const id = foundation.targets[0].id;
  const state = scheduleReview(id, undefined, Rating.Good, now).card;
  const review = { id: 'review-1', targetId: id, rating: Rating.Good, timestamp: now.toISOString() };
  await recordReview(db, state, review);
  const replacement = structuredClone(foundation);
  replacement.version = '1.0.1';
  replacement.entities[0].summary = 'A corrected contextual summary.';
  await installPackage(db, replacement);
  assert.equal((await get(db, 'packages', foundation.id)).version, '1.0.1');
  assert.equal((await get(db, 'entities', replacement.entities[0].id)).summary, replacement.entities[0].summary);
  assert.deepEqual(await get(db, 'states', id), state);
  assert.deepEqual(await all(db, 'reviews'), [review]);
  assert.equal((await all(db, 'targets')).length, replacement.targets.length);
});

test('rejected package leaves previous package and graph active', async t => {
  const db = await database(t);
  await installPackage(db, foundation);
  const previous = await exportDatabase(db);
  const invalid = structuredClone(foundation);
  invalid.relationships[0].to = 'missing-entity';
  await assert.rejects(installPackage(db, invalid), /unknown to endpoint/);
  assert.deepEqual((await exportDatabase(db)).stores, previous.stores);
});

test('repeated review event is applied exactly once and cannot overwrite newer state', async t => {
  const db = await database(t);
  const state = scheduleReview('target', undefined, Rating.Good, now).card;
  const review = { id: 'review', targetId: 'target', rating: Rating.Good, timestamp: now.toISOString() };
  assert.equal(await recordReview(db, state, review), true);
  assert.equal(await recordReview(db, { ...state, reps: 99 }, review), false);
  assert.deepEqual(await get(db, 'states', 'target'), state);
  assert.equal((await all(db, 'reviews')).length, 1);
});

test('backup restores content, settings, and learning history together', async t => {
  const source = await database(t);
  const destination = await database(t);
  await installPackage(source, foundation);
  await put(source, 'settings', { id: 'preferences', collectionIds: ['science'], dailyMinutes: 8 });
  const id = foundation.targets[0].id;
  await recordReview(source, scheduleReview(id, undefined, Rating.Good, now).card,
    { id: 'saved-review', targetId: id, rating: Rating.Good, timestamp: now.toISOString() });
  const backup = JSON.parse(JSON.stringify(await exportDatabase(source)));
  await put(destination, 'settings', { id: 'old-setting', value: 'remove me' });
  await restoreDatabase(destination, backup);
  assert.deepEqual((await exportDatabase(destination)).stores, backup.stores);
  assert.equal(await get(destination, 'settings', 'old-setting'), undefined);
});

test('invalid backup and interrupted restore both preserve existing data', async t => {
  const db = await database(t);
  await installPackage(db, foundation);
  await put(db, 'settings', { id: 'preferences', dailyMinutes: 7 });
  const original = await exportDatabase(db);
  const invalid = structuredClone(original);
  invalid.stores.states.push({ id: 'bad', due: 'not-a-date', stability: -1 });
  await assert.rejects(restoreDatabase(db, invalid), /invalid memory/);
  assert.deepEqual((await exportDatabase(db)).stores, original.stores);
  const interrupted = structuredClone(original);
  interrupted.stores.settings.push({ id: 'uncloneable', value() {} });
  await assert.rejects(restoreDatabase(db, interrupted));
  assert.deepEqual((await exportDatabase(db)).stores, original.stores);
});

test('local diagnostic history is bounded and long messages are trimmed', async t => {
  const db = await database(t);
  for (let i = 0; i < 105; i++) await logEvent(db, 'test', `${i}:${'x'.repeat(1100)}`, 'info', { i });
  const logs = await all(db, 'logs');
  assert.equal(logs.length, 100);
  assert.ok(logs.every(log => log.message.length <= 1000));
  assert.ok(logs.some(log => log.context.i === 104));
});

test('restore rebuilds graph indexes from validated packages rather than trusting altered backup indexes', async t => {
  const db = await database(t);
  await installPackage(db, foundation);
  const backup = await exportDatabase(db);
  const corrupted = structuredClone(backup);
  corrupted.stores.entities = [{ id: 'invented', label: 'Invalid index record' }];
  corrupted.stores.relationships = [{ id: 'broken', from: 'missing', to: 'missing' }];
  corrupted.stores.targets = [];
  await restoreDatabase(db, corrupted);
  for (const store of ['entities', 'relationships', 'targets']) {
    assert.deepEqual(await all(db, store), backup.stores[store]);
  }
});

test('extra practice is recorded once without moving any scheduled repetition and survives backup restore',async t=>{
 const db=await database(t);
 await installPackage(db,foundation);
 const targetId=foundation.targets[0].id;
 const state=scheduleReview(targetId,null,Rating.Good,now).card;
 await put(db,'states',state);
 const event={id:'practice-review',targetId,timestamp:now.toISOString(),rating:4,practice:true,nextDue:null};
 assert.equal(await recordReview(db,null,event),true);
 assert.equal(await recordReview(db,null,{...event,rating:1}),false);
 assert.deepEqual(await get(db,'states',targetId),state);
 assert.equal((await get(db,'reviews',event.id)).rating,4);
 const backup=await exportDatabase(db);
 const restored=await database(t);await restoreDatabase(restored,backup);
 assert.deepEqual(await get(restored,'states',targetId),state);
 assert.equal((await get(restored,'reviews',event.id)).practice,true);
});
test('new fact cards and legacy mirrors survive backup, rollback and old backups without rewriting history',async t=>{
 const {attachKnowledge,schedulingKey,legacyFactKey}=await import('../src/lib/knowledge-model.js');
 const {stateForTarget}=await import('../src/lib/learning.js');
 const db=await database(t);await installPackage(db,foundation);
 const target=attachKnowledge([foundation.targets[0]],foundation)[0];
 const card=scheduleReview(schedulingKey(target),null,3,now).card;
 const review={id:'canonical',targetId:target.id,schedulerId:card.id,factId:target.factId,mode:'recall',rating:3,timestamp:now.toISOString(),correct:true};
 await recordReview(db,card,review,{...card,id:legacyFactKey(target)});
 const backup=await exportDatabase(db),destination=await database(t);await restoreDatabase(destination,backup);
 assert.equal(stateForTarget(target,[target],await all(destination,'states'),await all(destination,'reviews')).id,card.id);
 const legacy=JSON.parse(await readFile('knowledge-build/base-foundation.json','utf8'));await installPackage(destination,legacy);
 assert.equal((await get(destination,'states',legacyFactKey(target))).due,card.due);
 assert.deepEqual(await all(destination,'reviews'),[review]);
 const oldBackup=await exportDatabase(destination);await restoreDatabase(db,oldBackup);assert.deepEqual(await all(db,'reviews'),[review]);
});
