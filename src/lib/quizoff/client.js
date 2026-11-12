export const STORAGE_KEY='atlas-quizoff';
export const NAME_KEY='atlas-quizoff-name';
export const BACKOFF_MIN=500,BACKOFF_MAX=8000,PING_EVERY=25000,PONG_WAIT=10000;
const FATAL=new Set(['no-room','version','full','started','name','key']);
// The room holds answers to closed questions to 200 characters and open ones to 400.
const ANSWER_LIMIT=400;
const OPEN=1;
const hex=bytes=>Array.from(bytes,b=>(b&255).toString(16).padStart(2,'0')).join('');
function defaultRandom(n){const out=new Uint8Array(n);globalThis.crypto.getRandomValues(out);return out;}
function uuid(random){const b=Array.from(random(16),x=>x&255);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=hex(b);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
// random(n) returns n random bytes (array-like of 0..255); ids and keys are made from them.
export function createQuizoffClient({origin,app,pack,storage,WebSocketImpl,fetchImpl,reduce,now=Date.now,random=defaultRandom,timers}) {
 const T={
  setTimeout:(...a)=>(timers?.setTimeout||globalThis.setTimeout)(...a),clearTimeout:(...a)=>(timers?.clearTimeout||globalThis.clearTimeout)(...a),
  setInterval:(...a)=>(timers?.setInterval||globalThis.setInterval)(...a),clearInterval:(...a)=>(timers?.clearInterval||globalThis.clearInterval)(...a)
 };
 const base=String(origin||'').replace(/\/+$/,'');
 const subscribers=new Set();
 let status='idle',error=null,room=null,you=null,player=null,key=null,name='',events=[],game=null,online=[],progress=null,offset=0,myAnswers={},myVotes={};
 let hasGame=false,destroyed=false,sock=null,pending=null,attempts=0,reconnectTimer=null,pingTimer=null,pongTimer=null,snap=null;
 const store={
  get(k){try{return storage?.getItem(k)??null;}catch{return null;}},
  set(k,v){try{storage?.setItem(k,v);}catch{}},
  del(k){try{storage?.removeItem(k);}catch{}}
 };
 name=store.get(NAME_KEY)||'';
 function build(){return {status,error,room,you,name,events,game,online,progress,offset,myAnswers,myVotes};}
 function emit(){snap=build();for(const fn of [...subscribers]){try{fn(snap);}catch{}}}
 function save(){
  if(!hasGame||!room||!player)return;
  store.set(STORAGE_KEY,JSON.stringify({room,player,key,events,myAnswers,myVotes}));
 }
 function recompute(){
  if(!reduce||!room)return;
  try{game=reduce(room,you,events);}catch{}
 }
 function lastSeq(){return events.length?events[events.length-1].seq:0;}
 // Appends in order; returns {changed,gap}. Duplicates are skipped, a missing seq stops the merge.
 function addEvents(list){
  let changed=false,gap=false;
  const sorted=(Array.isArray(list)?list:[]).filter(e=>e && Number.isInteger(e.seq)).sort((a,b)=>a.seq-b.seq);
  for(const ev of sorted){
   const last=lastSeq();
   if(ev.seq<=last)continue;
   if(ev.seq!==last+1){gap=true;break;}
   events=events.concat([ev]);changed=true;
  }
  return {changed,gap};
 }
 function clearTimers(){
  if(reconnectTimer!==null){T.clearTimeout(reconnectTimer);reconnectTimer=null;}
  stopPing();
 }
 function stopPing(){
  if(pingTimer!==null){T.clearInterval(pingTimer);pingTimer=null;}
  if(pongTimer!==null){T.clearTimeout(pongTimer);pongTimer=null;}
 }
 function closeSocket(){
  const ws=sock;sock=null;stopPing();
  if(ws){ws.onopen=ws.onmessage=ws.onclose=ws.onerror=null;try{ws.close();}catch{}}
 }
 function send(msg){
  const ws=sock;
  if(!ws||ws.readyState!==OPEN||status!=='online')return false;
  try{ws.send(typeof msg==='string'?msg:JSON.stringify(msg));return true;}catch{return false;}
 }
 function settle(ok,value){
  const p=pending;pending=null;
  if(p)(ok?p.resolve:p.reject)(value);
 }
 function resetState(){
  status='idle';room=null;you=null;player=null;key=null;events=[];game=null;online=[];progress=null;offset=0;myAnswers={};myVotes={};hasGame=false;attempts=0;
 }
 function fatal(info){
  closeSocket();clearTimers();
  error=info;status='idle';online=[];
  if(!hasGame||info.code==='no-room'){
   if(hasGame)store.del(STORAGE_KEY);
   resetState();error=info;
  }
  emit();settle(false,info);
 }
 function nextDelay(){const d=Math.min(BACKOFF_MAX,BACKOFF_MIN*2**attempts);attempts++;return d;}
 function schedule(delay){
  if(destroyed||!hasGame)return;
  if(reconnectTimer!==null)T.clearTimeout(reconnectTimer);
  status='reconnecting';
  reconnectTimer=T.setTimeout(()=>{reconnectTimer=null;connect();},delay);
  emit();
 }
 // Socket gone (close, error, dead, resync): drop it and retry, or fail if the game was never joined.
 function dropped(immediate=false){
  closeSocket();online=[];
  if(destroyed)return;
  if(!hasGame){fatal({code:'unreachable'});return;}
  schedule(immediate?0:nextDelay());
 }
 function replaced(){
  closeSocket();clearTimers();online=[];status='idle';error={code:'replaced'};emit();
 }
 function connect(){
  if(destroyed||!player)return;
  if(reconnectTimer!==null){T.clearTimeout(reconnectTimer);reconnectTimer=null;}
  closeSocket();
  status=hasGame?'reconnecting':'connecting';
  let ws;
  try{ws=new WebSocketImpl(`${base.replace(/^http/,'ws')}/api/quizoff/rooms/${encodeURIComponent(room?.code||pendingCode)}/ws`);}
  catch{dropped();return;}
  sock=ws;
  ws.onopen=()=>{
   if(sock!==ws)return;
   try{ws.send(JSON.stringify({t:'hello',v:1,player,key,app,pack,have:lastSeq()}));}catch{dropped();}
  };
  ws.onmessage=e=>{if(sock===ws)handle(e.data);};
  // 4000: this player opened the game somewhere else. Reconnecting would make the two take turns closing each other.
  ws.onclose=e=>{if(sock!==ws)return;if(e?.code===4000)return replaced();dropped();};
  ws.onerror=()=>{if(sock===ws)dropped();};
  emit();
 }
 let pendingCode='';
 function startPing(){
  stopPing();
  pingTimer=T.setInterval(probe,PING_EVERY);
 }
 function probe(){
  const ws=sock;
  if(!ws||status!=='online'||ws.readyState!==OPEN)return;
  try{ws.send('ping');}catch{dropped();return;}
  if(pongTimer===null)pongTimer=T.setTimeout(()=>{pongTimer=null;dropped();},PONG_WAIT);
 }
 function handle(data){
  if(typeof data!=='string')return;
  if(data==='pong'){if(pongTimer!==null){T.clearTimeout(pongTimer);pongTimer=null;}return;}
  let msg;try{msg=JSON.parse(data);}catch{return;}
  if(!msg||typeof msg!=='object')return;
  switch(msg.t){
   case 'welcome':return onWelcome(msg);
   case 'event':return onEvent(msg.event);
   case 'presence':online=Array.isArray(msg.online)?msg.online:[];return emit();
   case 'progress':progress={q:msg.q,answered:msg.answered||[],voted:msg.voted||[],ready:msg.ready||[]};return emit();
   case 'error':{
    if(!FATAL.has(msg.code))return;
    const {t,...info}=msg;return fatal(info);
   }
  }
 }
 function onWelcome(msg){
  room=msg.room||room;
  const id=typeof msg.you==='object'&&msg.you?msg.you.id:msg.you;
  you=id||player.id;
  offset=(Number.isFinite(msg.now)?msg.now:now())-now();
  online=Array.isArray(msg.online)?msg.online:[];
  progress=msg.progress?{voted:[],...msg.progress}:null;
  const {gap}=addEvents(msg.events);
  hasGame=true;error=null;status='online';
  recompute();
  if(gap||game?.gap){save();emit();dropped();return;}
  attempts=0;
  save();startPing();emit();
  resend();
  settle(true,snap);
 }
 function onEvent(ev){
  if(!room)return;
  const {changed,gap}=addEvents([ev]);
  if(gap){dropped(true);return;}
  if(!changed)return;
  recompute();
  if(game?.gap){dropped(true);return;}
  save();emit();
 }
 // Open question = last `question` event without a later `ballot` or `reveal`.
 function openQuestion(){
  for(let i=events.length-1;i>=0;i--){
   const e=events[i];
   if(['reveal','ballot'].includes(e.t||e.type))return null;
   if(e.t==='question'||e.type==='question')return e.q;
  }
  return null;
 }
 // Open vote = last `ballot` event without a later `reveal` or `question`.
 function openVote(){
  for(let i=events.length-1;i>=0;i--){
   const t=events[i].t||events[i].type;
   if(t==='reveal'||t==='question')return null;
   if(t==='ballot')return events[i].q;
  }
  return null;
 }
 // After welcome: what this phone gave while away, unless the room already has it.
 function resend(){
  const q=openQuestion();
  if(q!==null&&Object.hasOwn(myAnswers,q)&&!(progress?.q===q&&progress.answered?.includes(you)))send({t:'answer',q,answer:myAnswers[q]});
  const v=openVote();
  if(v!==null&&Object.hasOwn(myVotes,v)&&!(progress?.q===v&&progress.voted?.includes(you)))send({t:'vote',q:v,for:myVotes[v]});
 }
 function begin(code,playerName){
  closeSocket();clearTimers();
  const wasSaved=hasGame;
  if(wasSaved)store.del(STORAGE_KEY);
  resetState();error=null;
  name=playerName;store.set(NAME_KEY,name);
  player={id:uuid(random),name:name};key=hex(random(24));
  pendingCode=code;
  settle(false,{code:'cancelled'});
  return new Promise((resolve,reject)=>{pending={resolve,reject};});
 }
 function cleanName(n){return String(n??'').trim();}
 const api={
  subscribe(fn){subscribers.add(fn);try{fn(snap||(snap=build()));}catch{}return()=>subscribers.delete(fn);},
  snapshot(){return snap||(snap=build());},
  create(playerName){
   const p=begin('',cleanName(playerName));
   status='connecting';emit();
   (async()=>{
    try{
     const res=await fetchImpl(`${base}/api/quizoff/rooms`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app,pack})});
     if(!pending)return;
     if(res.status!==201&&!res.ok)return fatal({code:'create-failed',status:res.status});
     const data=await res.json();
     if(!pending)return;
     const code=String(data?.code||'').toUpperCase();
     if(!code)return fatal({code:'create-failed'});
     pendingCode=code;connect();
    }catch{if(pending)fatal({code:'unreachable'});}
   })();
   return p;
  },
  join(code,playerName){
   const p=begin(String(code??'').trim().toUpperCase(),cleanName(playerName));
   connect();
   return p;
  },
  // Restores the saved game and reconnects. Returns true when there was one.
  resume(){
   if(destroyed)return false;
   if(hasGame&&sock)return true;
   const raw=store.get(STORAGE_KEY);
   if(!raw)return false;
   let saved;try{saved=JSON.parse(raw);}catch{store.del(STORAGE_KEY);return false;}
   // A game this version cannot read is forgotten rather than half restored.
   if(!saved?.room?.code||!saved.player?.id||!saved.key||!Array.isArray(saved.events)||!saved.events.every(e=>e&&typeof e==='object'&&Number.isInteger(e.seq))){store.del(STORAGE_KEY);return false;}
   closeSocket();clearTimers();
   room=saved.room;player=saved.player;you=player.id;key=saved.key;name=player.name||name;
   const map=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
   events=saved.events;myAnswers=map(saved.myAnswers);myVotes=map(saved.myVotes);
   online=[];progress=null;error=null;attempts=0;hasGame=true;
   recompute();connect();
   return true;
  },
  start(settings,questions){return send({t:'start',settings,questions});},
  answer(q,answer){
   if(!hasGame)return false;
   const text=String(answer??'').trim().slice(0,ANSWER_LIMIT);
   if(!text||Object.hasOwn(myAnswers,q))return false;
   myAnswers={...myAnswers,[q]:text};
   save();emit();
   if(openQuestion()===q)send({t:'answer',q,answer:text});
   return true;
  },
  // One vote per round, for another player's answer; kept like an answer and resent after a reconnect while the vote is open.
  vote(q,target){
   if(!hasGame||typeof target!=='string'||!target||target===you||Object.hasOwn(myVotes,q))return false;
   myVotes={...myVotes,[q]:target};
   save();emit();
   if(openVote()===q)send({t:'vote',q,for:target});
   return true;
  },
  timeup(q){return send({t:'timeup',q});},
  ready(q){return send({t:'ready',q});},
  force(q){return send({t:'force',q});},
  leave(){send({t:'leave'});api.forget();},
  forget(){
   closeSocket();clearTimers();
   store.del(STORAGE_KEY);
   resetState();error=null;
   settle(false,{code:'cancelled'});
   emit();
  },
  // Retry now (visibilitychange/online): skips the wait, or checks a socket that looks alive.
  reconnect(){
   if(destroyed||!hasGame||!player)return;
   if(error?.code==='replaced'){error=null;return connect();}
   if(error)return;
   if(reconnectTimer!==null||!sock)return connect();
   if(status==='online')probe();
  },
  destroy(){
   destroyed=true;closeSocket();clearTimers();subscribers.clear();
  }
 };
 return api;
}
