import {assessTargets} from '../src/lib/difficulty.js';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validatePackage} from './validate-knowledge.mjs';
const sections=['collections','entities','relationships','targets','sources','timelines'];
const normalize=text=>String(text).normalize('NFKC').toLowerCase().trim();
const union=(a=[],b=[])=>[...new Set([...a,...b])];
const entityType=type=>['country','country-area'].includes(type)?'country-area':type;
export function mergeKnowledge(base,patches) {
 patches=[...new Map(patches.map(patch=>[JSON.stringify(patch),patch])).values()];
 const output=structuredClone(base);
 const maps=Object.fromEntries(sections.map(section=>[section,new Map(output[section].map(row=>[row.id,row]))]));
 const entityAliases=new Map();
 for(const patch of patches) {
  for(const section of ['collections','sources']) for(const row of patch[section]||[]) {
   if(!maps[section].has(row.id)) maps[section].set(row.id,structuredClone(row));
  }
  for(const row of patch.entities||[]) {
   const canonical=maps.entities.get(row.id) || [...maps.entities.values()].find(old=>entityType(old.type)===entityType(row.type) && normalize(old.label)===normalize(row.label));
   if(canonical) {
    entityAliases.set(row.id,canonical.id);
    canonical.collectionIds=union(canonical.collectionIds,row.collectionIds);
    canonical.sourceIds=union(canonical.sourceIds,row.sourceIds);
    for(const key of ['iso2','iso3','m49']) if(row[key]) canonical[key]=row[key];
   } else {maps.entities.set(row.id,structuredClone(row));entityAliases.set(row.id,row.id);}
  }
 }
 const resolve=id=>entityAliases.get(id)||id;
 for(const patch of patches) {
  for(const original of patch.relationships||[]) {
   const row={...original,from:resolve(original.from),to:resolve(original.to)};
   const old=maps.relationships.get(row.id);
   if(old && (old.from!==row.from||old.to!==row.to||old.type!==row.type)) throw new Error(`Conflicting relationship ${row.id}`);
   maps.relationships.set(row.id,row);
  }
  for(const original of patch.targets||[]) {
   const row={...original,entityId:resolve(original.entityId)};
   const duplicate=[...maps.targets.values()].find(old=>normalize(old.prompt)===normalize(row.prompt));
   if(duplicate && duplicate.id!==row.id) {
    if(normalize(duplicate.answer)!==normalize(row.answer)) throw new Error(`Conflicting answer ${row.prompt}`);
    duplicate.sourceIds=union(duplicate.sourceIds,row.sourceIds);
    duplicate.collectionIds=union(duplicate.collectionIds,row.collectionIds);
    duplicate.acceptedAnswers=union(duplicate.acceptedAnswers,row.acceptedAnswers);
   } else if(!maps.targets.has(row.id)) maps.targets.set(row.id,row);
  }
  for(const row of patch.timelines||[]) if(!maps.timelines.has(row.id)) maps.timelines.set(row.id,{...row,items:row.items.map(item=>({...item,...(item.entityId?{entityId:resolve(item.entityId)}:{})}))});
 }
 for(const section of sections) output[section]=[...maps[section].values()];
 output.targets=assessTargets(output.targets);
 Object.assign(output,{version:'1.1.2',language:'nb',generatedAt:'2026-10-11T12:00:00Z',entityCount:output.entities.length,relationshipCount:output.relationships.length,targetCount:output.targets.length});
 output.coverage={scope:'Kildebelagt register og utvalgte øvelser. Registerdekning er ikke full øvingsdekning.',imports:patches.map(patch=>({coverage:patch.coverage||patch.provenance||{},counts:Object.fromEntries(sections.map(section=>[section,(patch[section]||[]).length]))}))};
 const validation=validatePackage(output);
 if(!validation.valid) throw new Error(validation.errors.join('\n'));
 return output;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const base=JSON.parse(await readFile('knowledge-build/base-foundation.json','utf8'));
 const paths=process.argv.slice(2);
 if(!paths.length) throw new Error('Provide completed knowledge patch paths');
 const patches=await Promise.all(paths.map(async path=>JSON.parse(await readFile(path,'utf8'))));
 const output=mergeKnowledge(base,patches);
 await writeFile('public/knowledge/foundation.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(validatePackage(output).counts));
}
