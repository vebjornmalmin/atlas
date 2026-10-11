import {readFile,writeFile} from 'node:fs/promises';
const packageData=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const media=JSON.parse(await readFile('public/knowledge/media.json','utf8'));
const maps=await Promise.all(['world','norway'].map(async name=>JSON.parse(await readFile(`public/maps/${name}.json`,'utf8'))));
const urls=[...new Set([...packageData.sources.map(s=>s.url),...media.flatMap(item=>[item.sourceUrl,item.licenseUrl]),...maps.map(item=>item.source.licenseUrl||item.source.url)].filter(Boolean))];
const previous=process.argv.includes('--resume')?JSON.parse(await readFile('docs/link-audit.json','utf8')).results:[];
const results=[...previous]; const pending=urls.filter(url=>!results.some(row=>row.url===url));let cursor=0;
async function check(url){
 for(let attempt=0;attempt<2;attempt++)try{
  let response=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(15000)});
  if([403,405,501].includes(response.status)) {response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000)});await response.body?.cancel();}
  return {url,status:response.status,finalUrl:response.url,reachable:response.ok};
 }catch(error){if(attempt===1)return {url,status:0,error:error.message,reachable:false};}
}
await Promise.all(Array.from({length:8},async()=>{
 while(cursor<pending.length){const url=pending[cursor++];results.push(await check(url));if(results.length%100===0)console.log(`${results.length}/${urls.length}`);}
}));
const report={checkedAt:new Date().toISOString(),total:results.length,reachable:results.filter(r=>r.reachable).length,failures:results.filter(r=>!r.reachable),results};
await writeFile('docs/link-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,reachable:report.reachable,failures:report.failures},null,2));
