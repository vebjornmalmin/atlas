// Builds the perspective layer: land borders and positions from the map, flows of Nobel laureates
// between countries, historiographical lenses with their thinkers, and a dated news snapshot.
// The script is idempotent: rows from an earlier run are removed before the layer is rebuilt.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LENS_PROJECTIONS} from '../knowledge-build/lens-projections.mjs';
import {distanceKm} from '../src/lib/world-graph.js';

const LAYER='perspective';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const data=await read('public/knowledge/foundation.json');
const world=await read('public/maps/world.json');
const research=await read('knowledge-build/perspectives.json');
const news=await read('knowledge-build/news-snapshot.json');
const laureateSource=await read('knowledge-build/sources/nobel-laureates.json');
const laureates=laureateSource.laureates || laureateSource;
const HOME={label:'Oslo',lat:59.9139,lon:10.7522};

const COLLECTIONS=[
  {id:'world-lenses',title:'Verdensblikk',subject:'historiography',description:'Tjue måter historikere og metahistorikere har sett verden på, med tenkere, verk, begreper og eksempler.',layer:LAYER},
  {id:'flags-borders',title:'Flagg og naboland',subject:'geography',description:'Flagg, landegrenser og reiser over land mellom naboer.',layer:LAYER},
  {id:'current-affairs',title:'Aktuelt nå',subject:'current-affairs',description:'Et datert utvalg nyheter koblet til steder og personer i kunnskapsnettverket.',layer:LAYER}
];
const layerCollections=new Set(COLLECTIONS.map(c=>c.id));
data.collections=[...data.collections.filter(c=>!layerCollections.has(c.id)),...COLLECTIONS];
data.entities=data.entities.filter(e=>e.layer!==LAYER);
data.relationships=data.relationships.filter(r=>r.layer!==LAYER);
data.sources=data.sources.filter(s=>s.layer!==LAYER);
for(const e of data.entities){e.collectionIds=e.collectionIds.filter(id=>!layerCollections.has(id));delete e.geo;}

const entities=new Map(data.entities.map(e=>[e.id,e]));
const relationIds=new Set(data.relationships.map(r=>r.id));
const addCollection=(entity,id)=>{if(!entity.collectionIds.includes(id))entity.collectionIds.push(id);};
const short=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
const factOnly='Kun fakta og egne sammendrag. Kildetekst og medier videreformidles ikke.';
function sourceFor(url,title,license=factOnly){
  const existing=data.sources.find(s=>s.url===url);
  if(existing)return existing.id;
  const id=`ps-${short(url)}`;
  data.sources.push({id,title:title || sourceTitle(url),url,license,layer:LAYER});
  return id;
}
function sourceTitle(url){
  const u=new URL(url);
  const host=u.hostname.replace(/^www\./,'');
  const last=decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').replace(/[_-]+/g,' ').replace(/\.\w+$/,'');
  const site=host.includes('wikipedia')?`Wikipedia (${host.split('.')[0]})`:host==='plato.stanford.edu'?'Stanford Encyclopedia of Philosophy':host.includes('britannica')?'Encyclopaedia Britannica':host;
  return last?`${site}: ${last}`:site;
}
const sourcesFor=urls=>[...new Set((urls || []).filter(u=>/^https:\/\//.test(u)).map(u=>sourceFor(u)))];
function addEntity(entity){
  if(entities.has(entity.id))throw new Error(`Duplicate perspective entity ${entity.id}`);
  const row={...entity,layer:LAYER};data.entities.push(row);entities.set(row.id,row);return row;
}
function addRelation(r){
  if(!entities.has(r.from) || !entities.has(r.to) || r.from===r.to)return null;
  const id=r.id || `${r.type}:${r.from}:${r.to}`;
  if(relationIds.has(id))return null;
  relationIds.add(id);const row={...r,id,evidenceStatus:r.evidenceStatus || 'documented',layer:LAYER};
  data.relationships.push(row);return row;
}
const byLabel=(label,type)=>data.entities.find(e=>e.type===type && e.label.toLowerCase()===String(label).toLowerCase());

// 1. Positions and borders from the Natural Earth display map.
const naturalEarth=sourceFor(world.source.url,'Natural Earth – Admin 0 Countries 1:110m','Offentlig eiendom');
const countryByRegion=new Map();
for(const e of data.entities)if(['country','country-area'].includes(e.type)){
  const region=e.mapRegionId || e.iso3?.toLowerCase();
  if(region && world.regions.some(r=>r.id===region))countryByRegion.set(region,e);
}
const toLonLat=([x,y])=>[x/2-180,85-y/2];
function centroid(path){
  let best=null;
  for(const ring of path.split(/(?=M)/)){
    const pts=[...ring.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[+m[1],+m[2]]);
    if(pts.length<3)continue;
    let a=0,cx=0,cy=0;
    for(let i=0;i<pts.length;i++){const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length],f=x1*y2-x2*y1;a+=f;cx+=(x1+x2)*f;cy+=(y1+y2)*f;}
    if(!best || Math.abs(a)>Math.abs(best.a))best={a,x:cx/(3*a),y:cy/(3*a)};
  }
  return toLonLat([best.x,best.y]);
}
for(const region of world.regions){
  const entity=countryByRegion.get(region.id);if(!entity)continue;
  const [lon,lat]=centroid(region.path);
  // The home country counts as near even though its geographic midpoint is some distance from Oslo.
  entity.geo={lon:+lon.toFixed(2),lat:+lat.toFixed(2),distanceKm:entity.id==='norway'?0:Math.round(distanceKm(HOME,{lat,lon})),mapRegionId:region.id};
  addCollection(entity,'flags-borders');
  if(!entity.sourceIds.includes(naturalEarth))entity.sourceIds.push(naturalEarth);
}
const vertexOwners=new Map();
for(const region of world.regions)for(const point of new Set([...region.path.matchAll(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g)].map(m=>m[0]))){
  if(!vertexOwners.has(point))vertexOwners.set(point,new Set());vertexOwners.get(point).add(region.id);
}
const shared=new Map();
for(const owners of vertexOwners.values()){const ids=[...owners].sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=`${ids[i]}|${ids[j]}`;shared.set(key,(shared.get(key)||0)+1);}}
// One shared vertex marks a real but short border in most cases; these two only touch across water.
const NOT_BORDERS=new Set(['egy|jor','cmr|ner']);
const VIA={'bra|fra':'Frankrike grenser til Brasil gjennom Fransk Guyana.','fra|sur':'Frankrike grenser til Surinam gjennom Fransk Guyana.'};
for(const [key,count] of shared){
  if(NOT_BORDERS.has(key))continue;
  const [a,b]=key.split('|').map(id=>countryByRegion.get(id));if(!a || !b)continue;
  addRelation({id:`borders:${key}`,from:a.id,to:b.id,type:'borders',context:VIA[key] || `${a.label} og ${b.label} har felles landegrense.`,sourceIds:[naturalEarth],derived:true,sharedVertices:count});
}

// 2. Gender and knowledge flows in the Nobel register.
const genderById=new Map(laureates.map(l=>[String(l.id),l.gender]));
for(const e of data.entities)if(e.nobelId && genderById.get(String(e.nobelId)) && e.type==='person')e.metadata={...e.metadata,gender:genderById.get(String(e.nobelId))};
const birthCountry=new Map(),orgCountry=new Map(),affiliations=new Map();
for(const r of data.relationships){
  if(r.type==='birthplace-in-current-country')birthCountry.set(r.from,r.to);
  if(r.type==='located-in-country')orgCountry.set(r.from,r.to);
  if(r.type==='award-time-affiliation'){if(!affiliations.has(r.from))affiliations.set(r.from,new Set());affiliations.get(r.from).add(r.to);}
}
const flows=new Map(),countryStats={};
const stat=id=>countryStats[id] ||= {born:0,hosted:0,outflow:0,inflow:0,women:0,thinkers:0,news:0};
for(const [person,born] of birthCountry){
  stat(born).born++;
  if(entities.get(person)?.metadata?.gender==='female')stat(born).women++;
  const hosts=new Set([...(affiliations.get(person)||[])].map(org=>orgCountry.get(org)).filter(Boolean));
  for(const host of hosts){stat(host).hosted++;if(host===born)continue;const key=`${born}|${host}`;flows.set(key,(flows.get(key)||0)+1);}
  if(hosts.size && !hosts.has(born))stat(born).outflow++;
}
for(const [key,count] of flows){
  const [from,to]=key.split('|');stat(to).inflow+=count;
  addRelation({id:`knowledge-flow:${from}:${to}`,from,to,type:'knowledge-flow',count,derived:true,sourceIds:['nobel-api-directory'],
    context:`${count} ${count===1?'Nobelprisvinner':'Nobelprisvinnere'} født i ${entities.get(from).label} var tilknyttet en institusjon i ${entities.get(to).label} da prisen ble tildelt.`});
}

// 3. Lenses, thinkers, works, concepts and the metahistorical vocabulary.
const thinkerIds=new Map(),conceptIds=new Map(),workIds=new Map(),lensIds=new Map();
const countryByIso3=new Map(data.entities.filter(e=>e.iso3).map(e=>[e.iso3,e]));
for(const t of research.thinkers){
  const existing=byLabel(t.label,'person');
  const life=t.deathYear?`${t.birthYear ?? '?'}–${t.deathYear}`:`født ${t.birthYear}`;
  const row=existing || addEntity({id:`thinker-${t.id}`,label:t.label,type:'person',summary:t.summary,collectionIds:[],sourceIds:sourcesFor(t.sourceUrls),
    metadata:{birthYear:t.birthYear,deathYear:t.deathYear ?? null,role:'historian',lifespan:life}});
  addCollection(row,'world-lenses');thinkerIds.set(t.id,row.id);
  const country=countryByIso3.get(t.birthCountryIso3);
  if(country){stat(country.id).thinkers++;addRelation({from:row.id,to:country.id,type:'birthplace-in-current-country',context:`${t.label} ble født i det som i dag er ${country.label}.`,sourceIds:row.sourceIds.slice(0,2)});}
}
const ensureConcept=(c,collection='world-lenses')=>{
  const existing=byLabel(c.label,'concept');
  const row=existing || addEntity({id:`concept-${c.id}`,label:c.label,type:'concept',summary:c.summary,collectionIds:[],sourceIds:sourcesFor(c.sourceUrls)});
  addCollection(row,collection);conceptIds.set(c.id,row.id);return row;
};
for(const c of research.concepts)ensureConcept(c);
for(const w of research.works){
  const row=addEntity({id:`work-${w.id}`,label:w.label,type:'scholarly-work',summary:w.summary,collectionIds:['world-lenses'],sourceIds:sourcesFor(w.sourceUrls),
    metadata:{year:w.year,norwegianTitle:w.norwegianTitle || null}});
  workIds.set(w.id,row.id);
  for(const a of w.authorIds || [])addRelation({from:thinkerIds.get(a),to:row.id,type:'author-of',year:w.year,context:`${entities.get(thinkerIds.get(a))?.label} utga ${w.label} (${w.year}).`,sourceIds:row.sourceIds});
}
for(const c of research.concepts)for(const t of c.thinkerIds || [])addRelation({from:thinkerIds.get(t),to:conceptIds.get(c.id),type:'proposed',context:`${entities.get(thinkerIds.get(t))?.label} er knyttet til begrepet «${c.label}».`,sourceIds:entities.get(conceptIds.get(c.id)).sourceIds});
for(const i of research.influences)addRelation({from:thinkerIds.get(i.from),to:thinkerIds.get(i.to),type:'influenced',context:i.context,sourceIds:sourcesFor(i.sourceUrls)});

const lenses=[];
for(const lens of research.lenses){
  const projection=LENS_PROJECTIONS[lens.id];if(!projection)throw new Error(`No projection for lens ${lens.id}`);
  const row=addEntity({id:`lens-${lens.id}`,label:lens.name,type:'lens',summary:lens.summary,collectionIds:['world-lenses'],sourceIds:sourcesFor(lens.sourceUrls)});
  lensIds.set(lens.id,row.id);
  for(const t of lens.thinkerIds || [])addRelation({from:thinkerIds.get(t),to:row.id,type:'shaped-lens',context:`${entities.get(thinkerIds.get(t))?.label} er en sentral stemme i linsen «${lens.name}».`,sourceIds:row.sourceIds});
  for(const w of lens.workIds || [])addRelation({from:workIds.get(w),to:row.id,type:'key-work-for',context:`${entities.get(workIds.get(w))?.label} er et nøkkelverk for linsen «${lens.name}».`,sourceIds:entities.get(workIds.get(w))?.sourceIds || row.sourceIds});
  for(const c of lens.conceptIds || [])addRelation({from:row.id,to:conceptIds.get(c),type:'uses-concept',context:`Linsen «${lens.name}» bruker begrepet «${entities.get(conceptIds.get(c))?.label}».`,sourceIds:row.sourceIds});
  lenses.push({id:lens.id,entityId:row.id,name:lens.name,question:lens.question,summary:lens.summary,critique:lens.critique,
    timeScale:lens.timeScale,unitOfAnalysis:lens.unitOfAnalysis,emphasizes:lens.emphasizes || [],evidenceStatus:lens.evidenceStatus || 'documented',
    thinkerIds:(lens.thinkerIds||[]).map(t=>thinkerIds.get(t)).filter(Boolean),...projection});
}
lenses.sort((a,b)=>a.order-b.order);
for(const e of research.exemplars || []){
  const lens=lensIds.get(e.lensId),target=entities.get(e.entityId);if(!lens || !target)continue;
  addCollection(target,'world-lenses');
  addRelation({id:`views-through:${e.lensId}:${e.entityId}`,from:lens,to:target.id,type:'views-through',context:e.reason,sourceIds:sourcesFor(e.sourceUrls).length?sourcesFor(e.sourceUrls):entities.get(lens).sourceIds});
}

const mh=research.metahistory;
const vocabulary={};
for(const group of ['tropes','emplotments','arguments','ideologies'])vocabulary[group]=(mh[group]||[]).map(item=>{
  const row=ensureConcept({id:`metahistory-${item.id}`,label:item.label,summary:item.summary,sourceUrls:item.sourceUrls || research.lenses.find(l=>l.id==='metahistory')?.sourceUrls});
  return {id:item.id,entityId:row.id,label:item.label};
});
const fieldGroup={emplotment:'emplotments',trope:'tropes',argument:'arguments',ideology:'ideologies'};
const fieldLabel={emplotment:'plotform',trope:'trope',argument:'argumentasjonsform',ideology:'ideologisk implikasjon'};
const assignments=[];
for(const a of mh.assignments || []){
  const thinker=thinkerIds.get(a.thinkerId);if(!thinker)continue;
  for(const field of Object.keys(fieldGroup)){
    const term=vocabulary[fieldGroup[field]].find(v=>v.id===a[field]);if(!a[field] || !term)continue;
    addRelation({id:`emplotted-as:${a.thinkerId}:${field}`,from:thinker,to:term.entityId,type:'emplotted-as',field,
      evidenceStatus:a.confidence==='high'?'documented':'uncertain',
      context:`Hayden White leste ${entities.get(thinker).label} med ${fieldLabel[field]}en ${term.label.toLowerCase()}.${a.note?` ${a.note}`:''}`,
      sourceIds:sourcesFor(a.sourceUrls)});
    assignments.push({thinkerId:thinker,field,termId:term.id,confidence:a.confidence});
  }
}
const thresholds=[...(research.bigHistoryThresholds||[])].sort((a,b)=>a.order-b.order).map(t=>{
  const row=addEntity({id:`threshold-${t.id}`,label:t.label,type:'threshold',summary:t.summary,collectionIds:['world-lenses'],sourceIds:sourcesFor(t.sourceUrls),metadata:{order:t.order,approxYearsAgo:t.approxYearsAgo}});
  return {id:row.id,order:t.order,label:t.label,approxYearsAgo:t.approxYearsAgo};
});
thresholds.forEach((t,i)=>{if(i)addRelation({from:thresholds[i-1].id,to:t.id,type:'precedes',context:`${thresholds[i-1].label} kom før ${t.label.toLowerCase()} i David Christians fortelling om økende kompleksitet.`,sourceIds:entities.get(t.id).sourceIds});});
const bigHistory=lensIds.get('big-history');
if(bigHistory)for(const t of thresholds)addRelation({from:bigHistory,to:t.id,type:'views-through',context:`Terskel ${t.order} i Big History: ${t.label}.`,sourceIds:entities.get(t.id).sourceIds});

// 4. Dated news, linked to places and people.
for(const item of news.items){
  const source=sourceFor(item.url,`${item.publisher}: ${item.headline}`,'Kun egne sammendrag og lenke til saken.');
  const row=addEntity({id:item.id,label:item.headline,type:'news-event',summary:item.summary,collectionIds:['current-affairs'],sourceIds:[source],
    metadata:{date:item.date,publisher:item.publisher,url:item.url,domain:item.domain,globalStory:Boolean(item.globalStory),impact:item.impact,impactReason:item.impactReason,lensHints:item.lensHints || [],background:item.background || null}});
  const mentioned=[...(item.countryIso3||[]).map(code=>countryByIso3.get(code)?.id),...(item.entityIds||[])].filter(id=>entities.has(id));
  row.metadata.primaryEntityId=mentioned[0] || null;
  for(const id of new Set(mentioned)){
    addCollection(entities.get(id),'current-affairs');
    if(['country','country-area'].includes(entities.get(id).type))stat(id).news++;
    addRelation({from:row.id,to:id,type:'mentions',year:Number(item.date.slice(0,4)),context:`${item.publisher}, ${item.date}: ${item.headline}`,sourceIds:[source]});
  }
}

// 5. Impact: weighted, undirected PageRank over the finished graph, reported as a percentile.
// Administrative containment and prize bookkeeping would otherwise make counties and prize categories the most "important" nodes.
const EDGE_WEIGHT={'part-of':.05,'located-in':.2,'in-region':.2,'formerly-part-of':.2,'award-category':.05,'awarded-prize':.3,'award-time-affiliation':.4,'located-in-country':.3,'birthplace-in-current-country':.5,'capital-of':.6,borders:.6,'knowledge-flow':.6,mentions:.8};
const nodes=data.entities.map(e=>e.id),index=new Map(nodes.map((id,i)=>[id,i]));
const neighbours=nodes.map(()=>[]);
for(const r of data.relationships){const a=index.get(r.from),b=index.get(r.to);if(a===undefined || b===undefined)continue;const w=EDGE_WEIGHT[r.type] ?? 1;neighbours[a].push([b,w]);neighbours[b].push([a,w]);}
const strength=neighbours.map(list=>list.reduce((sum,[,w])=>sum+w,0));
let rank=new Float64Array(nodes.length).fill(1/nodes.length);
for(let step=0;step<40;step++){
  const next=new Float64Array(nodes.length).fill(.15/nodes.length);let dangling=0;
  // Weak links pass on only part of a node's rank; the rest returns to the whole graph.
  for(let i=0;i<nodes.length;i++){const total=Math.max(1,strength[i]);dangling+=rank[i]*(1-strength[i]/total);for(const [j,w] of neighbours[i])next[j]+=.85*rank[i]*w/total;}
  for(let i=0;i<nodes.length;i++)next[i]+=.85*dangling/nodes.length;rank=next;
}
const ordered=nodes.map((id,i)=>[id,rank[i]]).sort((a,b)=>a[1]-b[1]);
const impact={};ordered.forEach(([id],i)=>{impact[id]=Math.round(100*i/(ordered.length-1));});

data.perspectives={version:1,home:HOME,lenses,thresholds,
  metahistory:{vocabulary,assignments,note:research.notes || ''},
  countryStats,impact,
  news:{snapshotDate:news.snapshotDate,method:news.method,halfLifeDays:14},
  method:{impact:'Rangering etter sentralitet (vektet PageRank) i Atlas-nettverket. Administrative koblinger teller lite. Måler hvor tett noden er koblet i registeret, ikke historisk betydning i seg selv.',
    locality:`Avstand i luftlinje fra ${HOME.label} til landets geografiske midtpunkt på kartet. Norske steder regnes som nære.`,
    actuality:'Nyheter teller mest den dagen de publiseres, og vekten halveres hver 14. dag.',
    borders:'Landegrenser er avledet fra delte punkter i Natural Earth 1:110m. Svært korte grenser og små stater som Andorra og Liechtenstein kan mangle.'}};
data.entityCount=data.entities.length;data.relationshipCount=data.relationships.length;
await writeFile('public/knowledge/foundation.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({lenses:lenses.length,borders:data.relationships.filter(r=>r.type==='borders').length,flows:flows.size,news:news.items.length,entities:data.entities.length,relationships:data.relationships.length}));
