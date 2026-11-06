<script>
  import {learningCoverage,evidenceOverview} from '../lib/learning-coverage.js';
  import { onMount, tick } from 'svelte';
  import {attachKnowledge,schedulingKey,legacyFactKey,evidenceKind} from '../lib/knowledge-model.js';
  import {selectLearningPath,selectConnectedSession,objectiveStatus,safeLearningQueue} from '../lib/connected-learning.js';
  import {sourceQueries,loadSourceContent,mergeSourceContent,downloadSourceImage} from '../lib/source-loading.js';
  import StructuredQuiz from '../lib/StructuredQuiz.svelte';
  import PanZoomMap from '../lib/PanZoomMap.svelte';
  import SortableList from '../lib/SortableList.svelte';
  import {pathBounds,unionBox} from '../lib/map-view.js';
  import {LEVELS,AXES,levelName,estimateVariants,timelineTargets,FAMILIAR_ISO3,preferredLevel,levelFromDepth,levelsWithQuestions,usableLevel,profileSummary,axisInsights} from '../lib/levels.js';
  import LearningPath from '../lib/LearningPath.svelte';
  import StorySpine from '../lib/StorySpine.svelte';
  import {chapterFor,yearSpan,weavePerspectives,simultaneityTargets,PERSPECTIVE_REASON,perspectiveLabel} from '../lib/story.js';
  import {buildDailySession,buildUnitReview,curriculumProgress,recommendedUnits,gradeAnswer,knownNameSet,isLessonEntry,practiceStreak,UNIT_STATUS} from '../lib/progression.js';
  import {STEP_LABELS,formatYear} from '../lib/core-curriculum.js';
  import {FORMAT_CHOICES,WORLD_FORMAT_CHOICES,STRUCTURED_MODES,buildFormatTargets,gradeStructured,structuredReady} from '../lib/quiz-formats.js';
  import WorldExplorer from '../lib/WorldExplorer.svelte';
  import {buildWorldGraph,relevanceScores,DEFAULT_RELEVANCE} from '../lib/world-graph.js';
  import Flag from '../lib/Flag.svelte';
  import {buildWorldTargets} from '../lib/world-exercises.js';
  import {buildThemeTargets} from '../lib/listening/theme-exercises.js';
  import {buildListeningTargets} from '../lib/listening/exercises.js';
  import {buildDistanceTargets} from '../lib/time-distance.js';
  import {TIME_ANCHORS} from '../../knowledge-build/time-anchors.mjs';
  import {advanceSession,nextActionNote,retryTargets} from '../lib/repetition.js';
  import {progressDetails,sessionOutcome,selfApprovals} from '../lib/progress.js';
  import {assessTargets} from '../lib/difficulty.js';
  import {APP_VERSION,APP_CHECK_INTERVAL,OFFLINE_HEADER,createAppUpdateChecker} from '../lib/app-updates.js';
  import {foundationTargets} from '../lib/foundations.js';
  import {factKey,learningStage,quizProgress,overviewBounds,effectiveRating} from '../lib/journey.js';
  import {saveJournal,readJournal,questionDraft,restoreDraft,dropRetired} from '../lib/session-journal.js';
  import {hintSteps,removesOption,removedOption} from '../lib/hints.js';
  import Feedback from '../lib/Feedback.svelte';
  import {answerPresentation,contextualExplanation,questionSupport} from '../lib/presentation.js';
  import { openDatabase, all, get, put, installPackage, recordReview, logEvent, exportDatabase, restoreDatabase, clearLogs, transaction } from '../lib/storage.js';
  import { validatePackage, contentHash, readiness } from '../lib/content.js';
  import { readUiState, saveUiState } from '../lib/ui-state.js';
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
  // The learner approved a typed answer the grader did not recognise. Stored as self-assessment, never as "Satt lett".
  let selfApproved = $state(false);
  let preparedTargetId = $state('');
  let savedSessions = $state.raw([]);
  let quizCollection = $state('');
  let quizLevel = $state(2);
  let atlasTab = $state('tid');
  let meTab = $state('fremgang');
  let quizMode = $state('mixed');
  let quizSetup = $state(false);
  let progressTab = $state('overview');
  // Where the learner was (tabs, open page, search, timeline, quiz choices, scroll), kept between visits.
  let timelineState = $state({zoom:'',domain:'',selectedId:''});
  let scrollY = $state(0);
  let uiReady = $state(false);
  let restoreScroll = 0;
  const uiSnapshot = () => ({view,atlasTab,meTab,progressTab,query,collectionFilter,selectedUnit,detailId,quizSetup,quiz:{collection:quizCollection,level:quizLevel,mode:quizMode},timeline:{...timelineState},scrollY});
  function keepUiState(){try{saveUiState(localStorage,uiSnapshot());}catch{/* The app still works; it just opens at the start next time. */}}
  $effect(()=>{const state=uiSnapshot();if(uiReady && state)keepUiState();});
  let journalWarning = false;
  const stageLabel = stage => ({foundation:'Grunnlag',details:'Detaljer',connections:'Avansert'}[stage] || stage);
  function draftNow() { return questionDraft(current?.id,{answer,formatDraft,correct,revealed,usedHint,hintLevel,timelineOrder,selectedRegion,mapView,introduction,learnedFirst,gradeNote,selfApproved}); }
  $effect(()=>{
    if(loading || !session || (current && preparedTargetId!==current.id))return;
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
  let hintLevel = $state(0);
  let timelineOrder = $state.raw([]);
  let selectedRegion = $state('');
  let query = $state('');
  let collectionFilter = $state('');
  let detailId = $state('');
  let restoreInput = $state();
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
  let mapView = $state.raw(null);
  let quizMap = $state();
  let confirmRestore = $state.raw(null);
  let pendingDestruction = $state('');
  let lastUpdate = $state.raw(null);

  const ratingLabels = ['Igjen', 'Vanskelig', 'Bra', 'Lett'];
  const ratingNotes = ['Husket ikke', 'Husket med innsats', 'Husket riktig', 'Husket lett'];
  const reasonLabel = reason => reason===PERSPECTIVE_REASON?'Perspektiv':reason==='Connected introduction'?'Nytt holdepunkt':reason==='Connected recall'?'Neste sammenheng': reason === 'Due review' ? 'Repetisjon' : reason === 'New knowledge' ? 'Ny kunnskap' : reason === 'Session retry' ? 'Nytt forsøk i denne quizen' : reason === 'Extra practice' ? 'Ekstraøving' : reason;
  const modeLabel = mode => ({theme:'KJENN IGJEN TEMAET',listen:'LYTT',distance:'NÆRMEST I TID',estimate:'NÅR SKJEDDE DET?',recall:'SKRIV SVARET',recognition:'FLERVALG',outline:'GJENKJENN OMRISS',map:'KART',timeline:'TIDSLINJE',matching:'KOBLE SAMMEN','before-after':'HVA KOM FØRST?',arrows:'HISTORISKE PILER',pick:'VELG FLAGG','border-walk':'NABOREISE'}[mode] || mode);
  const subjectLabel = subject => ({history:'Historie',geography:'Geografi',politics:'Politikk',literature:'Litteratur',art:'Kunst',science:'Vitenskap',philosophy:'Filosofi',economics:'Økonomi',nobel:'Nobelpriser',historiography:'Historiesyn','current-affairs':'Aktuelt'}[subject] || subject);
  const typeLabel = type => ({'topic':'Emne','document':'Dokument','space-mission':'Romoppdrag','military-operation':'Militær operasjon','fictional-character':'Litterær figur',person:'Person','country-area':'Land eller område','municipality':'Kommune','award-event':'Pristildeling',country:'Land',city:'By',region:'Region',event:'Hendelse',work:'Verk',concept:'Begrep',organization:'Organisasjon',award:'Pris',discovery:'Oppdagelse',movement:'Bevegelse',office:'Embete',period:'Periode',artwork:'Kunstverk',scientific_discovery:'Vitenskapelig oppdagelse',historical_event:'Historisk hendelse',literary_work:'Litterært verk','literary-work':'Litterært verk','political-office':'Politisk embete','former-county':'Tidligere fylke',county:'Fylke',lens:'Historiesyn','scholarly-work':'Faglig verk',threshold:'Terskel i Big History','news-event':'Nyhet'}[type] || type);
  const relationLabel = type => ({'born-in':'Født i','died-in':'Døde i','located-in':'Ligger i','part-of':'Del av','located-in-country':'Ligger i landet','birthplace-in-current-country':'Fødested ligger i dagens land','award-time-affiliation':'Tilknytning da prisen ble tildelt','awarded-prize':'Pristildeling','award-category':'Priskategori','recognized-contribution':'Anerkjente bidraget',awarded:'Ble tildelt','held-office':'Hadde embetet','succeeded':'Etterfulgte','capital-of':'Hovedstad i','in-region':'Ligger i','formerly-part-of':'Tidligere del av',received:'Mottok','recognized-for':'Anerkjent for','written-by':'Skrevet av','created-by':'Skapt av','prepared-for-visit':'Laget før besøk av','depicts-place':'Viser stedet','concerns-document':'Gjelder dokumentet','involves-person':'Omfatter personen','took-place-in':'Fant sted i',adopted:'Vedtok',drafted:'Skrev utkast til',commanded:'Ledet',established:'Opprettet','founded-under':'Grunnlagt under','crew-member':'Medlem av besetningen','author-of':'Forfatter av','features-character':'Har figuren','uses-device':'Bruker virkemiddelet','work-type':'Verkstype',borders:'Grenser til','knowledge-flow':'Kunnskapsflyt','shaped-lens':'Stemme i historiesynet','key-work-for':'Nøkkelverk for','uses-concept':'Bruker begrepet',proposed:'Knyttet til begrepet',influenced:'Påvirket','emplotted-as':'Lest som',precedes:'Kom før','views-through':'Ser på',mentions:'Omtaler'}[type] || type);
  const worldIds = ['nor','fra','ita','bra','jpn','egy','usa','ind','aus','deu','esp','zaf','gbr','swe','fin','dnk','pol'];
  function regionSpan(region) {
    const numbers = region.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const xs = numbers.filter((_,i)=>i%2===0), ys = numbers.filter((_,i)=>i%2===1);
    return xs.length ? (Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)) : 0;
  }

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

  let worldGraph = $derived(data?.perspectives ? buildWorldGraph(data) : null);
  let recognitionIndex = $derived(buildRecognitionIndex(data?.targets || []));
  let knownNames = $derived(knownNameSet(data));
  let targets = $derived.by(() => {
    if (!data) return [];
    const core = data.targets.filter(t => t.unitId);
    const legacy = data.targets.filter(t => !t.unitId);
    const base = legacy.map(t => ({...t, mode:'recall'}));
    const recognition = legacy.filter(t => t.answerFormat!=='explanation' && hasRecognitionOptions(t, recognitionIndex))
      .map(t => ({...t, id:`${t.id}:recognition`, baseId:t.id, mode:'recognition', significance:Math.max(1,t.significance-1)}));
    const byIso = new Map(data.entities.filter(e => e.iso3).map(e => [e.iso3.toLowerCase(), e]));
    const mapTargets = maps.flatMap(dataset => dataset.regions.filter(r => dataset.id === 'norway' || worldIds.includes(r.id) || (byIso.has(r.id) && regionSpan(r) >= 450 && !['fji','atf'].includes(r.id))).flatMap(rawRegion => {
      // Country names come from the Norwegian register; the map file only has English names for most countries.
      const region = dataset.id === 'world' && byIso.has(rawRegion.id) ? {...rawRegion, label: byIso.get(rawRegion.id).label} : rawRegion;
      const countryEntity = (dataset.id === 'world' && byIso.get(region.id)) || data.entities.find(e => e.label.toLowerCase() === region.label.toLowerCase());
      const collectionIds = dataset.id === 'norway' ? ['norway'] : ['world-geography'];
      const span = regionSpan(rawRegion);
      // Familiar or large countries are easier to find; small and rarely mentioned ones are not.
      const familiarity = dataset.id === 'norway' ? 1 : FAMILIAR_ISO3.has(region.id) ? 1 : span >= 2500 ? 2 : 3;
      const common = { entityId:countryEntity?.id, collectionIds, datasetId:dataset.id, regionId:region.id, answer:region.label, familiarity,
        acceptedAnswers:[], explanation:`${region.label} er markert på det publiserte kartet over ${dataset.id === 'norway' ? 'norske fylker' : 'verdens land'}.`,
        sourceIds:[], difficulty:2, significance:3, kind:'recognition' };
      return [{...common,id:`map:${dataset.id}:${region.id}`,mode:'map',prompt:`Finn ${region.label} på kartet.`},
        {...common,id:`outline:${dataset.id}:${region.id}`,mode:'outline',prompt:`Hvilket ${dataset.id === 'norway' ? 'fylke' : 'land'} er dette?`}];
    }));
    const timelines = timelineTargets(data);
    const familiarCountries = new Set(data.entities.filter(e => e.iso3 && FAMILIAR_ISO3.has(e.iso3.toLowerCase())).map(e => e.id));
    const marked = base.map(t => t.id.startsWith('geo-capital-') && familiarCountries.has(t.entityId) ? {...t, familiarCountry:true} : t);
    const estimates = estimateVariants([...core, ...base]);
    const introductions=foundationTargets(data);
    const anchored=new Set(introductions.filter(t=>!t.id.startsWith('foundation:period:')).map(t=>t.entityId));
    return attachKnowledge(assessTargets([...introductions.filter(t=>!t.id.startsWith('foundation:period:') || !anchored.has(t.entityId)), ...core, ...marked, ...recognition.map(t=>familiarCountries.has(t.entityId) && t.id.startsWith('geo-capital-')?{...t,familiarCountry:true}:t), ...estimates, ...mapTargets, ...timelines, ...buildFormatTargets(data,maps), ...simultaneityTargets(data), ...buildThemeTargets(), ...buildListeningTargets(), ...buildDistanceTargets(TIME_ANCHORS), ...(worldGraph?buildWorldTargets(data,worldGraph):[])]),data);
  });
  // Which forms and levels exist for the chosen theme, computed once per theme instead of on every render.
  let availability = $derived.by(() => {
    const levels = new Set(), formats = new Map();
    if (!data) return {levels, formats};
    const base = {...prefs,collectionIds:quizCollection?[quizCollection]:[],subject:'all',fromYear:'',toYear:'',level:0};
    for (const format of [...FORMAT_CHOICES, ...WORLD_FORMAT_CHOICES]) {
      const found = new Set();
      for (const t of targets) if (!found.has(t.level) && targetMatches(t,{...base,objective:format.id},data.collections) && (format.id!=='chronology' || t.mode==='timeline')) found.add(t.level);
      if (found.size) formats.set(format.id, [...found].sort());
    }
    for (const t of targets) if (targetMatches(t,{...base,objective:quizMode},data.collections)) levels.add(t.level);
    return {levels, formats};
  });
  function formatAvailable(mode) {
    // A level-N quiz also uses level N-1, so a form is available when either level has it.
    const levels = availability.formats.get(mode) || [];
    return levels.includes(quizLevel) || levels.includes(quizLevel-1) || (quizLevel===0 && levels.length>0);
  }
  // Register questions are ordered partly by the learner's own weighting of impact, actuality and nearness.
  let relevance = $derived(worldGraph ? relevanceScores(worldGraph,{...DEFAULT_RELEVANCE,...prefs.relevance}).scores : new Map());
  let rankedTargets = $derived(relevance.size ? targets.map(t=>({...t,relevance:relevance.get(t.entityId) || 0})) : targets);
  let coreProgress = $derived(data?.curriculum ? curriculumProgress(data.curriculum,targets,states,reviews) : null);
  let selection = $derived(!data ? {queue:[],dueCount:0,newCount:0,eligibleCount:0} : data.curriculum ? buildDailySession({data,targets,states,reviews,preferences:prefs,now:new Date(clock)}) : selectConnectedSession(data,rankedTargets, states, prefs, new Date(), data.collections, reviews));
  // Today's chapter with perspectives woven in: the same era from another subject, an arrow, or a lens.
  let dailyPlan = $derived(data?.curriculum && selection.units?.length ? weavePerspectives({queue:selection.queue,units:selection.units,curriculum:data.curriculum,targets,reviews,progress:coreProgress,level:preferredLevel(prefs)}) : selection.queue);
  let selectedUnit = $state('');
  let clock = $state(Date.now());
  // Geography units practise place knowledge on the offline maps.
  const UNIT_MAPS = {'geo-norges-fylker-byer':/^/,'geo-norges-landskap':/^/,'geo-kontinenter-hav':/./,'geo-europa':/Europa/,'geo-asia':/Asia/,'geo-afrika':/Afrika/,'geo-amerika':/Amerika|Karibia/,'geo-oseania-polar':/Australia|Melanesia|Mikronesia|Polynesia/};
  function unitMapTargets(unitId) {
    const pattern = UNIT_MAPS[unitId];
    if (!pattern) return [];
    const norway = unitId.startsWith('geo-norges');
    const labels = new Map(data.entities.map(e => [e.id, e.label]));
    const parents = id => data.relationships.filter(r => ['in-region','located-in','part-of'].includes(r.type) && r.from === id && data.entities.find(e => e.id === r.to)?.type === 'region').map(r => r.to);
    const regionsOf = id => { const seen = new Set(); let frontier = parents(id); while (frontier.length) { frontier.forEach(r => seen.add(r)); frontier = frontier.flatMap(parents).filter(r => !seen.has(r)); } return [...seen].map(r => labels.get(r)).join(' '); };
    return targets.filter(t => t.mode === 'map' && (norway ? t.datasetId === 'norway' : t.datasetId === 'world' && pattern.test(regionsOf(t.entityId)))).map(t => t.id);
  }
  let dailyInProgress = $derived(session?.status==='active' && session.title==='Dagens økt' && Boolean(current || currentLesson) && dayKey(new Date(session.startedAt))===dayKey(new Date(clock)));
  // An unfinished daily session from an earlier day; today's plan replaces it and starting archives it.
  let staleDaily = $derived(session?.status==='active' && session.title==='Dagens økt' && Boolean(current || currentLesson) && !dailyInProgress);
  let streak = $derived(practiceStreak(reviews,new Date(clock)));
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
  let selfApprovedCount = $derived(reviews.filter(r=>r.selfApproved).length);
  let outcome = $derived(sessionOutcome(session?.results || []));
  let outcomeTotal = $derived(outcome.independent + outcome.supported + outcome.retry);
  const riktig = n => n === 1 ? 'riktig' : 'riktige';
  // The separator stays at the end of a line, never at the start of the next.
  let progressNote = $derived.by(() => {
    const retries = session?.queue?.filter(q => q.sessionRetry).length || 0;
    return [
      ...(outcomeTotal > 0 ? [`${outcome.independent} ${riktig(outcome.independent)} uten hjelp`, `${outcome.supported} med støtte`, `${outcome.retry} å øve videre på`] : []),
      ...(retries ? [`${retries} ekstra forsøk lagt til etter spørsmålene`] : [])
    ];
  });
  let retryIds = $derived(retryTargets(session?.results || []));
  let current = $derived(session && !isLessonEntry(session.queue[session.index]) ? targets.find(t => t.id === session.queue[session.index]?.id) : null);
  let currentArtwork = $derived(artworkMedia.find(m=>m.entityId===(current?.media || current?.entityId)));
  let answerStyle = $derived(answerPresentation(current));
  let hints = $derived(hintSteps(current));
  function nextHint() { if (hintLevel < hints.length) { hintLevel += 1; usedHint = true; } }
  let explanationContext = $derived(contextualExplanation(data || {},current,targets,reviews,session?.queue.slice((session?.index||0)+1).map(q=>q.id)||[]));
  let connections = $derived(explanationContext.connections);
  let currentObjective = $derived(data?.learningObjectives?.find(o=>o.id===session?.queue[session.index]?.objectiveId));
  let currentState = $derived(current ? stateForTarget(current,targets,states,reviews) : null);
  let intervals = $derived(current ? ratingIntervals(currentState) : {});
  const retryNote = rating => nextActionNote(session,{correct,usedHint,learnedFirst,rating:effectiveRating(rating,{correct,usedHint,learnedFirst,mode:current?.mode})});
  let entity = $derived(data?.entities.find(e => e.id === detailId));
  // A person or place often has questions on only some levels. The level menu on its page offers only those,
  // and starts on the chosen quiz level when it works here, otherwise on the nearest one that does.
  let entityTargets = $derived(entity ? targets.filter(t=>t.entityId===entity.id) : []);
  let entityLevels = $derived(levelsWithQuestions(entityTargets));
  let entityLevelChoice = $state(null);
  let entityLevel = $derived(usableLevel(entityLevels, entityLevelChoice ?? quizLevel));
  $effect(()=>{ detailId; entityLevelChoice=null; });
  let relationshipLimit = $state(40);
  let entityRelationships = $derived(data?.relationships.filter(r=>r.from===detailId || r.to===detailId) || []);
  $effect(()=>{ detailId; relationshipLimit = 40; });
  let exploreLimit = $state(60);
  let allMatchingEntities = $derived((data?.entities.filter(e => (!collectionFilter || e.collectionIds.includes(collectionFilter)) &&
    `${e.label} ${e.summary}`.toLowerCase().includes(query.toLowerCase())) || []).sort((a,b)=>Number(b.type==='topic')-Number(a.type==='topic') || Number(b.label.toLowerCase().startsWith(query.toLowerCase()))-Number(a.label.toLowerCase().startsWith(query.toLowerCase()))));
  let matchingEntities = $derived(allMatchingEntities.slice(0,exploreLimit));
  $effect(() => { query; collectionFilter; exploreLimit = 60; });
  let reviewedToday = $derived(reviews.filter(r => dayKey(new Date(r.timestamp)) === dayKey(new Date(clock))).length);
  let currentDataset = $derived(current ? maps.find(m=>m.id===current.datasetId) : null);

  // The outline question shows one shape on its own, framed with some air around it.
  let outlineBox = $derived.by(() => {
    if (current?.mode !== 'outline' || !currentDataset) return '0 0 720 290';
    const b = pathBounds(currentDataset.regions.find(r=>r.id===current.regionId)?.path || '', true);
    if (!b) return currentDataset.viewBox;
    const size = Math.max(b[2], b[3]) * 1.35 + 4;
    return `${b[0]+b[2]/2-size/2} ${b[1]+b[3]/2-size/2} ${size} ${size}`;
  });
  function regionBox(id) { const region = currentDataset?.regions.find(r=>r.id===id); const b = region && pathBounds(region.path, true); return b ? [b[0]-b[2]*1.2-6, b[1]-b[3]*1.2-6, b[2]*3.4+12, b[3]*3.4+12] : null; }

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
    if(offlineTest)throw new Error('Koble til nettet for å hente nye bilder og spørsmål.');
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
    sourceStatus=`${added} kildeposter hentet · ${pictures} nye bilder · ${data.targets.length-originalCount} nye spørsmål.${failed?' Noe innhold kunne ikke hentes. Prøv igjen på emnesiden.':''}`;
  }
  async function refresh() {
    [states,reviews,logs,savedSessions] = await Promise.all(['states','reviews','logs','sessions'].map(s=>all(db,s)));
  }
  async function savePreferences(silent = false) {
    if (prefs.fromYear !== '' && prefs.toYear !== '' && Number(prefs.fromYear)>Number(prefs.toYear)) throw new Error('Startåret må være før sluttåret.');
    const record = JSON.parse(JSON.stringify(prefs));
    await put(db,'settings',record);
    document.documentElement.dataset.theme = prefs.theme;
    if(!silent) notify('Utvalget er lagret.');
  }
  function toggleCollection(id) {
    prefs.collectionIds = prefs.collectionIds.includes(id) ? prefs.collectionIds.filter(x=>x!==id) : [...prefs.collectionIds,id];
  }
  const LEGACY_ROUTES = {learn:['atlas','emner'],world:['atlas','kart'],explore:['atlas',''],focus:['me','okten'],progress:['me','fremgang'],settings:['me','innstillinger']};
  function resolveRoute(route) {
    const [next,tab] = LEGACY_ROUTES[route] || [['today','atlas','me'].includes(route)?route:'today',''];
    if (next==='atlas' && tab) atlasTab = tab;
    if (next==='me' && tab) meTab = tab;
    return next;
  }
  function navigate(route) { const next = resolveRoute(route); window.location.hash = next; view = next; sessionScreen = false; window.scrollTo(0,0); }
  // The relevance weights live in one place, next to the map that shows what they do.
  async function openWeights() { atlasTab = 'kart'; navigate('atlas'); await tick(); requestAnimationFrame(()=>{ const panel=document.querySelector('#world-weights'); if (panel) { panel.open=true; panel.scrollIntoView({block:'start'}); } }); }
  function openUnit(id) { selectedUnit = id; detailId = ''; query = ''; collectionFilter = ''; atlasTab = 'emner'; navigate('atlas'); }
  async function prepareQuestion(draft = null) {
    const saved=restoreDraft(current,draft);
    answer = saved?.answer || ''; formatDraft = saved?.formatDraft || {}; correct = saved?.correct ?? null; revealed = saved?.revealed || false;
    usedHint = saved?.usedHint || false; hintLevel = saved?.hintLevel ?? (usedHint ? 1 : 0); selectedRegion = saved?.selectedRegion || ''; mapView = saved?.mapView || null;
    timelineOrder = saved?.timelineOrder || (current?.mode === 'timeline' ? buildTimelineExercise(current.timeline).items : []);
    introduction = saved?.introduction ?? Boolean(session?.queue[session.index]?.reason==='Connected introduction' && current?.snapshot);
    learnedFirst = saved?.learnedFirst || false; gradeNote = saved?.gradeNote || ''; selfApproved = saved?.selfApproved || false; preparedTargetId=current?.id || currentLesson?.id || '';
    await tick(); document.querySelector('#main-view')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
  }
  async function archiveActive() {
    if(session?.status==='active') await put(db,'sessions',{...session,id:session.sessionId,draft:draftNow()});
  }
  async function beginSession(practiceObjective = null, scope = null) {
    const pool = scope?.targetIds ? rankedTargets.filter(t=>scope.targetIds.includes(t.id)) : scope?.entityIds ? rankedTargets.filter(t=>scope.entityIds.includes(t.entityId)) : scope?.entityId ? rankedTargets.filter(t=>t.entityId===scope.entityId) : rankedTargets;
    const level = scope?.level ?? (scope?.depth ? levelFromDepth(scope.depth) : scope?.targetIds ? 0 : quizLevel);
    const focus = scope ? {...prefs,collectionIds:scope.collectionId?[scope.collectionId]:[],subject:'all',fromYear:'',toYear:'',level} : prefs;
    let selected, planned=false, practice=Boolean(practiceObjective && !scope?.learningPathId);
    if (scope?.unitId) {
      const learn = scope.unitMode!=='review' ? buildDailySession({data,targets,states,reviews,preferences:prefs,unitIds:[scope.unitId]}) : {queue:[]};
      selected = learn.queue.length ? learn : buildUnitReview({data,targets,states,reviews,unitId:scope.unitId,preferences:prefs});
      planned = true; practice = !learn.queue.length;
    }
    else if (scope?.learningPathId) selected = selectLearningPath(data,scope.learningPathId,targets,states,focus,reviews);
    else if (practiceObjective) selected = selectPracticeSession(pool,states,focus,practiceObjective,new Date(),data.collections,reviews);
    else { selected = {...selection, queue: dailyPlan}; planned = Boolean(data.curriculum); }
    if (!selected.queue.length) { notify(scope?.learningPathId?'Du har øvd på disse holdepunktene. Neste steg blir tilgjengelig senere; du kan også velge en fri quiz.':'Ingen spørsmål på dette nivået. Velg et annet nivå eller emne.'); return; }
    await archiveActive();
    const rows = planned ? selected.queue : safeLearningQueue(selected.queue);
    const queue = rows.map(q=>q.target?{id:q.target.id,reason:q.reason,unitId:q.unitId,objectiveId:q.objectiveId,support:q.support}:{id:q.id,reason:q.reason,unitId:q.unitId});
    session = {id:'active',difficultyPolicy:'2026-10-11',sessionId:crypto.randomUUID(),startedAt:new Date().toISOString(),title:scope?.title || (practiceObjective?'Fri quiz':'Dagens økt'),chapter:!scope && !practiceObjective && data.curriculum?chapterFor(selection.units || [],data.curriculum):null,scope,objective:practiceObjective,queue,practice,index:0,results:[],status:'active'};
    await put(db,'sessions',session);
    sessionScreen = true; quizSetup = false; view = 'today'; window.location.hash='today';
    await prepareQuestion(); await refresh(); window.scrollTo(0,0);
  }
  async function finishLesson() {
    const entry=session.queue[session.index];
    const index=session.index+1;
    session={...session,index,draft:null,results:[...session.results,{id:entry.id,lesson:true}],status:index>=session.queue.length?'completed':'active'};
    await put(db,'sessions',session);
    await prepareQuestion();
  }
  // A content update can retire cards that a saved session still has ahead of it.
  const entryExists = entry => isLessonEntry(entry) ? Boolean(data?.curriculum?.units.some(u=>u.id===entry.unitId)) : targets.some(t=>t.id===entry?.id);
  async function resumeSession(saved = null) {
    if(saved) {await archiveActive();session={...dropRetired(saved,entryExists),id:'active'};await put(db,'sessions',session);await prepareQuestion(session.draft);await refresh();}
    if (!current && !currentLesson) { notify('Spørsmålet er ikke tilgjengelig. Du kan starte en ny quiz.'); return; }
    sessionScreen = true; view='today';window.location.hash='today'; window.scrollTo(0,0);
  }
  function reveal() {
    if (STRUCTURED_MODES.includes(current?.mode)) correct=gradeStructured(current,formatDraft,worldGraph?.neighbours).correct;
    else if (current?.mode === 'map') { correct = selectedRegion ? gradeMapSelection(selectedRegion,current.regionId) : null; const box=unionBox([regionBox(current.regionId),selectedRegion && selectedRegion!==current.regionId?regionBox(selectedRegion):null]); if(box) void tick().then(()=>quizMap?.flyTo(box,900)); }
    else if (current?.mode === 'timeline') correct = gradeTimeline(timelineOrder,current.timeline).correct;
    else if(current?.answerFormat==='explanation')correct=null;
    else if (current?.unitId && !['map','recognition'].includes(current.mode)) {const grade=gradeAnswer(current,answer,knownNames);correct=grade.correct;gradeNote=grade.note || '';}
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
  function chooseRegion(id) { if (revealed || !id) return; selectedRegion = selectedRegion===id ? '' : id; }
  async function rate(rating) {
    const target=current, now=new Date();
    rating=effectiveRating(rating,{correct,learnedFirst,usedHint,mode:target.mode});
    const entry=session.queue[session.index];
    const result=scheduleReview(schedulingKey(target),currentState,rating,now);
    const event={id:`${session.sessionId}:${session.index}`,targetId:target.id,entityId:target.entityId || null,timestamp:now.toISOString(),rating,mode:target.mode,correct,usedHint,...(hintLevel?{hintLevel}:{}),learnedFirst,
      factId:factKey(target),claimIds:target.claimIds,evidenceKind:evidenceKind(target),answerFormat:target.answerFormat,assessment:target.answerFormat==='explanation' || selfApproved?'self':'answer',...(selfApproved?{selfApproved:true,typedAnswer:answer.trim()}:{}),reason:entry.reason,schedulerId:schedulingKey(target),sessionRetry:Boolean(entry.sessionRetry),nextDue:result.card.due,log:result.log};
    // A first answer always starts the long-term schedule, even in free practice; otherwise the card would never return.
    const practice=(session.practice || entry.sessionRetry) && Boolean(currentState);
    const saved=practice?{...event,practice:true,nextDue:null,log:null}:event, mirror={...result.card,id:legacyFactKey(target)};
    const applied=practice?await recordReview(db,null,saved):await recordReview(db,result.card,event,mirror);
    // Update memory directly; reading every store back after each answer made phones lag.
    if(applied){reviews=[...reviews,saved];if(!practice){const ids=new Set([result.card.id,mirror.id]);states=[...states.filter(s=>!ids.has(s.id)),result.card,...(mirror.id!==result.card.id?[mirror]:[])];}}
    session=advanceSession(session,{id:target.id,rating,correct,learnedFirst,usedHint,mode:target.mode});
    await transaction(db,['sessions'],tx=>{
      tx.objectStore('sessions').put(session);
      if(session.status==='completed') tx.objectStore('sessions').put({...session,id:session.sessionId,completedAt:now.toISOString()});
    });
    if(!applied || session.status==='completed') await refresh();
    await prepareQuestion();
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
    // Safari can report navigator.onLine=false while the network works, so only a failed request counts as offline.
    if (offlineTest) { if(manual) notify('Du er frakoblet. Installert kunnskap er fortsatt tilgjengelig.'); return; }
    const prior=await get(db,'settings','updates');
    if(!manual && prior && Date.now()-new Date(prior.checkedAt)<3600000) {lastUpdate=prior;return;}
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
    }catch(caught) {
      const failure=caught instanceof TypeError?new Error('Fikk ikke kontakt med nettet. Installert kunnskap er fortsatt tilgjengelig.'):caught;
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
      const waiting=registration.waiting;let reloaded=false;
      const reload=()=>{if(!reloaded){reloaded=true;window.location.reload();}};
      // Safari does not always report the controller change; the worker's own state and a timeout are fallbacks.
      navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
      waiting.addEventListener('statechange',()=>{if(waiting.state==='activated')reload();});
      setTimeout(reload,4000);
      waiting.postMessage({type:'ACTIVATE'});
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
      const hash=window.location.hash.slice(1),before=view;
      view=resolveRoute(hash);
      // Another part of the app opens at its top, not at the scroll position of the page left behind.
      if(uiReady && view!==before)window.scrollTo(0,0);
      if(view!=='today')sessionScreen=false;
      detailId='';error='';
    };
    // Reopen where the learner left off. A link with its own #route wins over the saved view.
    let ui=null;
    try{ui=readUiState(localStorage);}catch{/* No saved place; start on I dag. */}
    if(ui){
      ({atlasTab,meTab,progressTab,query,collectionFilter,selectedUnit}=ui);
      quizCollection=ui.quiz.collection;quizLevel=ui.quiz.level;quizMode=ui.quiz.mode;timelineState=ui.timeline;
      if(!window.location.hash.slice(1))history.replaceState(null,'',`#${ui.view}`);
    }
    route(); window.addEventListener('hashchange',route);
    const tabAgain=event=>{if(event.detail===view && !sessionScreen){quizSetup=false;detailId='';}};
    window.addEventListener('atlas-tab-again',tabAgain);
    if(ui && view===ui.view){detailId=ui.detailId;quizSetup=ui.quizSetup && view==='today';restoreScroll=ui.scrollY;}
    uiReady=true;
    let scrollTimer;
    const onScroll=()=>{if(!scrollTimer)scrollTimer=setTimeout(()=>{scrollTimer=undefined;scrollY=Math.round(window.scrollY);},300);};
    const onHide=()=>{if(document.visibilityState==='hidden'){scrollY=Math.round(window.scrollY);keepUiState();}};
    window.addEventListener('scroll',onScroll,{passive:true});document.addEventListener('visibilitychange',onHide);window.addEventListener('pagehide',onHide);
    offlineTest=new URLSearchParams(window.location.search).has('offline-test');
    installed=window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
    const prompt=event=>{event.preventDefault();installPrompt=event;};
    window.addEventListener('beforeinstallprompt',prompt);
    const reconnect=()=>{if(db){void checkUpdates().catch(failure=>recordError('updates',failure));void checkAppUpdate();}};
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void checkAppUpdate();},APP_CHECK_INTERVAL);
    // The daily plan depends on the time of day; a home-screen app can stay open overnight.
    const tickClock=()=>{clock=Date.now();};const clockTimer=setInterval(tickClock,60000);
    const visible=()=>{if(document.visibilityState==='visible'){tickClock();reconnect();}};
    const connectionChanged=()=>{if(db){void checkUpdates().catch(failure=>recordError('updates',failure));void checkAppUpdate(true);}};
    window.addEventListener('online',connectionChanged);window.addEventListener('offline',connectionChanged);document.addEventListener('visibilitychange',visible);
    const unhandled=event=>{if(db)void logEvent(db,'unhandled',String(event.reason?.message || event.reason),'error').catch(()=>{});};
    window.addEventListener('unhandledrejection',unhandled);
    const boot=async()=>{
      try {
        db=await openDatabase();
        prefs={...DEFAULT_PREFERENCES,...await get(db,'settings','preferences')};
        document.documentElement.dataset.theme=prefs.theme;
        data=(await all(db,'packages'))[0] || null;
        if(!data || data.language !== 'nb') {await checkUpdates(true);data=(await all(db,'packages'))[0] || null;}
        else if(['1.1.2','1.0.1','1.0.2','1.1.0','1.1.1','1.2.0','2.1.0'].includes(data.version) || !data.curriculum || !data.perspectives) {try{await checkUpdates(true);data=(await all(db,'packages'))[0] || data;}catch{/* Keep the installed package usable offline. */}}
        if(!data)throw new Error('Koble til nettet én gang for å installere kunnskapsbiblioteket.');
        const mediaResponse=await fetch('/knowledge/media.json');if(mediaResponse.ok)baseMedia=await mediaResponse.json();
        await restoreSourceContent();
        maps=await Promise.all(['world','norway'].map(async id=>{const r=await fetch(`/maps/${id}.json`);if(!r.ok)throw new Error('Kartpakken er utilgjengelig.');return r.json();}));
        await refresh();session=await get(db,'sessions','active') || null;
        const pruned=dropRetired(session,entryExists);if(pruned!==session){session=pruned;await put(db,'sessions',session);}
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
          fetchVersion:async()=>{if(offlineTest)throw new Error('Koble til nettet for å sjekke oppdateringer.');const response=await fetch('/version.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.headers.get(OFFLINE_HEADER))throw Object.assign(new Error('Fikk ikke kontakt med nettet.'),{offline:true});if(!response.ok)throw new Error('Kunne ikke sjekke appversjonen. Prøv igjen.');return response.json();},
          getRegistration:()=>registration,
          onStatus:status=>{if(disposed)return;appCheck=status;if(status.state==='ready')updateReady=true;if(!offlineTest && status.state!=='checking')reportStatus(status.offline?'Uten nett':'');}
        });
        reportStatus(offlineTest?'Frakoblet test':'');
        void checkAppUpdate();
        lastUpdate=await get(db,'settings','updates');
        void checkUpdates().catch(failure=>recordError('updates',failure));
      }catch(failure){await recordError('startup',failure);}
      finally{if(!disposed)loading=false;}
      if(!disposed && restoreScroll && !sessionScreen){await tick();requestAnimationFrame(()=>window.scrollTo(0,restoreScroll));}
    };
    void boot();
    return ()=>{disposed=true;clearInterval(timer);clearInterval(clockTimer);window.removeEventListener('hashchange',route);window.removeEventListener('atlas-tab-again',tabAgain);window.removeEventListener('scroll',onScroll);document.removeEventListener('visibilitychange',onHide);window.removeEventListener('pagehide',onHide);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('online',connectionChanged);window.removeEventListener('offline',connectionChanged);document.removeEventListener('visibilitychange',visible);window.removeEventListener('unhandledrejection',unhandled);db?.close();};
  });
</script>

<svelte:head><title>Atlas · Quiz</title></svelte:head>

{#snippet sessionTop()}
<div class="s-top">
  <button class="s-back" onclick={()=>sessionScreen=false} aria-label="Pause økten og gå tilbake"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>Pause</span></button>
</div>
<div class="s-progress" role="group" aria-label="Fremgang i quizen">
  <div class="s-progress-line">
    <div class="s-steps" role="progressbar" aria-label="Fullførte spørsmål" aria-valuemin="0" aria-valuemax={session.queue.length} aria-valuenow={session.index}>{#each session.queue as item,i}<span class:done={i<session.index} class:independent={session.results[i]?.correct===true && !session.results[i]?.usedHint && !session.results[i]?.learnedFirst} class:active={i===session.index} aria-hidden="true"></span>{/each}</div>
    <span class="s-count"><strong>{session.index}</strong>/{session.queue.length}<span class="sr-only"> fullført, {session.queue.length-session.index} igjen</span></span>
  </div>
  {#if progressNote.length}<p class="s-progress-note">{progressNote.join('\u00a0· ')}</p>{/if}
</div>
{/snippet}

<main id="main-view" tabindex="-1">
  {#if error}<div class="banner error" role="alert"><p>{error}</p><button class="quiet" onclick={()=>error=''}>Lukk</button></div>{/if}
  {#if offlineTest}<div class="banner warm stacked" role="status"><div><p class="eyebrow">NETTVERKET ER AVSLÅTT FOR APPEN</p><p class="muted">Frakoblet test: innhold hentes bare fra det som er lagret på enheten.</p></div><button class="secondary sm" onclick={()=>run(()=>offlineMode(false))}>Avslutt frakoblet test</button></div>{/if}
  {#if updateReady && !sessionScreen}<div class="banner" role="status"><div><p><strong>En ny utgave er klar.</strong></p><p class="muted">Fremgangen beholdes.</p></div><button class="primary sm" disabled={busy} onclick={()=>run(applyUpdate)}>Oppdater appen</button></div>{/if}
  {#if loading}
    <section class="hero"><h1>Laster quiz…</h1></section><div class="card skeleton" aria-busy="true"><span></span><span></span></div>
  {:else if !data}
    <section class="hero"><h1>Koble til nettet</h1><p class="lead">Last ned spørsmålene for å komme i gang.</p><button class="primary" onclick={()=>window.location.reload()}>Prøv igjen</button></section>
  {:else if view === 'today'}
    {#if sessionScreen && session?.status === 'completed'}
      {@const answered=session.results.filter(r=>!r.lesson)}
      {@const touched=[...new Set(session.queue.map(q=>q.unitId).filter(Boolean))]}
      <div class="session-view s-summary">
        <header class="s-summary-head"><p class="eyebrow">{session.title || 'Økt'}</p><h1>Økten er ferdig</h1><p class="s-sub">{new Set(answered.map(r=>r.id)).size} spørsmål · {answered.length} svar</p></header>
        <div class="s-results" role="group" aria-label="Resultat av økten"><span><strong>{outcome.independent}</strong>uten hjelp</span><span><strong>{outcome.supported}</strong>med støtte</span><span><strong>{outcome.retry}</strong>øv videre</span></div>
        {#if touched.length && coreProgress}<section class="s-topics"><h2 class="s-label">Emnene dine</h2>{#each touched as id}{@const row=coreProgress.units.get(id)}{#if row}<button class="s-unit" data-status={row.status} onclick={()=>{selectedUnit=id;navigate('learn');}}><span class="s-dot" aria-hidden="true"></span><span class="s-unit-text"><strong>{unitTitle(id)}</strong><small>{UNIT_STATUS[row.status].label} · {row.correct} av {row.total} riktig sist</small><span class="s-bar-track"><span style={`width:${Math.round(100*row.correct/row.total)}%`}></span></span></span><svg class="s-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>{/if}{/each}</section>{/if}
        <div class="s-end-actions">{#if retryIds.length}<button class="primary" onclick={()=>run(()=>beginSession('mixed',{targetIds:retryIds,level:0,title:'Øv videre'}))}>Øv på {retryIds.length} {retryIds.length==1?'kort':'kort'} igjen</button>{/if}
        {#if data.curriculum && !session.objective && selection.queue.length}<button class={retryIds.length?'secondary':'primary'} onclick={()=>run(()=>beginSession(null,session.scope?.unitId?{...session.scope,unitMode:'learn'}:null))}>Lær mer</button>{:else if session.objective}<button class="secondary" onclick={()=>run(()=>beginSession(session.objective || 'mixed',session.scope))}>Ta en quiz til</button>{/if}
        <button class="quiet" onclick={()=>sessionScreen=false}>Ferdig for nå</button></div>
      </div>
    {:else if sessionScreen && currentLesson}
      <div class="session-view s-lesson-view">
        {@render sessionTop()}
        <section class="s-exercise lesson-step">
          <p class="eyebrow">Nytt emne · {domainTitle(currentLesson.domainId)}</p>
          <h1 class="s-lesson-title">{currentLesson.title}</h1>
          {#each currentLesson.lesson as paragraph}<p class="s-lesson-text">{paragraph}</p>{/each}
          <div class="s-keys"><h2 class="s-label">Dette skal sitte</h2><ul class="s-key-list">{#each currentLesson.keyPoints as point}<li>{point}</li>{/each}</ul></div>
          <p class="s-meta">Spørsmålene om emnet kommer etter hvert i økten, og igjen de neste dagene.</p>
        </section>
        <div class="s-bar"><button class="primary" disabled={busy} onclick={()=>run(finishLesson)}>Videre</button></div>
      </div>
    {:else if sessionScreen && current}
      <div class="session-view s-quiz" data-mode={current.mode} class:is-revealed={revealed}>
      {@render sessionTop()}
      {#if !session.difficultyPolicy && current.difficulty===5}<div class="s-alert"><p>Denne eldre quizen inneholder avanserte spørsmål.</p><button class="secondary" onclick={()=>run(()=>beginSession('mixed',{collectionId:current.collectionIds[0],depth:'foundation',title:titleFor(current.collectionIds[0])}))}>Start på grunnlag</button></div>{/if}
      <section class="s-exercise" class:s-asking={!revealed}>{#if session.queue[session.index]?.sessionRetry}<p class="s-retry">Nytt forsøk · hent fram svaret uten hjelp</p>{/if}<p class="eyebrow s-eyebrow">{#if session.queue[session.index]?.reason===PERSPECTIVE_REASON}Perspektiv · {perspectiveLabel(current)}{:else if current.unitId}{unitTitle(current.unitId)} · {STEP_LABELS[current.step]}{:else}Nivå {current.level} · {modeLabel(current.mode)}{/if}</p>{#if introduction}<div class="s-intro"><h1>Kort fortalt</h1><p>{current.snapshot}</p>{#if currentObjective}<p class="s-meta">{currentObjective.introduction}</p>{/if}<button class="primary" onclick={()=>{introduction=false;learnedFirst=true;}}>Prøv spørsmålet</button></div>{:else}<h1 class="s-question" class:is-answered={revealed}>{current.prompt}</h1>{#if current.visual?.flag}<Flag iso2={current.visual.flag} size="large" label="Flagget du skal kjenne igjen" />{/if}
        {#if !revealed}
        {#if session.queue[session.index]?.support?.length}<details class="s-disclosure s-support"><summary>Holdepunkter før du prøver</summary>{#each session.queue[session.index].support as item}<p><strong>{item.title}</strong></p><p>{item.text}</p>{/each}<p class="s-meta">Du kan utforske videre selv om dette er nytt.</p></details>{/if}
        {#if questionSupport(current) && !revealed && !currentArtwork}<p class="s-context">{questionSupport(current)}</p>{/if}
        {#if currentArtwork}<figure class="artwork-figure"><img src={currentArtwork.url} alt={revealed?currentArtwork.title:'Bildet du skal undersøke'} width={currentArtwork.width} height={currentArtwork.height}><figcaption class="s-meta">{revealed?currentArtwork.title:'Se nøye på motivet før du svarer.'}</figcaption></figure>{/if}
        {/if}
        {#if STRUCTURED_MODES.includes(current.mode)}
          {#key current.id}<StructuredQuiz target={current} bind:draft={formatDraft} {revealed} dataset={maps.find(m=>m.id===(current.datasetId || 'world'))} graph={worldGraph} />{/key}
        {:else if current.mode === 'map' && currentDataset}
          {#key current.id}<PanZoomMap bind:this={quizMap} base={currentDataset.viewBox} bind:view={mapView} label={`${currentDataset.title}: finn stedet. Dra for å flytte, knip eller dobbelttrykk for å zoome, trykk for å velge.`} className="quiz-map" onTap={({region})=>chooseRegion(region)}>
            {#each currentDataset.regions as region}<path d={region.path} data-region={region.id} class:selected={selectedRegion===region.id} class:wrong={revealed && selectedRegion===region.id && region.id!==current.regionId} class:correct={revealed && region.id===current.regionId} fill-rule="evenodd" />{/each}
          </PanZoomMap>{/key}
          <p class="s-meta s-note">{revealed?'':selectedRegion?'Valgt. Trykk på et annet område for å endre, eller kontroller svaret.':'Dra for å flytte og knip for å zoome. Trykk på stedet du tror er riktig.'}</p>
          <details class="s-disclosure map-source"><summary>Kartkilde</summary><p class="s-meta">{currentDataset.source.attribution || currentDataset.source.title} <a class="source-link" href={currentDataset.source.licenseUrl || currentDataset.source.url} target="_blank" rel="noreferrer">{currentDataset.source.license}</a></p></details>
        {:else if current.mode === 'outline' && currentDataset}
          <div class="map-board outline-board"><svg viewBox={outlineBox} role="img" aria-label="Geografisk omriss uten navn"><path d={currentDataset.regions.find(r=>r.id===current.regionId).path} fill-rule="evenodd"/></svg></div>
          <p class="s-meta">{currentDataset.source.attribution || currentDataset.source.title}</p>
        {:else if current.mode === 'timeline'}
          <SortableList bind:items={timelineOrder} disabled={revealed} label="Hendelser i rekkefølge, tidligst øverst" startLabel="Tidligst" endLabel="Senest" itemClass={(item,i)=>revealed?(item.year===[...timelineOrder].map(x=>x.year).sort((a,b)=>a-b)[i]?'is-right':'is-wrong'):''}>{#snippet row(item)}<span>{item.label}</span>{#if revealed}<small class="muted">{item.display ?? formatYear(item.year)}</small>{/if}{/snippet}</SortableList>
        {/if}
        {#if !revealed}
          {#if current.mode === 'recognition'}
            {@const options=makeRecognitionOptions(current.options ? current : data.targets.find(t=>t.id===current.baseId),data.targets,4,recognitionIndex)}
            {@const removed=removesOption(current,hintLevel)?removedOption(current,options):null}
            <div class="s-choices" role="group" aria-label="Svaralternativer">{#each options as option,i}<button class="s-choice" class:is-removed={option.id===removed} disabled={option.id===removed} aria-label={option.id===removed?`${option.label}, fjernet av hintet`:undefined} onclick={()=>answerChoice(option)}><span class="s-choice-key" aria-hidden="true">{'ABCD'[i] || i+1}</span><span class="s-choice-label">{option.label}</span></button>{/each}</div>
          {:else if !STRUCTURED_MODES.includes(current.mode) && current.mode !== 'map' && current.mode !== 'timeline'}
            <form class="s-form" onsubmit={event=>{event.preventDefault();reveal();}}><label class="s-field-label" for="recall">{answerStyle.label}</label>{#if answerStyle.extended}<textarea id="recall" class="textarea recall-long s-input" bind:value={answer} rows="3" placeholder={answerStyle.placeholder} autocomplete="off"></textarea>{:else}<input id="recall" class="input recall-short s-input" class:recall-year={['numeric','decimal'].includes(answerStyle.inputMode)} bind:value={answer} inputmode={answerStyle.inputMode} placeholder={answerStyle.placeholder} autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done">{/if}<button class="primary" type="submit">{answer.trim()?'Kontroller svaret':'Vis svaret'}</button></form>
          {/if}
          {#if hintLevel}<div class="s-hint" role="status">{#each hints.slice(0,hintLevel) as text,i}<p><span class="s-hint-step">Hint {i+1}</span> {text}</p>{/each}</div>{/if}
          <div class="s-help"><button class="quiet" onclick={()=>{learnedFirst=true;correct=null;revealed=true;}}>Jeg vil lære dette først</button>
          {#if hintLevel < hints.length}<button class="quiet" onclick={nextHint}>{hintLevel?'Mer hjelp':'Hint'}</button>{/if}</div>
          {#if STRUCTURED_MODES.includes(current.mode) || current.mode === 'timeline' || current.mode === 'map'}
            <div class="s-bar">
              {#if current.mode === 'map'}<button class="quiet" onclick={()=>{selectedRegion='';reveal();}}>Vis meg stedet</button>{/if}
              {#if STRUCTURED_MODES.includes(current.mode)}<button class="primary" disabled={!structuredReady(current,formatDraft)} onclick={reveal}>Kontroller svaret</button>{/if}
              {#if current.mode === 'timeline'}<button class="primary" onclick={reveal}>Kontroller rekkefølgen</button>{/if}
              {#if current.mode === 'map'}<button class="primary" disabled={!selectedRegion} onclick={reveal}>Kontroller svaret</button>{/if}
            </div>
          {/if}
          <details class="s-disclosure difficulty-note"><summary>Nivå {current.level} · {levelName(current.level)}</summary><div class="axis-bars">{#each AXES as axis}<div class="axis-row"><span>{axis.label}</span><span class="axis-meter" aria-hidden="true">{#each [1,2,3] as step}<i class:on={step<=current.profile[axis.id]}></i>{/each}</span><small>{axis.steps[current.profile[axis.id]-1]}</small></div>{/each}</div><p class="s-meta">{profileSummary(current.profile)}</p></details>
        {/if}
        {#if revealed}
          <div class="s-feedback" class:is-right={correct===true} class:is-wrong={correct===false}>
            <p class="s-verdict">{#if correct===true}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>{:else if correct===false}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>{:else}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5h10v15l-5-3.5-5 3.5z"/></svg>{/if}<span>{selfApproved?'GODKJENT AV DEG':correct===true?'RIKTIG':correct===false?'IKKE HELT':'SVARET'}</span></p>
            <h2 id="answer-heading" class="s-answer" class:is-long={String(current.answer ?? '').length>48} tabindex="-1"><span class="sr-only">{selfApproved?'Godkjent av deg. Svaret er: ':correct===true?'Riktig. ':correct===false?'Ikke helt. Riktig svar: ':'Svaret: '}</span>{current.mode==='matching'?'De riktige parene':current.answer}</h2>
            {#if gradeNote}<p class="s-meta s-grade-note">{gradeNote}</p>{/if}
            {#if correct===false && answer.trim() && current.mode!=='timeline' && !STRUCTURED_MODES.includes(current.mode) && current.answerFormat!=='explanation'}<div class="s-yours"><p>Du {current.mode==='recognition'?'valgte':'skrev'}: <strong>{answer}</strong></p>{#if current.mode==='recall'}<button class="quiet override" onclick={()=>{correct=true;selfApproved=true;gradeNote='Du godkjente svaret ditt selv. Det lagres som egenvurdering.';}}>Godkjenn svaret mitt</button>{/if}</div>{#if current.mode==='recall'}<p class="s-meta s-override-hint">Mente du det samme med andre ord? Da kan du godkjenne svaret selv.</p>{/if}{/if}
            {#if selfApproved}<div class="s-yours"><p>Du skrev: <strong>{answer}</strong></p><button class="quiet override" onclick={()=>{correct=false;selfApproved=false;gradeNote='';}}>Angre godkjenningen</button></div>{/if}
            {#if current.mode==='matching'}<ul class="pair-answers">{#each current.pairs as pair}<li>{pair.label} <strong>{pair.answer}</strong></li>{/each}</ul>{/if}
            {#if current.mode==='border-walk'}{@const result=gradeStructured(current,formatDraft,worldGraph.neighbours)}<p class="s-meta">{result.arrived && result.valid?`Du krysset ${result.crossings} grenser. Korteste rute krysser ${result.shortest}.`:'Ruten nådde ikke målet.'}</p>{/if}
            {#if current.mode==='arrows'}{@const result=gradeStructured(current,formatDraft)}<p class="s-meta">Retning: {result.directionCorrect?'riktig':'må øves'} · År: {result.yearCorrect?'riktig':'må øves'}</p>{/if}
            <p class="s-explain">{explanationContext.explanation}</p>
            {#each explanationContext.uncertainty as note}<p class="s-meta">{note}</p>{/each}
            {#if current.answerFormat==='explanation'}<fieldset class="s-rubric"><legend>Sammenlign med svaret ditt</legend><p><strong>Svaret ditt:</strong> {answer || 'Du skrev ikke noe svar.'}</p><p class="s-meta">Vurder innholdet, ikke om du brukte samme ord. Dette lagres som egenvurdering.</p>{#each current.rubric || [] as criterion}<label class="s-check"><input type="checkbox" disabled={!answer.trim()} checked={Boolean(formatDraft[criterion.id])} onchange={event=>{formatDraft={...formatDraft,[criterion.id]:event.currentTarget.checked};correct=Boolean(answer.trim()) && current.rubric.every(c=>formatDraft[c.id]);}}><span>{criterion.text}</span></label>{/each}</fieldset>{/if}
          </div>
          {#if currentArtwork}<figure class="artwork-figure"><img src={currentArtwork.url} alt={`${currentArtwork.title} av ${currentArtwork.artist}`} width={currentArtwork.width} height={currentArtwork.height} /></figure>{/if}
          <div class="s-more">
          {#if currentUnit}<details class="s-disclosure s-context-details"><summary>Om emnet: {currentUnit.title}</summary>{#each currentUnit.lesson as paragraph}<p>{paragraph}</p>{/each}<ul class="s-key-list">{#each currentUnit.keyPoints as point}<li>{point}</li>{/each}</ul></details>{#if currentArtwork}<details class="s-disclosure s-context-details"><summary>Om bildet og bildekilden</summary><p>{currentArtwork.context}</p><p class="s-meta">{currentArtwork.credit} · <a href={currentArtwork.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a> · <a href={currentArtwork.licenseUrl} target="_blank" rel="noreferrer">Lisens og bruk</a></p></details>{/if}{/if}
          {#if !current.unitId && (current.snapshot || current.followUp || currentArtwork || connections.length)}<details class="s-disclosure s-context-details"><summary>Fordypning og forbindelser</summary>{#if current.snapshot}<p>{current.snapshot}</p>{/if}{#if current.followUp}<p>{current.followUp}</p>{/if}{#if currentArtwork}<details class="s-disclosure"><summary>Om bildet og bildekilden</summary><p>{currentArtwork.context}</p><p class="s-meta">{currentArtwork.credit} · <a href={currentArtwork.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a> · <a href={currentArtwork.licenseUrl} target="_blank" rel="noreferrer">Lisens og bruk</a></p></details>{/if}{#if connections.length}<details class="s-disclosure"><summary>Les videre ({connections.length})</summary>{#each connections as relation}<p>{relation.context}</p><small class="s-meta">{relation.practiced?'Du har øvd på':'Et nytt holdepunkt:'} {relation.label}</small>{#if relation.evidenceStatus!=='documented'}<p class="s-meta">{relation.evidenceStatus==='disputed'?'Forbindelsen er omstridt.':'Forbindelsen er usikker.'}</p>{/if}{#each relation.sourceIds as sourceId}{@const source=sourceFor(sourceId)}{#if source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/if}{/each}{/each}</details>{/if}</details>{/if}
          <details class="s-disclosure"><summary>Kilder</summary>{#each (current.sources || []) as source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/each}{#each current.sourceIds as sourceId}{@const source=sourceFor(sourceId)}{#if source}<a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{/if}{/each}</details>
          </div>
          {#if usedHint || learnedFirst || selfApproved || correct!==true || session.practice || session.queue[session.index]?.sessionRetry}
            <p class="s-next-note">{selfApproved?'Lagres som riktig etter egenvurdering':retryNote(fallbackRating()) || (session.queue[session.index]?.sessionRetry?'Lagret som øving i denne quizen':'Svar uten hjelp lagres som riktig')}</p>
            <div class="s-bar"><button class="primary" disabled={busy} onclick={()=>run(()=>rate(fallbackRating()))}>Neste</button></div>
          {:else}
            <p class="s-next-note">Neste repetisjon {whenLabel(intervals[3])}</p>
            <div class="s-bar s-bar-rate"><button class="s-rate" disabled={busy} onclick={()=>run(()=>rate(2))}>Var usikker</button><button class="primary" disabled={busy} onclick={()=>run(()=>rate(3))}>Neste</button><button class="s-rate" disabled={busy} onclick={()=>run(()=>rate(4))}>Satt lett{#if whenLabel(intervals[4])!==whenLabel(intervals[3])}<small>{whenLabel(intervals[4])}</small>{/if}</button></div>
          {/if}
        {/if}
      {/if}</section>
      </div>
    {:else}
      {@const paused=savedSessions.filter(s=>s.id!=='active' && s.sessionId!==session?.sessionId && s.status==='active')}
      <div class="today">
      {#if !quizSetup}<header class="t-head"><p class="eyebrow">{new Date().toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'})}{#if streak>1}{` · ${streak} dager på rad`}{/if}</p><div class="t-title-row"><h1>{reviewedToday?'Godt i gang':'I dag'}</h1>{#if reviewedToday}<span class="t-meta">{reviewedToday} svar i dag</span>{/if}</div></header>
      {#if session?.status==='active' && (current || currentLesson) && !(data.curriculum && session.title==='Dagens økt')}<div class="t-chapter t-resume"><p class="eyebrow">Påbegynt</p><h2>{session.title || 'Påbegynt økt'}</h2><p class="t-sub">{session.index} av {session.queue.length} gjort</p><button class="primary" onclick={()=>run(()=>resumeSession())}>Fortsett der du var</button></div>{/if}
      {#if data.curriculum}
        {@const plan=dailyPlan}
        {@const fresh=plan.filter(q=>q.target && !['Due review',PERSPECTIVE_REASON].includes(q.reason))}
        {@const chapter=chapterFor(selection.units || [],data.curriculum)}
        <div class="t-chapter">
          {#if dailyInProgress}
            <p class="eyebrow">Dagens kapittel</p><h2>{session.chapter?.title || 'Dagens økt'}</h2><p class="t-sub">{session.index} av {session.queue.length} gjort</p>
            <button class="primary" onclick={()=>run(()=>resumeSession())}>Fortsett der du var</button>
          {:else if plan.length}
            <p class="eyebrow">{chapter?`${chapter.era}${chapter.span?` · ${chapter.span}`:''}`:'Repetisjon'}</p>
            <h2>{chapter?.title || 'Det du holder på å glemme'}</h2>
            {#if coreProgress}<StorySpine curriculum={data.curriculum} progress={coreProgress} highlight={selection.units || []} compact />{/if}
            <div class="t-counts"><span><strong>{plan.filter(q=>q.reason==='Due review').length}</strong>repetisjoner</span><span><strong>{fresh.length}</strong>nye kort</span><span><strong>{plan.filter(q=>q.reason===PERSPECTIVE_REASON).length}</strong>{plan.filter(q=>q.reason===PERSPECTIVE_REASON).length===1?'perspektiv':'perspektiver'}</span></div>
            {#if (selection.units || []).length>1}<p class="t-sub">Også i dag: {selection.units.filter(id=>id!==data.curriculum.units.find(u=>u.title===chapter?.title)?.id).map(unitTitle).join(' og ')}</p>{/if}
            <button class="primary" disabled={busy} onclick={()=>run(()=>beginSession())}>Start dagens kapittel</button>
          {:else}
            <h2>Ferdig for i dag</h2><p class="t-sub">Alt som skulle repeteres er gjort. Nye kort i de aktive emnene kommer når du har repetert de forrige.</p>
            {#if coreProgress}{@const next=recommendedUnits(data.curriculum,coreProgress,{domainIds:prefs.collectionIds,story:prefs.story!==false})[0]}{#if next}<button class="secondary" onclick={()=>run(()=>beginSession(null,{unitId:next.id,unitMode:'learn',title:next.title}))}>Les neste kapittel nå: {next.title}</button>{/if}{/if}
          {/if}
          {#if staleDaily}<p class="t-sub stale-session">Økten fra {new Date(session.startedAt).toLocaleDateString('nb-NO',{weekday:'long'})} ble ikke fullført ({session.index} av {session.queue.length}). <button class="link-button" onclick={()=>run(()=>resumeSession())}>Fortsett den</button></p>{/if}
        </div>
        {#if !reviews.length && !prefs.introSeen}<div class="t-intro"><details><summary>Slik fungerer Atlas</summary><ul><li>Hver dag er et kapittel i én historie gjennom tid: en epoke, og hva som skjedde andre steder samtidig.</li><li>Hvert emne begynner med en kort innføring. Spørsmålene kommer litt etter, så du henter fram i stedet for å kopiere.</li><li>Det du holder på å glemme, kommer tilbake til riktig tid. Noen minutter om dagen er nok.</li></ul></details><button class="quiet" onclick={()=>run(async()=>{prefs.introSeen=true;await savePreferences(true);})}>Skjønner</button></div>{/if}
        {#if coreProgress}
          {@const path=recommendedUnits(data.curriculum,coreProgress,{domainIds:prefs.collectionIds,story:prefs.story!==false}).filter(u=>!(selection.units || []).includes(u.id)).slice(0,3)}
          {#if path.length}<section class="t-next"><h2 class="s-label">Neste på reisen</h2>
          <div class="t-rows">{#each path as unit}{@const row=coreProgress.units.get(unit.id)}
            <button class="t-row" data-status={row.status} onclick={()=>openUnit(unit.id)}><span class="s-dot" aria-hidden="true"></span><span class="t-row-text"><strong>{unit.title}</strong><small>{unit.years?`${yearSpan(unit)} · `:''}{domainTitle(unit.domainId)} · {row.status==='new'?'Ikke startet':UNIT_STATUS[row.status].label}</small></span><svg class="s-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>
          {/each}</div><button class="quiet t-all" onclick={()=>{atlasTab='tid';navigate('atlas');}}>Se hele reisen<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button></section>{/if}
        {/if}
      {:else}
      <div class="t-chapter"><h2>Dagens quiz</h2><p class="t-sub">{selection.queue.length} spørsmål · nivå {preferredLevel(prefs) || 'alle'}</p><button class="primary" disabled={busy || !selection.queue.length} onclick={()=>run(()=>beginSession())}>Start dagens quiz</button></div>
      {/if}
      <div class="t-practice"><div><h2>Øv fritt</h2><p>Velg tema, nivå og form: kart, piler, tidslinjer, flervalg eller skriving.</p></div><button class="secondary" onclick={()=>{quizSetup=true;window.scrollTo(0,0);}}>Lag en quiz</button></div>
      {/if}
      {#if quizSetup}<div class="t-back"><button class="s-back" onclick={()=>quizSetup=false}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg><span>I dag</span></button></div><header class="t-head"><h1>Lag en quiz</h1></header>
        <div class="t-builder">
          <label class="t-field">Tema<select class="select" bind:value={quizCollection}><option value="">Alt innhold</option>{#if data.collections.some(c=>c.core)}<optgroup label="Fagområder">{#each data.collections.filter(c=>c.core).sort((a,b)=>a.order-b.order) as c}<option value={c.id}>{c.title}</option>{/each}</optgroup>{/if}<optgroup label="Registre og verden">{#each data.collections.filter(c=>!c.core) as c}<option value={c.id}>{c.title}</option>{/each}</optgroup></select></label>
          <fieldset><legend>Nivå</legend><div class="level-picker">{#each LEVELS as l}<button type="button" class="level-option" aria-pressed={quizLevel===l.id} disabled={!availability.levels.has(l.id)} onclick={()=>quizLevel=l.id}><strong>{l.id}</strong><small>{l.name}</small></button>{/each}</div><p class="level-note">{LEVELS.find(l=>l.id===quizLevel)?.note}</p></fieldset>
          <fieldset class="format-picker"><legend>Form</legend><div class="format-grid">{#each [...FORMAT_CHOICES,...WORLD_FORMAT_CHOICES] as format}{@const levels=availability.formats.get(format.id) || []}{#if levels.length}<button class="format-choice" aria-pressed={quizMode===format.id} onclick={()=>{quizMode=format.id;if(!levels.includes(quizLevel))quizLevel=levels.reduce((best,l)=>Math.abs(l-quizLevel)<Math.abs(best-quizLevel)?l:best,levels[0]);}}><strong>{format.label}</strong><small>{levels.includes(quizLevel)?format.note:`Nivå ${levels.join(', ')}`}</small></button>{/if}{/each}</div></fieldset>
          <button class="primary" disabled={busy || !formatAvailable(quizMode)} onclick={()=>run(()=>beginSession(quizMode,{collectionId:quizCollection,level:quizLevel,title:quizCollection?titleFor(quizCollection):'Fri quiz'}))}>Start quiz</button>
          {#if !formatAvailable(quizMode)}<p class="t-sub">Ingen spørsmål i denne formen på dette nivået. Velg et annet nivå eller tema.</p>{/if}
        </div>
      {/if}
      {#if paused.length && !quizSetup}<details class="t-paused"><summary>Quizer på pause ({paused.length})</summary>{#each paused as saved}<button class="t-row" onclick={()=>run(()=>resumeSession(saved))}><span class="t-row-text"><strong>{saved.title || 'Quiz'}</strong><small>{saved.index+1} av {saved.queue.length}</small></span><svg class="s-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg></button>{/each}</details>{/if}
      </div>
    {/if}
  {:else if view === 'atlas'}
    <div class="atlas-page">
    {#if entity}
    <div class="atlas-entity">
      <button class="quiet back-button" onclick={()=>detailId=''}>← Atlas</button><section class="hero"><p class="eyebrow">{typeLabel(entity.type)}</p><h1>{#if entity.geo && entity.iso2}<Flag iso2={entity.iso2} />{/if}{entity.label}</h1><p class="lead">{entity.summary}</p></section>{#if entity.type==='topic'}<button class="primary" onclick={()=>openUnit(entity.id.replace(/^unit:/,''))}>Åpne emnet</button>{/if}{#if artworkMedia.find(m=>m.entityId===entity.id)}{@const art=artworkMedia.find(m=>m.entityId===entity.id)}<figure class="artwork-figure"><img src={art.url} alt={`${art.title} av ${art.artist}`} width={art.width} height={art.height}><figcaption class="muted detail">{art.credit} · <a href={art.sourceUrl} target="_blank" rel="noreferrer">Bildekilde</a></figcaption></figure>{/if}
      {#if sourceQueries(entity,data.sources).length}<div class="card stack"><button class="secondary" disabled={busy} onclick={()=>run(()=>loadMoreSources(entity.id))}>Hent bilder og flere spørsmål</button><p class="muted detail">Henter kildebelagte forbindelser og bilder med fri bruk. Innholdet lagres på denne enheten.</p>{#if sourceProgress || sourceStatus}<p class="muted" role="status">{sourceProgress || sourceStatus}</p>{/if}</div>{/if}
      <div class="card stack">{#if entityTargets.length}<label>Nivå<select class="select" value={entityLevel} onchange={event=>entityLevelChoice=Number(event.currentTarget.value)}>{#each LEVELS.filter(l=>entityLevels.includes(l.id)) as l}<option value={l.id}>{l.id} · {l.name}</option>{/each}<option value={0}>Alle nivåer</option></select></label>{/if}<button class="primary" disabled={busy || !entityTargets.length} onclick={()=>run(()=>beginSession('mixed',{entityId:entity.id,title:entity.label,level:entityLevel}))}>Quiz om {entity.label}</button>{#if !entityTargets.length}<p class="muted">Denne siden har ikke quizspørsmål ennå.</p>{/if}</div>
      {#if worldGraph}<button class="secondary" onclick={()=>{try{const saved=JSON.parse(localStorage.getItem('atlas-world')||'{}');localStorage.setItem('atlas-world',JSON.stringify({...saved,focusId:entity.id}));}catch{}navigate('world');}}>Se {entity.label} gjennom historiesynene →</button>{/if}<div class="chips">{#each entity.collectionIds as id}<button class="chip" onclick={()=>run(()=>beginSession('mixed',{collectionId:id,level:quizLevel,title:titleFor(id)}))}>Quiz: {titleFor(id)} →</button>{/each}</div>
      <h2 class="section-title">Sammenhenger</h2><div class="card">{#each entityRelationships.slice(0,relationshipLimit) as relation}{@const other=data.entities.find(e=>e.id===(relation.from===entity.id?relation.to:relation.from))}<button class="entity-row" onclick={()=>detailId=other?.id || ''}><span><small class="eyebrow">{relation.from===entity.id || relation.type==='borders'?relationLabel(relation.type):`${relationLabel(relation.type)} · inngående`}</small><strong>{other?.label}</strong><small class="muted">{relation.context}</small></span><span aria-hidden="true">↗</span></button>{/each}</div>
      {#if entityRelationships.length > relationshipLimit}<button class="secondary" onclick={()=>relationshipLimit+=40}>Vis flere forbindelser ({entityRelationships.length})</button>{/if}
      <h2 class="section-title">Flere spørsmål</h2>{#each targets.filter(t=>t.entityId===entity.id && !t.baseId).sort((a,b)=>a.difficulty-b.difficulty).slice(0,6) as target}<div class="card"><small class="muted">Nivå {target.level} · {levelName(target.level)}</small><p>{target.prompt}</p><details><summary>Vis svar</summary><h3>{target.answer}</h3><p class="muted">{target.explanation}</p></details></div>{/each}
      <div class="card"><h2>Kilder</h2>{#each entity.sourceIds as id}{@const source=sourceFor(id)}{#if source}<p><a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></p>{/if}{/each}</div>
    </div>
    {:else}
      <h1 class="sr-only">Atlas</h1>
      <div class="atlas-searchbar"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 4 4"/></svg><input class="input atlas-search" id="search" bind:value={query} type="search" placeholder="Søk etter person, sted, verk eller idé" aria-label="Søk i Atlas"></div>
      {#if query.trim() || collectionFilter}
      <div class="search-bar-row"><button class="quiet" onclick={()=>{query='';collectionFilter='';}}>← Tilbake til Atlas</button><label class="field search-filter">Samling<select class="select" bind:value={collectionFilter}><option value="">All kunnskap</option>{#each data.collections as collection}<option value={collection.id}>{collection.title}</option>{/each}</select></label></div>
      {#if collectionFilter}<div class="card stack collection-quiz"><label>Nivå<select class="select" bind:value={quizLevel}>{#each LEVELS as l}<option value={l.id}>{l.id} · {l.name}</option>{/each}<option value={0}>Alle nivåer</option></select></label><button class="primary" disabled={busy} onclick={()=>run(()=>beginSession('mixed',{collectionId:collectionFilter,level:quizLevel,title:titleFor(collectionFilter)}))}>Start quiz: {titleFor(collectionFilter)}</button></div>{/if}
      <p class="result-count">Viser {matchingEntities.length} av {allMatchingEntities.length} treff.</p>
      <div class="entity-list">{#each matchingEntities as item}<button class="entity-row" onclick={()=>detailId=item.id}><span><small class="eyebrow">{typeLabel(item.type)}</small><strong>{item.label}</strong><small class="muted">{item.summary}</small></span><span aria-hidden="true">↗</span></button>{:else}<p class="empty">Ingen treff ennå. Prøv et annet navn eller en annen samling.</p>{/each}</div>
      {#if matchingEntities.length < allMatchingEntities.length}<button class="secondary more-results" onclick={()=>exploreLimit+=60}>Vis flere</button>{/if}
      <div class="card stack source-tools"><button class="secondary" disabled={busy} onclick={()=>run(()=>loadMoreSources())}>Hent flere bilder og spørsmål</button><p class="muted detail">Henter opptil åtte nye kildeposter i valgt samling. Bilder og spørsmål lagres lokalt og kan brukes uten nett.</p><p class="muted" role="status">{sourceProgress || sourceStatus}</p></div>
      {:else}
        <div class="ruled-tabs" role="tablist" aria-label="Velg visning">{#each [['tid','Tid'],['kart','Kart'],['emner','Emner']] as [id,label]}<button role="tab" aria-selected={atlasTab===id} onclick={()=>{atlasTab=id;if(id!=='emner')selectedUnit='';}}>{label}</button>{/each}</div>
        {#if atlasTab==='tid' && data.curriculum && coreProgress}
          <div class="atlas-tid"><StorySpine curriculum={data.curriculum} progress={coreProgress} highlight={selection.units || []} onOpen={openUnit} bind:zoom={timelineState.zoom} bind:domain={timelineState.domain} bind:selectedId={timelineState.selectedId} /></div>
        {:else if atlasTab==='kart'}
          {#if worldGraph && maps.some(m=>m.id==='world')}<WorldExplorer graph={worldGraph} dataset={maps.find(m=>m.id==='world')} bind:relevance={prefs.relevance} {typeLabel} {relationLabel} formatAvailable={id=>targets.some(t=>t.format===id)} onSave={()=>run(()=>put(db,'settings',JSON.parse(JSON.stringify(prefs))))} onOpen={id=>{detailId=id;view='atlas';window.location.hash='atlas';window.scrollTo(0,0);}} onQuiz={(objective,scope)=>run(()=>beginSession(objective,scope))} onUnit={openUnit} />
    {:else}<div class="card"><p>Verdensutforskeren trenger kunnskapspakke 2.1.0. Koble til nettet for å oppdatere.</p><button class="secondary" disabled={busy} onclick={()=>run(()=>checkUpdates(true))}>Se etter oppdatering</button></div>{/if}
        {:else}
          {#if data.curriculum && coreProgress}
      <div class="atlas-emner"><LearningPath curriculum={data.curriculum} progress={coreProgress} sources={data.sources} bind:selectedUnit {busy}
        onstart={id=>run(()=>beginSession(null,{unitId:id,unitMode:'learn',title:unitTitle(id)}))}
        onreview={id=>run(()=>beginSession(null,{unitId:id,unitMode:'review',title:unitTitle(id)}))}
        mapFor={id=>unitMapTargets(id).length>2} onmap={id=>run(()=>beginSession('geography',{targetIds:unitMapTargets(id),level:0,title:`Kart: ${unitTitle(id)}`}))} /></div>
      
    {:else}<section class="hero"><h1>Emner</h1><p class="lead">Oppdater innholdet for å få emnene.</p></section>{/if}
        {/if}
      {/if}
    {/if}
    </div>
  {:else if view === 'me'}
    <div class="me-page">
    <h1 class="me-title">Deg</h1>
    <div class="ruled-tabs" role="tablist" aria-label="Velg visning">{#each [['fremgang','Fremgang'],['okten','Økten'],['innstillinger','Innstillinger']] as [id,label]}<button role="tab" aria-selected={meTab===id} onclick={()=>meTab=id}>{label}</button>{/each}</div>
    {#if meTab==='fremgang'}
<div class="sub-nav" role="group" aria-label="Velg fremgangsvisning">{#each [{id:'overview',label:'Oversikt'},{id:'levels',label:'Nivåer og akser'},{id:'topics',label:'Quiztemaer'},{id:'history',label:'Siste svar'}] as tab}<button aria-pressed={progressTab===tab.id} onclick={event=>{progressTab=tab.id;event.currentTarget.scrollIntoView?.({inline:'center',block:'nearest'});window.scrollTo(0,0);}}>{tab.label}</button>{/each}</div>
    {#if progressTab==='overview'}
    <section class="ledger-stats"><div class="stat-row"><div class="stat"><strong>{summary.answered}</strong><span>Ulike spørsmål besvart</span></div><div class="stat"><strong>{summary.correct}</strong><span>Riktige uten hjelp sist</span></div></div><p class="muted">Dagens økt, emner og fri quiz teller med.</p></section>
    {/if}
    {#if progressTab==='overview' && data.curriculum && coreProgress}<section class="ledger"><h2>Kunnskapskart</h2><p class="muted">Andel kort du sist svarte riktig på uten hjelp, per fagområde.</p>{#each data.curriculum.domains as domain}{@const row=coreProgress.domains.get(domain.id)}{@const pct=row.total?Math.round(100*row.correct/row.total):0}<button class="unit-row ledger-row" onclick={()=>{selectedUnit='';navigate('learn');}}><span class="unit-text"><strong>{domain.title}</strong><small class="muted">{row.complete} av {row.units} emner gjennomført · {row.correct} av {row.total} kort</small><span class="bar small"><span style={`width:${pct}%`}></span></span></span><span class="ledger-num" aria-hidden="true">{pct}<small>%</small></span></button>{/each}</section>{/if}
    {#if progressTab==='overview'}
    <div class="card"><h2>Øv videre</h2><p class="muted">{progress.retryIds.length} spørsmål hadde sist feil svar eller læringsstøtte.</p><button class="primary" disabled={!progress.retryIds.length || busy} onclick={()=>run(()=>beginSession('mixed',{targetIds:progress.retryIds,level:0,title:'Øv videre'}))}>Øv på det du trenger</button></div>
    <div class="card"><h2>Siste sju dager</h2><div class="week-activity">{#each progress.days as day}<div><strong>{day.count}</strong><span class="activity-bar" style={`height:${8+Math.min(60,day.count*3)}px`}></span><small>{day.label}</small></div>{/each}</div><p class="muted">Antall besvarte oppgaver, inkludert ekstraøving.</p></div>
    {/if}
    
    {#if progressTab==='overview'}<div class="card"><h2>Hva slags øving?</h2><p class="muted">Siste svar uten hjelp, fordelt på ferdighet. Egenvurderte forklaringer er ikke en måling av full mestring.</p><div class="result-grid"><span><strong>{abilities.recognized}</strong>gjenkjent</span><span><strong>{abilities.recalled}</strong>hentet fram</span><span><strong>{abilities.explained}</strong>forklart med egenvurdering</span></div>{#if selfApprovedCount}<p class="muted">{selfApprovedCount} tekstsvar er godkjent av deg selv. De teller som riktige, men aldri som «Satt lett».</p>{/if}</div>{/if}
    {#if progressTab==='levels'}
      {@const insight=axisInsights(targets,reviews)}
      <div class="card"><h2>Hva gjør det vanskelig for deg?</h2>
        <p class="muted">Et spørsmål kan være vanskelig av fire ulike grunner. Andelen viser siste svar uten hjelp, for hvert trinn på aksen.</p>
        {#if insight.weakest}<p class="insight">Du faller mest på <strong>{insight.weakest.axis.label.toLocaleLowerCase('nb')}</strong>: {insight.weakest.axis.note}</p>{:else}<p class="muted">Svar på flere spørsmål for å se et mønster.</p>{/if}
        {#each insight.rows as row}<div class="axis-insight"><h3>{row.axis.label}</h3><div class="axis-steps">{#each row.steps as cell}<span><small>{row.axis.steps[cell.step-1]}</small><strong>{cell.rate===null?'–':`${Math.round(cell.rate*100)} %`}</strong><i style:width={`${cell.rate===null?0:Math.round(cell.rate*100)}%`}></i><em>{cell.answered} svar</em></span>{/each}</div></div>{/each}
      </div>
      <h2 class="section-title">Nivåene</h2>
      {#each LEVELS as level}{@const result=quizProgress(targets.filter(t=>t.level===level.id),reviews)}<div class="card level-entry"><h3><span class="level-id">{level.id}</span>{level.name}</h3><p class="muted">{level.note}</p>
        <div class="coverage-track" role="img" aria-label={`${result.correct} ${riktig(result.correct)} uten hjelp, ${result.answered-result.correct} trenger øving, ${result.remaining} usett`}><span class="coverage-correct" style={`width:${result.total?100*result.correct/result.total:0}%`}></span><span class="coverage-practice" style={`width:${result.total?100*(result.answered-result.correct)/result.total:0}%`}></span></div>
        <p class="muted">{result.correct} {riktig(result.correct)} uten hjelp · {result.answered-result.correct} trenger øving · {result.remaining} usett</p>
        <button class="secondary" disabled={busy} onclick={()=>run(()=>beginSession('mixed',{level:level.id,title:`Nivå ${level.id}: ${level.name}`}))}>Øv på nivå {level.id}</button></div>{/each}
    {/if}
    {#if progressTab==='topics'}<h2 class="section-title">Quiztemaer du har øvd på</h2>{#each data.collections as collection}{@const result=quizProgress(targets.filter(t=>t.collectionIds.includes(collection.id)),reviews)}{#if result.answered}<button class="entity-row" onclick={()=>{quizCollection=collection.id;quizSetup=true;navigate('today');quizSetup=true;}}><span><strong>{collection.title}</strong><small>{result.answered} besvart · {result.correct} {riktig(result.correct)} sist</small></span></button>{/if}{/each}
    {/if}
    {#if !summary.answered && progressTab==='overview'}<p class="muted">Start en quiz for å se fremgangen din.</p><button class="primary" onclick={()=>navigate('today')}>Velg quiz</button>{/if}
    {#if progressTab==='history'}<details class="card" open><summary>Siste svar</summary>{#each [...reviews].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,10) as review}<p class="detail"><strong>{targets.find(t=>t.id===review.targetId)?.prompt || 'Tidligere spørsmål'}</strong><br><span class="muted">{review.learnedFirst?'Lært først':review.usedHint?'Med hint':review.correct===true?'Riktig':review.correct===false?'Feil':'Svar vist'} · {displayDate(review.timestamp)}</span></p>{/each}</details>{/if}
    {:else if meTab==='okten'}
    
    <p class="muted">Dette styrer dagens kapittel. Fri quiz velger du når du starter den.</p>
    <form onsubmit={event=>{event.preventDefault();run(async()=>{await savePreferences();});}}>
      {#if data.curriculum}<div class="card"><h2>Fagområder</h2><p class="muted">Ingen valgt betyr alle. Nye emner veksler mellom fagområdene du velger.</p><div class="chips">{#each data.curriculum.domains as domain}<button type="button" class="chip" class:active={prefs.collectionIds.includes(domain.id)} aria-pressed={prefs.collectionIds.includes(domain.id)} onclick={()=>toggleCollection(domain.id)}>{domain.title}</button>{/each}</div></div>{/if}
      <div class="card stack"><label class="field">Øktlengde<select class="select" bind:value={prefs.dailyMinutes}><option value={3}>Kort · omtrent 6 spørsmål</option><option value={5}>Vanlig · omtrent 10 spørsmål</option><option value={10}>Lang · omtrent 20 spørsmål</option></select></label><label class="field">Nytt stoff<select class="select" bind:value={prefs.newRatio}><option value={0}>Bare repetisjon når noe er klart</option><option value={0.25}>Lite nytt</option><option value={0.4}>Balansert</option><option value={0.6}>Mye nytt</option></select></label><p class="muted detail">Repetisjoner kommer alltid først. Nye kort fyller resten av økten.</p>
        <label class="row toggle"><input type="checkbox" checked={prefs.story!==false} onchange={e=>prefs.story=e.currentTarget.checked}><span>Følg historien gjennom tid<small class="muted">Nye emner åpnes i tidsrekkefølge på tvers av fag, med et tidløst emne innimellom.</small></span></label>
        <fieldset><legend>Nivå for perspektiver og registre</legend><div class="level-picker">{#each LEVELS as l}<button type="button" class="level-option" aria-pressed={preferredLevel(prefs)===l.id} onclick={()=>prefs.level=l.id}><strong>{l.id}</strong><small>{l.name}</small></button>{/each}</div><p class="level-note">{LEVELS.find(l=>l.id===preferredLevel(prefs))?.note || 'Alle nivåer.'}</p></fieldset></div>
      <details class="card"><summary>Registre og fri quiz</summary><p class="muted">Disse valgene gjelder bare quizer fra registrene (Nobelpriser, kommuner, land), ikke emnene.</p><h3>Samlinger</h3><div class="chips">{#each data.collections.filter(c=>!c.core) as collection}<button type="button" class="chip" class:active={prefs.collectionIds.includes(collection.id)} aria-pressed={prefs.collectionIds.includes(collection.id)} onclick={()=>toggleCollection(collection.id)}>{collection.title}</button>{/each}</div>
      <h3>Hva er relevant for deg?</h3><p class="muted">Spørsmål fra registrene vektes etter påvirkning, aktualitet og nærhet. Nå: Påvirkning {prefs.relevance?.impact ?? DEFAULT_RELEVANCE.impact} · Aktualitet {prefs.relevance?.actuality ?? DEFAULT_RELEVANCE.actuality} · Nærhet {prefs.relevance?.locality ?? DEFAULT_RELEVANCE.locality}.</p><button type="button" class="secondary" onclick={openWeights}>Endre vektingen i Kart</button><div class="stack"><label class="field">Fagområde<select class="select" bind:value={prefs.subject}><option value="all">Alle fagområder</option>{#each [...new Set(data.collections.map(c=>c.subject))] as subject}<option value={subject}>{subjectLabel(subject)}</option>{/each}</select></label><label class="field">Geografisk relevans<select class="select" bind:value={prefs.geography}><option value="global">Global betydning</option><option value="norway">Mer norsk relevans</option></select></label><p class="muted detail">Norske spørsmål prioriteres.</p><label class="field">Bredde<select class="select" bind:value={prefs.breadth}><option value="broad">Veksle mellom fagområder</option><option value="deep">Fordypning</option></select></label><div class="row"><label class="field">Fra år<input class="input" type="number" min="-10000" max="2100" placeholder="Valgfritt" bind:value={prefs.fromYear}></label><label class="field">Til år<input class="input" type="number" min="-10000" max="2100" placeholder="Valgfritt" bind:value={prefs.toYear}></label></div><p class="muted detail">Årsfilteret gjelder spørsmål med dato.</p></div></details>
      <button class="primary" type="submit" disabled={busy}>Lagre</button>
    </form>
    {:else}

    <div class="settings-list">
      <section class="set-group"><h2 class="group-title">Visning</h2><div class="set-rows">
      <div class="settings-row"><label for="theme">Utseende</label><select id="theme" class="select" bind:value={prefs.theme} onchange={()=>run(savePreferences)}><option value="system">Følg enheten</option><option value="light">Lyst</option><option value="dark">Mørkt</option></select></div>
      </div></section>
      <section class="set-group"><h2 class="group-title">Påminnelse</h2><div class="set-rows">
      <div class="settings-row"><div><label for="reminder">Daglig påminnelse</label><p>Legges i kalenderen din</p></div><input id="reminder" class="input" type="time" bind:value={prefs.reminderTime} onchange={()=>run(()=>savePreferences(true))}></div>
      <div class="settings-row"><span>Legg påminnelsen i kalenderen</span><button class="secondary" onclick={()=>run(async()=>{await savePreferences(true);download(reminderCalendar(prefs.reminderTime),'atlas-daily-practice.ics','text/calendar');})}>Legg til</button></div>
      </div></section>
      <section class="set-group"><h2 class="group-title">Appen</h2><div class="set-rows">
      <div class="settings-row"><div><span>Oppdateringer</span><p>App {APP_VERSION} · innhold {data.version}</p></div><button class="secondary" disabled={busy || appCheck.state==='checking'} onclick={()=>run(async()=>{await checkAppUpdate(true);await checkUpdates(true);})}>{appCheck.state==='checking'?'Sjekker …':'Se etter'}</button></div>
      {#if updateReady}<div class="settings-row"><span>Ny apputgave er klar</span><button class="primary" disabled={busy} onclick={()=>run(applyUpdate)}>Installer</button></div>{:else if appCheck.state==='pending'}<div class="settings-row"><span role="status">Ny utgave er publisert, men ennå ikke aktiv.</span><button class="secondary" onclick={()=>run(async()=>{if(session)await put(db,'sessions',{...session,draft:draftNow()});window.location.reload();})}>Last inn på nytt</button></div>{:else if appCheck.state==='failed'}<p class="settings-note" role="status">{appCheck.message}</p>{/if}
      {#if !installed}<div class="settings-row"><div><span>Installer Atlas</span><p>iPhone: Del → Legg til på Hjem-skjerm i Safari.</p></div>{#if installPrompt}<button class="secondary" onclick={()=>run(async()=>{await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;})}>Installer</button>{/if}</div>{/if}
      </div></section>
      <section class="set-group"><h2 class="group-title">Data på enheten</h2><div class="set-rows">
      <div class="settings-row"><div><span>Sikkerhetskopi</span><p>Fremgangen lagres bare på denne enheten.</p></div><button class="secondary" disabled={busy} onclick={()=>run(async()=>download(await exportDatabase(db),`atlas-backup-${new Date().toISOString().slice(0,10)}.json`))}>Last ned</button></div>
      <div class="settings-row"><span>Gjenopprett fra sikkerhetskopi</span><button class="secondary" disabled={busy} onclick={()=>restoreInput.click()}>Velg fil</button><input bind:this={restoreInput} type="file" accept=".json,application/json" hidden onchange={event=>run(()=>readBackup(event))}></div>
      </div></section>
    </div>
    <details class="card diagnostics" ontoggle={event=>{if(event.currentTarget.open)run(async()=>{await checkStorage();await refresh();});}}><summary>Diagnostikk</summary>
      <h3>Lagring og frakoblet tilgang</h3><p>Nettleserbruk: {storageInfo.usage===undefined?'Utilgjengelig':`${Math.round(storageInfo.usage/1024)} KB`} av {storageInfo.quota===undefined?'ukjent kvote':`${Math.round(storageInfo.quota/1024/1024)} MB`}</p><p>Lagrede appdata: {Math.round((storageInfo.cacheBytes || 0)/1024)} KB · {storageInfo.cachedFiles || 0} filer</p><p>Varig lagring: {storageInfo.persistent?'Innvilget':'Ikke innvilget eller støttet'} · Frakoblet app: {offlineReady?'Installert':'Klargjøres eller er utilgjengelig'}</p>
      <div class="chips"><button class="secondary" onclick={()=>run(async()=>{const granted=await navigator.storage?.persist?.();await checkStorage();notify(granted?'Varig lagring er innvilget.':'Nettleseren innvilget ikke varig lagring. Ta sikkerhetskopi jevnlig.');})}>Be om varig lagring</button><button class="secondary" onclick={()=>run(()=>offlineMode(true))}>Test uten nettverk</button></div>
      <h3>Kunnskap</h3><p>{data.id} · {data.version} · skjema {data.schemaVersion}</p><p>{data.entities.length} kunnskapselementer · {data.relationships.length} forbindelser · {data.targets.length} øvelsesmål · {data.sources.length} kilder</p><p>Kunnskapsberedskap: {readiness(data).score}% <span class="muted">(40 % kildedekning + 30 % forklaringsdekning + 30 % forbindelsesdekning)</span></p><p class="muted">Siste innholdssjekk: {lastUpdate?new Date(lastUpdate.checkedAt).toLocaleString('nb-NO'):'Ikke kontrollert'} · {lastUpdate?.status === 'success' ? 'Vellykket' : lastUpdate?.status === 'failed' ? 'Mislyktes' : 'Ukjent'}{lastUpdate?.message?` · ${lastUpdate.message}`:''}</p>
      <div class="chips"><button class="secondary" onclick={()=>run(validateKnowledge)}>Valider</button><button class="secondary" onclick={()=>run(async()=>{await installPackage(db,data,{hash:data.hash});notify('Kunnskapsindeksene er gjenbygd; læringshistorikken er beholdt.');})}>Bygg indeksene på nytt</button></div>
      <h3>Innholdsdekning</h3><p class="muted">Hva biblioteket inneholder og mangler. Dette måler ikke kunnskapen din.</p>{#each contentCoverage as coverage}<details class="coverage"><summary>{coverage.title}</summary><p class="muted">{coverage.scope}</p><p>{coverage.facts} testede fakta · {coverage.introductions} introduksjoner · {coverage.connections} sammenhengsøvelser · {coverage.paths} læringsstier</p><p class="muted">{coverage.untestedEntities} registeroppføringer uten øvelser. {coverage.sourced} testede fakta har kilder.</p>{#if coverage.gaps.length}<h3>Videre utvikling</h3><ul>{#each coverage.gaps as gap}<li>{gap}</li>{/each}</ul>{/if}</details>{/each}
      <h3>Repetisjonsplan</h3><p class="muted">FSRS · ts-fsrs 5.4.2 · mål for bevaring 90 %</p>{#each [...reviews].reverse().slice(0,8) as review}{@const state=states.find(s=>s.id===(review.schedulerId || review.targetId))}<p class="detail-line"><strong>{review.targetId}</strong><br>{reasonLabel(review.reason)} · {ratingLabels[review.rating-1]} · stabilitet {state?.stability?.toFixed(1) || '0'} d · vanskelighet {state?.difficulty?.toFixed(1) || '0'}<br><span class="muted">{review.nextDue?`Neste: ${new Date(review.nextDue).toLocaleString('nb-NO')}`:'Ekstraøving'}</span></p>{/each}
      <h3>Logg</h3>{#each [...logs].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,10) as log}<p class="detail-line"><strong>{log.component} · {log.severity === 'error' ? 'Feil' : log.severity === 'warning' ? 'Advarsel' : 'Informasjon'}</strong><br>{log.message}<br><span class="muted">{new Date(log.timestamp).toLocaleString('nb-NO')}</span></p>{:else}<p class="muted">Ingen feil er registrert.</p>{/each}
      <div class="chips"><button class="secondary" onclick={()=>download({exportedAt:new Date().toISOString(),logs},'atlas-diagnostics.json')}>Eksporter</button><button class="quiet danger" onclick={()=>pendingDestruction='logs'}>Tøm loggen…</button></div>
    </details>
    {/if}
    </div>
  {/if}
  {#if confirmRestore}<div class="card confirm" role="alert"><h2>Erstatte lokale data?</h2><p>Dette gjenoppretter sikkerhetskopien fra {displayDate(confirmRestore.exportedAt)} og erstatter kunnskapen og læringshistorikken på denne enheten. Eksporter en kopi først hvis du vil beholde den.</p><button class="primary" disabled={busy} onclick={()=>run(restore)}>Erstatt med denne sikkerhetskopien</button><button class="secondary" onclick={()=>confirmRestore=null}>Avbryt</button></div>{/if}
  {#if pendingDestruction==='logs'}<div class="card confirm" role="alert"><h2>Tømme diagnostikkloggen?</h2><p>Læringshistorikken beholdes. Den lokale diagnostikkloggen slettes.</p><button class="primary" onclick={()=>run(async()=>{await clearLogs(db);pendingDestruction='';await refresh();})}>Tøm diagnostikkloggen</button><button class="secondary" onclick={()=>pendingDestruction=''}>Avbryt</button></div>{/if}
</main>
<Feedback context={()=>({appVersion:APP_VERSION,view,packageId:data?.id,packageVersion:data?.version,target:current?{id:current.id,prompt:current.prompt,mode:current.mode,entityId:current.entityId}:null,session:sessionScreen?{index:session?.index,total:session?.queue.length,revealed,correct,usedHint}:null,focus:JSON.parse(JSON.stringify(prefs)),selfApproved:selfApprovals(targets,reviews),offlineTest,error})}/>
{#if toast}<div id="toast" class="toast" role="status" aria-live="polite"><span>{toast}</span><button class="quiet" aria-label="Lukk melding" onclick={()=>toast=''}>×</button></div>{/if}
