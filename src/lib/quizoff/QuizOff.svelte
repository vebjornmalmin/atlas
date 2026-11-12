<script>
  import {onMount,tick,untrack} from 'svelte';
  import {createQuizoffClient} from './client.js';
  import {replay,scoreboard,activePlayers,currentQuestion,roundFor,isHost} from './game.js';
  import {quizoffDomains,quizoffPool,pickQuestions,buildQuestion,gradeQuizoff,answerLabel,revealInfo} from './questions.js';
  import {cleanName,isRoomCode,NAME_MAX,MIN_PLAYERS,MAX_PLAYERS,COUNT_MIN,FORCE_AFTER,VOTE_SECONDS,CODE_LENGTH} from './protocol.js';
  import {buildRecognitionIndex} from '../exercises.js';
  import {inviteUrl,inviteText} from './invite.js';
  import {qrCode,qrPath} from './qr.js';

  // pack: the installed knowledge pack. onstate reports {inGame,phase,code,question,total,status} to the page.
  // invite: {code} from a join link (code '' when the link had no valid code), or null.
  let {pack,knownNames=null,index=null,appVersion,invite=null,onexit=()=>{},onstate=()=>{}}=$props();

  // What only this phone needs to get back to the exact place: a typed but unsent answer and "Neste" tapped.
  const LOCAL_KEY='atlas-quizoff-local',SETUP_KEY='atlas-quizoff-setup';
  const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)) || null;}catch{return null;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Works without; only the draft is lost on reopening. */}};
  const COUNTS=[5,10,15],SECONDS=[15,20,30];

  // Fixed for the life of the screen: every phone in a game must grade with the same cards.
  const fixed=untrack(()=>({pack,index,appVersion,knownNames}));
  const targets=fixed.pack.targets || [];
  const byId=new Map(targets.map(t=>[t.id,t]));
  const recognition=fixed.index || buildRecognitionIndex(targets);
  const grade=(entry,answer)=>gradeQuizoff(entry,byId,answer,fixed.knownNames);
  const domains=quizoffDomains(fixed.pack,targets);

  const client=createQuizoffClient({origin:location.origin,app:fixed.appVersion,pack:fixed.pack.version,storage:localStorage,WebSocketImpl:WebSocket,fetchImpl:fetch.bind(globalThis),reduce:(room,you,events)=>replay(room,you,events,grade)});
  let snap=$state.raw(client.snapshot());
  const unsubscribe=client.subscribe(next=>{snap=next;});
  const resumed=client.resume();

  // A join link: the same game as the saved one just resumes it; another game waits until the player chooses.
  // The page removes the code from the address at once, so an invitation not yet used is kept for this tab:
  // updating the app (a reload) before joining must come back to the same join step.
  const PENDING_KEY='atlas-quizoff-invite';
  const pending=()=>{try{const code=sessionStorage.getItem(PENDING_KEY);return isRoomCode(code)?{code}:null;}catch{return null;}};
  const link=untrack(()=>invite) ?? pending();
  const saved=resumed?client.snapshot():null;
  if(link?.code && saved?.game?.phase==='finished' && saved.room.code!==link.code)client.forget(); // Nothing left to keep in a finished game.
  const kept=resumed && client.snapshot().room;
  let invited=$state(link?.code && link.code!==client.snapshot().room?.code?link.code:'');
  let conflict=$state(Boolean(invited && kept));
  $effect(()=>{try{if(invited)sessionStorage.setItem(PENDING_KEY,invited);else sessionStorage.removeItem(PENDING_KEY);}catch{/* Without it the invitation is only lost on a reload. */}});

  let nameField=$state(client.snapshot().name || '');
  let codeField=$state('');
  let formError=$state(link && !link.code && !kept?'Lenken har ingen gyldig kode. Skriv koden du fikk, eller start et spill.':'');
  let attempt=$state('');
  let notice=$state('');
  let now=$state(Date.now());
  let confirmLeave=$state(false);
  let announce=$state('');
  const savedSetup=readJson(SETUP_KEY) || {};
  let setup=$state({domain:domains.some(d=>d.id===savedSetup.domain)?savedSetup.domain:'',count:COUNTS.includes(savedSetup.count)?savedSetup.count:10,seconds:SECONDS.includes(savedSetup.seconds)?savedSetup.seconds:20,form:['recognition','open'].includes(savedSetup.form)?savedSetup.form:'mixed'});
  $effect(()=>{writeJson(SETUP_KEY,{...setup});});

  let local=$state(readJson(LOCAL_KEY) || {});
  const keepLocal=next=>{local=next;writeJson(LOCAL_KEY,next);};

  let game=$derived(snap.game);
  let code=$derived(snap.room?.code || '');
  let you=$derived(snap.you);
  let phase=$derived(snap.error?.code==='replaced'?'replaced':game && snap.room?game.phase:'start');
  let players=$derived(game?activePlayers(game):[]);
  let host=$derived(game?.players.find(p=>p.id===game.host) || null);
  let amHost=$derived(Boolean(game && isHost(game,you)));
  let canStart=$derived(amHost || Boolean(host && !snap.online.includes(host.id)));
  let total=$derived(game?.settings?.count || 0);
  let q=$derived(game?.q ?? -1);
  let entry=$derived(game?currentQuestion(game):null);
  let question=$derived(entry?buildQuestion(entry,byId,targets,recognition):null);
  let myAnswer=$derived(q>=0 && Object.hasOwn(snap.myAnswers,q)?snap.myAnswers[q]:null);
  let timed=$derived(phase==='question' || phase==='vote');
  let remaining=$derived(game?.deadline?Math.max(0,game.deadline-(now+snap.offset)):0);
  let timeUp=$derived(timed && remaining<=0);
  // The whole of the running phase, for the timer bar: the question's own length, or the vote's.
  let phaseLength=$derived(phase==='vote'?VOTE_SECONDS*1000:game?.deadline && game.openedAt!==null?game.deadline-game.openedAt:1);
  let progress=$derived(snap.progress && snap.progress.q===q?{voted:[],...snap.progress}:{q,answered:[],voted:[],ready:[]});
  let ballot=$derived(phase==='vote' && game?.ballot?.q===q?game.ballot:null);
  let myVote=$derived(q>=0 && Object.hasOwn(snap.myVotes || {},q)?snap.myVotes[q]:null);
  let picked=$state('');
  let round=$derived(game && phase==='reveal'?roundFor(game,q):null);
  let mine=$derived(round?.answers[you] || null);
  let info=$derived(entry?revealInfo(entry,byId):{answer:'',explanation:''});
  let board=$derived(game?scoreboard(game):[]);
  let me=$derived(board.find(r=>r.id===you) || null);
  let revealAt=$derived.by(()=>{for(let i=snap.events.length-1;i>=0;i--){const e=snap.events[i];if((e.t||e.type)==='reveal' && e.q===q)return e.at;}return null;});
  let tappedNext=$derived(local.code===code && local.ready===q);
  let iAmReady=$derived(progress.ready.includes(you) || (tappedNext && snap.status==='online'));
  let waitingFor=$derived(players.filter(p=>p.id!==you && snap.online.includes(p.id) && !progress.ready.includes(p.id)));
  // The reveal moves on by itself FORCE_AFTER after it opened, by the room's clock.
  let revealLeft=$derived(phase==='reveal' && revealAt!==null?Math.max(0,revealAt+FORCE_AFTER-(now+snap.offset)):FORCE_AFTER);
  let draft=$state('');

  // The page hides the update banner and the tab bar from these.
  $effect(()=>{onstate({inGame:Boolean(snap.room && game && game.phase!=='finished'),phase,code,question:q>=0?q+1:null,total,status:snap.status});});

  // A typed answer is kept per question, so closing and reopening the app keeps it.
  let draftFor='';
  $effect(()=>{
    const key=phase==='question'?`${code}:${q}`:'';
    untrack(()=>{if(key===draftFor)return;draftFor=key;draft=key && local.code===code && local.draft?.q===q?local.draft.text || '':'';});
  });
  function keepDraft(){keepLocal({...local,code,draft:{q,text:draft}});}

  // The room forgets "Neste" when the socket drops: say it again after every reconnect during that reveal.
  let wasOnline=false,needReady=false;
  $effect(()=>{
    const online=snap.status==='online';
    if(online && !wasOnline)needReady=true;
    wasOnline=online;
    if(!needReady || !online || phase!=='reveal')return;
    needReady=false;
    if(tappedNext && !(snap.progress?.q===q && snap.progress.ready.includes(you)))client.ready(q);
  });

  // The clock: the countdowns, and every 2 s while the phase is still showing, "time is up" for a question or a vote
  // and "move on" for a reveal.
  let lastTimeup=0;
  onMount(()=>{
    const timer=setInterval(()=>{
      now=Date.now();
      if(snap.status!=='online' || now-lastTimeup<2000)return;
      if(timed && remaining<=0){lastTimeup=now;client.timeup(q);}
      else if(phase==='reveal' && revealAt!==null && revealLeft<=0){lastTimeup=now;client.force(q);}
    },250);
    // Opened elsewhere: only the button takes the game back, or two phones would keep taking turns.
    const again=()=>{if(snap.error?.code!=='replaced')client.reconnect();};
    const visible=()=>{if(document.visibilityState==='visible'){again();void holdWake();}};
    document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',again);window.addEventListener('online',again);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',again);window.removeEventListener('online',again);releaseWake();unsubscribe();client.destroy();try{sessionStorage.removeItem(PENDING_KEY);}catch{}};
  });

  // Keep the screen on during questions, votes and reveals. Not every phone allows it; that is fine.
  let lock=null,wantWake=false;
  async function holdWake(){
    if(!wantWake || lock || document.visibilityState!=='visible' || !navigator.wakeLock)return;
    try{const l=await navigator.wakeLock.request('screen');if(!wantWake){l.release().catch(()=>{});return;}lock=l;l.addEventListener('release',()=>{if(lock===l)lock=null;});}catch{lock=null;}
  }
  function releaseWake(){const l=lock;lock=null;l?.release().catch(()=>{});}
  $effect(()=>{wantWake=phase==='question' || phase==='vote' || phase==='reveal';if(wantWake)void holdWake();else releaseWake();});

  // Each new question and each reveal starts at the top, with focus on its heading.
  let shownKey='';
  $effect(()=>{
    const key=`${phase}:${q}`;
    if(key===shownKey)return;
    shownKey=key;confirmLeave=false;picked='';
    untrack(()=>{
      if(phase==='question')announce=`Spørsmål ${q+1} av ${total}`;
      else if(phase==='vote')announce='Stem på svaret som ligger nærmest fasiten';
      else if(phase==='reveal')announce='';
      else if(phase==='finished')announce='Spillet er ferdig';
    });
    const target={question:'qo-question',vote:'qo-vote',reveal:'qo-result',finished:'qo-final',lobby:'qo-lobby'}[phase];
    if(target)void tick().then(()=>{window.scrollTo({top:0,behavior:'instant'});document.getElementById(target)?.focus({preventScroll:true});});
  });

  function errorText(error){
    if(!error)return '';
    switch(error.code){
      case 'no-room':return attempt==='join' && invited?`Fant ikke spillet ${invited}. Det kan være over, eller alle har forlatt det. Be om en ny lenke.`:attempt==='join'?'Fant ikke noe spill med den koden. Sjekk koden og prøv igjen.':'Spillet finnes ikke lenger.';
      case 'version':return `Dere har ulike utgaver av Atlas${error.app && error.app!==appVersion?` (spillet bruker ${error.app}, du har ${appVersion})`:''}. Begge må oppdatere appen og prøve igjen.`;
      case 'started':return 'Spillet har allerede startet. Du kan ikke bli med nå.';
      case 'full':return `Spillet er fullt. Det er plass til ${MAX_PLAYERS} spillere.`;
      case 'name':return `Navnet må være mellom 1 og ${NAME_MAX} tegn.`;
      case 'key':return 'Denne telefonen kan ikke koble til spillet igjen.';
      case 'unreachable':return 'Fikk ikke kontakt. Quiz-off trenger internett.';
      case 'create-failed':return 'Kunne ikke lage et spill nå. Prøv igjen om litt.';
      default:return '';
    }
  }
  function checkName(){
    const name=cleanName(nameField);
    if(!name){formError=`Skriv et navn på 1 til ${NAME_MAX} tegn.`;return '';}
    return name;
  }
  function create(){
    formError='';notice='';const name=checkName();if(!name)return;
    attempt='create';client.create(name).catch(()=>{});
  }
  function join(typed=codeField){
    formError='';notice='';
    const value=typed.trim().toUpperCase();
    if(value.length!==CODE_LENGTH){formError=`Koden har ${CODE_LENGTH} bokstaver.`;return;}
    if(/[IO]/.test(value)){formError='Koden har aldri bokstavene I eller O. Sjekk koden.';return;}
    const name=checkName();if(!name)return;
    attempt='join';client.join(value,name).then(()=>{invited='';},()=>{});
  }
  function otherWay(focus){invited='';formError='';if(snap.error)client.forget();void tick().then(()=>document.getElementById(focus)?.focus());}
  function leaveForInvite(){client.leave();keepLocal({});attempt='';conflict=false;void tick().then(()=>{window.scrollTo({top:0,behavior:'instant'});document.getElementById('qo-invite')?.focus({preventScroll:true});});}
  function stay(){conflict=false;invited='';}
  function typedCode(event){
    codeField=event.currentTarget.value.toUpperCase().replace(/[^A-ZÆØÅ]/g,'').slice(0,CODE_LENGTH);
    event.currentTarget.value=codeField;
  }
  function leave(exit){
    client.leave();keepLocal({});attempt='';
    if(exit)onexit();
  }

  function start(){
    notice='';
    const modes={recognition:['recognition'],mixed:['recognition','recall'],open:['recognition','recall','open']}[setup.form];
    const pool=quizoffPool(targets,{domainId:setup.domain,modes});
    const seed=Array.from(crypto.getRandomValues(new Uint32Array(2)),n=>n.toString(36)).join('');
    const questions=pickQuestions(pool,{count:setup.count,seed});
    if(questions.length<COUNT_MIN){notice='Det er for få spørsmål her. Velg et annet fagområde eller begge formene.';return;}
    const title=domains.find(d=>d.id===setup.domain)?.title || 'Blandet';
    if(!client.start({count:questions.length,seconds:setup.seconds,title},questions))notice='Ikke tilkoblet. Vent litt og prøv igjen.';
  }
  // The join link and its QR code, only while others can still join.
  let joinLink=$derived(code?inviteUrl(location.origin,code):'');
  let qr=$derived(phase==='lobby' && joinLink?qrCode(joinLink):null);
  let qrSize=$derived(qr?qr.matrix.length+8:0);
  async function share(){
    notice='';
    const text=inviteText(code);
    if(navigator.share){
      try{await navigator.share({title:'Quiz-off i Atlas',text,url:joinLink});return;}
      catch(error){if(error?.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(`${text} ${joinLink}`);notice='Invitasjonen med lenken er kopiert. Lim den inn i en melding.';}
    catch{notice=`Del lenken eller koden ${code}: ${joinLink}`;}
  }
  async function copyLink(){
    notice='';
    try{await navigator.clipboard.writeText(joinLink);notice='Lenken er kopiert.';}
    catch{
      const node=document.getElementById('qo-link');
      if(node){const range=document.createRange();range.selectNodeContents(node);getSelection()?.removeAllRanges();getSelection()?.addRange(range);}
      notice='Kunne ikke kopiere. Lenken er merket, så du kan kopiere den selv.';
    }
  }

  function choose(option){if(!timeUp && myAnswer===null)client.answer(q,option.id);}
  function submit(event){
    event.preventDefault();
    if(timeUp || myAnswer!==null || !draft.trim())return;
    if(client.answer(q,draft)){keepLocal({...local,code,draft:null});document.getElementById('qo-recall')?.blur();}
  }
  function next(){keepLocal({...local,code,ready:q});client.ready(q);}
  function castVote(){if(!timeUp && myVote===null && picked && picked!==you)client.vote(q,picked);}

  const labelFor=answer=>entry?answerLabel(entry,byId,targets,recognition,answer):String(answer ?? '');
  const names=list=>list.length<2?list.join(''):`${list.slice(0,-1).join(', ')} og ${list.at(-1)}`;
  const place=row=>{const shared=board.filter(r=>r.rank===row.rank).length>1;return `${shared?'Delt ':''}${row.rank}. plass`;};
  let verdict=$derived(!round?'':round.open?(mine?.correct?'DU VANT':mine?'IKKE VALGT':'INGEN SVAR'):mine?.correct?'RIKTIG':mine?'IKKE HELT':'INGEN SVAR');
  $effect(()=>{if(phase==='reveal' && round)untrack(()=>{announce=round.open?(mine?.correct?`Svaret ditt vant. ${mine.points} poeng.`:mine?'Svaret ditt vant ikke.':'Du svarte ikke.'):mine?.correct?`Riktig. ${mine.points} poeng.`:mine?'Ikke riktig.':'Du svarte ikke.';});});
  const nameOf=id=>{const p=game?.players.find(x=>x.id===id);return p?`${p.name}${id===you?' (deg)':''}`:'';};
  const letter=i=>'ABCDEFGH'[i] || String(i+1);
  const voteCount=n=>n===1?'1 stemme':`${n} stemmer`;
  // An open round's answers: most votes first, then in the ballot's order.
  let openRows=$derived.by(()=>{
    if(!round?.open)return [];
    const order=game.ballot?.q===q?game.ballot.order:Object.keys(round.answers);
    return Object.keys(round.answers).sort((a,b)=>round.answers[b].votes-round.answers[a].votes || order.indexOf(a)-order.indexOf(b));
  });
  let openHeading=$derived.by(()=>{
    if(!round?.open)return '';
    const won=openRows.filter(id=>round.answers[id].correct).map(nameOf);
    if(!openRows.length)return 'Ingen svarte';
    if(!won.length)return 'Ingen fikk stemmer';
    if(openRows.length===1)return `${won[0]} var den eneste som svarte`;
    return won.length>1?`Delt seier: ${names(won)}`:`${won[0]} vant`;
  });
</script>

{#snippet standings(rows,label)}
  <ol class="qo-standings" aria-label={label}>
    {#each rows as row (row.id)}
      <li class:is-you={row.id===you} class:has-left={row.left}>
        <span class="qo-rank" aria-hidden="true">{row.rank}</span>
        <span class="qo-who"><span class="sr-only">{place(row)}: </span>{row.name}{#if row.id===you}<small>{' (deg)'}</small>{/if}{#if row.left}<small>{' · har forlatt spillet'}</small>{/if}</span>
        <span class="qo-points">{row.points}<span class="sr-only"> poeng</span><small aria-hidden="true"> p</small></span>
      </li>
    {/each}
  </ol>
{/snippet}

{#snippet timer()}
  <div class="qo-timer" class:is-low={remaining<=5000} role="timer" aria-label={timeUp?'Tiden er ute':`${Math.ceil(remaining/1000)} sekunder igjen`}>
    <span class="qo-timer-track" aria-hidden="true"><span style={`width:${Math.min(100,100*remaining/phaseLength)}%`}></span></span>
    <span class="qo-timer-num" aria-hidden="true">{Math.ceil(remaining/1000)}</span>
  </div>
{/snippet}

{#snippet connection()}
  <p class="qo-status" aria-live="polite">{#if snap.status==='reconnecting'}Kobler til igjen …{:else if snap.status==='connecting' && phase!=='start'}Kobler til …{/if}</p>
  {#if snap.error && snap.room}<div class="banner error" role="alert"><p>{errorText(snap.error)}</p><button class="quiet" onclick={()=>leave(true)}>Forlat</button></div>{/if}
{/snippet}

{#snippet top()}
  <div class="s-top qo-top">
    <button class="s-back" onclick={()=>confirmLeave=!confirmLeave} aria-expanded={confirmLeave}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>Forlat</span></button>
    <span class="qo-top-code"><span class="sr-only">Kode </span>{code}</span>
  </div>
  {#if confirmLeave}
    <div class="s-alert qo-confirm" role="group" aria-label="Forlate spillet?">
      <p>Forlate spillet? Du kan ikke komme tilbake til det, og de andre spiller videre uten deg.</p>
      <div class="qo-row"><button class="secondary" onclick={()=>leave(true)}>Forlat spillet</button><button class="quiet" onclick={()=>confirmLeave=false}>Bli i spillet</button></div>
    </div>
  {/if}
{/snippet}

<div class="qo {timed || phase==='reveal'?'session-view s-quiz':'today'}" data-phase={phase}>
  <p class="sr-only" aria-live="polite">{announce}</p>
  {#if conflict}
    <header class="t-head"><p class="eyebrow">Quiz-off</p><h1 id="qo-conflict">Du er allerede med i et spill</h1>
      <p class="t-lead">Du er med i spillet {code}. Lenken du åpnet, er til spillet {invited}. Du kan bare være med i ett spill om gangen, så du må forlate {code} for å bli med i {invited}.</p></header>
    <div class="qo-actions"><button class="primary" onclick={stay}>Fortsett i spillet {code}</button><button class="secondary" onclick={leaveForInvite}>Forlat {code} og bli med i {invited}</button></div>
    <p class="s-meta qo-conflict-note">Forlater du {code}, kan du ikke komme tilbake til det.</p>
  {:else if phase==='replaced'}
    <header class="t-head"><p class="eyebrow">Quiz-off · {code}</p><h1>Åpnet et annet sted</h1></header>
    <p class="t-lead">Du har åpnet dette spillet på en annen telefon eller i et annet vindu. Spillet fortsetter der.</p>
    <div class="qo-actions"><button class="primary" onclick={()=>client.reconnect()}>Fortsett på denne telefonen</button><button class="quiet" onclick={()=>leave(true)}>Forlat spillet</button></div>
  {:else if phase==='start' && invited}
    <div class="t-back"><button class="s-back" onclick={()=>{client.forget();onexit();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>I dag</span></button></div>
    <header class="t-head"><p class="eyebrow">Quiz-off</p><h1 id="qo-invite" tabindex="-1">Bli med i spillet <span class="qo-invite-code">{invited}</span></h1><p class="t-lead">Du er invitert til en direkte quiz, hver på sin telefon. Skriv navnet ditt, så er du med.</p></header>
    {@const failure=formError || errorText(snap.error)}
    {#if failure}<div class="banner error" role="alert"><p>{failure}</p></div>{/if}
    <form class="t-builder qo-start qo-invite" onsubmit={event=>{event.preventDefault();join(invited);}}>
      <label class="t-field" for="qo-name">Navnet ditt</label>
      <input id="qo-name" class="input" bind:value={nameField} maxlength={NAME_MAX} autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="Slik ser de andre deg">
      <button class="primary" type="submit" disabled={snap.status==='connecting'}>{snap.status==='connecting' && attempt==='join'?'Kobler til …':`Bli med i ${invited}`}</button>
      {#if snap.status==='connecting'}<button class="quiet" type="button" onclick={()=>{client.forget();attempt='';}}>Avbryt</button>{/if}
    </form>
    <div class="qo-other"><p class="s-label">Noe annet?</p><div class="qo-row"><button class="quiet" onclick={()=>otherWay('qo-code')}>Skriv en annen kode</button><button class="quiet" onclick={()=>otherWay('qo-new')}>Start et eget spill</button></div></div>
    <p class="s-meta">Quiz-off trenger internett. Navn og svar ligger på serveren til 30 minutter etter spillet. Svarene kommer ikke med i læringshistorikken din.</p>
  {:else if phase==='start'}
    <div class="t-back"><button class="s-back" onclick={()=>{client.forget();onexit();}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>I dag</span></button></div>
    <header class="t-head"><h1>Quiz-off</h1><p class="t-lead">Spill mot venner, hver på sin telefon. Alle får de samme spørsmålene samtidig. Raske, riktige svar gir mest poeng.</p></header>
    {@const failure=formError || errorText(snap.error)}
    {#if failure}<div class="banner error" role="alert"><p>{failure}</p></div>{/if}
    <div class="t-builder qo-start">
      <label class="t-field" for="qo-name">Navnet ditt</label>
      <input id="qo-name" class="input" bind:value={nameField} maxlength={NAME_MAX} autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Slik ser de andre deg">
      <section class="t-chapter qo-choice" aria-labelledby="qo-new"><p class="eyebrow">Nytt spill</p><h2 id="qo-new" tabindex="-1">Du er vert</h2><p class="t-sub">Du får en kode, en lenke og en QR-kode som de andre bruker for å bli med.</p>
        <button class="primary" disabled={snap.status==='connecting'} onclick={create}>{snap.status==='connecting' && attempt==='create'?'Lager spillet …':'Start et spill'}</button></section>
      <section class="t-chapter qo-choice" aria-labelledby="qo-join"><p class="eyebrow">Bli med</p><h2 id="qo-join">Har du en kode?</h2>
        <form class="qo-join" onsubmit={event=>{event.preventDefault();join();}}>
          <label class="t-field" for="qo-code">Koden fra den som startet</label>
          <input id="qo-code" class="input qo-code-input" value={codeField} oninput={typedCode} maxlength={CODE_LENGTH} autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="go" placeholder="ABCD" aria-describedby="qo-code-note">
          <p id="qo-code-note" class="s-meta">Fire bokstaver.</p>
          <button class="secondary" type="submit" disabled={snap.status==='connecting'}>{snap.status==='connecting' && attempt==='join'?'Kobler til …':'Bli med'}</button>
        </form></section>
      {#if snap.status==='connecting'}<button class="quiet" onclick={()=>{client.forget();attempt='';}}>Avbryt</button>{/if}
      <p class="s-meta">Quiz-off trenger internett. Navn og svar ligger på serveren til 30 minutter etter spillet. Svarene kommer ikke med i læringshistorikken din.</p>
    </div>
  {:else if phase==='lobby'}
    <div class="t-back"><button class="s-back" onclick={()=>leave(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>Forlat spillet</span></button></div>
    <header class="t-head"><p class="eyebrow">Quiz-off</p><h1 id="qo-lobby" tabindex="-1">Venter på spillere</h1></header>
    {@render connection()}
    <section class="qo-code-card" aria-label="Koden til spillet">
      <p class="s-label">Koden</p>
      <p class="qo-code" aria-label={`Koden er ${code.split('').join(' ')}`}>{code}</p>
      <button class="secondary" onclick={share}>Inviter</button>
      {#if qr}<figure class="qo-qr">
        <svg viewBox={`0 0 ${qrSize} ${qrSize}`} shape-rendering="crispEdges" role="img" aria-label={`QR-kode med lenke for å bli med i spillet ${code.split('').join(' ')}`}><rect width={qrSize} height={qrSize} fill="#fff"/><path d={qrPath(qr.matrix)} fill="#000"/></svg>
        <figcaption>Er dere i samme rom? De andre retter kameraet på telefonen mot QR-koden og trykker på lenken som dukker opp.</figcaption>
      </figure>{/if}
      <div class="qo-link"><p class="s-label">Lenke til spillet</p><p id="qo-link" class="qo-link-text">{joinLink}</p><button class="secondary" onclick={copyLink}>Kopier lenke</button></div>
    </section>
    {#if notice}<p class="qo-notice" role="status">{notice}</p>{/if}
    <section class="qo-players"><h2 class="s-label">Spillere · {players.length} av {MAX_PLAYERS}</h2>
      <ul class="t-rows">{#each players as p (p.id)}{@const here=p.id===you || snap.online.includes(p.id)}
        <li class="qo-player"><span class="qo-dot" class:is-on={here} aria-hidden="true"></span><span class="t-row-text"><strong>{p.name}{p.id===you?' (deg)':''}</strong><small>{p.id===game.host?'Vert · ':''}{here?'Tilkoblet':'Ikke tilkoblet'}</small></span></li>
      {/each}</ul>
    </section>
    {#if canStart}
      <div class="t-builder qo-setup">
        {#if !amHost}<p class="t-sub">{host?.name} er ikke tilkoblet. Du kan velge og starte spillet.</p>{/if}
        <label class="t-field">Fagområde<select class="select" bind:value={setup.domain}><option value="">Blandet</option>{#each domains as d}<option value={d.id}>{d.title}</option>{/each}</select></label>
        <fieldset><legend>Antall spørsmål</legend><div class="qo-seg">{#each COUNTS as n}<button type="button" class="secondary" aria-pressed={setup.count===n} onclick={()=>setup.count=n}>{n}</button>{/each}</div></fieldset>
        <fieldset><legend>Sekunder per spørsmål</legend><div class="qo-seg">{#each SECONDS as n}<button type="button" class="secondary" aria-pressed={setup.seconds===n} onclick={()=>setup.seconds=n}>{n}</button>{/each}</div></fieldset>
        <fieldset><legend>Form</legend><div class="format-grid">
          <button type="button" class="format-choice" aria-pressed={setup.form==='recognition'} onclick={()=>setup.form='recognition'}><strong>Flervalg</strong><small>Velg blant fire svar</small></button>
          <button type="button" class="format-choice" aria-pressed={setup.form==='mixed'} onclick={()=>setup.form='mixed'}><strong>Flervalg og skriving</strong><small>Noen svar skriver du selv</small></button>
          <button type="button" class="format-choice qo-form-open" aria-pressed={setup.form==='open'} onclick={()=>setup.form='open'}><strong>Med forklaringer</strong><small>Noen ganger forklarer alle hvorfor. Spillerne stemmer fram det beste svaret.</small></button>
        </div></fieldset>
        <button class="primary" disabled={players.length<MIN_PLAYERS || snap.status!=='online'} aria-describedby="qo-start-note" onclick={start}>Start spillet</button>
        <p id="qo-start-note" class="t-sub">{players.length<MIN_PLAYERS?'Venter på minst én spiller til. Del koden.':snap.status!=='online'?'Venter på forbindelsen.':`${players.length} spillere er med.`}</p>
      </div>
    {:else}
      <p class="t-sub qo-wait">Venter på at {host?.name || 'verten'} velger spørsmål og starter spillet.</p>
    {/if}
  {:else if phase==='question' && entry}
    {@render top()}
    <div class="s-progress" role="group" aria-label="Fremgang i spillet">
      <div class="s-progress-line">
        <div class="s-steps" aria-hidden="true">{#each game.questions as _,i}<span class:done={i<q} class:active={i===q}></span>{/each}</div>
        <span class="s-count">Spørsmål <strong>{q+1}</strong> av {total}</span>
      </div>
      {@render timer()}
    </div>
    {@render connection()}
    <section class="s-exercise">
      <p class="eyebrow s-eyebrow">Quiz-off · {game.settings.title || 'Blandet'}</p>
      {#if question.missing}
        <h1 id="qo-question" class="s-question" tabindex="-1">Spørsmålet mangler her</h1>
        <p class="s-context">Dette kortet finnes ikke i utgaven av Atlas på denne telefonen. Runden avsluttes når tiden er ute.</p>
      {:else}
        <h1 id="qo-question" class="s-question" class:is-answered={myAnswer!==null} tabindex="-1">{question.prompt}</h1>
        {#if myAnswer!==null}
          <div class="qo-sent" role="status">
            <p class="s-label">Svaret ditt er {snap.status==='online'?'sendt':'lagret'}</p>
            <p class="qo-sent-answer" class:is-long={entry.mode==='open'}>{labelFor(myAnswer)}</p>
            {#if snap.status!=='online'}<p class="s-meta">Det sendes når du er på nett igjen.</p>{/if}
          </div>
        {:else if timeUp}
          <div class="qo-sent" role="status"><p class="s-label">Tiden er ute</p><p class="s-meta">Venter på at runden avsluttes.</p></div>
        {:else if question.options}
          <div class="s-choices" role="group" aria-label="Svaralternativer. Du kan bare svare én gang.">{#each question.options as option,i}<button class="s-choice" onclick={()=>choose(option)}><span class="s-choice-key" aria-hidden="true">{'ABCD'[i] || i+1}</span><span class="s-choice-label">{option.label}</span></button>{/each}</div>
        {:else if question.input.multiline}
          <form class="s-form qo-open-form" onsubmit={submit}><label class="s-field-label" for="qo-recall">{question.input.label}</label><textarea id="qo-recall" class="textarea recall-long s-input" bind:value={draft} oninput={keepDraft} placeholder={question.input.placeholder} maxlength={question.input.max} rows="6" autocomplete="off" aria-describedby="qo-open-note"></textarea><button class="primary" type="submit" disabled={!draft.trim()}>Send forklaringen</button><p id="qo-open-note" class="s-meta">{draft.length} av {question.input.max} tegn. Du kan bare svare én gang. Etterpå stemmer alle på svaret som ligger nærmest fasiten.</p></form>
        {:else}
          <form class="s-form" onsubmit={submit}><label class="s-field-label" for="qo-recall">{question.input.label}</label><input id="qo-recall" class="input recall-short s-input" class:recall-year={['numeric','decimal'].includes(question.input.inputMode)} bind:value={draft} oninput={keepDraft} inputmode={question.input.inputMode} placeholder={question.input.placeholder} maxlength="200" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"><button class="primary" type="submit" disabled={!draft.trim()}>Svar</button><p class="s-meta">Du kan bare svare én gang.</p></form>
        {/if}
      {/if}
      {#if myAnswer!==null || timeUp || question.missing}
        <section class="qo-answered" aria-label="Hvem som har svart">
          <h2 class="s-label">{players.filter(p=>progress.answered.includes(p.id) || (p.id===you && myAnswer!==null)).length} av {players.length} har svart</h2>
          <ul class="t-rows">{#each players as p (p.id)}{@const done=progress.answered.includes(p.id) || (p.id===you && myAnswer!==null)}{@const here=p.id===you || snap.online.includes(p.id)}
            <li class="qo-player"><span class="qo-dot" class:is-on={done} aria-hidden="true"></span><span class="t-row-text"><strong>{p.name}{p.id===you?' (deg)':''}</strong><small>{done?'Har svart':here?'Tenker …':'Ikke tilkoblet'}</small></span></li>
          {/each}</ul>
        </section>
      {/if}
    </section>
  {:else if phase==='vote' && entry && ballot}
    {@render top()}
    <div class="s-progress" role="group" aria-label="Fremgang i spillet">
      <div class="s-progress-line">
        <div class="s-steps" aria-hidden="true">{#each game.questions as _,i}<span class:done={i<q} class:active={i===q}></span>{/each}</div>
        <span class="s-count">Spørsmål <strong>{q+1}</strong> av {total} · stemming</span>
      </div>
      {@render timer()}
    </div>
    {@render connection()}
    <section class="s-exercise qo-vote">
      <p class="eyebrow s-eyebrow">Quiz-off · Stem</p>
      {#if !question.missing}<p class="s-question is-answered">{question.prompt}</p>{/if}
      <h1 id="qo-vote" class="qo-vote-title" tabindex="-1">Hvilket svar ligger nærmest fasiten?</h1>
      <section class="qo-model" aria-labelledby="qo-model-label">
        <p id="qo-model-label" class="s-label">Fasit</p>
        <p class="qo-model-text">{question.missing?'Kortet mangler på denne telefonen.':info.answer}</p>
        {#if info.criteria.length}<p class="s-label">Dette bør være med</p><ul class="qo-criteria">{#each info.criteria as criterion}<li>{criterion}</li>{/each}</ul>{/if}
      </section>
      {#if myVote!==null}
        <div class="qo-sent" role="status"><p class="s-label">Stemmen din er {snap.status==='online'?'sendt':'lagret'}</p>{#if snap.status!=='online'}<p class="s-meta">Den sendes når du er på nett igjen.</p>{:else}<p class="s-meta">Navnene kommer når alle har stemt eller tiden er ute.</p>{/if}</div>
      {:else if timeUp}
        <div class="qo-sent" role="status"><p class="s-label">Tiden er ute</p><p class="s-meta">Venter på at stemmingen avsluttes.</p></div>
      {/if}
      <h2 class="s-label qo-ballot-label" id="qo-ballot-label">Svarene, uten navn</h2>
      <div class="s-choices qo-ballot" role="group" aria-labelledby="qo-ballot-label" aria-describedby="qo-ballot-note">
        {#each ballot.order as id,i (id)}{@const own=id===you}{@const chosen=(myVote ?? picked)===id}
          <button class="s-choice qo-ballot-choice" class:is-own={own} aria-pressed={own?undefined:chosen} disabled={own || myVote!==null || timeUp} onclick={()=>picked=id}>
            <span class="s-choice-key" aria-hidden="true">{letter(i)}</span>
            <span class="s-choice-label"><span class="sr-only">Svar {letter(i)}{own?', ditt svar':''}: </span>{ballot.answers[id].answer}{#if own}<small class="qo-own" aria-hidden="true">Ditt svar · du kan ikke stemme på det</small>{/if}</span>
          </button>
        {/each}
      </div>
      <p id="qo-ballot-note" class="s-meta">Du har én stemme, og den kan ikke endres.</p>
      <section class="qo-answered" aria-label="Hvem som har stemt">
        <h2 class="s-label" aria-live="polite">{players.filter(p=>progress.voted.includes(p.id) || (p.id===you && myVote!==null)).length} av {players.length} har stemt</h2>
        <ul class="t-rows">{#each players as p (p.id)}{@const done=progress.voted.includes(p.id) || (p.id===you && myVote!==null)}{@const here=p.id===you || snap.online.includes(p.id)}
          <li class="qo-player"><span class="qo-dot" class:is-on={done} aria-hidden="true"></span><span class="t-row-text"><strong>{p.name}{p.id===you?' (deg)':''}</strong><small>{done?'Har stemt':here?'Velger …':'Ikke tilkoblet'}</small></span></li>
        {/each}</ul>
      </section>
    </section>
    <div class="s-bar"><button class="primary" disabled={!picked || myVote!==null || timeUp} onclick={castVote}>{myVote!==null?'Du har stemt':timeUp?'Tiden er ute':picked?`Stem på svar ${letter(ballot.order.indexOf(picked))}`:'Velg et svar'}</button></div>
  {:else if phase==='reveal' && entry}
    {@render top()}
    <div class="s-progress" role="group" aria-label="Fremgang i spillet">
      <div class="s-progress-line">
        <div class="s-steps" aria-hidden="true">{#each game.questions as _,i}<span class:done={i<=q} class:active={i===q}></span>{/each}</div>
        <span class="s-count">Spørsmål <strong>{q+1}</strong> av {total}</span>
      </div>
    </div>
    {@render connection()}
    <section class="s-exercise">
      <p class="eyebrow s-eyebrow">Quiz-off · {game.settings.title || 'Blandet'}</p>
      {#if !question.missing}<p class="s-question is-answered">{question.prompt}</p>{/if}
      {#if round?.open}
      <div class="s-feedback" class:is-right={mine?.correct} class:is-wrong={!mine?.correct}>
        <p class="s-verdict">{#if mine?.correct}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>{:else}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>{/if}<span>{verdict}{mine?.correct?` · +${mine.points} poeng`:''}</span></p>
        <h2 id="qo-result" class="s-answer is-long" tabindex="-1"><span class="sr-only">{mine?.correct?`Svaret ditt vant, ${mine.points} poeng. `:mine?'Svaret ditt vant ikke. ':'Du svarte ikke. '}</span>{openHeading}</h2>
        <div class="qo-model"><p class="s-label">Fasit</p><p class="qo-model-text">{question.missing?'Kortet mangler på denne telefonen':info.answer}</p></div>
        {#if info.explanation}<p class="s-explain">{info.explanation}</p>{/if}
      </div>
      <section class="qo-round" aria-label="Svarene og stemmene">
        <h2 class="s-label">Svarene og stemmene</h2>
        <ul class="t-rows">
          {#each openRows as id (id)}{@const a=round.answers[id]}
            <li class="qo-answer qo-open-answer" class:is-right={a.correct}>
              <span class="qo-mark" aria-hidden="true">{a.correct?'✓':''}</span>
              <span class="t-row-text"><strong>{nameOf(id)}</strong><span class="qo-open-text">{a.answer}</span><small>{voteCount(a.votes)}{a.correct?' · vant':''}</small></span>
              <span class="qo-points">{a.correct?`+${a.points}`:'0'}<span class="sr-only"> poeng</span></span>
            </li>
          {/each}
          {#each game.players.filter(p=>!p.left && !round.answers[p.id]) as p (p.id)}
            <li class="qo-answer"><span class="qo-mark" aria-hidden="true">–</span><span class="t-row-text"><strong>{p.name}{p.id===you?' (deg)':''}</strong><small>Svarte ikke</small></span><span class="qo-points">0<span class="sr-only"> poeng</span></span></li>
          {/each}
        </ul>
      </section>
      {:else}
      <div class="s-feedback" class:is-right={mine?.correct} class:is-wrong={!mine?.correct}>
        <p class="s-verdict">{#if mine?.correct}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>{:else}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>{/if}<span>{verdict}{mine?.correct?` · +${mine.points} poeng`:''}</span></p>
        <h2 id="qo-result" class="s-answer" class:is-long={info.answer.length>48} tabindex="-1"><span class="sr-only">{mine?.correct?`Riktig, ${mine.points} poeng. Svaret er: `:mine?'Ikke riktig. Riktig svar: ':'Du svarte ikke. Riktig svar: '}</span>{question.missing?'Kortet mangler på denne telefonen':info.answer}</h2>
        {#if mine && !mine.correct}<div class="s-yours"><p>Du {entry.mode==='recognition'?'valgte':'skrev'}: <strong>{labelFor(mine.answer)}</strong></p></div>{/if}
        {#if info.explanation}<p class="s-explain">{info.explanation}</p>{/if}
      </div>
      <section class="qo-round" aria-label="Svarene i denne runden">
        <h2 class="s-label">Svarene</h2>
        <ul class="t-rows">{#each game.players.filter(p=>!p.left || round?.answers[p.id]) as p (p.id)}{@const a=round?.answers[p.id]}
          <li class="qo-answer" class:is-right={a?.correct} class:is-wrong={a && !a.correct}>
            <span class="qo-mark" aria-hidden="true">{a?.correct?'✓':a?'✗':'–'}</span>
            <span class="t-row-text"><strong>{p.name}{p.id===you?' (deg)':''}</strong><small>{a?labelFor(a.answer):'Svarte ikke'}<span class="sr-only">{a?.correct?', riktig':a?', feil':''}</span></small></span>
            <span class="qo-points">{a?.correct?`+${a.points}`:'0'}<span class="sr-only"> poeng</span></span>
          </li>
        {/each}</ul>
      </section>
      {/if}
      <section class="qo-table"><h2 class="s-label">Stillingen</h2>{@render standings(board,'Stillingen etter denne runden')}</section>
      <p class="s-next-note" aria-live="polite">{#if iAmReady}{waitingFor.length?`Venter på ${names(waitingFor.map(p=>p.name))}.`:'Alle er klare.'}{:else if waitingFor.length<players.length-1}{players.length-1-waitingFor.length} av {players.length-1} andre er klare.{/if}</p>
    </section>
    <div class="s-bar"><span class="qo-auto" role="timer">{revealLeft>0?`${q+1>=total?'Resultatet':'Neste spørsmål'} om ${Math.ceil(revealLeft/1000)} s`:snap.status==='online'?'Går videre …':'Venter på nett …'}</span><button class="primary" disabled={iAmReady} onclick={next}>{iAmReady?'Venter på de andre …':q+1>=total?'Se resultatet':'Neste'}</button></div>
  {:else if phase==='finished'}
    {@const shared=me?board.filter(r=>r.rank===me.rank).length>1:false}
    <header class="t-head"><p class="eyebrow">Quiz-off · {game.settings?.title || 'Blandet'} · {code}</p><h1 id="qo-final" tabindex="-1">{!me?'Spillet er ferdig':me.rank===1?(shared?'Delt førsteplass!':'Du vant!'):`Du kom på ${shared?'delt ':''}${me.rank}. plass`}</h1>
      {#if me}<p class="t-lead">{me.points} poeng · {me.correct} av {total} riktige · {board.length} spillere</p>{/if}</header>
    {@render connection()}
    <section class="qo-table qo-final"><h2 class="s-label">Resultatet</h2>{@render standings(board,'Sluttresultatet')}</section>
    <div class="qo-actions"><button class="primary" onclick={()=>leave(false)}>Nytt spill</button><button class="secondary" onclick={()=>leave(true)}>Tilbake til I dag</button></div>
  {:else}
    <header class="t-head"><p class="eyebrow">Quiz-off · {code}</p><h1>Kobler til …</h1></header>
    {@render connection()}
    <div class="qo-actions"><button class="quiet" onclick={()=>leave(true)}>Forlat spillet</button></div>
  {/if}
</div>
