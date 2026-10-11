import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceQueries,commonsMedia,questionPatch,mergeSourceContent,loadSourceContent,downloadSourceImage} from '../src/lib/source-loading.js';
import {validatePackage} from '../src/lib/content.js';
const foundation=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const person={...foundation.entities.find(e=>e.type==='person'),wikidataId:'Q1'};
const claim=(id='Q2',extra={})=>({id:'Q1$birth',rank:'normal',mainsnak:{snaktype:'value',datavalue:{value:{id}}},references:[{snaks:{P854:[{datavalue:{value:'https://example.org/biography'}}]}}],...extra});
const answers={Q2:{labels:{nb:{value:'Et kontrollert sted'}},aliases:{nb:[{value:'Stedsnavnet'}]}}};
const image={title:'File:Portrait.jpg',imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Portrait.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Portrait.jpg',width:300,height:400,extmetadata:{Artist:{value:'<b>Fotograf</b>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]};

test('one Wikipedia query structure works for language editions, encoded titles and mobile URLs',()=>{
 for(const language of ['nb','nn','en','de','zh','be-tarask']) {
  const entity={sourceIds:['s']};
  assert.deepEqual(sourceQueries(entity,[{id:'s',url:`https://${language}.m.wikipedia.org/wiki/Marie_Curie%27s_life`}]),[{provider:'wikipedia',language,title:"Marie Curie's life"}]);
 }
 assert.deepEqual(sourceQueries({sourceIds:['s']},[{id:'s',url:'https://en.wikipedia.org.evil.test/wiki/Person'}]),[]);
 assert.deepEqual(sourceQueries({sourceIds:['s']},[{id:'s',url:'https://en.wikipedia.org/wiki/File:Portrait.jpg'}]),[]);
 assert.deepEqual(sourceQueries({sourceIds:['s']},[{id:'s',url:'https://en.wikipedia.org/wiki/%zz'}]),[]);
});
test('source identity is exact, scoped and deduplicated without name guessing',()=>{
 const sources=[{id:'s',url:'https://www.wikidata.org/wiki/Q1'},{id:'other',url:'https://www.metmuseum.org/art/collection/search/123'}];
 assert.deepEqual(sourceQueries({...person,sourceIds:['s']},sources),[{provider:'wikidata',id:'Q1'}]);
 assert.deepEqual(sourceQueries({sourceIds:['other']},sources),[{provider:'met',id:123}]);
});
test('only a single unqualified answer with a source URL and Norwegian label becomes a question',()=>{
 const valid=questionPatch(person,{lastrevid:42,claims:{P19:[claim()]}},answers,foundation);
 assert.equal(valid.targets.length,1);assert.equal(valid.targets[0].answer,'Et kontrollert sted');
 assert.equal(valid.sources[0].wikidataRevision,42);assert.equal(valid.relationships[0].type,'born-in');
 for(const claims of [[claim('Q2'),claim('Q3')],[claim('Q2',{rank:'deprecated'})],[claim('Q2',{qualifiers:{P580:[]}})],[claim('Q2',{references:[]})]])assert.equal(questionPatch(person,{claims:{P19:claims}},answers,foundation).targets.length,0);
 assert.equal(questionPatch(person,{claims:{P19:[claim()]}},{Q2:{labels:{en:{value:'Only English'}}}},foundation).targets.length,0);
});
test('local overlays preserve target IDs, content, knowledge mappings and review-independent base data',()=>{
 const record={patch:questionPatch(person,{claims:{P19:[claim()]}},answers,foundation)};
 const merged=mergeSourceContent(foundation,[record]);
 assert.equal(merged.targets.length,foundation.targets.length+1);assert.deepEqual(validatePackage(merged),[]);
 assert.equal(foundation.targets.some(t=>t.id.startsWith('dynamic:')),false);
 assert.deepEqual(mergeSourceContent(foundation,[record,record]),merged);
 const broken=structuredClone(record);broken.patch.relationships[0].to='missing';assert.throws(()=>mergeSourceContent(foundation,[broken]),/kontrolleres/);
});
test('Commons requires licensed Wikimedia files and strips markup from credits',()=>{
 const media=commonsMedia(person,image);assert.equal(media.artist,'Fotograf');assert.equal(media.entityId,person.id);
 for(const changed of [{url:'https://en.wikipedia.org/fair-use.jpg'},{extmetadata:{}},{extmetadata:{...image.imageinfo[0].extmetadata,LicenseShortName:{value:'All rights reserved'}}}])assert.equal(commonsMedia(person,{...image,imageinfo:[{...image.imageinfo[0],...changed}]}),null);
 const pd=structuredClone(image);pd.imageinfo[0].extmetadata.LicenseShortName.value='Public domain';delete pd.imageinfo[0].extmetadata.LicenseUrl;pd.imageinfo[0].extmetadata.Copyrighted={value:'False'};
 assert.equal(commonsMedia(person,pd).licenseUrl,'https://creativecommons.org/publicdomain/mark/1.0/');
});
test('Wikipedia redirects resolve to identity, Wikidata references generate linked questions, Commons supplies the matching picture',async()=>{
 const calls=[];
 const e={...person,wikidataId:undefined,sourceIds:['wiki']};
 const d={...foundation,sources:[...foundation.sources,{id:'wiki',url:'https://nb.wikipedia.org/wiki/Test'}]};
 const fetcher=async url=>{
  const u=new URL(url);calls.push(u);
  if(u.hostname==='nb.wikipedia.org')return Response.json({query:{pages:[{title:'Canonical',pageprops:{wikibase_item:'Q1'}}]}});
  if(u.hostname==='commons.wikimedia.org')return Response.json({query:{pages:[image]}});
  if(u.searchParams.get('ids')==='Q2')return Response.json({entities:answers});
  return Response.json({entities:{Q1:{claims:{P19:[claim()],P18:[{mainsnak:{snaktype:'value',datavalue:{value:'Portrait.jpg'}}}]}}}});
 };
 const r=await loadSourceContent(e,d,{fetcher});assert.equal(r.patch.targets.length,1);assert.equal(r.media.entityId,e.id);
 assert.equal(calls.length,4);assert.equal(calls[3].searchParams.get('titles'),'File:Portrait.jpg');
});
test('a generic Wikidata artwork picture cannot replace an exact reviewed version',async()=>{
 const e={...person,type:'artwork'};let calls=0;
 const r=await loadSourceContent(e,foundation,{fetcher:async()=>{calls++;return Response.json({entities:{Q1:{claims:{P18:[{mainsnak:{snaktype:'value',datavalue:{value:'Other version.jpg'}}}]}}}});}});
 assert.equal(calls,1);assert.equal(r.media,undefined);
});
test('Met links exact collection IDs, gates public-domain images and connects creator questions',async()=>{
 const e={...person,type:'artwork',wikidataId:undefined,sourceIds:['met']};
 const d={...foundation,sources:[...foundation.sources,{id:'met',url:'https://www.metmuseum.org/art/collection/search/123'}]};
 const item={objectID:123,isPublicDomain:true,title:'Work',primaryImageSmall:'https://images.metmuseum.org/work.jpg',objectURL:'https://www.metmuseum.org/art/collection/search/123',artistDisplayName:'En kunstner',artistWikidata_URL:'https://www.wikidata.org/wiki/Q2'};
 const r=await loadSourceContent(e,d,{fetcher:async()=>Response.json(item)});assert.equal(r.media.license,'CC0');assert.equal(r.patch.targets[0].answer,'En kunstner');
 const blocked=await loadSourceContent(e,d,{fetcher:async()=>Response.json({...item,isPublicDomain:false})});assert.equal(blocked.media,undefined);assert.equal(blocked.patch.targets.length,0);
});
test('downloaded pictures become portable offline content, rejecting HTML and oversized files',async()=>{
 const media=commonsMedia(person,image);
 const saved=await downloadSourceImage(media,async()=>new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}}));
 assert.match(saved.url,/^data:image\/jpeg;base64,/);assert.equal(saved.bytes,3);assert.equal(saved.remoteUrl,media.url);
 await assert.rejects(downloadSourceImage(media,async()=>new Response('<html>',{headers:{'content-type':'text/html'}})),/format/);
 await assert.rejects(loadSourceContent(person,foundation,{fetcher:async()=>Response.json({error:{code:'maxlag'}})}),/forespørselen/);
});

test('refreshing the same source keeps its generated questions',()=>{
 const record={patch:questionPatch(person,{claims:{P19:[claim()]}},answers,foundation)};
 const installed=mergeSourceContent(foundation,[record]);
 const refreshed={patch:questionPatch(person,{claims:{P19:[claim()]}},answers,installed)};
 assert.equal(refreshed.patch.targets.length,1);
 assert.equal(mergeSourceContent(foundation,[refreshed]).targets.length,installed.targets.length);
});

test('picture subjects gain questions from existing authoritative graph evidence when Wikidata has no qualifying claims',async()=>{
 const entity=foundation.entities.find(e=>e.wikidataId && foundation.relationships.some(r=>r.from===e.id && r.type==='award-time-affiliation'));
 const result=await loadSourceContent(entity,foundation,{fetcher:async()=>Response.json({entities:{[entity.wikidataId]:{claims:{}}}})});
 assert.ok(result.patch.targets.some(t=>t.relationshipId));
 const merged=mergeSourceContent(foundation,[result]);assert.deepEqual(validatePackage(merged),[]);
 for(const target of result.patch.targets) {
  assert.equal(target.explanation,foundation.relationships.find(r=>r.id===target.relationshipId).context);
  assert.ok(target.sourceIds.every(id=>foundation.sources.some(s=>s.id===id)));
 }
});
