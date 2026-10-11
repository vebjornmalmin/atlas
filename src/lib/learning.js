import {factKey,learningStage,uniqueFacts,exposureKey,uniqueQuizFacts} from './journey.js';
import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';
export { Rating };
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false, enable_short_term: false });
export const DEFAULT_PREFERENCES = {
  id: 'preferences', collectionIds: [], dailyMinutes: 5, newRatio: 0.4,
  depth: 'foundation', geography: 'global', objective: 'mixed', breadth: 'broad',
  subject: 'all', fromYear: '', toYear: '', theme: 'system', reminderTime: '09:00'
};


export function schedulingIndex(targets,states) {
  const keyById=new Map(targets.map(t=>[t.id,factKey(t)]));
  const index=new Map();
  for(const state of states){
    const key=keyById.get(state.id) || state.id;
    const previous=index.get(key);
    if(!previous || (state.last_review || '').localeCompare(previous.last_review || '')>0 || (state.last_review===previous.last_review && state.id===key))index.set(key,state);
  }
  return index;
}
export function stateForTarget(target,targets,states) {return schedulingIndex(targets,states).get(factKey(target)) || null;}

export function hydrateCard(state, now = new Date()) {
  if (!state) return createEmptyCard(now);
  return { ...state, due: new Date(state.due), last_review: state.last_review ? new Date(state.last_review) : undefined };
}

export function scheduleReview(targetId, state, rating, now = new Date()) {
  if (![1, 2, 3, 4].includes(rating)) throw new Error('Invalid recall rating.');
  const result = scheduler.next(hydrateCard(state, now), now, state ? rating : Math.min(rating,3));
  if(!state && new Date(result.card.due)-now>86400000){result.card.due=new Date(now.getTime()+86400000);result.card.scheduled_days=1;}
  return {
    card: { ...result.card, id: targetId, due: result.card.due.toISOString(), last_review: result.card.last_review?.toISOString() },
    log: { ...result.log, due: result.log.due.toISOString(), review: result.log.review.toISOString() }
  };
}

export function ratingIntervals(state, now = new Date()) {
  return Object.fromEntries([1,2,3,4].map(rating => [rating, scheduleReview('preview', state, rating, now).card.due]));
}

export function targetMatches(target, preferences, collections = []) {
  const pref = { ...DEFAULT_PREFERENCES, ...preferences };
  if (pref.collectionIds.length && !target.collectionIds.some(id => pref.collectionIds.includes(id))) return false;
  if (pref.subject !== 'all' && !target.collectionIds.some(id => collections.find(c => c.id === id)?.subject === pref.subject)) return false;
  if (pref.depth === 'foundation' && (target.difficulty > 3 || learningStage(target) !== 'foundation')) return false;
  if (pref.depth === 'intermediate' && (target.difficulty > 4 || learningStage(target) === 'connections')) return false;
  if (Number.isFinite(target.year)) {
    if (pref.fromYear !== '' && target.year < Number(pref.fromYear)) return false;
    if (pref.toYear !== '' && target.year > Number(pref.toYear)) return false;
  }
  if (pref.objective === 'chronology' && target.mode !== 'timeline' && target.kind !== 'before-after') return false;
  if (pref.objective === 'geography' && target.mode !== 'map') return false;
  if (pref.objective === 'connections' && target.kind !== 'connections') return false;
  if (pref.objective === 'recognition' && target.mode !== 'recognition') return false;
  if (pref.objective === 'outline' && target.mode !== 'outline') return false;
  if (['matching','before-after','arrows'].includes(pref.objective) && target.mode!==pref.objective) return false;
  if (pref.objective === 'recall' && ['map', 'timeline', 'recognition','matching','before-after','arrows'].includes(target.mode)) return false;
  return true;
}

export function selectSession(targets, states, preferences, now = new Date(), collections = [], reviews = []) {
  const pref = { ...DEFAULT_PREFERENCES, ...preferences };
  const eligible = targets.filter(t => targetMatches(t, pref, collections));
  const byId = schedulingIndex(targets,states);
  const due = eligible.filter(t => byId.has(factKey(t)) && new Date(byId.get(factKey(t)).due) <= now)
    .sort((a,b) => new Date(byId.get(factKey(a)).due) - new Date(byId.get(factKey(b)).due));
  const score = target => target.significance * 2 - target.difficulty + (pref.geography === 'norway' && target.collectionIds.some(id => id.includes('norway') || id.includes('norwegian')) ? 3 : 0);
  const knownFacts = new Set(targets.filter(t=>byId.has(factKey(t))).map(factKey));
  const recentFacts = new Set(reviews.filter(r=>now-new Date(r.timestamp)<86400000).map(r=>targets.find(t=>t.id===r.targetId)).filter(Boolean).map(factKey));
  const fresh = eligible.filter(t => !knownFacts.has(factKey(t)) && !recentFacts.has(factKey(t)))
    .sort((a,b) => Number(Boolean(b.snapshot))-Number(Boolean(a.snapshot)) || Number(b.mode==='recognition')-Number(a.mode==='recognition') || score(b) - score(a) || a.id.localeCompare(b.id));
  const max = Math.min(20, Math.max(3, Number(pref.dailyMinutes) * 2));
  const newCount = pref.newRatio === 0 ? 0 : due.length ? Math.max(1, Math.round(max * pref.newRatio)) : max;
  const selectedDue = uniqueQuizFacts(due).slice(0, max - (due.length ? newCount : 0));
  const availableFresh = uniqueQuizFacts(fresh).filter(t=>!selectedDue.some(d=>exposureKey(d)===exposureKey(t)));
  const selectedFresh = [];
  const subjects = new Set();
  const modes = new Set();
  while (availableFresh.length && selectedFresh.length < newCount) {
    let index = pref.objective === 'mixed' ? availableFresh.findIndex(t => !modes.has(t.mode || 'recall')) : -1;
    if (index < 0) index = pref.breadth === 'broad' ? availableFresh.findIndex(t => !subjects.has(t.collectionIds[0])) : 0;
    if (index < 0) index = 0;
    const target = availableFresh.splice(index, 1)[0];
    selectedFresh.push(target); subjects.add(target.collectionIds[0]); modes.add(target.mode || 'recall');
  }
  const result = [];
  while (selectedDue.length || selectedFresh.length) {
    if (selectedDue.length) result.push({target:selectedDue.shift(),reason:'Due review'});
    if (selectedFresh.length) result.push({target:selectedFresh.shift(),reason:'New knowledge'});
  }
  return { queue: result.slice(0, max), dueCount: due.length, newCount: fresh.length, eligibleCount: eligible.length };
}

export function selectPracticeSession(targets, states, preferences, objective='mixed', now=new Date(), collections=[], reviews=[]) {
  const pref={...DEFAULT_PREFERENCES,...preferences,objective};
  if (objective==='chronology' || objective==='connections' || ['before-after','arrows'].includes(objective)) pref.depth='advanced';
  else if(['geography','outline','matching'].includes(objective) && pref.depth==='foundation')pref.depth='intermediate';
  const eligible=targets.filter(target=>targetMatches(target,pref,collections) && (objective!=='chronology' || target.mode==='timeline'));
  const byId=schedulingIndex(targets,states);
  const lastPracticed=new Map();
  for(const review of reviews) { const target=targets.find(t=>t.id===review.targetId); if(!target)continue; const key=exposureKey(target); if(!lastPracticed.has(key) || lastPracticed.get(key)<review.timestamp) lastPracticed.set(key,review.timestamp); }
  const rank=target=>!byId.has(factKey(target))?0:new Date(byId.get(factKey(target)).due)<=now?1:2;
  const remaining=uniqueQuizFacts([...eligible].sort((a,b)=>(lastPracticed.get(exposureKey(a))||byId.get(factKey(a))?.last_review||'').localeCompare(lastPracticed.get(exposureKey(b))||byId.get(factKey(b))?.last_review||'') || rank(a)-rank(b) || Number(Boolean(b.snapshot))-Number(Boolean(a.snapshot)) || Number(b.mode==='recognition')-Number(a.mode==='recognition') || b.significance-a.significance || a.id.localeCompare(b.id)));
  const selected=[];const modes=new Set();
  const max=Math.min(20,Math.max(3,Number(pref.dailyMinutes)*2));
  while(remaining.length && selected.length<max){
    const oldest=lastPracticed.get(exposureKey(remaining[0])) || '';
    let index=objective==='mixed'?remaining.findIndex(target=>(lastPracticed.get(exposureKey(target)) || '')===oldest && !modes.has(target.mode||'recall')):0;
    if(index<0)index=0;
    const target=remaining.splice(index,1)[0];selected.push({target,reason:'Extra practice'});modes.add(target.mode||'recall');
  }
  return {queue:selected,eligibleCount:eligible.length};
}

export function memorySummary(targets, states, now = new Date()) {
  const activeIds = new Set(targets.map(factKey));
  const active = [...schedulingIndex(targets,states)].filter(([id])=>activeIds.has(id)).map(([,state])=>state);
  const introduced = active.length;
  const strong = active.filter(s => s.stability >= 21 && s.lapses <= Math.max(1, s.reps / 3)).length;
  const difficult = active.filter(s => s.difficulty >= 7 || s.lapses >= 2).length;
  const due = active.filter(s => new Date(s.due) <= now).length;
  return { total: activeIds.size, introduced, strong, difficult, due, new: activeIds.size - introduced };
}

export function reminderCalendar(time, now = new Date()) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid reminder time.');
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(now); date.setHours(hours, minutes, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 1);
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const local = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}T${String(hours).padStart(2,'0')}${String(minutes).padStart(2,'0')}00`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atlas//Daily practice//EN','BEGIN:VEVENT',`UID:atlas-practice-${now.getTime()}@atlas-memory`,`DTSTAMP:${stamp(now)}`,`DTSTART:${local}`,'DURATION:PT5M','RRULE:FREQ=DAILY','SUMMARY:Atlas — dagens quiz','DESCRIPTION:Åpne Atlas og ta en quiz.','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Tid for en quiz','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
