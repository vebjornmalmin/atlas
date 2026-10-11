import {validatePackage} from './content.js';

export const SOURCE_QUERY_STRUCTURE = {
  wikipedia: {endpoint:'https://{language}.wikipedia.org/w/api.php', action:'query', props:'pageprops|info', identity:'pageprops.wikibase_item', continuation:'continue', docs:'https://www.mediawiki.org/wiki/API:Query'},
  wikidata: {endpoint:'https://www.wikidata.org/w/api.php', action:'wbgetentities', props:'labels|aliases|claims|sitelinks', identity:'id', batchSize:50, docs:'https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities'},
  commons: {endpoint:'https://commons.wikimedia.org/w/api.php', action:'query', props:'imageinfo', metadata:'url|size|extmetadata', identity:'canonical file title', docs:'https://www.mediawiki.org/wiki/API:Imageinfo'},
  met: {endpoint:'https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}', identity:'objectID', image:'primaryImageSmall', licenseGate:'isPublicDomain', docs:'https://metmuseum.github.io/'}
};
const qid = value => /^Q\d+$/.test(value || '');
const https = value => {try {return new URL(value).protocol === 'https:';} catch {return false;}};
const text = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot);/g, m=>({'&nbsp;':' ','&amp;':'&','&quot;':'"'}[m])).replace(/\s+/g,' ').trim();
const union = (a=[],b=[]) => [...new Set([...a,...b])];
const rules = {
  P19:{types:['person'],type:'born-in',answerType:'place',question:name=>`Hvor ble ${name} født?`,context:(a,b)=>`${a} ble født i ${b}.`},
  P20:{types:['person'],type:'died-in',answerType:'place',question:name=>`Hvor døde ${name}?`,context:(a,b)=>`${a} døde i ${b}.`},
  P50:{types:['work','literary-work'],type:'written-by',answerType:'person',question:name=>`Hvem skrev «${name}»?`,context:(a,b)=>`${b} skrev «${a}».`},
  P170:{types:['artwork'],type:'created-by',answerType:'person',question:name=>`Hvem skapte «${name}»?`,context:(a,b)=>`${b} skapte «${a}».`}
};

/** Resolve identifiers from source records; never infer identity from a name search. */
export function sourceQueries(entity, sources=[]) {
  const result=[];
  if(qid(entity.wikidataId)) result.push({provider:'wikidata',id:entity.wikidataId});
  for(const source of sources.filter(s=>entity.sourceIds?.includes(s.id))) {
    let url;try {url=new URL(source.url);} catch {continue;}
    if(url.protocol!=='https:')continue;
    const wiki=url.hostname.match(/^([a-z][a-z0-9-]*)(?:\.m)?\.wikipedia\.org$/);
    if(wiki && url.pathname.startsWith('/wiki/')) {
      let title;try {title=decodeURIComponent(url.pathname.slice(6)).replaceAll('_',' ');} catch {continue;}
      if(title && !title.includes(':')) result.push({provider:'wikipedia',language:wiki[1],title});
    }
    if(url.hostname==='www.wikidata.org' && /^\/wiki\/Q\d+$/.test(url.pathname))result.push({provider:'wikidata',id:url.pathname.slice(6)});
    if(['www.metmuseum.org','metmuseum.org'].includes(url.hostname)) {
      const match=url.pathname.match(/^\/art\/collection\/search\/(\d+)\/?$/);
      if(match)result.push({provider:'met',id:Number(match[1])});
    }
  }
  return [...new Map(result.map(query=>[JSON.stringify(query),query])).values()];
}
function api(endpoint,params) {const url=new URL(endpoint);url.search=new URLSearchParams({format:'json',formatversion:'2',origin:'*',...params});return url.href;}
async function json(url,fetcher) {
  const response=await fetcher(url,{signal:AbortSignal.timeout(15000),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error(`Kilden svarte med feil (${response.status}). Prøv igjen senere.`);
  const data=await response.json();if(data.error)throw new Error('Kilden kunne ikke behandle forespørselen.');return data;
}
function referencedClaims(record,property) {
  const claims=(record.claims?.[property] || []).filter(c=>c.rank!=='deprecated' && c.mainsnak?.snaktype==='value');
  const preferred=claims.filter(c=>c.rank==='preferred');
  const selected=preferred.length?preferred:claims;
  // A short-answer question must have one unqualified, referenced answer.
  if(selected.some(c=>Object.keys(c.qualifiers || {}).length))return [];
  const values=union(selected.map(c=>c.mainsnak.datavalue?.value?.id));
  if(values.length!==1 || !qid(values[0]))return [];
  return selected.filter(c=>c.references?.some(r=>(r.snaks?.P854 || []).some(s=>https(s.datavalue?.value))));
}
export function commonsMedia(entity, page) {
  const info=page?.imageinfo?.[0];const metadata=info?.extmetadata || {};
  const license=text(metadata.LicenseShortName?.value);const licenseUrl=text(metadata.LicenseUrl?.value) || (/^(Public domain|PD(?:-Art|-old.*)?)$/i.test(license) && String(metadata.Copyrighted?.value).toLowerCase()==='false'?'https://creativecommons.org/publicdomain/mark/1.0/':'');
  const imageUrl=info?.thumburl || info?.url;
  // Local Wikipedia fair-use images and unknown licenses are excluded.
  if(!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(imageUrl || '') || !https(info?.descriptionurl) || !https(licenseUrl))return null;
  if(!/^(CC BY(?:-SA)?(?: [1-4]\.0)?|CC0(?: 1\.0)?|Public domain|PD(?:-Art|-old.*)?)$/i.test(license))return null;
  if(text(metadata.Restrictions?.value) || /Copyrighted in /i.test(metadata.Categories?.value || ''))return null;
  const artist=text(metadata.Artist?.value);const credit=text(metadata.Credit?.value);
  if(!artist)return null;
  return {entityId:entity.id,url:imageUrl,title:entity.label,artist,credit:[artist,credit,'Wikimedia Commons'].filter(Boolean).join(' · '),sourceUrl:info.descriptionurl,license,licenseUrl,width:info.thumbwidth || info.width,height:info.thumbheight || info.height,context:`Bildet er knyttet til den identifiserte posten for ${entity.label}.`,fileTitle:page.title};
}

export function questionPatch(entity, record, answers, existing) {
  const patch={entities:[],relationships:[],targets:[],sources:[]};
  for(const [property,rule] of Object.entries(rules)) {
    if(!rule.types.includes(entity.type))continue;
    const claims=referencedClaims(record,property);if(!claims.length)continue;
    const answerId=claims[0].mainsnak.datavalue.value.id;const answerRecord=answers[answerId];
    const label=answerRecord?.labels?.nb?.value;if(!label)continue;
    const old=existing.entities.find(e=>e.wikidataId===answerId || (e.label===label && e.type===rule.answerType));
    const endpointId=old?.id || `wikidata-${answerId}`;
    const sourceIds=[];
    for(const claim of claims)for(const reference of claim.references)for(const snak of reference.snaks?.P854 || []) {
      const url=snak.datavalue?.value;if(!https(url))continue;
      const id=`dynamic-source:${encodeURIComponent(url)}`;sourceIds.push(id);
      patch.sources.push({id,title:`Kilde til ${rule.type}: ${entity.label}`,url,license:'Fakta og egne formuleringer; kildeteksten gjengis ikke.',retrievedAt:new Date().toISOString(),wikidataClaim:claim.id,wikidataRevision:record.lastrevid});
    }
    const context=rule.context(entity.label,label);
    patch.entities.push(old?{...old,collectionIds:union(old.collectionIds,entity.collectionIds),sourceIds:union(old.sourceIds,sourceIds)}:{id:endpointId,wikidataId:answerId,label,type:rule.answerType,summary:`${label} er knyttet til ${entity.label} i den oppgitte kilden.`,collectionIds:entity.collectionIds,sourceIds:union(sourceIds)});
    const id=`dynamic:${entity.id}:${property}`;
    patch.relationships.push({id,from:entity.id,to:endpointId,type:rule.type,context,sourceIds:union(sourceIds)});
    const prompt=rule.question(entity.label);
    if(!existing.targets.some(t=>t.id!==id && t.prompt.trim().toLowerCase()===prompt.toLowerCase()))patch.targets.push({id,entityId:entity.id,prompt,answer:label,answerType:rule.answerType,acceptedAnswers:union((answerRecord.aliases?.nb || []).map(a=>a.value)),kind:'recall',learningStage:'details',difficulty:3,significance:3,collectionIds:entity.collectionIds,sourceIds:union(sourceIds),explanation:context});
  }
  if(patch.sources.length)patch.entities.push({...entity,sourceIds:union(entity.sourceIds,patch.sources.map(source=>source.id))});
  return patch;
}

/** Reuse already verified graph evidence when a provider has no usable new claims. */
export function graphQuestionPatch(entity,data) {
  const patch={entities:[],relationships:[],targets:[],sources:[]};
  const templates={
    received:{answerType:'award',prompt:(name,year)=>`Hvilken pris mottok ${name} i ${year}?`},
    'award-time-affiliation':{answerType:'organization',prompt:(name,year)=>`Hvilken institusjon var ${name} tilknyttet da prisen ble tildelt i ${year}?`},
    'recognized-for':{answerType:'concept',prompt:(name,year)=>`Hvilket faglig bidrag ble ${name} anerkjent for i ${year}?`}
  };
  const relations=data.relationships.filter(r=>r.from===entity.id && templates[r.type] && Number.isInteger(r.year) && (!r.evidenceStatus || r.evidenceStatus==='documented') && r.sourceIds?.length && r.sourceIds.every(id=>data.sources.some(source=>source.id===id && https(source.url))));
  for(const relation of relations) {
    const family=relations.filter(r=>r.type===relation.type && r.year===relation.year);
    if(new Set(family.map(r=>r.to)).size!==1)continue;
    const answerEntity=data.entities.find(e=>e.id===relation.to);if(!answerEntity)continue;
    const id=`dynamic-graph:${relation.id}`;
    const template=templates[relation.type],prompt=template.prompt(entity.label,relation.year);
    if(data.targets.some(t=>t.id!==id && t.prompt.trim().toLowerCase()===prompt.toLowerCase()))continue;
    patch.targets.push({id,entityId:entity.id,relationshipId:relation.id,prompt,answer:answerEntity.label,acceptedAnswers:answerEntity.aliases || [],answerType:answerEntity.type,kind:'recall',learningStage:'details',difficulty:3,significance:3,year:relation.year,collectionIds:entity.collectionIds,sourceIds:relation.sourceIds,explanation:relation.context});
  }
  return patch;
}

export async function loadSourceContent(entity, data, {fetcher=fetch, knownMedia=[]}={}) {
  const queries=sourceQueries(entity,data.sources);let record;let media;let museum;
  for(const query of queries) {
    if(query.provider==='met' && entity.type==='artwork') {
      const item=await json(SOURCE_QUERY_STRUCTURE.met.endpoint.replace('{id}',query.id),fetcher);
      if(item.objectID!==query.id || !item.isPublicDomain || !https(item.primaryImageSmall || item.primaryImage))continue;
      museum=item;
      media={entityId:entity.id,url:item.primaryImageSmall || item.primaryImage,title:entity.label,artist:item.artistDisplayName || 'Ukjent kunstner',credit:[item.artistDisplayName,item.creditLine,'The Metropolitan Museum of Art'].filter(Boolean).join(' · '),sourceUrl:item.objectURL,license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',context:`Samlingens objekt ${item.objectID}: ${item.title}. ${item.objectDate || ''}`};
    }
    if(query.provider==='wikipedia') {
      const response=await json(api(SOURCE_QUERY_STRUCTURE.wikipedia.endpoint.replace('{language}',query.language),{action:'query',prop:'pageprops|info',inprop:'url',redirects:'1',titles:query.title}),fetcher);
      const page=response.query?.pages?.[0];if(!page || page.missing || Object.hasOwn(page.pageprops || {},'disambiguation'))continue;
      const id=page.pageprops?.wikibase_item;
      if(qid(id) && (!entity.wikidataId || entity.wikidataId===id))record=(await json(api(SOURCE_QUERY_STRUCTURE.wikidata.endpoint,{action:'wbgetentities',ids:id,props:'labels|aliases|claims|sitelinks'}),fetcher)).entities?.[id];
    }
    if(query.provider==='wikidata')record=(await json(api(SOURCE_QUERY_STRUCTURE.wikidata.endpoint,{action:'wbgetentities',ids:query.id,props:'labels|aliases|claims|sitelinks'}),fetcher)).entities?.[query.id];
  }
  const patch={entities:[],relationships:[],targets:[],sources:[]};
  if(record && !record.missing) {
    const ids=union(Object.entries(rules).filter(([,rule])=>rule.types.includes(entity.type)).flatMap(([property])=>referencedClaims(record,property).map(c=>c.mainsnak.datavalue.value.id)));
    const answers=ids.length?(await json(api(SOURCE_QUERY_STRUCTURE.wikidata.endpoint,{action:'wbgetentities',ids:ids.join('|'),props:'labels|aliases',languages:'nb'}),fetcher)).entities:{};
    Object.assign(patch,questionPatch(entity,record,answers || {},data));
    // Artwork versions need a catalog-specific match. Preserve the reviewed local artwork.
    if(!knownMedia.some(m=>m.entityId===entity.id) && entity.type!=='artwork') {
      const images=(record.claims?.P18 || []).filter(c=>c.rank!=='deprecated' && c.mainsnak?.snaktype==='value');
      const filename=images.find(c=>c.rank==='preferred')?.mainsnak.datavalue?.value || images[0]?.mainsnak.datavalue?.value;
      if(typeof filename==='string') {
        const response=await json(api(SOURCE_QUERY_STRUCTURE.commons.endpoint,{action:'query',prop:'imageinfo',titles:`File:${filename}`,iiprop:'url|size|extmetadata',iiurlwidth:'900'}),fetcher);
        media=commonsMedia(entity,response.query?.pages?.[0]);
      }
    }
  }
  if(museum?.artistDisplayName && museum.artistWikidata_URL && qid(museum.artistWikidata_URL.split('/').pop())) {
    const id=museum.artistWikidata_URL.split('/').pop();
    const fake={id:`met-${museum.objectID}`,claims:{P170:[{id:`met-${museum.objectID}-artist`,mainsnak:{snaktype:'value',datavalue:{value:{id}}},references:[{snaks:{P854:[{datavalue:{value:museum.objectURL}}]}}]}]}};
    const generated=questionPatch(entity,fake,{[id]:{labels:{nb:{value:museum.artistDisplayName}}}},data);
    for(const section of Object.keys(patch))patch[section].push(...generated[section]);
  }
  const graph=graphQuestionPatch(entity,data);
  patch.targets.push(...graph.targets.filter(target=>!patch.targets.some(old=>old.prompt===target.prompt)));
  return {patch,media:knownMedia.some(m=>m.entityId===entity.id)?null:media,queries,checkedAt:new Date().toISOString()};
}

/** Add a validated local overlay without replacing installed packages or study state. */
export function mergeSourceContent(base, records=[]) {
  const output=structuredClone(base);
  const sections=['entities','relationships','targets','sources'];
  const maps=Object.fromEntries(sections.map(section=>[section,new Map(output[section].map(row=>[row.id,row]))]));
  const prompts=new Set(output.targets.map(target=>target.prompt.trim().toLowerCase()));
  for(const record of records)for(const section of sections)for(const row of record.patch?.[section] || []) {
    const old=maps[section].get(row.id);
    if(old && section!=='entities')continue;
    if(section==='targets') {
      const prompt=row.prompt.trim().toLowerCase();
      if(prompts.has(prompt))continue;
      prompts.add(prompt);
    }
    maps[section].set(row.id,old?{...old,collectionIds:union(old.collectionIds,row.collectionIds),sourceIds:union(old.sourceIds,row.sourceIds)}:structuredClone(row));
  }
  for(const section of sections)output[section]=[...maps[section].values()];
  Object.assign(output,{entityCount:output.entities.length,relationshipCount:output.relationships.length,targetCount:output.targets.length});
  if(output.knowledgeModelVersion===1) {
    const claims=new Map(output.claims.map(claim=>[claim.id,claim]));
    const byRelationship=new Map(output.claims.flatMap(claim=>claim.relationshipIds.map(id=>[id,claim.id])));
    for(const record of records)for(const relation of record.patch?.relationships || []) {
      const id=`fact:relationship:${relation.id}`;
      if(!claims.has(id))claims.set(id,{id,entityIds:[relation.from,relation.to],relationshipIds:[relation.id],statement:relation.context,sourceIds:relation.sourceIds,evidenceStatus:'documented'});
      byRelationship.set(relation.id,id);
    }
    output.claims=[...claims.values()];
    for(const record of records)for(const target of record.patch?.targets || [])if(maps.targets.has(target.id) && !output.exerciseFacts[target.id]) {
      const relationId=target.relationshipId || target.id;
      const claimId=byRelationship.get(relationId) || `fact:relationship:${relationId}`;
      output.exerciseFacts[target.id]={factId:claimId,claimIds:[claimId],retrievalRole:target.entityId};
    }
  }
  const errors=validatePackage(output);
  if(errors.length)throw new Error(`Nytt innhold kunne ikke kontrolleres: ${errors[0]}`);
  return output;
}

export async function downloadSourceImage(media,fetcher=fetch) {
  if(!media)return null;
  const response=await fetcher(media.url,{signal:AbortSignal.timeout(15000),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('Bildet kunne ikke lastes ned.');
  const blob=await response.blob();
  if(!['image/jpeg','image/png','image/webp'].includes(blob.type) || blob.size>2000000)throw new Error('Bildets format eller størrelse støttes ikke.');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return {...media,remoteUrl:media.url,url:`data:${blob.type};base64,${btoa(binary)}`,bytes:blob.size};
}
