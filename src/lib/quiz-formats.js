import {buildTimelineExercise,normalizeAnswer} from './exercises.js';
import {gradeBorderWalk} from './world-exercises.js';
import {WORLD_FORMATS} from '../../knowledge-build/lens-projections.mjs';

export const FORMAT_CHOICES = [
  {id:'mixed',label:'Blandet quiz',note:'Varierte oppgaver'},
  {id:'recognition',label:'Flervalg',note:'Velg ett svar'},
  {id:'recall',label:'Skriv svaret',note:'Hent fram fra hukommelsen'},
  {id:'matching',label:'Koble sammen',note:'Finn tre riktige par'},
  {id:'before-after',label:'Hva kom først?',note:'Sammenlign to hendelser'},
  {id:'arrows',label:'Historiske piler',note:'Tegn retning på kartet'},
  {id:'geography',label:'Kart',note:'Finn riktig sted'},
  {id:'outline',label:'Omriss',note:'Gjenkjenn formen'},
  {id:'chronology',label:'Tidslinje',note:'Sett hendelser i rekkefølge'}
];
export const STRUCTURED_MODES = ['matching','before-after','arrows','pick','border-walk'];
export const WORLD_FORMAT_CHOICES = WORLD_FORMATS;
const regions = [
  {id:'gbr',label:'Storbritannia',x:358,y:59},
  {id:'fra',label:'Frankrike',x:365,y:79},
  {id:'deu',label:'Tyskland',x:383,y:67},
  {id:'pol',label:'Polen',x:398,y:65},
  {id:'nor',label:'Norge',x:379,y:41},
  {id:'dnk',label:'Danmark',x:379,y:55}
];
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
    const items=[...timeline.items].sort((a,b)=>a.year-b.year);
    for(let i=0;i<items.length-1;i+=2){
      const pair=items.slice(i,i+2);if(pair[0].year===pair[1].year)continue;
      const shuffled=buildTimelineExercise({id:`first:${timeline.id}:${i}`,items:pair}).items;
      result.push({id:`first:${timeline.id}:${i}`,mode:'before-after',kind:'before-after',entityId:pair[0].entityId || pair[0].id,collectionIds:timeline.collectionIds,
        prompt:timeline.id.includes('nobel')?'Hvilken Nobelpristildeling kom først?':timeline.id.includes('presidential')?'Hvilken presidentperiode begynte først?':'Hvilken hendelse kom først?',
        items:shuffled,firstId:pair[0].id,answer:`${pair[0].label} (${pair[0].year})`,explanation:`${pair[0].label}: ${pair[0].year}. ${pair[1].label}: ${pair[1].year}. Rekkefølge betyr ikke nødvendigvis at én hendelse forårsaket den andre.`,
        sourceIds:timeline.sourceIds,difficulty:5,significance:3});
    }
  }
  if(maps.some(m=>m.id==='world'))for(const event of [
    {id:'poland-1939',label:'Tysklands invasjon av Polen',from:'deu',to:'pol',year:1939,date:'1. september 1939',source:{title:'United States Holocaust Memorial Museum – invasjonen av Polen',url:'https://encyclopedia.ushmm.org/content/en/article/invasion-of-poland-fall-1939'}},
    {id:'norway-1940',label:'Tysklands invasjon av Norge',from:'deu',to:'nor',year:1940,date:'9. april 1940',source:{title:'Deutschlandmuseum – invasjonen av Danmark og Norge',url:'https://www.deutschlandmuseum.de/en/history/calendar/1940-04-09-germany-invades-denmark-and-norway/'}},
    {id:'denmark-1940',label:'Tysklands invasjon av Danmark',from:'deu',to:'dnk',year:1940,date:'9. april 1940',source:{title:'Deutschlandmuseum – invasjonen av Danmark og Norge',url:'https://www.deutschlandmuseum.de/en/history/calendar/1940-04-09-germany-invades-denmark-and-norway/'}},
    {id:'normandy-1944',label:'De alliertes landgang i Normandie på D-dagen',from:'gbr',to:'fra',year:1944,date:'6. juni 1944',source:{title:'Britiske myndigheter – D-dagen',url:'https://www.gov.uk/government/news/d-day-anniversary-we-remember-69-years-later'}}
  ]){
    const from=regions.find(r=>r.id===event.from),to=regions.find(r=>r.id===event.to);
    result.push({id:`arrows:${event.id}`,mode:'arrows',kind:'connections',entityId:event.id==='normandy-1944'?'d-day-landings-in-normandy':undefined,collectionIds:['history'],datasetId:'world',regions,
      prompt:`${event.label}: hvor gikk angrepet fra og til, og i hvilket år?`,
      from:event.from,to:event.to,year:event.year,answer:`${from.label} → ${to.label} · ${event.year}`,
      explanation:`${event.label} begynte ${event.date}. Pilen viser en forenklet forbindelse mellom land, ikke en faktisk militær rute. Kartet bruker dagens grenser.`,
      sourceIds:[],sources:[event.source],difficulty:5,significance:4});
  }
  return result;
}
export function gradeStructured(target,draft={},neighbours=new Map()) {
  if(target.mode==='pick')return {correct:draft.choice===target.correctId};
  if(target.mode==='border-walk')return gradeBorderWalk(target,draft.path||[],neighbours);
  if(target.mode==='matching') {
    const correctCount=target.pairs.filter(p=>draft[p.id]===p.id).length;
    return {correct:correctCount===target.pairs.length,correctCount,total:target.pairs.length};
  }
  if(target.mode==='before-after')return {correct:draft.first===target.firstId};
  if(target.mode==='arrows') {
    const directionCorrect=draft.from===target.from && draft.to===target.to;
    const yearCorrect=String(draft.year ?? '').trim()===String(target.year);
    return {correct:directionCorrect && yearCorrect,directionCorrect,yearCorrect};
  }
  return {correct:false};
}
export function structuredReady(target,draft={}) {
  if(target.mode==='pick')return Boolean(draft.choice);
  if(target.mode==='border-walk')return draft.path?.at(-1)===target.goal;
  if(target.mode==='matching')return target.pairs.every(p=>Boolean(draft[p.id]));
  if(target.mode==='before-after')return Boolean(draft.first);
  return Boolean(draft.from && draft.to && String(draft.year ?? '').trim());
}
