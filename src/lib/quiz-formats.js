import {buildTimelineExercise,normalizeAnswer} from './exercises.js';
import {gradeBorderWalk} from './world-exercises.js';
import {gradeEstimate} from './levels.js';
import {gradeTheme,themeReady} from './listening/theme-exercises.js';
import {gradeListening,listeningReady} from './listening/exercises.js';
import {gradeDistance,distanceReady} from './time-distance.js';
import {WORLD_FORMATS} from '../../knowledge-build/lens-projections.mjs';
import {HISTORICAL_ARROWS,ARROW_REGION_NAMES,ARROW_KIND_QUESTIONS} from '../../knowledge-build/historical-arrows.mjs';

export const FORMAT_CHOICES = [
  {id:'mixed',label:'Blandet quiz',note:'Varierte oppgaver'},
  {id:'recognition',label:'Flervalg',note:'Velg ett svar'},
  {id:'recall',label:'Skriv svaret',note:'Hent fram fra hukommelsen'},
  {id:'matching',label:'Koble sammen',note:'Trekk linjer mellom par'},
  {id:'before-after',label:'Hva kom først?',note:'Sammenlign to hendelser'},
  {id:'arrows',label:'Historiske piler',note:'Dra en pil mellom land'},
  {id:'geography',label:'Kart',note:'Finn riktig sted'},
  {id:'outline',label:'Omriss',note:'Gjenkjenn formen'},
  {id:'chronology',label:'Tidslinje',note:'Dra hendelsene i rekkefølge'},
  {id:'estimate',label:'Når skjedde det?',note:'Plasser på tidslinjen'},
  {id:'distance',label:'Nærmest i tid',note:'Tidsavstander som overrasker'},
  {id:'theme',label:'Kjenn igjen temaet',note:'Lytt til melodien, uten nett'},
  {id:'listen',label:'Lytt',note:'Ekte innspillinger, krever nett'}
];
export const STRUCTURED_MODES = ['matching','before-after','arrows','pick','border-walk','estimate','theme','listen','distance'];
export const WORLD_FORMAT_CHOICES = WORLD_FORMATS;
export function buildFormatTargets(data, maps=[]) {
  const result=[];
  // Only homogeneous, single-answer families are suitable for unambiguous pairs.
  for (const [family,prefix,collection] of [['capital','capital-','world-geography'],['author','author-','literature']]) {
    const seen=new Set();
    const rows=data.targets.filter(t=>t.id.startsWith(prefix) || (family==='author' && t.id.startsWith('culture-author-'))).filter(t=>{const key=normalizeAnswer(t.answer);if(seen.has(key))return false;seen.add(key);return true;});
    for(let i=0;i<rows.length;i+=3){
      const batch=rows.slice(i,i+3);
      if(batch.length!==3 || new Set(batch.map(t=>t.answer)).size!==3)continue;
      const pairs=batch.map(t=>({id:t.id,label:t.prompt,answer:t.answer}));
      result.push({id:`matching:${family}:${batch[0].id}`,mode:'matching',kind:'connections',entityId:batch[0].entityId,collectionIds:[collection],pairs,
        prompt:family==='capital'?'Koble hvert land til hovedstaden.':'Koble hvert verk til forfatteren.',
        answer:pairs.map(p=>`${p.label} ${p.answer}`).join(' · '),explanation:'Hvert svar brukes én gang. De riktige parene vises nedenfor.',
        sourceIds:[...new Set(batch.flatMap(t=>t.sourceIds))],difficulty:3,significance:3});
    }
  }
  for(const timeline of data.timelines){
    // Ordinals such as «16. Abraham Lincoln» would reveal which came first.
    const items=[...timeline.items].map(i=>({...i,label:String(i.label).replace(/^\d+\.\s+/,'')})).sort((a,b)=>a.year-b.year);
    for(let i=0;i<items.length-1;i+=2){
      const pair=items.slice(i,i+2);if(pair[0].year===pair[1].year)continue;
      const shuffled=buildTimelineExercise({id:`first:${timeline.id}:${i}`,items:pair}).items;
      result.push({id:`first:${timeline.id}:${i}`,mode:'before-after',kind:'before-after',entityId:pair[0].entityId || pair[0].id,collectionIds:timeline.collectionIds,
        prompt:timeline.id.includes('nobel')?'Hvilken Nobelpristildeling kom først?':timeline.id.includes('presidential')?'Hvilken presidentperiode begynte først?':'Hvilken hendelse kom først?',
        items:shuffled,firstId:pair[0].id,answer:`${pair[0].label} (${pair[0].year})`,explanation:`${pair[0].label}: ${pair[0].year}. ${pair[1].label}: ${pair[1].year}. Rekkefølge betyr ikke nødvendigvis at én hendelse forårsaket den andre.`,
        sourceIds:timeline.sourceIds,difficulty:5,significance:3});
    }
  }
  if(maps.some(m=>m.id==='world'))for(const event of HISTORICAL_ARROWS){
    const from=ARROW_REGION_NAMES[event.from],to=ARROW_REGION_NAMES[event.to];
    const regions=[event.from,event.to,...event.distractors].map(id=>({id,label:ARROW_REGION_NAMES[id]})).sort((a,b)=>a.label.localeCompare(b.label,'nb'));
    const question=ARROW_KIND_QUESTIONS[event.kind];
    const common={mode:'arrows',kind:'connections',entityId:event.entityId,collectionIds:['history'],datasetId:'world',regions,
      from:event.from,to:event.to,year:event.year,sourceIds:[],sources:event.sources,difficulty:5,significance:4,
      explanation:`${event.label}: ${event.date}. ${event.note}${event.approximate?' Datoen er omtrentlig.':''} Kartet bruker dagens grenser.`};
    // The direction alone is the easier, spatial question; the year variant also asks for the exact year.
    result.push({...common,id:`arrows:${event.id}:direction`,baseId:`arrows:${event.id}`,retrievalRole:'direction',askYear:false,
      prompt:`${event.label} (${event.date}): ${question}?`,answer:`${from} → ${to}`});
    result.push({...common,id:`arrows:${event.id}`,askYear:true,
      prompt:`${event.label}: ${question}, og i hvilket år?${event.year<0?' Skriv f.Kr. for år før Kristus.':''}`,answer:`${from} → ${to} · ${event.date}`});
  }
  return result;
}
export function parseYearInput(value) {
  const match=String(value ?? '').trim().toLowerCase().match(/^(-?\d{1,4})\s*(f\.?\s*kr\.?|fvt\.?)?$/);
  if(!match)return NaN;
  const year=Number(match[1]);
  return match[2] ? -Math.abs(year) : year;
}
export function gradeStructured(target,draft={},neighbours=new Map()) {
  if(target.mode==='pick')return {correct:draft.choice===target.correctId};
  if(target.mode==='estimate')return gradeEstimate(draft.year,target);
  if(target.mode==='theme')return gradeTheme(target,draft);
  if(target.mode==='listen')return gradeListening(target,draft);
  if(target.mode==='distance')return gradeDistance(target,draft);
  if(target.mode==='border-walk')return gradeBorderWalk(target,draft.path||[],neighbours);
  if(target.mode==='matching') {
    const correctCount=target.pairs.filter(p=>draft[p.id]===p.id).length;
    return {correct:correctCount===target.pairs.length,correctCount,total:target.pairs.length};
  }
  if(target.mode==='before-after')return {correct:draft.first===target.firstId};
  if(target.mode==='arrows') {
    const directionCorrect=draft.from===target.from && draft.to===target.to;
    const yearCorrect=target.askYear===false?null:parseYearInput(draft.year)===target.year;
    return {correct:directionCorrect && yearCorrect!==false,directionCorrect,yearCorrect};
  }
  return {correct:false};
}
export function structuredReady(target,draft={}) {
  if(target.mode==='pick')return Boolean(draft.choice);
  if(target.mode==='border-walk')return draft.path?.at(-1)===target.goal;
  if(target.mode==='matching')return target.pairs.every(p=>Boolean(draft[p.id]));
  if(target.mode==='before-after')return Boolean(draft.first);
  if(target.mode==='estimate')return Number.isFinite(draft.year);
  if(target.mode==='theme')return themeReady(target,draft);
  if(target.mode==='listen')return listeningReady(target,draft);
  if(target.mode==='distance')return distanceReady(target,draft);
  return Boolean(draft.from && draft.to && (target.askYear===false || String(draft.year ?? '').trim()));
}
