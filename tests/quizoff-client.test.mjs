import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuizoffClient,STORAGE_KEY,NAME_KEY} from '../src/lib/quizoff/client.js';

function fakeTimers(){
 let time=0,id=0;const items=new Map();
 const api={
  now:()=>time,
  setTimeout:(fn,ms)=>{items.set(++id,{fn,at:time+ms,every:0});return id;},
  setInterval:(fn,ms)=>{items.set(++id,{fn,at:time+ms,every:ms});return id;},
  clearTimeout:h=>{items.delete(h);},clearInterval:h=>{items.delete(h);},
  pending:()=>items.size,
  advance(ms){
   const end=time+ms;
   for(;;){
    let next=null;
    for(const [h,it] of items)if(it.at<=end&&(!next||it.at<next[1].at))next=[h,it];
    if(!next)break;
    const [h,it]=next;time=Math.max(time,it.at);
    if(it.every)it.at+=it.every;else items.delete(h);
    it.fn();
   }
   time=end;
  }
 };
 return api;
}
function fakeWebSocket(){
 return class FakeWebSocket{
  static instances=[];
  static last(){return FakeWebSocket.instances[FakeWebSocket.instances.length-1];}
  constructor(url){this.url=url;this.readyState=0;this.sent=[];FakeWebSocket.instances.push(this);}
  send(data){this.sent.push(data);}
  close(){this.readyState=3;}
  open(){this.readyState=1;this.onopen?.({});}
  recv(msg){this.onmessage?.({data:typeof msg==='string'?msg:JSON.stringify(msg)});}
  serverClose(){this.readyState=3;this.onclose?.({});}
  frames(){return this.sent.filter(s=>s!=='ping').map(s=>JSON.parse(s));}
 };
}
function memoryStorage(){
 const map=new Map();
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{map.set(k,String(v));},removeItem:k=>{map.delete(k);}};
}
const flush=()=>new Promise(r=>setImmediate(r));
const ev=(seq,t,extra={})=>({seq,at:seq*1000,t,...extra});
const ROOM={code:'ABCD',app:'1.10.0',pack:'p1'};
const lobby=()=>[ev(1,'joined',{player:{id:'me',name:'Ola'}}),ev(2,'joined',{player:{id:'p2',name:'Kari'}})];
const started=()=>[...lobby(),ev(3,'started',{settings:{count:3,seconds:20,title:''},questions:[{id:'core:a',mode:'recall'}]}),ev(4,'question',{q:0,deadline:24000})];

function setup(options={}){
 const timers=fakeTimers(),WS=fakeWebSocket(),storage=options.storage||memoryStorage();
 const reduceCalls=[];let counter=0;
 const reduce=(room,you,events)=>{reduceCalls.push(events.length);return {seq:events.length?events[events.length-1].seq:0,n:events.length,you};};
 const fetches=[];
 const fetchImpl=options.fetchImpl||(async(url,init)=>{fetches.push({url,init});return {ok:true,status:201,json:async()=>({code:'WXYZ'})};});
 const client=createQuizoffClient({origin:'https://atlas.test',app:'1.10.0',pack:'p1',storage,WebSocketImpl:WS,fetchImpl,reduce,now:timers.now,random:n=>Array.from({length:n},(_,i)=>(++counter+i)%256),timers});
 const welcome=(ws,extra={})=>ws.recv({t:'welcome',room:ROOM,you:extra.you||'me',now:5000,events:[],online:['me'],progress:{q:0,answered:[],ready:[]},...extra});
 // join, open and welcome the first socket
 async function joined(events=lobby()){
  const p=client.join('abcd','Ola');const ws=WS.last();ws.open();
  const hello=ws.frames()[0];
  welcome(ws,{you:hello.player.id,events});await p;return {ws,hello};
 }
 return {client,timers,WS,storage,reduceCalls,fetches,welcome,joined};
}
const saved=s=>JSON.parse(s.storage.getItem(STORAGE_KEY));

test('create posts the room, connects, and goes online after welcome with room and player',async()=>{
 const s=setup();
 const p=s.client.create('Ola');
 assert.equal(s.client.snapshot().status,'connecting');
 await flush();
 assert.equal(s.fetches[0].url,'https://atlas.test/api/quizoff/rooms');
 assert.deepEqual(JSON.parse(s.fetches[0].init.body),{app:'1.10.0',pack:'p1'});
 const ws=s.WS.last();
 assert.equal(ws.url,'wss://atlas.test/api/quizoff/rooms/WXYZ/ws');
 ws.open();
 const hello=ws.frames()[0];
 assert.equal(hello.t,'hello');assert.equal(hello.v,1);assert.equal(hello.app,'1.10.0');assert.equal(hello.pack,'p1');assert.equal(hello.have,0);
 assert.equal(hello.player.name,'Ola');assert.match(hello.player.id,/^[0-9a-f-]{36}$/);assert.ok(hello.key.length>=32);
 s.welcome(ws,{room:{...ROOM,code:'WXYZ'},you:hello.player.id,events:[ev(1,'joined',{player:hello.player})]});
 const snap=await p;
 assert.equal(snap.status,'online');assert.equal(snap.room.code,'WXYZ');assert.equal(snap.you,hello.player.id);assert.equal(snap.name,'Ola');
 assert.equal(snap.offset,5000);assert.deepEqual(snap.online,['me']);assert.equal(snap.game.n,1);
 assert.equal(s.storage.getItem(NAME_KEY),'Ola');
 assert.equal(saved(s).player.id,hello.player.id);assert.equal(saved(s).key,hello.key);
});

test('create rejects when the server cannot be reached or refuses',async()=>{
 const down=setup({fetchImpl:async()=>{throw new TypeError('Load failed');}});
 await assert.rejects(down.client.create('Ola'),{code:'unreachable'});
 assert.equal(down.client.snapshot().status,'idle');
 const refused=setup({fetchImpl:async()=>({ok:false,status:500,json:async()=>({})})});
 await assert.rejects(refused.client.create('Ola'),{code:'create-failed'});
 const closed=setup();const p=closed.client.join('abcd','Ola');closed.WS.last().serverClose();
 await assert.rejects(p,{code:'unreachable'});
 assert.equal(closed.storage.getItem(STORAGE_KEY),null);
});

test('join upper-cases and trims the code',async()=>{
 const s=setup();
 const {ws}=await s.joined();
 assert.equal(ws.url,'wss://atlas.test/api/quizoff/rooms/ABCD/ws');
 const t=setup();const p=t.client.join('  ab cd'.replace(' ab cd','abcd  '),'Ola');
 assert.equal(t.WS.last().url,'wss://atlas.test/api/quizoff/rooms/ABCD/ws');
 t.client.forget();await assert.rejects(p,{code:'cancelled'});
});

test('http origins use ws',async()=>{
 const WS=fakeWebSocket();
 const c=createQuizoffClient({origin:'http://localhost:8787/',app:'a',pack:'p',storage:memoryStorage(),WebSocketImpl:WS,fetchImpl:async()=>{},reduce:()=>null,timers:fakeTimers()});
 c.join('abcd','Ola');
 assert.equal(WS.last().url,'ws://localhost:8787/api/quizoff/rooms/ABCD/ws');
 c.destroy();
});

test('events are appended, saved, reduced and published as a new snapshot; duplicates are ignored',async()=>{
 const s=setup();const {ws}=await s.joined();
 const seen=[];s.client.subscribe(x=>seen.push(x));
 const before=s.client.snapshot();
 ws.recv({t:'event',event:ev(3,'started',{settings:{count:3,seconds:20,title:''},questions:[]})});
 const after=s.client.snapshot();
 assert.notEqual(after,before);assert.equal(before.events.length,2);assert.equal(after.events.length,3);
 assert.equal(after.game.seq,3);assert.equal(saved(s).events.length,3);
 const calls=s.reduceCalls.length,emits=seen.length;
 ws.recv({t:'event',event:ev(3,'started')});ws.recv({t:'event',event:ev(2,'joined')});
 assert.equal(s.client.snapshot(),after);assert.equal(s.reduceCalls.length,calls);assert.equal(seen.length,emits);
 assert.equal(s.WS.instances.length,1);
});

test('presence and progress update the snapshot without touching the log',async()=>{
 const s=setup();const {ws}=await s.joined();
 ws.recv({t:'presence',online:['me','p2']});ws.recv({t:'progress',q:0,answered:['p2'],ready:[]});
 const snap=s.client.snapshot();
 assert.deepEqual(snap.online,['me','p2']);assert.deepEqual(snap.progress,{q:0,answered:['p2'],voted:[],ready:[]});assert.equal(snap.events.length,2);
 ws.recv({t:'progress',q:0,answered:['p2','me'],voted:['p2'],ready:[]});
 assert.deepEqual(s.client.snapshot().progress.voted,['p2']);
});

test('a gap in seq reconnects, and hello carries the last contiguous seq',async()=>{
 const s=setup();const {ws}=await s.joined();
 ws.recv({t:'event',event:ev(5,'question',{q:0,deadline:1})});
 assert.equal(s.client.snapshot().events.length,2);
 assert.equal(s.client.snapshot().status,'reconnecting');
 s.timers.advance(0);
 const ws2=s.WS.last();assert.notEqual(ws2,ws);ws2.open();
 assert.equal(ws2.frames()[0].have,2);
 s.welcome(ws2,{events:[ev(3,'started'),ev(4,'question',{q:0,deadline:1}),ev(5,'reveal',{q:0,answers:{}})]});
 assert.equal(s.client.snapshot().status,'online');assert.equal(s.client.snapshot().events.length,5);
});

test('socket close goes reconnecting, then a new socket says hello with have and catches up',async()=>{
 const s=setup();const {ws}=await s.joined();
 ws.serverClose();
 assert.equal(s.client.snapshot().status,'reconnecting');
 s.timers.advance(499);assert.equal(s.WS.instances.length,1);
 s.timers.advance(1);assert.equal(s.WS.instances.length,2);
 const ws2=s.WS.last();ws2.open();
 assert.deepEqual(ws2.frames()[0].have,2);assert.equal(ws2.frames()[0].t,'hello');
 s.welcome(ws2,{events:[ev(3,'started'),ev(4,'question',{q:0,deadline:1})]});
 const snap=s.client.snapshot();
 assert.equal(snap.status,'online');assert.equal(snap.events.length,4);assert.equal(saved(s).events.length,4);
});

test('backoff grows from 0.5 s to 8 s, resets after welcome, and reconnect() skips the wait',async()=>{
 const s=setup();const {ws}=await s.joined();
 ws.serverClose();
 const waits=[];
 for(let i=0;i<6;i++){
  const count=s.WS.instances.length;let waited=0;
  while(s.WS.instances.length===count&&waited<20000){s.timers.advance(100);waited+=100;}
  waits.push(waited);s.WS.last().serverClose();
 }
 assert.deepEqual(waits,[500,1000,2000,4000,8000,8000]);
 const count=s.WS.instances.length;
 s.client.reconnect();
 assert.equal(s.WS.instances.length,count+1);
 const ws3=s.WS.last();ws3.open();s.welcome(ws3);
 ws3.serverClose();
 s.timers.advance(499);assert.equal(s.WS.instances.length,count+1);
 s.timers.advance(1);assert.equal(s.WS.instances.length,count+2);
});

test('an answer given offline is resent after welcome while the question is open',async()=>{
 const s=setup();const {ws}=await s.joined(started());
 ws.serverClose();
 assert.equal(s.client.answer(0,'  Rembrandt '),true);
 assert.deepEqual(s.client.snapshot().myAnswers,{0:'Rembrandt'});assert.deepEqual(saved(s).myAnswers,{0:'Rembrandt'});
 assert.equal(s.client.answer(0,'Other'),false);
 s.client.reconnect();
 const ws2=s.WS.last();ws2.open();
 s.welcome(ws2,{events:[]});
 assert.deepEqual(ws2.frames().slice(1),[{t:'answer',q:0,answer:'Rembrandt'}]);
});

test('an answer given online is sent at once, and not resent when progress already lists it',async()=>{
 const s=setup();const {ws,hello}=await s.joined(started());
 s.client.answer(0,'Rembrandt');
 assert.deepEqual(ws.frames().slice(1),[{t:'answer',q:0,answer:'Rembrandt'}]);
 ws.serverClose();s.client.reconnect();
 const ws2=s.WS.last();ws2.open();
 s.welcome(ws2,{you:hello.player.id,events:[],progress:{q:0,answered:[hello.player.id],ready:[]}});
 assert.equal(ws2.frames().length,1);
});

test('an answer is not resent when the round was already revealed',async()=>{
 const s=setup();const {ws}=await s.joined(started());
 ws.serverClose();s.client.answer(0,'Rembrandt');s.client.reconnect();
 const ws2=s.WS.last();ws2.open();
 s.welcome(ws2,{events:[ev(5,'reveal',{q:0,answers:{}})]});
 assert.equal(ws2.frames().length,1);
 assert.equal(s.client.snapshot().myAnswers[0],'Rembrandt');
});

test('start, timeup, ready, force and leave are sent as protocol messages; offline sends are dropped',async()=>{
 const s=setup();const {ws}=await s.joined();
 const settings={count:3,seconds:20,title:'Q'},questions=[{id:'core:a',mode:'recall'}];
 assert.equal(s.client.start(settings,questions),true);s.client.timeup(0);s.client.ready(0);s.client.force(0);
 assert.deepEqual(ws.frames().slice(1),[{t:'start',settings,questions},{t:'timeup',q:0},{t:'ready',q:0},{t:'force',q:0}]);
 ws.serverClose();
 assert.equal(s.client.ready(1),false);
});

test('resume restores the saved game and reconnects with have',async()=>{
 const s=setup();const {hello}=await s.joined(started());
 s.client.answer(0,'Rembrandt');
 const fresh=setup({storage:s.storage});
 assert.equal(fresh.client.snapshot().name,'Ola');
 assert.equal(fresh.client.resume(),true);
 const snap=fresh.client.snapshot();
 assert.equal(snap.status,'reconnecting');assert.equal(snap.events.length,4);assert.equal(snap.room.code,'ABCD');
 assert.equal(snap.you,hello.player.id);assert.equal(snap.game.n,4);assert.deepEqual(snap.myAnswers,{0:'Rembrandt'});
 const ws=fresh.WS.last();ws.open();
 const h=ws.frames()[0];
 assert.equal(h.have,4);assert.equal(h.player.id,hello.player.id);assert.equal(h.key,hello.key);
 fresh.welcome(ws,{you:hello.player.id,events:[ev(5,'reveal',{q:0,answers:{}})]});
 assert.equal(fresh.client.snapshot().status,'online');assert.equal(fresh.client.snapshot().events.length,5);
 assert.equal(setup().client.resume(),false);
 const bad=memoryStorage();bad.setItem(STORAGE_KEY,'{nope');
 assert.equal(setup({storage:bad}).client.resume(),false);assert.equal(bad.getItem(STORAGE_KEY),null);
});

for(const code of ['no-room','version','full','started','name','key']){
 test(`fatal error ${code} stops reconnecting and is exposed`,async()=>{
  const s=setup();const p=s.client.join('abcd','Ola');const ws=s.WS.last();ws.open();
  ws.recv({t:'error',code,app:'2.0.0',pack:'p9'});
  await assert.rejects(p,{code});
  ws.serverClose();
  s.timers.advance(60000);
  assert.equal(s.WS.instances.length,1);
  const snap=s.client.snapshot();
  assert.equal(snap.status,'idle');assert.equal(snap.error.code,code);
  if(code==='version'){assert.equal(snap.error.app,'2.0.0');assert.equal(snap.error.pack,'p9');}
  assert.equal(s.storage.getItem(STORAGE_KEY),null);
  s.client.reconnect();assert.equal(s.WS.instances.length,1);
 });
}

test('a fatal error on a saved game stops reconnecting; no-room also forgets the game',async()=>{
 const s=setup();await s.joined(started());
 const kept=setup({storage:s.storage});kept.client.resume();
 let ws=kept.WS.last();ws.open();ws.recv({t:'error',code:'version',app:'2.0.0',pack:'p1'});ws.serverClose();
 kept.timers.advance(60000);
 assert.equal(kept.WS.instances.length,1);assert.equal(kept.client.snapshot().error.code,'version');
 assert.equal(kept.client.snapshot().status,'idle');assert.ok(kept.storage.getItem(STORAGE_KEY));
 const gone=setup({storage:s.storage});gone.client.resume();
 ws=gone.WS.last();ws.open();ws.recv({t:'error',code:'no-room'});ws.serverClose();
 gone.timers.advance(60000);
 assert.equal(gone.WS.instances.length,1);assert.equal(gone.client.snapshot().error.code,'no-room');
 assert.equal(gone.client.snapshot().room,null);assert.equal(gone.client.snapshot().events.length,0);
 assert.equal(gone.storage.getItem(STORAGE_KEY),null);
 assert.equal(gone.client.resume(),false);
});

test('ping every 25 s; a pong keeps the socket, 10 s of silence closes it and reconnects',async()=>{
 const s=setup();const {ws}=await s.joined();
 s.timers.advance(24999);assert.equal(ws.sent.includes('ping'),false);
 s.timers.advance(1);assert.equal(ws.sent.filter(x=>x==='ping').length,1);
 ws.recv('pong');s.timers.advance(10000);
 assert.equal(s.client.snapshot().status,'online');assert.equal(s.WS.instances.length,1);
 s.timers.advance(15000);assert.equal(ws.sent.filter(x=>x==='ping').length,2);
 s.timers.advance(9999);assert.equal(s.client.snapshot().status,'online');
 s.timers.advance(1);
 assert.equal(ws.readyState,3);assert.equal(s.client.snapshot().status,'reconnecting');
 s.timers.advance(500);
 assert.equal(s.WS.instances.length,2);
 const ws2=s.WS.last();ws2.open();assert.equal(ws2.frames()[0].have,2);
});

test('reconnect() on a live socket probes it with a ping',async()=>{
 const s=setup();const {ws}=await s.joined();
 s.client.reconnect();
 assert.equal(ws.sent.filter(x=>x==='ping').length,1);
 s.timers.advance(10000);
 assert.equal(s.client.snapshot().status,'reconnecting');
});

test('storage that throws never breaks the game',async()=>{
 const boom=()=>{throw new Error('quota');};
 const storage={getItem:boom,setItem:boom,removeItem:boom};
 const s=setup({storage});
 assert.equal(s.client.resume(),false);
 const {ws}=await s.joined(started());
 ws.recv({t:'event',event:ev(5,'reveal',{q:0,answers:{}})});
 assert.equal(s.client.snapshot().events.length,5);
 assert.equal(s.client.answer(0,'x'),true);
 ws.serverClose();s.timers.advance(500);
 assert.equal(s.WS.instances.length,2);
 s.client.leave();assert.equal(s.client.snapshot().status,'idle');
});

test('leave sends leave, closes and clears storage; forget only clears',async()=>{
 const s=setup();const {ws}=await s.joined(started());
 assert.ok(s.storage.getItem(STORAGE_KEY));
 s.client.leave();
 assert.deepEqual(ws.frames().at(-1),{t:'leave'});assert.equal(ws.readyState,3);
 assert.equal(s.storage.getItem(STORAGE_KEY),null);
 const snap=s.client.snapshot();
 assert.equal(snap.status,'idle');assert.equal(snap.room,null);assert.deepEqual(snap.events,[]);assert.equal(snap.game,null);
 assert.equal(s.timers.pending(),0);
 const t=setup();const {ws:w2}=await t.joined();
 t.client.forget();
 assert.equal(w2.frames().some(f=>f.t==='leave'),false);assert.equal(t.storage.getItem(STORAGE_KEY),null);assert.equal(t.client.snapshot().status,'idle');
});

test('destroy stops timers and the socket but keeps the saved game',async()=>{
 const s=setup();const {ws}=await s.joined();
 s.client.destroy();
 assert.equal(ws.readyState,3);assert.equal(s.timers.pending(),0);
 assert.ok(s.storage.getItem(STORAGE_KEY));
 s.timers.advance(60000);assert.equal(s.WS.instances.length,1);
 assert.equal(s.client.resume(),false);
});

test('subscribe gets the current snapshot first and can unsubscribe',async()=>{
 const s=setup();const seen=[];
 const off=s.client.subscribe(x=>seen.push(x.status));
 assert.deepEqual(seen,['idle']);
 await s.joined();off();const n=seen.length;
 s.WS.last().recv({t:'presence',online:[]});
 assert.equal(seen.length,n);
});

const voting=()=>[...lobby(),ev(3,'started',{settings:{count:3,seconds:20,title:''},questions:[{id:'core:w',mode:'open'}]}),ev(4,'question',{q:0,deadline:64000}),
 ev(5,'ballot',{q:0,deadline:40000,answers:{me:{answer:'mitt',ms:1},p2:{answer:'ditt',ms:2}}})];

test('a vote is saved, sent once while the vote is open, and only for someone else',async()=>{
 const s=setup();const {ws,hello}=await s.joined(voting());
 const me=hello.player.id;
 assert.equal(s.client.vote(0,me),false,'not for yourself');
 assert.equal(s.client.vote(0,''),false);
 assert.equal(s.client.vote(0,'p2'),true);
 assert.deepEqual(s.client.snapshot().myVotes,{0:'p2'});assert.deepEqual(saved(s).myVotes,{0:'p2'});
 assert.equal(s.client.vote(0,'p3'),false,'one vote, final');
 assert.deepEqual(ws.frames().slice(1),[{t:'vote',q:0,for:'p2'}]);
 // Not sent when no vote is open for that round.
 const t=setup();const {ws:w2}=await t.joined(started());
 assert.equal(t.client.vote(0,'p2'),true);
 assert.deepEqual(w2.frames().slice(1),[]);
});

test('a vote given offline is resent after welcome while the vote is open and the room has not registered it',async()=>{
 const s=setup();const {ws,hello}=await s.joined(voting());
 ws.serverClose();
 s.client.vote(0,'p2');
 s.client.reconnect();
 const ws2=s.WS.last();ws2.open();
 s.welcome(ws2,{you:hello.player.id,events:[],progress:{q:0,answered:[hello.player.id,'p2'],voted:[],ready:[]}});
 assert.deepEqual(ws2.frames().slice(1),[{t:'vote',q:0,for:'p2'}]);
 // Registered already: not sent again.
 ws2.serverClose();s.client.reconnect();
 const ws3=s.WS.last();ws3.open();
 s.welcome(ws3,{you:hello.player.id,events:[],progress:{q:0,answered:[hello.player.id,'p2'],voted:[hello.player.id],ready:[]}});
 assert.equal(ws3.frames().length,1);
 // The vote closed while away: not sent.
 ws3.serverClose();s.client.reconnect();
 const ws4=s.WS.last();ws4.open();
 s.welcome(ws4,{you:hello.player.id,events:[ev(6,'reveal',{q:0,answers:{},votes:{}})]});
 assert.equal(ws4.frames().length,1);
 assert.equal(s.client.snapshot().myVotes[0],'p2');
});

test('an answer is not resent once the round has gone to the vote',async()=>{
 const s=setup();const {ws}=await s.joined(voting().slice(0,4));
 ws.serverClose();s.client.answer(0,'Fordi');s.client.reconnect();
 const ws2=s.WS.last();ws2.open();
 s.welcome(ws2,{events:[voting()[4]]});
 assert.equal(ws2.frames().length,1);
});

test('resume restores votes; a saved game without votes resumes, and one that cannot be read is forgotten',async()=>{
 const s=setup();await s.joined(voting());
 s.client.vote(0,'p2');
 const fresh=setup({storage:s.storage});
 assert.equal(fresh.client.resume(),true);
 assert.deepEqual(fresh.client.snapshot().myVotes,{0:'p2'});
 const old=memoryStorage();
 const {myVotes,...before}=saved(s);
 old.setItem(STORAGE_KEY,JSON.stringify(before));
 const o=setup({storage:old});
 assert.equal(o.client.resume(),true);assert.deepEqual(o.client.snapshot().myVotes,{});
 for(const broken of [{...before,events:[null]},{...before,events:[{t:'joined'}]},{...before,myVotes:[1],myAnswers:'x'}]){
  const b=memoryStorage();b.setItem(STORAGE_KEY,JSON.stringify(broken));
  const c=setup({storage:b});
  if(broken.myVotes){assert.equal(c.client.resume(),true);assert.deepEqual([c.client.snapshot().myVotes,c.client.snapshot().myAnswers],[{},{}]);}
  else{assert.equal(c.client.resume(),false);assert.equal(b.getItem(STORAGE_KEY),null);}
 }
 assert.equal(setup().client.vote(0,'p2'),false,'no game, no vote');
});
