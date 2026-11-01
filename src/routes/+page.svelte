<script>
  import {learningCoverage,evidenceOverview} from '../lib/learning-coverage.js';
  import { onMount, tick } from 'svelte';
  import {attachKnowledge,schedulingKey,legacyFactKey,evidenceKind} from '../lib/knowledge-model.js';
  import {selectLearningPath,selectConnectedSession,objectiveStatus,safeLearningQueue} from '../lib/connected-learning.js';
  import {sourceQueries,loadSourceContent,mergeSourceContent,downloadSourceImage} from '../lib/source-loading.js';
  import StructuredQuiz from '../lib/StructuredQuiz.svelte';
  import LearningPath from '../lib/LearningPath.svelte';
  import {buildDailySession,buildUnitReview,curriculumProgress,recommendedUnits,gradeAnswer,isLessonEntry,UNIT_STATUS} from '../lib/progression.js';
  import {STEP_LABELS} from '../lib/core-curriculum.js';
  import {FORMAT_CHOICES,STRUCTURED_MODES,buildFormatTargets,gradeStructured,structuredReady} from '../lib/quiz-formats.js';
  import {advanceSession,nextActionNote,retryTargets} from '../lib/repetition.js';
  import {progressDetails,sessionOutcome} from '../lib/progress.js';
  import {assessTargets} from '../lib/difficulty.js';
  import {APP_VERSION,APP_CHECK_INTERVAL,createAppUpdateChecker} from '../lib/app-updates.js';
  import {foundationTargets} from '../lib/foundations.js';
  import {factKey,learningStage,quizProgress,overviewBounds,effectiveRating} from '../lib/journey.js';
  import {saveJournal,readJournal,questionDraft,restoreDraft} from '../lib/session-journal.js';
  import Feedback from '../lib/Feedback.svelte';
  import {answerPresentation,contextualExplanation,questionSupport} from '../lib/presentation.js';
  import { openDatabase, all, get, put, installPackage, recordReview, logEvent, exportDatabase, restoreDatabase, clearLogs, transaction } from '../lib/storage.js';
  import { validatePackage, contentHash, readiness } from '../lib/content.js';
  import { DEFAULT_PREFERENCES, selectSession, selectPracticeSession, scheduleReview, stateForTarget, ratingIntervals, memorySummary, reminderCalendar, targetMatches } from '../lib/learning.js';
  import { checkAnswer, makeRecognitionOptions, buildRecognitionIndex, hasRecognitionOptions, buildTimelineExercise, gradeTimeline, createMapExercise, gradeMapSelection } from '../lib/exercises.js';

  let db;
  let view = $state('today');
  let loading = $state(true);
  let error = $state('');
  let toast = $state('');
  let busy = $state(false);
  let data = $state.raw(null);
  let maps = $state.raw([]);
  let artworkMedia = $state.raw([]);
  let sourceRecords = $state.raw([]);
  let sourceStatus = $state('');
  let sourceProgress = $state('');
  let baseMedia = [];
  let basePackage;
  const sourceBatchSize = 8;
  let states = $state.raw([]);
  let reviews = $state.raw([]);
  let logs = $state.raw([]);
  let prefs = $state({ ...DEFAULT_PREFERENCES });
  let session = $state.raw(null);
  let sessionScreen = $state(false);
  let introduction = $state(false);
  let learnedFirst = $state(false);
  let preparedTargetId = $state('');
  let savedSessions = $state.raw([]);
  let quizCollection = $state('us-presidents');
  let quizDepth = $state('foundation');
  let quizMode = $state('mixed');
  let quizSetup = $state(false);
  let progressTab = $state('overview');
  let journalWarning = false;
  const stageLabel = stage => ({foundation:'Grunnlag',details:'Detaljer',connections:'Avansert'}[stage] || stage);
  function draftNow() { return questionDraft(current?.id,{answer,formatDraft,correct,revealed,usedHint,timelineOrder,selectedRegion,mapZoom,mapPanX,mapPanY,introduction,learnedFirst,gradeNote}); }
  $effect(()=>{
    if(loading || !session || (current && preparedTargetId!==current.id) || currentLesson)return;
    const draft=draftNow();
    try {saveJournal(localStorage,session,draft,sessionScreen,view,detailId);}
    catch {if(!journalWarning){journalWarning=true;notify('Kunne ikke lagre det påbegynte svaret.');}}
  });
  let revealed = $state(false);
  let answer = $state('');
  let formatDraft = $state.raw({});
  $effect(()=>{document.documentElement.classList.toggle('quiz-active',sessionScreen && session?.status==='active' && view==='today');});
  $effect(()=>{if(revealed && sessionScreen){void tick().then(()=>{document.querySelector('#recall')?.blur();document.querySelector('#answer-heading')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}});
  let correct = $state(null);
  let usedHint = $state(false);
  let timelineOrder = $state.raw([]);
  let selectedRegion = $state('');
  let query = $state('');
  let collectionFilter = $state('');
  let detailId = $state('');
  let developer = $state(false);
  let storageInfo = $state.raw({});
  let offlineReady = $state(false);
  let updateReady = $state(false);
  let registration;
  let appCheck = $state.raw({state:'idle'});
  let appChecker;
  async function checkAppUpdate(manual=false){if(appChecker)await appChecker.check(manual);}
  let installed = $state(false);
  let installPrompt = $state.raw(null);
  let notice = $state('');
  let offlineTest = $state(false);
  let mapZoom = $state(1);
  let mapPanX = $state(0);
  let mapPanY = $state(0);
  let confirmRestore = $state.raw(null);
  let pendingDestruction = $state('');
  let lastUpdate = $state.raw(null);

  const ratingLabels = ['Igjen', 'Vanskelig', 'Bra', 'Lett'];
  const ratingNotes = ['Husket ikke', 'Husket med innsats', 'Husket riktig', 'Husket lett'];
  const reasonLabel = reason => reason==='Connected introduction'?'Nytt holdepunkt':reason==='Connected recall'?'Neste sammenheng': reason === 'Due review' ? 'Repetisjon' : reason === 'New knowledge' ? 'Ny kunnskap' : reason === 'Session retry' ? 'Nytt forsøk i denne quizen' : reason === 'Extra practice' ? 'Ekstraøving' : reason;
  const modeLabel = mode => ({recall:'SKRIV SVARET',recognition:'FLERVALG',outline:'GJENKJENN OMRISS',map:'KART',timeline:'TIDSLINJE',matching:'KOBLE SAMMEN','before-after':'HVA KOM FØRST?',arrows:'HISTORISKE PILER'}[mode] || mode);
  const subjectLabel = subject => ({history:'Historie',geography:'Geografi',politics:'Politikk',literature:'Litteratur',art:'Kunst',science:'Vitenskap',philosophy:'Filosofi',economics:'Økonomi',nobel:'Nobelpriser'}[subject] || subject);
  const typeLabel = type => ({'topic':'Emne','document':'Dokument','space-mission':'Romoppdrag','military-operation':'Militær operasjon','fictional-character':'Litterær figur',person:'Person','country-area':'Land eller område','municipality':'Kommune','award-event':'Pristildeling',country:'Land',city:'By',region:'Region',event:'Hendelse',work:'Verk',concept:'Begrep',organization:'Organisasjon',award:'Pris',discovery:'Oppdagelse',movement:'Bevegelse',office:'Embete',period:'Periode',artwork:'Kunstverk',scientific_discovery:'Vitenskapelig oppdagelse',historical_event:'Historisk hendelse',literary_work:'Litterært verk','literary-work':'Litterært verk','political-office':'Politisk embete','former-county':'Tidligere fylke',county:'Fylke'}[type] || type);
  const relationLabel = type => ({'born-in':'Født i','died-in':'Døde i','located-in':'Ligger i','part-of':'Del av','located-in-country':'Ligger i landet','birthplace-in-current-country':'Fødested ligger i dagens land','award-time-affiliation':'Tilknytning da prisen ble tildelt','awarded-prize':'Pristildeling','award-category':'Priskategori','recognized-contribution':'Anerkjente bidraget',awarded:'Ble tildelt','held-office':'Hadde embetet','succeeded':'Etterfulgte','capital-of':'Hovedstad i','in-region':'Ligger i','formerly-part-of':'Tidligere del av',received:'Mottok','recognized-for':'Anerkjent for','written-by':'Skrevet av','created-by':'Skapt av','prepared-for-visit':'Laget før besøk av','depicts-place':'Viser stedet','concerns-document':'Gjelder dokumentet','involves-person':'Omfatter personen','took-place-in':'Fant sted i',adopted:'Vedtok',drafted:'Skrev utkast til',commanded:'Ledet',established:'Opprettet','founded-under':'Grunnlagt under','crew-member':'Medlem av besetningen','author-of':'Forfatter av','features-character':'Har figuren','uses-device':'Bruker virkemiddelet','work-type':'Verkstype'}[type] || type);
  const worldIds = ['nor','fra','ita','bra','jpn','egy','usa','ind','aus','deu','esp','zaf'];

  let toastTimer;
  function notify(text) { toast = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (toast === text) toast = ''; }, Math.max(3500, text.length * 70)); }
  function reportStatus(text) { window.dispatchEvent(new CustomEvent('atlas-status', {detail:text})); }
  async function recordError(component, failure) {
    const message = failure?.message || String(failure);
    error = message;
    if (db) try { await logEvent(db, component, message, 'error'); } catch {}
  }
  async function run(task) {
    if (busy) return;
    busy = true; error = '';
    try { await task(); } catch (failure) { await recordError('application', failure); }
    finally { busy = false; }
  }
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const displayDate = value => new Date(value).toLocaleDateString('nb-NO', {month:'short',day:'numeric'});
  function intervalLabel(date) {
    const minutes = Math.max(1, Math.round((new Date(date) - new Date()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} t`;
    if (minutes < 2880) return 'I morgen';
    return `${Math.round(minutes / 1440)} dager`;
  }
  function whenLabel(date) {
    const days = Math.round((new Date(date) - new Date()) / 86400000);
    return days < 1 ? 'senere i dag' : days === 1 ? 'i morgen' : days < 60 ? `om ${days} dager` : `om ${Math.round(days/30)} måneder`;
  }
  function download(value, name, type = 'application/json') {
    const blob = new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], {type});
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sourceFor(id) { return data?.sources.find(s => s.id === id); }
  function titleFor(id) { return data?.collections.find(c => c.id === id)?.title || id; }

  let recognitionIndex = $derived(buildRecognitionIndex(data?.targets || []));
  let targets = $derived.by(() => {
    if (!data) return [];
    const core = data.targets.filter(t => t.unitId);
    const legacy = data.targets.filter(t => !t.unitId);
    const base = legacy.map(t => ({...t, mode:'recall'}));
    const recognition = legacy.filter(t => t.answerFormat!=='explanation' && hasRecognitionOptions(t, recognitionIndex))
      .map(t => ({...t, id:`${t.id}:recognition`, baseId:t.id, mode:'recognition', significance:Math.max(1,t.significance-1)}));
    const mapTargets = maps.flatMap(dataset => dataset.regions.filter(r => dataset.id === 'norway' || worldIds.includes(r.id)).flatMap(region => {
      const countryEntity = data.entities.find(e => e.label.toLowerCase() === region.label.toLowerCase());
      const collectionIds = dataset.id === 'norway' ? ['norway'] : ['world-geography'];
      const common = { entityId:countryEntity?.id, collectionIds, datasetId:dataset.id, regionId:region.id, answer:region.label,
        acceptedAnswers:[], explanation:`${region.label} er markert på det publiserte kartet over ${dataset.id === 'norway' ? 'norske fylker' : 'verdens land'}.`,
        sourceIds:[], difficulty:2, significance:3, kind:'recognition' };
      return [{...common,id:`map:${dataset.id}:${region.id}`,mode:'map',prompt:`Finn ${region.label} på kartet.`},
        {...common,id:`outline:${dataset.id}:${region.id}`,mode:'outline',prompt:`Hvilket ${dataset.id === 'norway' ? 'fylke' : 'land'} er dette?`}];
    }));
    const timelines = data.timelines.flatMap(t => {
      const sorted = [...t.items].sort((a,b) => a.year-b.year);
      const slices = Array.from({length:Math.ceil(sorted.length/5)}, (_,i) => sorted.slice(i*5,i*5+5));
      return slices.filter(items => items.length >= 2).map((items,i) => ({ id:`timeline:${t.id}:${i}`, entityId:items[0].entityId,
        collectionIds:t.collectionIds, prompt:t.id === 'nobel-scientific-recognition-timeline' ? 'Plasser disse tildelingene fra tidligst til senest etter Nobelprisåret.' : `Plasser disse ${t.id === 'us-presidential-chronology' ? 'presidentperiodene' : 'hendelsene'} fra tidligst til senest.`,
        answer:[...items].sort((a,b)=>a.year-b.year).map(i=>`${i.label} (${i.year})`).join(' → '), acceptedAnswers:[],
        explanation:'Datoene bestemmer rekkefølgen. Hendelser fra samme år kan stå i valgfri rekkefølge.', sourceIds:t.sourceIds,
        difficulty:3, significance:3, kind:'before-after', mode:'timeline', timeline:{...t,id:`${t.id}:${i}`,items} }));
    });
    const introductions=foundationTargets(data);
    const anchored=new Set(introductions.filter(t=>!t.id.startsWith('foundation:period:')).map(t=>t.entityId));
    return attachKnowledge(assessTargets([...introductions.filter(t=>!t.id.startsWith('foundation:period:') || !anchored.has(t.entityId)), ...core, ...base, ...recognition, ...mapTargets, ...timelines, ...buildFormatTargets(data,maps)]),data);
  });
  function formatAvailable(mode) {
    const depth=['chronology','before-after','arrows'].includes(mode)?'advanced':['geography','outline','matching'].includes(mode) && quizDepth==='foundation'?'intermediate':quizDepth;
    return targets.some(t=>targetMatches(t,{...prefs,collectionIds:quizCollection?[quizCollection]:[],subject:'all',fromYear:'',toYear:'',depth,objective:mode},data.collections) && (mode!=='chronology' || t.mode==='timeline'));
  }
  let coreProgress = $derived(data?.curriculum ? curriculumProgress(data.curriculum,targets,states,reviews) : null);
  let selection = $derived(!data ? {queue:[],dueCount:0,newCount:0,eligibleCount:0} : data.curriculum ? buildDailySession({data,targets,states,reviews,preferences:prefs,now:new Date()}) : selectConnectedSession(data,targets, states, prefs, new Date(), data.collections, reviews));
  let selectedUnit = $state('');
  let gradeNote = $state('');
  let currentEntry = $derived(session?.queue[session.index] || null);
  let currentLesson = $derived(isLessonEntry(currentEntry) ? data?.curriculum?.units.find(u=>u.id===currentEntry.unitId) : null);
  let currentUnit = $derived(current?.unitId ? data?.curriculum?.units.find(u=>u.id===current.unitId) : null);
  const unitTitle = id => data?.curriculum?.units.find(u=>u.id===id)?.title || '';
  const domainTitle = id => data?.curriculum?.domains.find(d=>d.id===id)?.title || '';
  let summary = $derived(quizProgress(targets, reviews));
  let progress = $derived(progressDetails(targets,reviews));
  let contentCoverage = $derived(data?learningCoverage(data,targets):[]);
  let abilities = $derived(evidenceOverview(targets,reviews));
  let outcome = $derived(sessionOutcome(session?.results || []));
  let retryIds = $derived(retryTargets(session?.results || []));
  let current = $derived(session && !isLessonEntry(session.queue[session.index]) ? targets.find(t => t.id === session.queue[session.index]?.id) : null);
  let currentArtwork = $derived(artworkMedia.find(m=>m.entityId===(current?.media || current?.entityId)));
  let answerStyle = $derived(answerPresentation(current));
  let explanationContext = $derived(contextualExplanation(data || {},current,targets,reviews,session?.queue.slice((session?.index||0)+1).map(q=>q.id)||[]));
  let connections = $derived(explanationContext.connections);
  let currentObjective = $derived(data?.learningObjectives?.find(o=>o.id===session?.queue[session.index]?.objectiveId));
  let currentState = $derived(current ? stateForTarget(current,targets,states,reviews) : null);
  let intervals = $derived(current ? ratingIntervals(currentState) : {});
  const retryNote = rating => nextActionNote(session,{correct,usedHint,learnedFirst,rating:effectiveRating(rating,{correct,usedHint,learnedFirst,mode:current?.mode})});
  let entity = $derived(data?.entities.find(e => e.id === detailId));
  let relationshipLimit = $state(40);
  let entityRelationships = $derived(data?.relationships.filter(r=>r.from===detailId || r.to===detailId) || []);
  $effect(()=>{ detailId; relationshipLimit = 40; });
  let exploreLimit = $state(60);
  let allMatchingEntities = $derived((data?.entities.filter(e => (!collectionFilter || e.collectionIds.includes(collectionFilter)) &&
    `${e.label} ${e.summary}`.toLowerCase().includes(query.toLowerCase())) || []).sort((a,b)=>Number(b.type==='topic')-Number(a.type==='topic') || Number(b.label.toLowerCase().startsWith(query.toLowerCase()))-Number(a.label.toLowerCase().startsWith(query.toLowerCase()))));
  let matchingEntities = $derived(allMatchingEntities.slice(0,exploreLimit));
  $effect(() => { query; collectionFilter; exploreLimit = 60; });
  let reviewedToday = $derived(reviews.filter(r => dayKey(new Date(r.timestamp)) === dayKey(new Date())).length);
  let currentDataset = $derived(current ? maps.find(m=>m.id===current.datasetId) : null);
  let currentMap = $derived(current?.mode === 'map' && currentDataset ? createMapExercise(currentDataset,current.regionId) : null);

  function mapBounds(region, dataset) {
    const chunks = region.path.split('Z').map(piece => {
      const numbers = piece.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      const xs = numbers.filter((_,i)=>i%2===0), ys = numbers.filter((_,i)=>i%2===1);
      return xs.length && ys.length ? [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] : null;
    }).filter(Boolean).sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]));
    const b = chunks[0]; if (!b) return dataset.viewBox;
    const min = dataset.id === 'world' ? 35 : 60;
    const width = Math.max(min,(b[2]-b[0])*2.8)/mapZoom;
    const height = Math.max(min,(b[3]-b[1])*2.8)/mapZoom;
    return `${(b[0]+b[2]-width)/2} ${(b[1]+b[3]-height)/2} ${width} ${height}`;
  }
  let mapViewBox = $derived(currentDataset && current ? current.mode==='map' ? overviewBounds(currentDataset,mapZoom,mapPanX,mapPanY) : mapBounds(currentDataset.regions.find(r=>r.id===current.regionId),currentDataset) : '0 0 720 290');

  async function restoreSourceContent() {
    basePackage=(await all(db,'packages'))[0];
    const savedRecords=(await get(db,'settings','source-content'))?.records || [];
    try {data=mergeSourceContent(basePackage,savedRecords);sourceRecords=savedRecords;}
    catch {
      sourceRecords=[];
      for(const record of savedRecords)try {mergeSourceContent(basePackage,[...sourceRecords,record]);sourceRecords=[...sourceRecords,record];} catch {sourceStatus='Noe tidligere hentet innhold passer ikke med den installerte pakken. Biblioteket er fortsatt tilgjengelig.';}
      data=mergeSourceContent(basePackage,sourceRecords);
    }
    artworkMedia=[...baseMedia,...sourceRecords.map(record=>record.media).filter(Boolean).filter(media=>!baseMedia.some(old=>old.entityId===media.entityId))];
  }
  async function loadMoreSources(entityId='') {
    if(offlineTest || !navigator.onLine)throw new Error('Koble til nettet for å hente nye bilder og spørsmål.');
    const candidates=data.entities.filter(item=>(entityId?item.id===entityId:!collectionFilter || item.collectionIds.includes(collectionFilter)) && sourceQueries(item,data.sources).length && (entityId || !sourceRecords.some(record=>record.entityId===item.id))).slice(0,sourceBatchSize);
    if(!candidates.length){sourceStatus='Alle tilgjengelige kildeposter i dette utvalget er hentet.';return;}
    let added=0,pictures=0,failed=0;
    const originalCount=data.targets.length;
    for(const [index,item] of candidates.entries()) {
      sourceProgress=`Henter ${index+1} av ${candidates.length}: ${item.label}`;
      try {
        const result=await loadSourceContent(item,data,{knownMedia:artworkMedia});
        let pictureFailed=false;
        if(result.media)try {result.media=await downloadSourceImage(result.media);} catch {result.media=null;pictureFailed=true;}
        const old=sourceRecords.find(record=>record.entityId===item.id);
        const record={entityId:item.id,...result,media:result.media || old?.media || null};
        const records=[...sourceRecords.filter(record=>record.entityId!==item.id),record];
        const merged=mergeSourceContent(basePackage,records);
        if(records.reduce((sum,record)=>sum+(record.media?.bytes || 0),0)>8000000)throw new Error('Bildebiblioteket har nådd grensen på 8 MB.');
        await put(db,'settings',{id:'source-content',records});
        sourceRecords=records;data=merged;
        artworkMedia=[...baseMedia,...records.map(record=>record.media).filter(Boolean).filter(media=>!baseMedia.some(old=>old.entityId===media.entityId))];
        added++;if(result.media)pictures++;if(pictureFailed)failed++;
      }catch {failed++;}
    }
    sourceProgress='';
    if(entityId && quizDepth==='foundation' && !foundationTargets(data).some(target=>target.entityId===entityId) && !data.targets.some(target=>target.entityId===entityId && learningStage(target)==='foundation'))quizDepth='intermediate';
    sourceStatus=`${added} kildeposter hentet · ${pictures} nye bilder · ${data.targets.length-originalCount} nye spørsmål.${failed?' Noe innhold kunne ikke hentes. Prøv igjen på emnesiden.':''}`;
  }
  async function refresh() {
    [states,reviews,logs,savedSessions] = await Promise.all(['states','reviews','logs','sessions'].map(s=>all(db,s)));
  }
  async function savePreferences() {
    if (prefs.fromYear !== '' && prefs.toYear !== '' && Number(prefs.fromYear)>Number(prefs.toYear)) throw new Error('Startåret må være før sluttåret.');
    const record = JSON.parse(JSON.stringify(prefs));
    await put(db,'settings',record);
    document.documentElement.dataset.theme = prefs.theme;
    notify('Utvalget er lagret.');
  }
  function toggleCollection(id) {
    prefs.collectionIds = prefs.collectionIds.includes(id) ? prefs.collectionIds.filter(x=>x!==id) : [...prefs.collectionIds,id];
  }
  function navigate(route) { window.location.hash = route; view = route; sessionScreen = false; }
  async function prepareQuestion(draft = null) {
    const saved=restoreDraft(current,draft);
    answer = saved?.answer || ''; formatDraft = saved?.formatDraft || {}; correct = saved?.correct ?? null; revealed = saved?.revealed || false;
    usedHint = saved?.usedHint || false; selectedRegion = saved?.selectedRegion || ''; mapZoom = saved?.mapZoom || 1;mapPanX=saved?.mapPanX || 0;mapPanY=saved?.mapPanY || 0;
    timelineOrder = saved?.timelineOrder || (current?.mode === 'timeline' ? buildTimelineExercise(current.timeline).items : []);
    introduction = saved?.introduction ?? Boolean(session?.queue[session.index]?.reason==='Connected introduction' && current?.snapshot);
    learnedFirst = saved?.learnedFirst || false; gradeNote = saved?.gradeNote || ''; preparedTargetId=current?.id || currentLesson?.id || '';
    await tick(); document.querySelector('#main-view')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
  }
  async function archiveActive() {
    if(session?.status==='active') await put(db,'sessions',{...session,id:session.sessionId,draft:draftNow()});
  }
  async function beginSession(practiceObjective = null, scope = null) {
    const pool = scope?.targetIds ? targets.filter(t=>scope.targetIds.includes(t.id)) : scope?.entityId ? targets.filter(t=>t.entityId===scope.entityId) : targets;
    const focus = scope ? {...prefs,collectionIds:scope.collectionId?[scope.collectionId]:[],subject:'all',fromYear:'',toYear:'',depth:scope.depth || quizDepth} : prefs;
    let selected, planned=false, practice=Boolean(practiceObjective && !scope?.learningPathId);
    if (scope?.unitId) {
      const learn = scope.unitMode!=='review' ? buildDailySession({data,targets,states,reviews,preferences:prefs,unitIds:[scope.unitId]}) : {queue:[]};
      selected = learn.queue.length ? learn : buildUnitReview({data,targets,states,reviews,unitId:scope.unitId,preferences:prefs});
      planned = true; practice = !learn.queue.length;
    }
    else if (scope?.learningPathId) selected = selectLearningPath(data,scope.learningPathId,targets,states,focus,reviews);
    else if (practiceObjective) selected = selectPracticeSession(pool,states,focus,practiceObjective,new Date(),data.collections,reviews);
    else { selected = selection; planned = Boolean(data.curriculum); }
    if (!selected.queue.length) { notify(scope?.learningPathId?'Du har øvd på disse holdepunktene. Neste steg blir tilgjengelig senere; du kan også velge en fri quiz.':'Ingen spørsmål på dette nivået. Velg et annet nivå eller emne.'); return; }
    await archiveActive();
    const rows = planned ? selected.queue : safeLearningQueue(selected.queue);
    const queue = rows.map(q=>q.target?{id:q.target.id,reason:q.reason,unitId:q.unitId,objectiveId:q.objectiveId,support:q.support}:{id:q.id,reason:q.reason,unitId:q.unitId});
    session = {id:'active',difficultyPolicy:'2026-10-11',sessionId:crypto.randomUUID(),startedAt:new Date().toISOString(),title:scope?.title || (practiceObjective?'Fri quiz':'Dagens økt'),scope,objective:practiceObjective,queue,practice,index:0,results:[],status:'active'};
    await put(db,'sessions',session);
    sessionScreen = true; view = 'today'; window.location.hash='today';
    await prepareQuestion(); await refresh(); window.scrollTo(0,0);
  }
  async function finishLesson() {
    const entry=session.queue[session.index];
    const index=session.index+1;
    session={...session,index,draft:null,results:[...session.results,{id:entry.id,lesson:true}],status:index>=session.queue.length?'completed':'active'};
    await put(db,'sessions',session);
    await prepareQuestion();
  }
  async function resumeSession(saved = null) {
    if(saved) {await archiveActive();session={...saved,id:'active'};await put(db,'sessions',session);await prepareQuestion(saved.draft);await refresh();}
    if (!current && !currentLesson) { notify('Spørsmålet er ikke tilgjengelig. Du kan starte en ny quiz.'); return; }
    sessionScreen = true; view='today';window.location.hash='today'; window.scrollTo(0,0);
  }
  function reveal() {
    if (STRUCTURED_MODES.includes(current?.mode)) correct=gradeStructured(current,formatDraft).correct;
    else if (current?.mode === 'timeline') correct = gradeTimeline(timelineOrder,current.timeline).correct;
    else if(current?.answerFormat==='explanation')correct=null;
    else if (current?.unitId && !['map','recognition'].includes(current.mode)) {const grade=gradeAnswer(current,answer);correct=grade.correct;gradeNote=grade.note || '';}
    else if (!['map','recognition'].includes(current?.mode)) correct = answer.trim() ? checkAnswer(current,answer) : null;
    revealed = true;
  }
  function fallbackRating() {
    if (current?.answerFormat==='explanation' && current.rubric?.length) {
      const checked=current.rubric.filter(c=>formatDraft[c.id]).length;
      return correct===true?3:checked?2:1;
    }
    return correct===true?3:1;
  }
  function answerChoice(option) { if (revealed) return; answer=option.label; correct=option.correct; revealed=true; }
  function chooseRegion(id) { if (revealed) return; selectedRegion=id; correct=gradeMapSelection(id,current.regionId); revealed=true; }
  function moveTimeline(index, direction) {
    const next=[...timelineOrder], other=index+direction;
    if (other<0 || other>=next.length) return;
    [next[index],next[other]]=[next[other],next[index]]; timelineOrder=next;
  }
  async function rate(rating) {
    const target=current, now=new Date();
    rating=effectiveRating(rating,{correct,learnedFirst,usedHint,mode:target.mode});
    const entry=session.queue[session.index];
    const result=scheduleReview(schedulingKey(target),currentState,rating,now);
    const event={id:`${session.sessionId}:${session.index}`,targetId:target.id,entityId:target.entityId || null,timestamp:now.toISOString(),rating,mode:target.mode,correct,usedHint,learnedFirst,
      factId:factKey(target),claimIds:target.claimIds,evidenceKind:evidenceKind(target),answerFormat:target.answerFormat,assessment:target.answerFormat==='explanation'?'self':'answer',reason:entry.reason,schedulerId:schedulingKey(target),sessionRetry:Boolean(entry.sessionRetry),nextDue:result.card.due,log:result.log};
    if(session.practice || entry.sessionRetry) await recordReview(db,null,{...event,practice:true,nextDue:null,log:null});
    else await recordReview(db,result.card,event,{...result.card,id:legacyFactKey(target)});
    session=advanceSession(session,{id:target.id,rating,correct,learnedFirst,usedHint,mode:target.mode});
    await transaction(db,['sessions'],tx=>{
      tx.objectStore('sessions').put(session);
      if(session.status==='completed') tx.objectStore('sessions').put({...session,id:session.sessionId,completedAt:now.toISOString()});
    });
    await refresh(); await prepareQuestion();
  }
  async function checkStorage() {
    const estimate = await navigator.storage?.estimate?.() || {};
    const persistent = await navigator.storage?.persisted?.();
    let cacheBytes=0, cachedFiles=0;
    for(const name of await caches.keys()) {
      if(!name.startsWith('atlas-release-')) continue;
      const cache=await caches.open(name);
      for(const request of await cache.keys()) {
        const response=await cache.match(request); cacheBytes+=(await response.arrayBuffer()).byteLength; cachedFiles++;
      }
    }
    storageInfo={...estimate,persistent,cacheBytes,cachedFiles};
    offlineReady=cachedFiles>0 && Boolean(data);
  }
  async function checkUpdates(manual = false) {
    if (offlineTest || !navigator.onLine) { if(manual) notify('Du er frakoblet. Installert kunnskap er fortsatt tilgjengelig.'); return; }
    const prior=await get(db,'settings','updates');
    if(!manual && prior && Date.now()-new Date(prior.checkedAt)<86400000) {lastUpdate=prior;return;}
    const started=Date.now();
    try {
      const response=await fetch('/knowledge/manifest.json',{cache:'no-store'});
      if(!response.ok) throw new Error('Oversikten over kunnskapspakker er utilgjengelig.');
      const manifest=await response.json();
      if(manifest.schemaVersion!==1 || !Array.isArray(manifest.packages))throw new Error('Dette formatet for kunnskapsoversikten støttes ikke.');
      let changed=0,bytes=0;
      for(const entry of manifest.packages) {
        if(typeof entry.url!=='string' || !entry.url.startsWith('/knowledge/') || !/^[a-f0-9]{64}$/.test(entry.hash))throw new Error('Ugyldige opplysninger om kunnskapspakken.');
        const existing=await get(db,'packages',entry.id);
        if(existing?.hash===entry.hash)continue;
        if(!existing && data)continue;
        const download=await fetch(entry.url,{cache:'no-store'});
        if(!download.ok)throw new Error('Nedlasting av kunnskapspakken mislyktes.');
        const text=await download.text();
        if(await contentHash(text)!==entry.hash)throw new Error('Kontroll av kunnskapspakken mislyktes. Tidligere innhold er beholdt.');
        const pkg=JSON.parse(text);
        if(pkg.id!==entry.id || pkg.version!==entry.version)throw new Error('Kunnskapspakken stemmer ikke med oversikten.');
        await installPackage(db,pkg,{hash:entry.hash});
        bytes+=new TextEncoder().encode(text).length;changed++;
      }
      lastUpdate={id:'updates',checkedAt:new Date().toISOString(),status:'success',changed,bytes,durationMs:Date.now()-started};
      await put(db,'settings',lastUpdate);
      if(changed) {await restoreSourceContent();await refresh();}
      await logEvent(db,'updates',changed?'Kunnskapspakkene er oppdatert.':'Kunnskapen er oppdatert.','info',{changed,bytes});
      if(manual)notify(changed?'Innholdet er oppdatert.':'Kunnskapen din er oppdatert.');
    }catch(failure) {
      lastUpdate={id:'updates',checkedAt:new Date().toISOString(),status:'failed',message:failure.message,durationMs:Date.now()-started};
      await put(db,'settings',lastUpdate);await logEvent(db,'updates',failure.message,'error');
      if(manual)throw failure;
    }
  }
  async function validateKnowledge() {
    const failures=validatePackage(data);
    await logEvent(db,'validation',failures.length?'Validering av kunnskapen mislyktes.':'Kunnskapsnettverket er validert.',failures.length?'error':'info',{errors:failures});
    await refresh();notify(failures.length?failures.join(' '):'Alle kunnskapsreferanser og kilder er gyldige.');
  }
  async function readBackup(event) {
    const file=event.currentTarget.files[0]; if(!file)return;
    if(file.size>20*1024*1024)throw new Error('Velg en sikkerhetskopi mindre enn 20 MB.');
    const {validateBackup}=await import('../lib/storage.js');
    confirmRestore=validateBackup(JSON.parse(await file.text()));
    event.currentTarget.value='';
  }
  async function restore() {
    await restoreDatabase(db,confirmRestore);confirmRestore=null;
    await restoreSourceContent();
    prefs={...DEFAULT_PREFERENCES,...await get(db,'settings','preferences')};
    session=await get(db,'sessions','active') || null;
    document.documentElement.dataset.theme=prefs.theme;
    await refresh();notify('Sikkerhetskopien er gjenopprettet.');
  }
  async function applyUpdate() {
    if(sessionScreen && session?.status==='active')throw new Error('Fullfør eller sett økten på pause før du oppdaterer appen.');
    if(!registration?.waiting) {updateReady=false;return;}
    if(registration?.waiting) {
      if(session)await put(db,'sessions',{...session,draft:draftNow()});
      navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});
      registration.waiting.postMessage({type:'ACTIVATE'});
    }
  }
  async function offlineMode(enabled) {
    if(!navigator.serviceWorker.controller)throw new Error('Vent til frakoblet tilgang er klar. Last siden på nytt og prøv igjen.');
    navigator.serviceWorker.controller.postMessage({type:'OFFLINE_TEST',enabled});
    window.location.href=enabled?'/?offline-test=1':'/';
  }

  onMount(() => {
    let disposed=false;
    const route=()=>{
      const hash=window.location.hash.slice(1);
      view=['today','learn','focus','explore','progress','settings'].includes(hash)?hash:'today';
      if(view!=='today')sessionScreen=false;
      developer=false;detailId='';error='';
    };
    route(); window.addEventListener('hashchange',route);
    offlineTest=new URLSearchParams(window.location.search).has('offline-test');
    installed=window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
    const prompt=event=>{event.preventDefault();installPrompt=event;};
    window.addEventListener('beforeinstallprompt',prompt);
    const reconnect=()=>{if(db){void checkUpdates().catch(failure=>recordError('updates',failure));void checkAppUpdate();}};
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void checkAppUpdate();},APP_CHECK_INTERVAL);
    const visible=()=>{if(document.visibilityState==='visible')reconnect();};
    window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',visible);
    const unhandled=event=>{if(db)void logEvent(db,'unhandled',String(event.reason?.message || event.reason),'error').catch(()=>{});};
    window.addEventListener('unhandledrejection',unhandled);
    const boot=async()=>{
      try {
        db=await openDatabase();
        prefs={...DEFAULT_PREFERENCES,...await get(db,'settings','preferences')};
        document.documentElement.dataset.theme=prefs.theme;
        data=(await all(db,'packages'))[0] || null;
        if(!data || data.language !== 'nb') {await checkUpdates(true);data=(await all(db,'packages'))[0] || null;}
        else if(['1.1.2','1.0.1','1.0.2','1.1.0','1.1.1','1.2.0'].includes(data.version) || !data.curriculum) {try{await checkUpdates(true);data=(await all(db,'packages'))[0] || data;}catch{/* Keep the installed package usable offline. */}}
        if(!data)throw new Error('Koble til nettet én gang for å installere kunnskapsbiblioteket.');
        const mediaResponse=await fetch('/knowledge/media.json');if(mediaResponse.ok)baseMedia=await mediaResponse.json();
        await restoreSourceContent();
        maps=await Promise.all(['world','norway'].map(async id=>{const r=await fetch(`/maps/${id}.json`);if(!r.ok)throw new Error('Kartpakken er utilgjengelig.');return r.json();}));
        await refresh();session=await get(db,'sessions','active') || null;
        const journal=readJournal(localStorage,session);
        await prepareQuestion(journal?.draft || session?.draft);
        if(journal?.view===view){sessionScreen=Boolean(journal.screen && session);detailId=journal.detailId || '';}
        if('serviceWorker' in navigator && !import.meta.env.DEV) {
          registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
          updateReady=Boolean(registration.waiting);
          registration.addEventListener('updatefound',()=>{
            const worker=registration.installing;
            worker?.addEventListener('statechange',()=>{if(worker.state==='installed' || worker.state==='activated'){updateReady=Boolean(registration.waiting);void checkStorage().catch(()=>{});}});
          });
          void navigator.serviceWorker.ready.then(()=>checkStorage()).catch(()=>{});
        }
        appChecker=createAppUpdateChecker({
          fetchVersion:async()=>{if(offlineTest || !navigator.onLine)throw new Error('Koble til nettet for å sjekke oppdateringer.');const response=await fetch('/version.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Kunne ikke sjekke appversjonen. Prøv igjen.');return response.json();},
          getRegistration:()=>registration,
          onStatus:status=>{if(disposed)return;appCheck=status;if(status.state==='ready')updateReady=true;}
        });
        void checkAppUpdate();
        lastUpdate=await get(db,'settings','updates');
        void checkUpdates().catch(failure=>recordError('updates',failure));
        reportStatus(offlineTest?'Frakoblet test':navigator.onLine?'':'Uten nett');
      }catch(failure){await recordError('startup',failure);}
      finally{if(!disposed)loading=false;}
    };
    void boot();
    return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('hashchange',route);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',visible);window.removeEventListener('unhandledrejection',unhandled);db?.close();};
  });
</script>

<svelte:head><title>Atlas · Quiz</title></svelte:head>

<main id="main-view" tabindex="-1">
  {#if error}<div class="card error" role="alert"><p>{error}</p><button class="quiet" onclick={()=>error=''}>Lukk</button></div>{/if}
  {#if offlineTest}<div class="card"><p class="eyebrow">NETTVERKET ER AVSLÅTT FOR APPEN</p><p class="muted">Frakoblet test: innhold hentes bare fra det som er lagret på enheten.</p><button class="secondary" onclick={()=>run(()=>offlineMode(false))}>Avslutt frakoblet test</button></div>{/if}
  {#if updateReady && !sessionScreen}<div class="card"><p>En ny utgave er klar.</p><button class="secondary" disabled={busy} onclick={()=>run(applyUpdate)}>Oppdater appen</button><p class="muted">Fremgangen beholdes.</p></div>{/if}
  {#if loading}
    <section class="hero"><h1>Laster quiz…</h1></section><div class="card skeleton" aria-busy="true"><span></span><span></span></div>
  {:else if !data}
    <section class="hero"><h1>Koble til nettet</h1><p class="lead">Last ned spørsmålene for å komme i gang.</p><button class="primary" onclick={()=>window.location.reload()}>Prøv igjen</button></section>
  {:else if view === 'today'}
    {#if sessionScreen && session?.status === 'completed'}
      {@const answered=session.results.filter(r=>!r.lesson)}
      {@const touched=[...new Set(session.queue.map(q=>q.unitId).filter(Boolean))]}
      <section class="hero"><p class="eyebrow">{session.title || 'Økt'}</p><h1>Økten er ferdig</h1><p class="lead">{new Set(answered.map(r=>r.id)).size} spørsmål · {answered.length} svar</p></section>
      <div class="card"><div class="result-grid"><span><strong>{outcome.independent}</strong>uten hjelp</span><span><strong>{outcome.supported}</strong>med støtte</span><span><strong>{outcome.retry}</strong>øv videre</span></div></div>
      {#if touched.length && coreProgress}<div class="card"><h2>Emnene dine</h2>{#each touched as id}{@const row=coreProgress.units.get(id)}{#if row}<button class="unit-row" data-status={row.status} onclick={()=>{selectedUnit=id;navigate('learn');}}><span class="unit-dot" aria-hidden="true"></span><span class="unit-text"><strong>{unitTitle(id)}</strong><small class="muted">{UNIT_STATUS[row.status].label} · {row.correct} av {row.total} sitter</small><span class="bar small"><span style={`width:${Math.round(100*row.correct/row.total)}%`}></span></span></span><span aria-hidden="true">›</span></button>{/if}{/each}</div>{/if}
      <div class="stack">{#if retryIds.length}<button class="primary" onclick={()=>run(()=>beginSession('mixed',{targetIds:retryIds,depth:'advanced',title:'Øv videre'}))}>Øv på {retryIds.length} {retryIds.length===1?'kort':'kort'} igjen</button>{/if}
      {#if data.curriculum && !session.objective && selection.queue.length}<button class={retryIds.length?'secondary':'primary'} onclick={()=>run(()=>beginSession(null,session.scope?.unitId?{...session.scope,unitMode:'learn'}:null))}>Lær mer</button>{:else if session.objective}<button class="secondary" onclick={()=>run(()=>beginSession(session.objective || 'mixed',session.scope))}>Ta en quiz til</button>{/if}
      <button class="quiet" onclick={()=>sessionScreen=false}>Ferdig for nå</button></div>
    {:else if sessionScreen && currentLesson}
      <div class="row"><button class="quiet back-button" onclick={()=>sessionScreen=false}>← Pause</button><span class="muted">{session.index+1} av {session.queue.length}</span></div>
      <section class="exercise lesson-step">
        <p class="eyebrow">Nytt emne · {domainTitle(currentLesson.domainId)}</p>
        <h1 class="lesson-title">{currentLesson.title}</h1>
        {#each currentLesson.lesson as paragraph}<p class="lesson-text">{paragraph}</p>{/each}
        <div class="card key-card"><h2>Dette skal sitte</h2><ul class="key-points">{#each currentLesson.keyPoints as point}<li>{point}</li>{/each}</ul></div>
        <p class="muted detail">Spørsmålene om emnet kommer etter hvert i økten, og igjen de neste dagene.</p>
        <div class="quiz-actions"><button class="primary" disabled={busy} onclick={()=>run(finishLesson)}>Videre</button></div>
      </section>
    {:else if sessionScreen && current}
      <div class="row"><button class="quiet back-button" onclick={()=>sessionScreen=false}>← Pause</button><span class="muted" aria-hidden="true"></span></div>
      {#if !session.difficultyPolicy && current.difficulty===5}<div class="card"><p>Denne eldre quizen inneholder avanserte spørsmål.</p><button class="secondary" onclick={()=>run(()=>beginSession('mixed',{collectionId:current.collectionIds[0],depth:'foundation',title:titleFor(current.collectionIds[0])}))}>Start på grunnlag</button></div>{/if}
      <div class="session-progress" role="group" aria-label="Fremgang i quizen">{#if session.queue.some(q=>q.sessionRetry)}<p class="muted retry-count">{session.queue.filter(q=>q.sessionRetry).length} ekstra forsøk lagt til etter spørsmålene</p>{/if}
        <div class="row"><strong>{session.index} av {session.queue.length} fullført</strong><span class="muted">{session.queue.length-session.index} igjen</span></div>
        <div class="session-steps" role="progressbar" aria-label="Fullførte spørsmål" aria-valuemin="0" aria-valuemax={session.queue.length} aria-valuenow={session.index}>{#each session.queue as item,i}<span class:done={i<session.index} class:independent={session.results[i]?.correct===true && !session.results[i]?.usedHint && !session.results[i]?.learnedFirst} class:active={i===session.index} aria-hidden="true"></span>{/each}</div>
        <small class="muted">{outcome.independent} riktige uten hjelp · {outcome.supported} med støtte · {outcome.retry} å øve videre på</small>
      </div>
      <section class="exercise" class:question-step={!revealed}>{#if session.queue[session.index]?.sessionRetry}<p class="retry-banner">Nytt forsøk · hent fram svaret uten hjelp</p>{/if}<p class="eyebrow">{#if current.unitId}{unitTitle(current.unitId)} · {STEP_LABELS[current.step]}{:else}{stageLabel(learningStage(current))} · {modeLabel(current.mode)}{/if}</p>{#if introduction}<div class="card lesson"><h1>Kort fortalt</h1><p>{current.snapshot}</p>{#if currentObjective}<p class="muted">{currentObjective.introduction}</p>{/if}<button class="primary" onclick={()=>{introduction=false;learnedFirst=true;}}>Prøv spørsmålet</button></div>{:else}<h1 class="question" class:answered-question={revealed}>{current.prompt}</h1>
        {#if !revealed}
        {#if session.queue[session.index]?.support?.length}<details class="card"><summary>Holdepunkter før du prøver</summary>{#each session.queue[session.index].support as item}<p><strong>{item.title}</strong></p><p>{item.text}</p>{/each}<p class="muted">Du kan utforske videre selv om dette er nytt.</p></details>{/if}
        {#if !current.unitId}<details class="difficulty-note"><summary>Om nivået</summary><p class="muted">{current.difficultyReason}</p><p class="muted">{current.precision==='exact'?'Presisjon: eksakt detalj.':current.precision==='complete'?'Presisjon: alle delene må med.':'Presisjon: hovedideen.'} {current.reasoning==='explain'?'Du forklarer med egne ord.':current.reasoning==='compare'?'Du sammenligner.':current.reasoning==='order'?'Du ordner i tid.':'Du identifiserer et holdepunkt.'}</p></details>{/if}
        {#if questionSupport(current) && !revealed && !currentArtwork}<p class="muted question-context">{questionSupport(current)}</p>{/if}
        {#if currentArtwork}<figure class="artwork-figure"><img src={currentArtwork.url} alt={revealed?currentArtwork.title:'Bildet du skal undersøke'} width={currentArtwork.width} height={currentArtwork.height}><figcaption class="muted detail">{revealed?currentArtwork.title:'Se nøye på motivet før du svarer.'}</figcaption></figure>{/if}
        {#if STRUCTURED_MODES.includes(current.mode)}
          <StructuredQuiz target={current} bind:draft={formatDraft} dataset={maps.find(m=>m.id===current.datasetId)} />
        {:else if current.mode === 'map' && currentMap}
          <div class="map-board"><svg viewBox={mapViewBox} role="group" aria-label="Velg riktig område på kartet"><title>{currentDataset.title}</title>{#each currentDataset.regions as region}<path d={region.path} class:selected={selectedRegion===region.id} class:correct={revealed && region.id===current.regionId} fill-rule="evenodd" role="button" tabindex={revealed?-1:0} aria-label={`Område ${currentDataset.regions.indexOf(region)+1}`} onclick={()=>chooseRegion(region.id)} onkeydown={event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();chooseRegion(region.id);}}}/>{/each}</svg></div>
          <div class="toolbar"><button class="secondary" aria-label="Zoom inn" onclick={()=>mapZoom=Math.min(16,mapZoom*2)}>+</button><button class="secondary" aria-label="Zoom ut" onclick={()=>mapZoom=Math.max(1,mapZoom/2)}>−</button><span class="muted">Trykk på et område</span></div>
          <div class="map-pan" role="group" aria-label="Flytt kart"><button aria-label="Flytt kartet vestover" disabled={mapZoom===1} onclick={()=>mapPanX=Math.max(-.5,mapPanX-.3/mapZoom)}>←</button><button aria-label="Flytt kartet nordover" disabled={mapZoom===1} onclick={()=>mapPanY=Math.max(-.5,mapPanY-.3/mapZoom)}>↑</button><button aria-label="Flytt kartet sørover" disabled={mapZoom===1} onclick={()=>mapPanY=Math.min(.5,mapPanY+.3/mapZoom)}>↓</button><button aria-label="Flytt kartet østover" disabled={mapZoom===1} onclick={()=>mapPanX=Math.min(.5,mapPanX+.3/mapZoom)}>→</button><button class="quiet" onclick={()=>{mapZoom=1;mapPanX=0;mapPanY=0;}}>Hele kartet</button></div>
          <details class="map-source"><summary>Kartkilde</summary><p class="muted detail">{currentDataset.source.attribution || currentDataset.source.title} <a class="source-link" href={currentDataset.source.licenseUrl || currentDataset.source.url} target="_blank" rel="noreferrer">{currentDataset.source.license}</a></p></details>
        {:else if current.mode === 'outline' && currentDataset}
          <div class="map-board"><svg viewBox={mapViewBox} role="img" aria-label="Geografisk omriss uten navn"><path d={currentDataset.regions.find(r=>r.id===current.regionId).path} fill-rule="evenodd"/></svg></div>
          <p class="muted detail">{currentDataset.source.attribution || currentDataset.source.title}</p>
        {:else if current.mode === 'timeline'}
          <ol class="timeline-list">{#each timelineOrder as item,index}<li class="timeline-item"><span>{item.label}{#if revealed}<small class="muted"> · {item.year}</small>{/if}</span>{#if !revealed}<div class="row"><button class="quiet" aria-label={`Flytt ${item.label} tidligere`} disabled={index===0} onclick={()=>moveTimeline(index,-1)}>↑</button><button class="quiet" aria-label={`Flytt ${item.label} senere`} disabled={index===timelineOrder.length-1} onclick={()=>moveTimeline(index,1)}>↓</button></div>{/if}</li>{/each}</ol>
        {/if}
        {#if !revealed}
          {#if current.mode === 'recognition'}
            <div class="stack">{#each makeRecognitionOptions(current.options ? current : data.targets.find(t=>t.id===current.baseId),data.targets,4,recognitionIndex) as option}<button class="secondary" onclick={()=>answerChoice(option)}>{option.label}</button>{/each}</div>
          {:else if !STRUCTURED_MODES.includes(current.mode) && current.mode !== 'map' && current.mode !== 'timeline'}
            <form onsubmit={event=>{event.preventDefault();reveal();}}><label class="field" for="recall">{answerStyle.label}</label>{#if answerStyle.extended}<textarea id="recall" class="textarea recall-long" bind:value={answer} rows="3" placeholder={answerStyle.placeholder} autocomplete="off"></textarea>{:else}<input id="recall" class="input recall-short" class:recall-year={['numeric','decimal'].includes(answerStyle.inputMode)} bind:value={answer} inputmode={answerStyle.inputMode} placeholder={answerStyle.placeholder} autocomplete="off" spellcheck="false" enterkeyhint="done">{/if}<button class="primary" type="submit">{answer.trim()?'Kontroller svaret':'Vis svaret'}</button></form>
          {/if}
          {#if STRUCTURED_MODES.includes(current.mode)}<button class="primary" disabled={!structuredReady(current,formatDraft)} onclick={reveal}>Kontroller svaret</button>{/if}
          {#if current.mode === 'timeline'}<button class="primary" onclick={reveal}>Kontroller rekkefølgen</button>{/if}
          {#if current.mode === 'map'}<button class="quiet" onclick={()=>{correct=null;revealed=true;}}>Vis meg stedet</button>{/if}
          <button class="quiet" onclick={()=>{learnedFirst=true;correct=null;revealed=true;}}>Jeg vil lære dette først</button>
          {#if !['map','timeline',...STRUCTURED_MODES].includes(current.mode) && (current.hint || current.mode!=='recognition') && current.answerFormat!=='explanation'}<button class="quiet" onclick={()=>usedHint=true}>Hint</button>{/if}
          {#if usedHint}<p class="card muted">{current.hint || `Svaret begynner med “${current.answer[0]}”.`}</p>{/if}
        {/if}
        {/if}
        {#if revealed}
          <div class="answer-box"><p class="eyebrow">{correct===true?'RIKTIG':correct===false?'IKKE HELT':'SVARET'}</p><h2 id="answer-heading" tabindex="-1">{current.mode==='matching'?'De riktige parene':current.answer}</h2>{#if gradeNote}<p class="muted grade-note">{gradeNote}</p>{/if}{#if correct===false && answer.trim() && current.mode!=='timeline' && !STRUCTURED_MODES.includes(current.mode) && current.answerFormat!=='explanation'}<p class="your-answer">Du {current.mode==='recognition'?'valgte':'skrev'}: <strong>{answer}</strong></p>{#if current.mode==='recall'}<button class="quiet override" onclick={()=>{correct=true;gradeNote='Du godkjente svaret ditt selv.';}}>Svaret mitt var riktig</button>{/if}{/if}{#if current.mode==='matching'}<ul class="pair-answers">{#each current.pairs as pair}<li>{pair.label} <strong>{pair.answer}</strong></li>{/each}</ul>{/if}{#if current.mode==='arrows'}{@const result=gradeStructured(current,formatDraft)}<p class="muted">Retning: {result.directionCorrect?'riktig':'må øves'} · År: {result.yearCorrect?'riktig':'må øves'}</p>{/if}<p class="feedback">{explanationContext.explanation}</p>{#each explanationContext.uncertainty as note}<p class="muted">{note}</p>{/each}{#if current.answerFormat==='explanation'}<fieldset class="stack"><legend>Sammenlign med svaret ditt</legend><p><strong>Svaret ditt:</strong> {answer || 'Du skrev ikke noe svar.'}</p><p class="muted">Vurder innholdet, ikke om du brukte samme ord. Dette lagres som egenvurdering.</p>{#each current.rubric || [] as criterion}<label class="row"><input type="checkbox" disabled={!answer.trim()} checked={Boolean(formatDraft[criterion.id])} onchange={event=>{formatDraft={...formatDraft,[criterion.id]:event.currentTarget.checked};correct=Boolean(answer.trim()) && current.rubric.every(c=>formatDraft[c.id]);}}>{criterion.text}</label>{/each}</fieldset>{/if}<details><summary>Kilder</summary>{#each (current.sources || []) as source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/each}{#each current.sourceIds as sourceId}{@const source=sourceFor(sourceId)}{#if source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/if}{/each}</details></div>
          {#if current.mode==='map' && currentDataset}<details class="card"><summary>Se riktig sted</summary><div class="map-board"><svg viewBox={currentDataset.viewBox} role="img" aria-label={`Kart med ${current.answer} markert`}>{#each currentDataset.regions as region}<path d={region.path} class:correct={region.id===current.regionId} fill-rule="evenodd" />{/each}</svg></div></details>{/if}
          {#if currentArtwork}<figure class="artwork-figure"><img src={currentArtwork.url} alt={`${currentArtwork.title} av ${currentArtwork.artist}`} width={currentArtwork.width} height={currentArtwork.height} /></figure>{/if}
          {#if currentUnit}<details class="card learning-context"><summary>Om emnet: {currentUnit.title}</summary>{#each currentUnit.lesson as paragraph}<p>{paragraph}</p>{/each}<ul class="key-points">{#each currentUnit.keyPoints as point}<li>{point}</li>{/each}</ul></details>{#if currentArtwork}<details class="card learning-context"><summary>Om bildet og bildekilden</summary><p>{currentArtwork.context}</p><p class="muted detail">{currentArtwork.credit} · <a href={currentArtwork.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a> · <a href={currentArtwork.licenseUrl} target="_blank" rel="noreferrer">Lisens og bruk</a></p></details>{/if}{/if}
          {#if !current.unitId && (current.snapshot || current.followUp || currentArtwork || connections.length)}<details class="card learning-context"><summary>Fordypning og forbindelser</summary>{#if current.snapshot}<p>{current.snapshot}</p>{/if}{#if current.followUp}<p>{current.followUp}</p>{/if}{#if currentArtwork}<details><summary>Om bildet og bildekilden</summary><p>{currentArtwork.context}</p><p class="muted detail">{currentArtwork.credit} · <a href={currentArtwork.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a> · <a href={currentArtwork.licenseUrl} target="_blank" rel="noreferrer">Lisens og bruk</a></p></details>{/if}{#if connections.length}<details><summary>Les videre ({connections.length})</summary>{#each connections as relation}<p>{relation.context}</p><small class="muted">{relation.practiced?'Du har øvd på':'Et nytt holdepunkt:'} {relation.label}</small>{#if relation.evidenceStatus!=='documented'}<p class="muted">{relation.evidenceStatus==='disputed'?'Forbindelsen er omstridt.':'Forbindelsen er usikker.'}</p>{/if}{#each relation.sourceIds as sourceId}{@const source=sourceFor(sourceId)}{#if source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/if}{/each}{/each}</details>{/if}</details>{/if}
          <div class="quiz-actions">{#if usedHint || learnedFirst || correct!==true || session.practice || session.queue[session.index]?.sessionRetry}<p class="muted">{retryNote(fallbackRating()) || (session.queue[session.index]?.sessionRetry?'Lagret som øving i denne quizen':'Svar uten hjelp lagres som riktig')}</p><button class="primary" disabled={busy} onclick={()=>run(()=>rate(fallbackRating()))}>Neste</button>{:else}<p class="muted detail next-review">Neste repetisjon {whenLabel(intervals[3])}</p><button class="primary" disabled={busy} onclick={()=>run(()=>rate(3))}>Neste</button><div class="rating-alt"><button class="quiet" disabled={busy} onclick={()=>run(()=>rate(2))}>Var usikker</button><button class="quiet" disabled={busy} onclick={()=>run(()=>rate(4))}>Satt lett · {whenLabel(intervals[4])}</button></div>{/if}</div>
        {/if}
      {/if}</section>
    {:else}
      {#if !quizSetup}<section class="hero today-hero"><p class="eyebrow">{new Date().toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'})}</p><h1>{reviewedToday?'Godt i gang':'Dagens økt'}</h1><p class="lead">{reviewedToday?`${reviewedToday} svar i dag`:'Noen minutter om dagen bygger kunnskap som varer.'}</p></section>
      {#if session?.status==='active' && (current || currentLesson)}<div class="card resume-card"><h2>{session.title || 'Påbegynt økt'}</h2><p class="muted">{session.index} av {session.queue.length} gjort</p><button class="primary" onclick={()=>run(()=>resumeSession())}>Fortsett der du var</button></div>{/if}
      {#if data.curriculum}
        {@const plan=selection.queue}
        {@const fresh=plan.filter(q=>q.target && q.reason!=='Due review')}
        <div class="card session-card">
          {#if plan.length}
            <div class="plan-counts"><span><strong>{plan.filter(q=>q.reason==='Due review').length}</strong>repetisjoner</span><span><strong>{fresh.length}</strong>nye kort</span><span><strong>{plan.filter(isLessonEntry).length}</strong>{plan.filter(isLessonEntry).length===1?'nytt emne':'nye emner'}</span></div>
            {#if selection.units?.length}<p class="muted">Nytt i dag: {selection.units.map(unitTitle).join(' og ')}</p>{/if}
            <button class="primary" disabled={busy || (session?.status==='active' && Boolean(current || currentLesson) && session.title==='Dagens økt')} onclick={()=>run(()=>beginSession())}>{session?.status==='active' && session.title==='Dagens økt' && (current || currentLesson)?'Økten er påbegynt':'Start dagens økt'}</button>
          {:else}
            <h2>Ferdig for i dag</h2><p class="muted">Alt som skulle repeteres er gjort, og nye kort i de aktive emnene kommer når du har repetert de forrige. Velg et emne for å lære mer nå.</p>
          {/if}
        </div>
        {#if coreProgress}
          {@const path=recommendedUnits(data.curriculum,coreProgress,{domainIds:prefs.collectionIds}).slice(0,4)}
          <h2 class="section-title">Din læringsvei</h2>
          <div class="card path-card">{#each path as unit}{@const row=coreProgress.units.get(unit.id)}
            <button class="unit-row" data-status={row.status} onclick={()=>{selectedUnit=unit.id;navigate('learn');}}><span class="unit-dot" aria-hidden="true"></span><span class="unit-text"><strong>{unit.title}</strong><small class="muted">{domainTitle(unit.domainId)} · {row.status==='new'?'Neste emne':`${UNIT_STATUS[row.status].label} · ${row.correct}/${row.total}`}</small></span><span aria-hidden="true">›</span></button>
          {/each}</div>
        {/if}
      {:else}
      <div class="card"><h2>Dagens quiz</h2><p class="muted">{selection.queue.length} spørsmål · {prefs.depth==='foundation'?'Grunnlag':prefs.depth==='intermediate'?'Detaljer':'Sammenhenger'}</p><button class="primary" disabled={busy || !selection.queue.length} onclick={()=>run(()=>beginSession())}>Start dagens quiz</button>{#if !selection.queue.length}<p class="muted">Du er ferdig med dagens utvalg. Ta en emnequiz under.</p>{/if}<button class="quiet" onclick={()=>navigate('focus')}>Endre dagens utvalg</button></div>
      {/if}
      <div class="today-links">{#if data.curriculum}<button class="secondary" onclick={()=>{selectedUnit='';navigate('learn');}}>Alle emner →</button>{/if}<button class="quiet" onclick={()=>{quizSetup=true;window.scrollTo(0,0);}}>Fri quiz, kart og registre →</button></div>
      {/if}
      {#if quizSetup}<div class="row"><button class="quiet" onclick={()=>quizSetup=false}>← Tilbake</button><span class="muted">Lag en quiz</span></div><div class="card stack"><h2>Quiz om et emne</h2><label>Emne<select class="select" bind:value={quizCollection}><option value="">Alle emner</option>{#each data.collections as c}<option value={c.id}>{c.title}</option>{/each}</select></label><label>Nivå<select class="select" bind:value={quizDepth}><option value="foundation">Grunnlag – bli kjent</option><option value="intermediate">Detaljer – husk mer</option><option value="advanced">Avansert – rekkefølge og detaljkunnskap</option></select></label><fieldset class="format-picker"><legend>Quizform</legend><div class="format-grid">{#each FORMAT_CHOICES as format}<button class="format-choice" disabled={!formatAvailable(format.id)} aria-pressed={quizMode===format.id} onclick={()=>{quizMode=format.id;if(['chronology','before-after','arrows'].includes(quizMode))quizDepth='advanced';else if(['geography','outline','matching'].includes(quizMode) && quizDepth==='foundation')quizDepth='intermediate';}}><strong>{format.label}</strong><small>{formatAvailable(format.id)?format.note:'Ingen i dette emnet'}</small></button>{/each}</div></fieldset><button class="primary" disabled={busy || !formatAvailable(quizMode)} onclick={()=>run(()=>beginSession(quizMode,{collectionId:quizCollection,depth:quizDepth,title:quizCollection?titleFor(quizCollection):'Alle emner'}))}>Start emnequiz</button><p class="muted">{formatAvailable(quizMode)?'Så mange quizer du vil.':'Velg en tilgjengelig quizform eller et annet emne.'}</p></div>{/if}
      {@const paused=savedSessions.filter(s=>s.id!=='active' && s.sessionId!==session?.sessionId && s.status==='active')}
      {#if paused.length}<details class="card"><summary>Quizer på pause ({paused.length})</summary>{#each paused as saved}<button class="entity-row" onclick={()=>run(()=>resumeSession(saved))}>{saved.title || 'Quiz'} · {saved.index+1}/{saved.queue.length} →</button>{/each}</details>{/if}
      <button class="secondary" onclick={()=>navigate('explore')}>Finn en person eller et sted →</button>
    {/if}
  {:else if view === 'learn'}
    {#if data.curriculum && coreProgress}
      <LearningPath curriculum={data.curriculum} progress={coreProgress} sources={data.sources} bind:selectedUnit {busy}
        onstart={id=>run(()=>beginSession(null,{unitId:id,unitMode:'learn',title:unitTitle(id)}))}
        onreview={id=>run(()=>beginSession(null,{unitId:id,unitMode:'review',title:unitTitle(id)}))} />
      {#if !selectedUnit}<button class="quiet" onclick={()=>navigate('focus')}>Tilpass dagens økt →</button>{/if}
    {:else}<section class="hero"><h1>Emner</h1><p class="lead">Oppdater innholdet for å få emnene.</p></section>{/if}
  {:else if view === 'focus'}
    <button class="quiet back-button" onclick={()=>navigate('learn')}>← Emner</button>
    <section class="hero"><h1>Tilpass økten</h1><p class="lead">Gjelder dagens økt. Emnene velger du fritt under Emner.</p></section>
    <form onsubmit={event=>{event.preventDefault();run(async()=>{await savePreferences();navigate('today');});}}>
      {#if data.curriculum}<div class="card"><h2>Fagområder</h2><p class="muted">Ingen valgt betyr alle. Nye emner veksler mellom fagområdene du velger.</p><div class="chips">{#each data.curriculum.domains as domain}<button type="button" class="chip" class:active={prefs.collectionIds.includes(domain.id)} aria-pressed={prefs.collectionIds.includes(domain.id)} onclick={()=>toggleCollection(domain.id)}>{domain.title}</button>{/each}</div></div>{/if}
      <div class="card stack"><label class="field">Øktlengde<select class="select" bind:value={prefs.dailyMinutes}><option value={3}>Kort · omtrent 6 spørsmål</option><option value={5}>Vanlig · omtrent 10 spørsmål</option><option value={10}>Lang · omtrent 20 spørsmål</option></select></label><label class="field">Nytt stoff<select class="select" bind:value={prefs.newRatio}><option value={0}>Bare repetisjon når noe er klart</option><option value={0.25}>Lite nytt</option><option value={0.4}>Balansert</option><option value={0.6}>Mye nytt</option></select></label><p class="muted detail">Repetisjoner kommer alltid først. Nye kort fyller resten av økten.</p></div>
      <details class="card"><summary>Registre og fri quiz</summary><p class="muted">Disse valgene gjelder bare quizer fra registrene (Nobelpriser, kommuner, land), ikke emnene.</p><h3>Samlinger</h3><div class="chips">{#each data.collections.filter(c=>!c.core) as collection}<button type="button" class="chip" class:active={prefs.collectionIds.includes(collection.id)} aria-pressed={prefs.collectionIds.includes(collection.id)} onclick={()=>toggleCollection(collection.id)}>{collection.title}</button>{/each}</div>
      <div class="stack"><label class="field">Fagområde<select class="select" bind:value={prefs.subject}><option value="all">Alle fagområder</option>{#each [...new Set(data.collections.map(c=>c.subject))] as subject}<option value={subject}>{subjectLabel(subject)}</option>{/each}</select></label><label class="field">Nivå<select class="select" bind:value={prefs.depth}><option value="foundation">Grunnlag</option><option value="intermediate">Detaljer</option><option value="advanced">Avansert</option><option value="specialized">All installert kunnskap</option></select></label><label class="field">Geografisk relevans<select class="select" bind:value={prefs.geography}><option value="global">Global betydning</option><option value="norway">Mer norsk relevans</option></select></label><p class="muted detail">Norske spørsmål prioriteres.</p><label class="field">Bredde<select class="select" bind:value={prefs.breadth}><option value="broad">Veksle mellom fagområder</option><option value="deep">Fordypning</option></select></label><div class="row"><label class="field">Fra år<input class="input" type="number" min="-10000" max="2100" placeholder="Valgfritt" bind:value={prefs.fromYear}></label><label class="field">Til år<input class="input" type="number" min="-10000" max="2100" placeholder="Valgfritt" bind:value={prefs.toYear}></label></div><p class="muted detail">Årsfilteret gjelder spørsmål med dato.</p></div></details>
      <button class="primary" type="submit" disabled={busy}>Lagre</button>
    </form>
  {:else if view === 'explore'}
    {#if entity}
      <button class="quiet back-button" onclick={()=>detailId=''}>← Bibliotek</button><section class="hero"><p class="eyebrow">{typeLabel(entity.type)}</p><h1>{entity.label}</h1><p class="lead">{entity.summary}</p></section>{#if entity.type==='topic'}<button class="primary" onclick={()=>{selectedUnit=entity.id.replace(/^unit:/,'');navigate('learn');}}>Åpne emnet</button>{/if}{#if artworkMedia.find(m=>m.entityId===entity.id)}{@const art=artworkMedia.find(m=>m.entityId===entity.id)}<figure class="artwork-figure"><img src={art.url} alt={`${art.title} av ${art.artist}`} width={art.width} height={art.height}><figcaption class="muted detail">{art.credit} · <a href={art.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a></figcaption></figure>{/if}
      {#if sourceQueries(entity,data.sources).length}<div class="card stack"><button class="secondary" disabled={busy} onclick={()=>run(()=>loadMoreSources(entity.id))}>Hent bilder og flere spørsmål</button><p class="muted detail">Henter kildebelagte forbindelser og bilder med fri bruk. Innholdet lagres på denne enheten.</p>{#if sourceProgress || sourceStatus}<p class="muted" role="status">{sourceProgress || sourceStatus}</p>{/if}</div>{/if}
      <div class="card stack"><label>Quiznivå<select bind:value={quizDepth}><option value="foundation">Grunnlag</option><option value="intermediate">Detaljer</option><option value="advanced">Avansert</option></select></label><button class="primary" disabled={busy || !targets.some(t=>t.entityId===entity.id)} onclick={()=>run(()=>beginSession('mixed',{entityId:entity.id,title:entity.label,depth:quizDepth}))}>Quiz om {entity.label}</button>{#if !targets.some(t=>t.entityId===entity.id)}<p class="muted">Denne siden har ikke quizspørsmål ennå.</p>{/if}</div>
      <div class="chips">{#each entity.collectionIds as id}<button class="chip" onclick={()=>run(()=>beginSession('mixed',{collectionId:id,depth:quizDepth,title:titleFor(id)}))}>Quiz: {titleFor(id)} →</button>{/each}</div>
      <h2 class="section-title">Sammenhenger</h2><div class="card">{#each entityRelationships.slice(0,relationshipLimit) as relation}{@const other=data.entities.find(e=>e.id===(relation.from===entity.id?relation.to:relation.from))}<button class="entity-row" onclick={()=>detailId=other?.id || ''}><span><small class="eyebrow">{relation.from===entity.id?relationLabel(relation.type):`${relationLabel(relation.type)} · inngående`}</small><strong>{other?.label}</strong><small class="muted">{relation.context}</small></span><span aria-hidden="true">↗</span></button>{/each}</div>
      {#if entityRelationships.length > relationshipLimit}<button class="secondary" onclick={()=>relationshipLimit+=40}>Vis flere forbindelser ({entityRelationships.length})</button>{/if}
      <h2 class="section-title">Flere spørsmål</h2>{#each targets.filter(t=>t.entityId===entity.id && !t.baseId).sort((a,b)=>a.difficulty-b.difficulty).slice(0,6) as target}<div class="card"><small class="muted">{stageLabel(learningStage(target))} · nivå {target.difficulty}/5</small><p>{target.prompt}</p><details><summary>Vis svar</summary><h3>{target.answer}</h3><p class="muted">{target.explanation}</p></details></div>{/each}
      <div class="card"><h2>Kilder</h2>{#each entity.sourceIds as id}{@const source=sourceFor(id)}{#if source}<p><a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></p>{/if}{/each}</div>
    {:else}
      <section class="hero"><h1>Finn et emne</h1></section><label class="field" for="search">Søk i biblioteket</label><input class="input" id="search" bind:value={query} type="search" placeholder="En person, et sted eller en idé"><label class="field">Samling<select class="select" bind:value={collectionFilter}><option value="">All kunnskap</option>{#each data.collections as collection}<option value={collection.id}>{collection.title}</option>{/each}</select></label><p class="muted detail">Søk etter en person, et sted eller et verk.</p><div class="card stack"><button class="secondary" disabled={busy} onclick={()=>run(()=>loadMoreSources())}>Hent flere bilder og spørsmål</button><p class="muted detail">Henter opptil åtte nye kildeposter i valgt samling. Bilder og spørsmål lagres lokalt og kan brukes uten nett.</p><p class="muted" role="status">{sourceProgress || sourceStatus}</p></div>{#if collectionFilter}<div class="card stack"><label>Quiznivå<select bind:value={quizDepth}><option value="foundation">Grunnlag</option><option value="intermediate">Detaljer</option><option value="advanced">Avansert</option></select></label><button class="primary" disabled={busy} onclick={()=>run(()=>beginSession('mixed',{collectionId:collectionFilter,depth:quizDepth,title:titleFor(collectionFilter)}))}>Start quiz: {titleFor(collectionFilter)}</button></div>{/if}
      <div class="entity-list">{#each matchingEntities as item}<button class="entity-row" onclick={()=>detailId=item.id}><span><small class="eyebrow">{typeLabel(item.type)}</small><strong>{item.label}</strong><small class="muted">{item.summary}</small></span><span aria-hidden="true">↗</span></button>{:else}<p class="empty">Ingen treff ennå. Prøv et annet navn eller en annen samling.</p>{/each}</div>
      <p class="muted detail">Viser {matchingEntities.length} av {allMatchingEntities.length} treff.</p>{#if matchingEntities.length < allMatchingEntities.length}<button class="secondary" onclick={()=>exploreLimit+=60}>Vis flere</button>{/if}
      
    {/if}
  {:else if view === 'progress'}
    <section class="hero"><h1>Fremgang</h1></section><div class="chips progress-tabs" role="group" aria-label="Velg fremgangsvisning">{#each [{id:'overview',label:'Oversikt'},{id:'levels',label:'Nivåer'},{id:'topics',label:'Emner'},{id:'library',label:'Innholdsdekning'},{id:'history',label:'Siste svar'}] as tab}<button class="chip" aria-pressed={progressTab===tab.id} onclick={()=>{progressTab=tab.id;window.scrollTo(0,0);}}>{tab.label}</button>{/each}</div>
    {#if progressTab==='overview'}
    <div class="card"><div class="stat-row"><div class="stat"><strong>{summary.answered}</strong><span>Ulike spørsmål besvart</span></div><div class="stat"><strong>{summary.correct}</strong><span>Riktige uten hjelp sist</span></div></div><p class="muted">Dagens quiz og emnequizer teller med.</p></div>
    <div class="card"><h2>Øv videre</h2><p class="muted">{progress.retryIds.length} spørsmål hadde sist feil svar eller læringsstøtte.</p><button class="primary" disabled={!progress.retryIds.length || busy} onclick={()=>run(()=>beginSession('mixed',{targetIds:progress.retryIds,depth:'advanced',title:'Øv videre'}))}>Øv på det du trenger</button></div>
    <div class="card"><h2>Siste sju dager</h2><div class="week-activity">{#each progress.days as day}<div><strong>{day.count}</strong><span class="activity-bar" style={`height:${8+Math.min(60,day.count*3)}px`}></span><small>{day.label}</small></div>{/each}</div><p class="muted">Antall besvarte oppgaver, inkludert ekstraøving.</p></div>
    {/if}
    {#if progressTab==='overview' && data.curriculum && coreProgress}<div class="card"><h2>Kunnskapskart</h2><p class="muted">Andel kort du sist svarte riktig på uten hjelp, per fagområde.</p>{#each data.curriculum.domains as domain}{@const row=coreProgress.domains.get(domain.id)}<button class="unit-row" onclick={()=>{selectedUnit='';navigate('learn');}}><span class="unit-text"><strong>{domain.title}</strong><small class="muted">{row.complete} av {row.units} emner gjennomført · {row.correct} av {row.total} kort</small><span class="bar small"><span style={`width:${row.total?Math.round(100*row.correct/row.total):0}%`}></span></span></span></button>{/each}</div>{/if}
    {#if progressTab==='overview'}<div class="card"><h2>Hva slags øving?</h2><p class="muted">Siste svar uten hjelp, fordelt på ferdighet. Egenvurderte forklaringer er ikke en måling av full mestring.</p><div class="result-grid"><span><strong>{abilities.recognized}</strong>gjenkjent</span><span><strong>{abilities.recalled}</strong>hentet fram</span><span><strong>{abilities.explained}</strong>forklart med egenvurdering</span></div></div>{/if}
    {#if progressTab==='library'}<div class="card"><h2>Hva inneholder biblioteket?</h2><p class="muted">Dette viser innhold og mangler. Det måler ikke kunnskapen din eller full dekning av et fag.</p></div>{#each contentCoverage as coverage}<details class="card"><summary>{coverage.title}</summary><p class="muted">{coverage.scope}</p><p>{coverage.facts} testede fakta · {coverage.introductions} introduksjoner · {coverage.connections} sammenhengsøvelser · {coverage.paths} læringsstier</p><p class="muted">{coverage.untestedEntities} registeroppføringer uten øvelser. {coverage.sourced} testede fakta har kilder.</p>{#if coverage.gaps.length}<h3>Videre utvikling</h3><ul>{#each coverage.gaps as gap}<li>{gap}</li>{/each}</ul>{/if}</details>{/each}{/if}
    {#if progressTab==='levels'}<h2 class="section-title">Nivåene dine</h2>{#each ['foundation','details','connections'] as stage}{@const result=quizProgress(targets.filter(t=>learningStage(t)===stage),reviews)}<div class="card"><h3>{stageLabel(stage)}</h3><p class="muted">{stage==='foundation'?'Bli kjent med personer, steder og hendelser.':stage==='details'?'Øv på årstall og flere fakta.':'Øv på rekkefølge og forbindelser.'}</p><div class="coverage-track" role="img" aria-label={`${result.correct} riktige uten hjelp, ${result.answered-result.correct} trenger øving, ${result.remaining} usett`}><span class="coverage-correct" style={`width:${result.total?100*result.correct/result.total:0}%`}></span><span class="coverage-practice" style={`width:${result.total?100*(result.answered-result.correct)/result.total:0}%`}></span></div><p class="muted">{result.correct} riktige uten hjelp · {result.answered-result.correct} trenger øving · {result.remaining} usett</p></div>{/each}
    {/if}
    {#if progressTab==='topics'}<h2 class="section-title">Emner du har øvd på</h2>{#each data.collections as collection}{@const result=quizProgress(targets.filter(t=>t.collectionIds.includes(collection.id)),reviews)}{#if result.answered}<button class="entity-row" onclick={()=>{quizCollection=collection.id;quizSetup=true;navigate('today');}}><span><strong>{collection.title}</strong><small>{result.answered} besvart · {result.correct} riktige sist</small></span><span>→</span></button>{/if}{/each}
    {/if}
    {#if !summary.answered && progressTab==='overview'}<p class="muted">Start en quiz for å se fremgangen din.</p><button class="primary" onclick={()=>navigate('today')}>Velg quiz</button>{/if}
    {#if progressTab==='history'}<details class="card" open><summary>Siste svar</summary>{#each [...reviews].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,10) as review}<p class="detail"><strong>{targets.find(t=>t.id===review.targetId)?.prompt || 'Tidligere spørsmål'}</strong><br><span class="muted">{review.learnedFirst?'Lært først':review.usedHint?'Med hint':review.correct===true?'Riktig':review.correct===false?'Feil':'Svar vist'} · {displayDate(review.timestamp)}</span></p>{/each}</details>{/if}
  {:else if view === 'settings'}
    {#if developer}
      <button class="quiet back-button" onclick={()=>developer=false}>← Innstillinger</button><section class="hero"><p class="eyebrow">PÅ ENHETEN DIN</p><h1>Bak<br>øvingen.</h1><p class="lead">Faktiske målinger og lokal diagnostikk.</p></section>
      <div class="card"><h2>Lagring og frakoblet tilgang</h2><p>Nettleserbruk: {storageInfo.usage===undefined?'Utilgjengelig':`${Math.round(storageInfo.usage/1024)} KB`}</p><p>Nettleserkvote: {storageInfo.quota===undefined?'Utilgjengelig':`${Math.round(storageInfo.quota/1024/1024)} MB`}</p><p>Lagrede appdata: {Math.round((storageInfo.cacheBytes || 0)/1024)} KB · {storageInfo.cachedFiles || 0} filer</p><p>Varig lagring: {storageInfo.persistent?'Innvilget':'Ikke innvilget eller støttet'}</p><p>Frakoblet app: {offlineReady?'Installert':'Klargjøres eller er utilgjengelig'}</p><button class="secondary" onclick={()=>run(checkStorage)}>Kontroller frakoblet tilgang</button><button class="secondary" onclick={()=>run(()=>offlineMode(true))}>Test uten nettverk</button><p class="muted detail">Testen blokkerer nettverksforespørsler i Atlas. Det er fortsatt nyttig å teste med flymodus på telefonen.</p></div>
      {@const ready=readiness(data)}<div class="card"><h2>Kunnskapsintegritet</h2><p>{data.entities.length} kunnskapselementer · {data.relationships.length} forbindelser · {data.targets.length} kvalitetssikrede øvelsesmål</p><p>{data.sources.length} kilder · {data.collections.length} samlinger</p><p>Kunnskapsberedskap: {ready.score}% av kriteriene for installert pakke</p><p class="muted detail">40 % kildedekning + 30 % forklaringsdekning + 30 % forbindelsesdekning. Måler den installerte pakken, ikke full fagdekning eller hvor godt du husker.</p><button class="secondary" onclick={()=>run(validateKnowledge)}>Valider kunnskapsdatabasen</button><button class="secondary" onclick={()=>run(async()=>{await installPackage(db,data,{hash:data.hash});notify('Kunnskapsindeksene er gjenbygd; læringshistorikken er beholdt.');})}>Bygg kunnskapsindeksene på nytt</button></div>
      <div class="card"><h2>Repetisjonsplan</h2><p>FSRS · ts-fsrs 5.4.2 · mål for bevaring 90%</p><p class="muted">Innholdets vanskelighetsgrad og betydning er redaksjonelle anslag. Personlig vanskelighetsgrad og stabilitet beregnes fra dine egne repetisjoner.</p>{#each [...reviews].reverse().slice(0,8) as review}{@const state=states.find(s=>s.id===(review.schedulerId || review.targetId))}<details><summary>{review.targetId}</summary><p>{reasonLabel(review.reason)} · {ratingLabels[review.rating-1]}</p><p>Stabilitet: {state?.stability?.toFixed(1) || '0'} dager · vanskelighetsgrad {state?.difficulty?.toFixed(1) || '0'}</p><p>{review.nextDue?`Neste repetisjon: ${new Date(review.nextDue).toLocaleString('nb-NO')}`:'Ekstraøving'}</p></details>{/each}</div>
      <div class="card"><h2>Kunnskapsoppdateringer</h2><p>{data.id} · {data.version} · skjema {data.schemaVersion}</p><p>Siste kontroll: {lastUpdate?new Date(lastUpdate.checkedAt).toLocaleString('nb-NO'):'Ikke kontrollert'}</p><p>Status: {lastUpdate?.status === 'success' ? 'Vellykket' : lastUpdate?.status === 'failed' ? 'Mislyktes' : 'Ukjent'}{lastUpdate?.message?` · ${lastUpdate.message}`:''}</p><p class="muted detail">{lastUpdate?.bytes || 0} byte lastet ned · {lastUpdate?.durationMs || 0} ms. Kontrollen kjøres omtrent daglig mens Atlas er åpen. Appen trenger ikke kjøre når den er lukket.</p><button class="secondary" disabled={busy} onclick={()=>run(()=>checkUpdates(true))}>Oppdater innhold</button></div>
      <div class="card"><h2>Lokal diagnostikklogg</h2>{#each [...logs].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,10) as log}<p class="detail"><strong>{log.component} · {log.severity === 'error' ? 'Feil' : log.severity === 'warning' ? 'Advarsel' : 'Informasjon'}</strong><br>{log.message}<br><span class="muted">{new Date(log.timestamp).toLocaleString('nb-NO')}</span></p>{:else}<p class="muted">Ingen feil er registrert.</p>{/each}<button class="secondary" onclick={()=>download({exportedAt:new Date().toISOString(),logs},'atlas-diagnostics.json')}>Eksporter diagnostikk</button><button class="quiet danger" onclick={()=>pendingDestruction='logs'}>Tøm loggen…</button></div>
    {:else}
      <section class="hero"><h1>Innstillinger</h1></section>
      <div class="card stack"><h2>Appoppdatering</h2><p class="muted">Installert: {APP_VERSION}</p><button class="secondary" disabled={appCheck.state==='checking'} onclick={()=>checkAppUpdate(true)}>{appCheck.state==='checking'?'Sjekker …':'Se etter appoppdatering'}</button>{#if updateReady}<button class="primary" disabled={busy} onclick={()=>run(applyUpdate)}>Installer oppdatering</button>{:else if appCheck.state==='current'}<p role="status">Du har nyeste utgave.</p>{:else if appCheck.state==='pending'}<p role="status">Ny utgave er publisert, men ennå ikke aktiv i denne fanen.</p><button class="secondary" onclick={()=>run(async()=>{if(session)await put(db,'sessions',{...session,draft:draftNow()});window.location.reload();})}>Last inn appen på nytt</button>{:else if appCheck.state==='failed'}<p role="status">{appCheck.message}</p>{/if}{#if appCheck.checkedAt}<p class="muted">Sist sjekket: {new Date(appCheck.checkedAt).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'})}</p>{/if}<p class="muted">Sjekkes automatisk hvert femte minutt mens appen er åpen.</p></div>
      <div class="card stack"><label class="field">Utseende<select class="select" bind:value={prefs.theme} onchange={()=>run(savePreferences)}><option value="system">Følg enheten</option><option value="light">Lyst</option><option value="dark">Mørkt</option></select></label></div>
      {#if !installed}<div class="card install-card"><h2>Installer Atlas</h2><p class="muted">På iPhone: åpne i Safari og velg Del → Legg til på Hjem-skjerm. På Android: velg Installer app eller Legg til på startskjermen i nettleseren.</p>{#if installPrompt}<button class="secondary" onclick={()=>run(async()=>{await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;})}>Installer Atlas</button>{/if}</div>{/if}
      <div class="card"><h2>Ta vare på en kopi</h2><p class="muted">Svar og fremgang lagres i denne nettleseren, uten konto. Ta en sikkerhetskopi før du bytter enhet eller sletter nettleserdata.</p><button class="secondary" disabled={busy} onclick={()=>run(async()=>download(await exportDatabase(db),`atlas-backup-${new Date().toISOString().slice(0,10)}.json`))}>Last ned sikkerhetskopi</button><label class="field">Gjenopprett en Atlas-sikkerhetskopi<input class="input" type="file" accept=".json,application/json" onchange={event=>run(()=>readBackup(event))}></label><button class="quiet" onclick={()=>run(async()=>{const granted=await navigator.storage?.persist?.();notify(granted?'Varig lagring er innvilget.':'Nettleseren innvilget ikke varig lagring. Ta sikkerhetskopi jevnlig.');})}>Be om varig lagring</button></div>
      <div class="card"><h2>En daglig påminnelse</h2><label class="field">Tidspunkt for øving<input class="input" type="time" bind:value={prefs.reminderTime}></label><button class="secondary" onclick={()=>run(async()=>{await savePreferences();download(reminderCalendar(prefs.reminderTime),'atlas-daily-practice.ics','text/calendar');})}>Legg til kalenderpåminnelse</button><p class="muted detail">Påminnelsen legges i kalenderen din.</p></div>
      <div class="card"><h2>Innhold</h2><p>{data.collections.length} emner · versjon {data.version}</p><button class="secondary" disabled={busy} onclick={()=>run(()=>checkUpdates(true))}>Oppdater innhold</button><p class="muted detail">Fremgangen din beholdes ved oppdatering.</p></div>
      <button class="secondary" onclick={()=>run(async()=>{await checkStorage();await refresh();developer=true;})}>Utviklerdiagnostikk →</button><p class="muted detail">Atlas {APP_VERSION}</p>
    {/if}
  {/if}
  {#if confirmRestore}<div class="card error" role="alert"><h2>Erstatte lokale data?</h2><p>Dette gjenoppretter sikkerhetskopien fra {displayDate(confirmRestore.exportedAt)} og erstatter kunnskapen og læringshistorikken på denne enheten. Eksporter en kopi først hvis du vil beholde den.</p><button class="primary" disabled={busy} onclick={()=>run(restore)}>Erstatt med denne sikkerhetskopien</button><button class="secondary" onclick={()=>confirmRestore=null}>Avbryt</button></div>{/if}
  {#if pendingDestruction==='logs'}<div class="card error" role="alert"><h2>Tømme diagnostikkloggen?</h2><p>Læringshistorikken beholdes. Den lokale diagnostikkloggen slettes.</p><button class="primary" onclick={()=>run(async()=>{await clearLogs(db);pendingDestruction='';await refresh();})}>Tøm diagnostikkloggen</button><button class="secondary" onclick={()=>pendingDestruction=''}>Avbryt</button></div>{/if}
</main>
<Feedback context={()=>({appVersion:APP_VERSION,view,developer,packageId:data?.id,packageVersion:data?.version,target:current?{id:current.id,prompt:current.prompt,mode:current.mode,entityId:current.entityId}:null,session:sessionScreen?{index:session?.index,total:session?.queue.length,revealed,correct,usedHint}:null,focus:JSON.parse(JSON.stringify(prefs)),offlineTest,error})}/>
{#if toast}<div id="toast" class="toast" role="status" aria-live="polite"><span>{toast}</span><button class="quiet" aria-label="Lukk melding" onclick={()=>toast=''}>×</button></div>{/if}
