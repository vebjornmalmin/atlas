import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_POINTS,SPEED_POINTS,WIN_POINTS,initialGame,applyEvent,replay,scoreboard,activePlayers,currentQuestion,roundFor,isHost,ballotOrder,tally,winners} from '../src/lib/quizoff/game.js';
const room={code:'ABCD',app:'1.0.0',pack:'p1'};
const QS=[{id:'core:a',mode:'recognition'},{id:'core:b',mode:'recall'},{id:'core:c',mode:'recall'}];
// the answer text "ok" is correct, anything else is wrong
const grade=(q,a)=>a==='ok';
const deepFreeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;};
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const P=(id,name)=>({id,name});
function fullLog(){
 let seq=0;const e=x=>({seq:++seq,at:seq*1000,...x});
 return [
  e({t:'joined',player:P('a','Ola')}),e({t:'joined',player:P('b','Kari')}),e({t:'joined',player:P('c','Per')}),
  e({t:'started',settings:{count:3,seconds:20,title:'T'},questions:QS}),
  e({t:'question',q:0,deadline:50000}),
  e({t:'reveal',q:0,answers:{a:{answer:'ok',ms:0},b:{answer:'ok',ms:10000},c:{answer:'no',ms:5000}}}),
  e({t:'question',q:1,deadline:90000}),
  e({t:'reveal',q:1,answers:{a:{answer:'no',ms:1000},b:{answer:'ok',ms:20000}}}),
  e({t:'question',q:2,deadline:130000}),
  e({t:'reveal',q:2,answers:{a:{answer:'ok',ms:4000},b:{answer:'ok',ms:4000}}}),
  e({t:'finished'})];
}
const run=(events)=>events.reduce((g,ev)=>applyEvent(g,ev,grade),initialGame(room,'a'));
test('a full three player, three question game gives the expected scores and ranks',()=>{
 const g=run(fullLog());
 assert.equal(g.phase,'finished');assert.equal(g.seq,11);assert.equal(g.gap,false);assert.equal(g.code,'ABCD');
 assert.deepEqual(g.scores.a,{points:150+140,correct:2,ms:4000});
 assert.deepEqual(g.scores.b,{points:125+100+140,correct:3,ms:34000});
 assert.deepEqual(g.scores.c,{points:0,correct:0,ms:0});
 const sb=scoreboard(g);
 assert.deepEqual(sb.map(r=>[r.id,r.points,r.correct,r.rank]),[['b',365,3,1],['a',290,2,2],['c',0,0,3]]);
 assert.equal(g.rounds.length,3);
 assert.deepEqual(roundFor(g,0).answers.c,{answer:'no',ms:5000,correct:false,points:0});
 assert.equal(roundFor(g,5),null);
});
test('points: correct answers get base plus speed bonus, wrong or missing get nothing',()=>{
 assert.equal(BASE_POINTS,100);assert.equal(SPEED_POINTS,50);
 const pts=ms=>{let g=run(fullLog().slice(0,5));g=applyEvent(g,{seq:6,at:1,t:'reveal',q:0,answers:{a:{answer:'ok',ms}}},grade);return g.scores.a.points;};
 assert.equal(pts(0),150);assert.equal(pts(10000),125);assert.equal(pts(20000),100);
 assert.equal(pts(99999),100);
 const g=run(fullLog().slice(0,5));
 const r=applyEvent(g,{seq:6,at:1,t:'reveal',q:0,answers:{a:{answer:'wrong',ms:0}}},grade);
 assert.equal(r.scores.a.points,0);assert.equal(r.scores.b.points,0);
});
test('grade is called once per revealed answer with the question entry',()=>{
 const calls=[];const g0=run(fullLog().slice(0,5));
 applyEvent(g0,fullLog()[5],(q,a)=>{calls.push([q,a]);return true;});
 assert.equal(calls.length,3);assert.deepEqual(calls[0][0],QS[0]);
});
test('duplicate and already seen seq are ignored',()=>{
 const log=fullLog();const g=run(log.slice(0,6));
 assert.equal(applyEvent(g,log[5],grade),g);assert.equal(applyEvent(g,log[1],grade),g);
 assert.deepEqual(run([...log.slice(0,6),log[5],log[2]]),g);
});
test('a jump in seq sets gap and applies nothing',()=>{
 const log=fullLog();const g=run(log.slice(0,3));
 const h=applyEvent(g,log[5],grade);
 assert.equal(h.gap,true);assert.equal(h.seq,3);assert.deepEqual({...h,gap:false},g);
 assert.equal(g.gap,false);
 const ok=applyEvent(h,log[3],grade);assert.equal(ok.gap,false);assert.equal(ok.seq,4);
 assert.equal(replay(room,'a',[log[0],log[1],log[4]],grade).gap,true);
});
test('replay equals ordered application for shuffled and duplicated input',()=>{
 const log=fullLog();const want=run(log);
 assert.deepEqual(replay(room,'a',log,grade),want);
 for(let s=1;s<=20;s++){
  const r=rng(s);const dup=[...log,...log.filter(()=>r()<.5)];
  assert.deepEqual(replay(room,'a',shuffle(dup,r),grade),want);
 }
 assert.equal(replay(room,'a',[],grade).seq,0);
});
test('host is the first joined player who has not left',()=>{
 const log=fullLog();
 let g=run(log.slice(0,3));assert.equal(g.host,'a');assert.ok(isHost(g,'a'));assert.ok(!isHost(g,'b'));
 g=applyEvent(g,{seq:4,at:1,t:'left',player:'a'},grade);
 assert.equal(g.host,'b');assert.deepEqual(activePlayers(g).map(p=>p.id),['b','c']);
 assert.equal(g.players[0].left,true);
 g=applyEvent(g,{seq:5,at:1,t:'left',player:'b'},grade);assert.equal(g.host,'c');
 g=applyEvent(g,{seq:6,at:1,t:'left',player:'c'},grade);assert.equal(g.host,null);
 assert.equal(isHost(g,null),false);
});
test('lobby, question and reveal phases and selectors',()=>{
 const log=fullLog();
 let g=run(log.slice(0,3));assert.equal(g.phase,'lobby');assert.equal(currentQuestion(g),null);
 g=run(log.slice(0,4));assert.equal(g.phase,'lobby');assert.deepEqual(g.settings,{count:3,seconds:20,title:'T'});assert.deepEqual(g.questions,QS);
 g=run(log.slice(0,5));assert.equal(g.phase,'question');assert.equal(g.q,0);assert.equal(g.openedAt,5000);assert.equal(g.deadline,50000);
 assert.deepEqual(currentQuestion(g),QS[0]);
 g=run(log.slice(0,6));assert.equal(g.phase,'reveal');
 g=run(log.slice(0,7));assert.deepEqual(currentQuestion(g),QS[1]);assert.equal(g.phase,'question');
});
test('ties share a rank; order is points, time of correct answers, name in nb order, id',()=>{
 const mk=(players,scores)=>({...initialGame(room,'x'),players:players.map(([id,name])=>({id,name,left:false})),scores});
 const z=(points,ms)=>({points,correct:1,ms});
 // same points: faster first; equal both: name; Å, Ø, Æ sort after Z in nb
 const g=mk([['1','Åse'],['2','Øyvind'],['3','Ægir'],['4','Zoe'],['5','Anna'],['6','Bo'],['7','Bo'],['8','Cid']],
  {1:z(100,500),2:z(100,500),3:z(100,500),4:z(100,500),5:z(100,500),6:z(100,200),7:z(100,200),8:z(150,9000)});
 const sb=scoreboard(g);
 assert.deepEqual(sb.map(r=>r.name),['Cid','Bo','Bo','Anna','Zoe','Ægir','Øyvind','Åse']);
 assert.deepEqual(sb.map(r=>r.id),['8','6','7','5','4','3','2','1']);
 assert.deepEqual(sb.map(r=>r.rank),[1,2,2,4,4,4,4,4]);
 const t=scoreboard(mk([['x','Ola'],['y','Kari']],{x:z(100,1),y:z(100,2)}));
 assert.deepEqual(t.map(r=>r.rank),[1,2]);
 // players without scores count as zero and a left player stays on the board
 const l=scoreboard({...mk([['x','Ola'],['y','Kari']],{}),players:[{id:'x',name:'Ola',left:true},{id:'y',name:'Kari',left:false}]});
 assert.deepEqual(l.map(r=>[r.id,r.left,r.points,r.rank]),[['y',false,0,1],['x',true,0,1]]);
});
test('a player who answered nothing scores zero and stays in the board',()=>{
 const g=run(fullLog());assert.deepEqual(roundFor(g,1).answers.c,undefined);
 assert.equal(scoreboard(g).find(r=>r.id==='c').points,0);
});
test('input game and events are never mutated',()=>{
 const log=deepFreeze(fullLog());let g=deepFreeze(initialGame(room,'a'));
 for(const ev of log)g=deepFreeze(applyEvent(g,ev,grade));
 assert.equal(g.phase,'finished');
 deepFreeze(room);
 assert.deepEqual(replay(room,'a',log,grade),g);
 assert.doesNotThrow(()=>applyEvent(g,{seq:99,at:1,t:'finished'},grade));
 assert.doesNotThrow(()=>scoreboard(g));
});

// Open questions: a ballot, then a reveal with the votes.
const OQ=[{id:'core:o',mode:'open'},{id:'core:b',mode:'recall'},{id:'core:p',mode:'open'}];
function openLog(answers,votes,{ballot=Object.keys(answers).length>1}={}){
 let seq=0;const e=x=>({seq:++seq,at:seq*1000,...x});
 const log=[e({t:'joined',player:P('a','Ola')}),e({t:'joined',player:P('b','Kari')}),e({t:'joined',player:P('c','Per')}),e({t:'joined',player:P('d','Åse')}),
  e({t:'started',settings:{count:3,seconds:20,title:'T'},questions:OQ}),e({t:'question',q:0,deadline:66000})];
 if(ballot)log.push(e({t:'ballot',q:0,answers,deadline:seq*1000+31000}));
 log.push(e({t:'reveal',q:0,answers,votes}));
 return log;
}
const A=(...ids)=>Object.fromEntries(ids.map((id,i)=>[id,{answer:`svar ${id}`,ms:(i+1)*7000}]));
test('a ballot opens the vote phase with its deadline, the answers and one order for every phone',()=>{
 const log=openLog(A('a','b','c'),{});
 const g=run(log.slice(0,7));
 assert.equal(g.phase,'vote');assert.equal(g.q,0);assert.equal(g.deadline,log[6].deadline);
 assert.deepEqual(g.ballot.answers,A('a','b','c'));assert.equal(g.ballot.at,7000);
 assert.deepEqual([...g.ballot.order].sort(),['a','b','c']);
 assert.deepEqual(g.ballot.order,run(log.slice(0,7)).ballot.order);
 assert.deepEqual(g.ballot.order,ballotOrder(log[6]));
 // Over many ballots the order is not the player list.
 const ids=['a','b','c','d','e','f'];let same=0;
 for(let at=0;at<50;at++)if(ballotOrder({q:0,at,answers:A(...ids)}).join()===ids.join())same++;
 assert.ok(same<5,`order followed the player list ${same} times of 50`);
 assert.equal(run(log.slice(0,6)).ballot,null);
});
test('open reveal: the most votes win 150 points, no speed bonus, and count as right without adding time',()=>{
 assert.equal(WIN_POINTS,BASE_POINTS+SPEED_POINTS);
 const g=run(openLog(A('a','b','c'),{a:'b',b:'a',c:'b',d:'b'}));
 assert.equal(g.phase,'reveal');
 assert.deepEqual(roundFor(g,0),{q:0,open:true,votes:{a:'b',b:'a',c:'b',d:'b'},answers:{
  a:{answer:'svar a',ms:7000,correct:false,points:0,votes:1},
  b:{answer:'svar b',ms:14000,correct:true,points:150,votes:3},
  c:{answer:'svar c',ms:21000,correct:false,points:0,votes:0}}});
 assert.deepEqual(g.scores.b,{points:150,correct:1,ms:0});
 assert.deepEqual(g.scores.a,{points:0,correct:0,ms:0});
 assert.deepEqual(scoreboard(g).map(r=>[r.id,r.points,r.correct,r.rank]),[['b',150,1,1],['a',0,0,2],['c',0,0,2],['d',0,0,2]]);
});
test('open reveal: every answer that shares the most votes wins',()=>{
 const g=run(openLog(A('a','b','c','d'),{a:'b',b:'a',c:'a',d:'b'}));
 assert.deepEqual(Object.entries(roundFor(g,0).answers).filter(([,x])=>x.correct).map(([id])=>id),['a','b']);
 assert.equal(g.scores.a.points,150);assert.equal(g.scores.b.points,150);assert.equal(g.scores.c.points,0);
 // Two players who both answered can only vote for each other: one vote each, both win.
 const two=run(openLog(A('a','b'),{a:'b',b:'a'}));
 assert.deepEqual(Object.values(roundFor(two,0).answers).map(x=>[x.votes,x.correct,x.points]),[[1,true,150],[1,true,150]]);
});
test('open reveal: a lone answer wins without a vote; no answers or no votes give no winner',()=>{
 const one=run(openLog(A('c'),{}));
 assert.ok(!one.ballot && one.phase==='reveal');
 assert.deepEqual(roundFor(one,0).answers.c,{answer:'svar c',ms:7000,correct:true,points:150,votes:0});
 const none=run(openLog({},{}));
 assert.deepEqual(roundFor(none,0).answers,{});
 assert.ok(Object.values(none.scores).every(s=>s.points===0));
 const silent=run(openLog(A('a','b','c'),{}));
 assert.ok(Object.values(roundFor(silent,0).answers).every(x=>!x.correct && x.votes===0));
 assert.deepEqual(winners(A('a','b'),{}),[]);
});
test('votes for yourself or for a player without an answer are not counted',()=>{
 assert.deepEqual(tally(A('a','b'),{a:'a',b:'zz',c:'a',d:'b'}),{a:1,b:1});
 const g=run(openLog(A('a','b','c'),{a:'a',b:'d',c:'a'}));
 assert.deepEqual(Object.values(roundFor(g,0).answers).map(x=>x.votes),[1,0,0]);
 assert.equal(g.scores.a.points,150);
});
test('open answers are never graded, and an open game replays the same on every phone',()=>{
 const calls=[];
 const log=openLog(A('a','b','c'),{a:'b',b:'c',c:'b'});
 const g=log.reduce((x,ev)=>applyEvent(x,ev,(q,a)=>{calls.push(a);return true;}),initialGame(room,'a'));
 assert.equal(calls.length,0);
 assert.equal(g.scores.b.points,150);
 const want=replay(room,'a',log,grade);
 for(let s=1;s<=10;s++){const r=rng(s);assert.deepEqual(replay(room,'a',shuffle([...log,...log.filter(()=>r()<.5)],r),grade),want);}
 const next=applyEvent(want,{seq:log.length+1,at:1,t:'question',q:1,deadline:9},grade);
 assert.equal(next.ballot,null);assert.equal(next.phase,'question');
 deepFreeze(log);assert.doesNotThrow(()=>replay(room,'a',log,grade));
});
