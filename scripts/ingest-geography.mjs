import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage} from './validate-knowledge.mjs';
const path=new URL('../knowledge-build/geography.json',import.meta.url);
const prior=JSON.parse(await readFile(path,'utf8'));
const snapshot=prior.snapshot;
if(!snapshot?.m49Rows?.length || !snapshot?.municipalities?.length) throw new Error('Missing official source snapshots');
const baseline=JSON.parse(await readFile(new URL('../knowledge-build/base-foundation.json',import.meta.url),'utf8'));
const slug=text=>String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ø/g,'o').replace(/æ/g,'ae').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const labels=new Intl.DisplayNames(['nb'],{type:'region'});
const existing=baseline.entities;
const knownCountries={NO:'norway',SE:'sweden',DK:'denmark',FI:'finland',FR:'france',DE:'germany',IT:'italy',ES:'spain',JP:'japan',CA:'canada'};
const regionLabels={'World':'Verden','Africa':'Afrika','Americas':'Amerika','Asia':'Asia','Europe':'Europa','Oceania':'Oseania','Northern Africa':'Nord-Afrika','Eastern Africa':'Øst-Afrika','Middle Africa':'Sentral-Afrika','Southern Africa':'Sørlige Afrika','Western Africa':'Vest-Afrika','Sub-Saharan Africa':'Afrika sør for Sahara','Latin America and the Caribbean':'Latin-Amerika og Karibia','Caribbean':'Karibia','Central America':'Mellom-Amerika','South America':'Sør-Amerika','Northern America':'Nord-Amerika','Central Asia':'Sentral-Asia','Eastern Asia':'Øst-Asia','South-eastern Asia':'Sørøst-Asia','Southern Asia':'Sør-Asia','Western Asia':'Vest-Asia','Eastern Europe':'Øst-Europa','Northern Europe':'Nord-Europa','Southern Europe':'Sør-Europa','Western Europe':'Vest-Europa','Australia and New Zealand':'Australia og New Zealand','Melanesia':'Melanesia','Micronesia':'Mikronesia','Polynesia':'Polynesia'};
const cityNames={'Copenhagen':'København','Rome':'Roma','Cairo':'Kairo','Algiers':'Alger','Athens':'Athen','Vienna':'Wien','Lisbon':'Lisboa','Brussels':'Brussel','Warsaw':'Warszawa','Prague':'Praha','Mexico City':'Mexico by','Panama City':'Panama by','Brasilia':'Brasília','Bogota':'Bogotá','Sao Tome':'São Tomé','Reykjavik':'Reykjavík','Male':'Malé'};
const collections=[{id:'world-geography',title:'Verdensgeografi',subject:'geography',description:'Land og områder, hovedsteder og FNs geografiske regioner.'},{id:'norway',title:'Norsk geografi',subject:'geography',description:'Alle norske fylker og kommuner, med utvalgte øvelser som knytter dem sammen.'},{id:'geography-connections',title:'Geografiske forbindelser',subject:'geography',description:'Knytt hovedsteder til land og land til geografiske regioner.'}];
const entities=new Map(),relationships=new Map(),targets=new Map(),sources=new Map();
const factLicense='Faktiske opplysninger, egne sammendrag. Original kildetekst gjengis ikke.';
const source=(id,title,url)=>sources.set(id,{id,title,url,license:factLicense,retrievedAt:snapshot.retrievedAt});
source('un-m49-geography','FNs statistikkavdeling – M49 geografiske regioner','https://unstats.un.org/unsd/methodology/m49/overview/');
source('kartverket-administrative-directory','Kartverket – norske fylker og kommuner','https://www.kartverket.no/til-lands/fakta-om-norge/norske-fylke-og-kommunar');
const entity=(id,label,type,summary,collectionIds,sourceIds,extra={})=>{
 const old=entities.get(id)||existing.find(e=>e.id===id);
 entities.set(id,{...old,id,label:old?.label??label,type:old?.type??type,summary,collectionIds:[...new Set([...(old?.collectionIds||[]),...collectionIds])],sourceIds:[...new Set([...(old?.sourceIds||[]),...sourceIds])],...extra});
 return id;
};
const relation=(from,to,type,context,sourceIds)=>{
 const id=`geo-${from}-${type}-${to}`;relationships.set(id,{id,from,to,type,context,sourceIds,confidence:1});
};
const target=(id,entityId,collectionIds,prompt,answer,acceptedAnswers,explanation,sourceIds,kind='recall',extra={})=>targets.set(id,{id,entityId,collectionIds,prompt,answer,acceptedAnswers,explanation,sourceIds,kind,difficulty:2,significance:3,context:kind==='connections'?'Bruk forbindelser mellom steder og administrative eller geografiske nivåer.': 'Knytt et land til byen som har rollen som hovedstad.',followUp:kind==='connections'?'Finn begge stedene i nettverket og undersøk hvilke andre steder som hører til samme nivå.':'Prøv forbindelsen motsatt vei, og plasser landet i FNs geografiske inndeling.',...extra});
const region=(name,code)=>entity(slug(name),regionLabels[name]||name,'region',`Geografisk region i FNs M49-inndeling (kode ${code}).`,['world-geography','geography-connections'],['un-m49-geography'],{m49:code});
const excluded=[];
const capitalProfiles=new Map(snapshot.capitals.map(c=>[c.iso2,c]));
const ambiguous=new Map([['ID','Pågående hovedstadsovergang krever ny offentlig kontroll.'],['GQ','Opplysninger om mulig hovedstadsendring krever kontroll mot nyere offentlig kilde.'],['EH','Omstridt territorium; ingen entydig hovedstadøvelse.'],['PW','Profilen oppgir Melekeok; regjeringssetet Ngerulmud krever en presis formulering.'],['NR','Ingen formell hovedstad; Yaren er ikke en ukvalifisert hovedstad.'],['KI','Bairiki er del av Sør-Tarawa; profilens stedsnivå trenger avklaring.'],['CH','Bern er føderalby; unngå ukvalifisert hovedstadspåstand.'],['YE','Politisk konflikt og flere regjeringsseter krever kvalifisering.'],['SD','Pågående konflikt og regjeringsflytting krever kvalifisering.']]);
const core=new Set('NO SE DK FI IS GB IE FR DE IT ES PT NL BE LU AT CH PL CZ SK HU RO BG GR EE LV LT UA SI HR RS BA ME AL MK MT CY US CA MX BR AR CL CO PE EC UY PY VE AU NZ JP CN KR MN IN PK BD NP BT AF IR IQ JO LB SA AE OM QA KW BH TR AM GE AZ KZ UZ EG MA TN DZ KE ET GH NG ZA TZ UG RW SN ZM ZW NA BW MG MU FJ PG VN TH PH MY SG KH LA MM TL ID'.split(' '));
for(const row of snapshot.m49Rows){
 const [globalCode,globalName,regionCode,regionName,subCode,subName,interCode,interName,name,m49,iso2,iso3]=row;
 const id=knownCountries[iso2]||`geo-${iso3.toLowerCase()}`;
 const label=({CD:'Den demokratiske republikken Kongo',CG:'Republikken Kongo'})[iso2]||labels.of(iso2)||name;
 entity(id,label,'country-area',`Land eller område i FNs statistiske M49-inndeling, med områdekode ${m49}. Inndelingen beskriver geografisk plassering og avgjør ikke politisk status.`,['world-geography','geography-connections'],['un-m49-geography'],{iso2,iso3,m49,mapRegionId:iso3.toLowerCase(),officialName:name});
 let parent=region(globalName,globalCode);
 for(const [n,c] of [[regionName,regionCode],[subName,subCode],[interName,interCode]]){
  if(!n)continue;
  const rid=region(n,c);relation(rid,parent,'part-of',`${regionLabels[n]||n} inngår i ${entities.get(parent).label} i FNs statistiske inndeling.`,['un-m49-geography']);parent=rid;
 }
 relation(id,parent,'located-in',`${label} er plassert i ${entities.get(parent).label} i FNs M49-inndeling.`,['un-m49-geography']);
 if(core.has(iso2)&&subName){
  const subId=slug(subName),answer=regionLabels[subName]||subName;
  target(`geo-region-${iso2.toLowerCase()}`,id,['world-geography','geography-connections'],`I hvilken geografisk delregion plasserer FN ${label}?`,answer,[subName],`${label} inngår i ${answer} i FNs statistiske M49-inndeling. Dette er en statistisk inndeling, ikke en politisk allianse.`,['un-m49-geography'],'connections',{relatedEntityIds:[subId],answerType:'region',context:'Spørsmålet gjelder FNs statistiske geografiske inndeling. Politiske organisasjoner og allianser er andre typer forbindelser.'});
 }
 const profile=capitalProfiles.get(iso2);
 if(!profile?.capital){excluded.push({iso2,topic:'capital',reason:'Ingen tilgjengelig hovedstadopplysning i UN-profilen.'});continue;}
 if(profile.hasFootnote||ambiguous.has(iso2)){excluded.push({iso2,topic:'capital',value:profile.capital,reason:ambiguous.get(iso2)||'UN-profilen kvalifiserer hovedstaden i en fotnote; utelatt fra ukvalifisert recall.'});continue;}
 const sid=`un-capital-${iso2.toLowerCase()}`;source(sid,`UNdata – ${label}`,profile.url);
 const cityLabel=cityNames[profile.capital]||profile.capital;
 const oldCity=existing.find(e=>e.type==='city'&&(e.label===cityLabel||e.label===profile.capital));
 const cityId=oldCity?.id||`city-${iso2.toLowerCase()}-${slug(profile.capital)}`;
 entity(cityId,cityLabel,'city',`Oppført som hovedstad i UNdata-profilen for ${label}.`,['world-geography','geography-connections'],[sid]);
 relation(cityId,id,'capital-of',`${cityLabel} er hovedstad i ${label}.`,[sid]);
 relation(cityId,id,'located-in',`${cityLabel} ligger i ${label}.`,[sid]);
 if(core.has(iso2)){
  const existingForward=baseline.targets.some(t=>t.prompt.toLowerCase()===`Hva er hovedstaden i ${label}?`.toLowerCase());
  if(!existingForward)target(`geo-capital-${iso2.toLowerCase()}`,id,['world-geography'],`Hva er hovedstaden i ${label}?`,cityLabel,[profile.capital],`${cityLabel} er hovedstad i ${label}. Landet inngår i ${regionLabels[subName]||subName} etter FNs geografiske inndeling.`,[sid,'un-m49-geography'],'recall',{answerType:'capital'});
  target(`geo-capital-reverse-${iso2.toLowerCase()}`,cityId,['world-geography','geography-connections'],`I hvilket land er ${cityLabel} hovedstad?`,label,[name,iso2==='US'?'USA':label],`${cityLabel} er hovedstad i ${label}.`,[sid],'connections',{relatedEntityIds:[id],answerType:'country'});
 }
}
const norwayId='norway';
const counties=new Map();
for(const row of snapshot.municipalities){
 const rawCode=String(row[Object.keys(row).find(k=>k.startsWith('Fylkesnr'))]).replace(/\.0$/,'').padStart(2,'0');
 if(counties.has(rawCode))continue;
 const mapCounty=JSON.parse(await readFile(new URL('../public/maps/norway.json',import.meta.url),'utf8')).regions.find(r=>r.id===`no-${rawCode}`);
 const label=mapCounty.label;
 const old=existing.find(e=>e.type==='county'&&e.label===label);
 const id=old?.id||`county-no-${rawCode}`;
 counties.set(rawCode,{id,label});entity(id,label,'county',`Norsk fylke med fylkesnummer ${rawCode}.`,['norway'],['kartverket-administrative-directory'],{mapRegionId:`no-${rawCode}`,administrativeCode:rawCode});
 relation(id,norwayId,'part-of',`${label} er et fylke i Norge.`,['kartverket-administrative-directory']);
}
const norwegianNames={'Aarborte - Hattfjelldal':'Hattfjelldal','Fauske - Fuossko':'Fauske','Evenes - Evenášši':'Evenes','Sortland - Suortá':'Sortland','Hábmer - Hamarøy':'Hamarøy','Trondheim - Tråante':'Trondheim','Namsos - Nåavmesjenjaelmie':'Namsos','Rosse - Røros':'Røros','Snåase - Snåsa':'Snåsa','Raarvihke - Røyrvik':'Røyrvik','Harstad - Hárstták':'Harstad','Tjeldsund - Dielddanuorri':'Tjeldsund','Loabák - Lavangen':'Lavangen','Storfjord - Omasvuotna - Omasvuono':'Storfjord','Gáivuotna - Kåfjord - Kaivuono':'Kåfjord','Nordreisa - Ráisa - Raisi':'Nordreisa','Hammerfest - Hámmerfeasta':'Hammerfest','Kárášjohka - Karasjok':'Karasjok','Guovdageaidnu - Kautokeino':'Kautokeino','Porsanger - Porsáŋgu - Porsanki':'Porsanger','Deatnu - Tana':'Tana','Unjárga - Nesseby':'Nesseby'};
const norwegianName=raw=>norwegianNames[raw]||raw;
const nameCounts=new Map();
for(const row of snapshot.municipalities){const n=norwegianName(row.Kommunenamn);nameCounts.set(n,(nameCounts.get(n)||0)+1);}
const municipalityExercises=new Set(['0301','1103','1106','1505','1506','1804','3201','3203','3301','3403','3901','3905','4001','4203','4204','4601','4602','5001','5006','5501','5601','5603','5605']);
for(const row of snapshot.municipalities){
 const code=String(row['Kommunenr.']).replace(/\.0$/,'').padStart(4,'0');
 const countyCode=String(row[Object.keys(row).find(k=>k.startsWith('Fylkesnr'))]).replace(/\.0$/,'').padStart(2,'0');
 const county=counties.get(countyCode);const fullName=row.Kommunenamn;
 const name=norwegianName(fullName);
 const label=nameCounts.get(name)>1?`${name} (${county.label})`:name;
 const id=code==='0301'?'oslo':`municipality-no-${code}`;
 entity(id,label,'municipality',`${fullName} kommune i ${county.label}, kommunenummer ${code}.`,['norway'],['kartverket-administrative-directory'],{administrativeCode:code,officialName:fullName});
 relation(id,county.id,'part-of',`${fullName} kommune inngår i ${county.label}.`,['kartverket-administrative-directory']);
 if(municipalityExercises.has(code))target(`geo-municipality-county-${code}`,id,['norway'],`I hvilket fylke ligger ${label} kommune?`,county.label,[],`${label} kommune ligger i ${county.label}. Kommune- og fylkesnummer gjør det mulig å skille administrative enheter med like navn.`,['kartverket-administrative-directory'],'connections',{relatedEntityIds:[county.id],answerType:'county',context:'Skille mellom kommune og fylke: Oppgi fylket kommunen inngår i etter den gjeldende administrative inndelingen.'});
}
target('geo-norway-levels','norway',['norway'],'Hva kalles de to administrative nivåene under staten i Norge?','Fylker og kommuner',['Fylke og kommune','Kommuner og fylker'],'Kartverkets oversikt skiller mellom 15 fylker og 357 kommuner. Oslo er både kommune og fylke.',['kartverket-administrative-directory']);
target('geo-oslo-two-levels','oslo',['norway'],'Hvilke to administrative roller har Oslo?','Kommune og fylke',['Fylke og kommune','Både kommune og fylke'],'Oslo står med fylkesnummer 03 og kommunenummer 0301 i Kartverkets oversikt.',['kartverket-administrative-directory'],'connections');
const result={provenance:{generatedAt:snapshot.retrievedAt,snapshotSha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),baseVersion:baseline.version,countryAreas:248,counties:15,municipalities:357,capitalPolicy:'Ukvalifiserte hovedstadøvelser utelater fotnoter, kjente endringer og omstridte eller flerdelte regjeringsseter.'},collections,entities:[...entities.values()],relationships:[...relationships.values()],targets:[...targets.values()],sources:[...sources.values()],timelines:[],snapshot,excluded};
const ids=new Set([...baseline.entities.map(e=>e.id),...entities.keys()]);
for(const r of result.relationships)if(!ids.has(r.from)||!ids.has(r.to))throw new Error(`Dangling relationship ${r.id}`);
for(const t of result.targets)if(!ids.has(t.entityId)||t.sourceIds.some(id=>!sources.has(id)))throw new Error(`Invalid target ${t.id}`);
if(snapshot.m49Rows.length!==248||snapshot.municipalities.length!==357||counties.size!==15)throw new Error('Official directory counts changed; review required.');
const merged={...baseline};
for(const key of ['collections','entities','relationships','targets','sources','timelines'])merged[key]=[...new Map([...baseline[key],...result[key]].map(row=>[row.id,row])).values()];
for(const key of ['entityCount','relationshipCount','targetCount'])delete merged[key];
const validation=validatePackage(merged);
if(!validation.valid)throw new Error(validation.errors.join('\n'));
const municipalityCodes=new Set(result.entities.filter(e=>e.administrativeCode?.length===4).map(e=>e.administrativeCode));
if(municipalityCodes.size!==357)throw new Error('Municipalities lost or duplicated while resolving names.');
await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({entities:result.entities.length,relationships:result.relationships.length,targets:result.targets.length,sources:result.sources.length,excludedCapitals:excluded.length}));
