import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppUpdateChecker,APP_CHECK_INTERVAL} from '../src/lib/app-updates.js';
test('manual checks bypass throttling, automatic checks wait five minutes, and use registration.update',async()=>{
 let calls=0,updates=0,time=1000;const statuses=[];
 const checker=createAppUpdateChecker({now:()=>time,version:'0.8.0',fetchVersion:async()=>{calls++;return {version:'0.8.0'};},getRegistration:()=>({update:async()=>{updates++;}}),onStatus:s=>statuses.push(s)});
 assert.equal((await checker.check()).state,'current');await checker.check();assert.equal(calls,1);
 await checker.check(true);assert.equal(calls,2);time+=APP_CHECK_INTERVAL;await checker.check();assert.equal(updates,3);
});
test('a waiting worker is ready even when semantic version is unchanged',async()=>{
 const checker=createAppUpdateChecker({version:'0.8.0',fetchVersion:async()=>({version:'0.8.0'}),getRegistration:()=>({waiting:{},update:async()=>{}})});
 assert.equal((await checker.check(true)).state,'ready');
});
test('new version without a ready worker is pending, never described as up to date',async()=>{
 const checker=createAppUpdateChecker({version:'0.8.0',fetchVersion:async()=>({version:'0.9.0'}),getRegistration:()=>({update:async()=>{}})});
 assert.equal((await checker.check(true)).state,'pending');
});
test('offline errors are surfaced and overlapping requests share the same work',async()=>{
 let calls=0;const checker=createAppUpdateChecker({fetchVersion:async()=>{calls++;throw new Error('Uten nett');},getRegistration:()=>null});
 const [a,b]=await Promise.all([checker.check(true),checker.check(true)]);assert.equal(calls,1);assert.equal(a.state,'failed');assert.equal(b.message,'Uten nett');
});
test('installation finishing after update resolves is awaited before reporting ready',async()=>{
 const worker=new EventTarget();worker.state='installing';const registration={installing:worker,waiting:null,update:async()=>{setTimeout(()=>{worker.state='installed';registration.waiting=worker;worker.dispatchEvent(new Event('statechange'));},5);}};
 const checker=createAppUpdateChecker({fetchVersion:async()=>({version:'0.9.0'}),getRegistration:()=>registration});
 assert.equal((await checker.check(true)).state,'ready');
});
