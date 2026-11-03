// Measures whether the lenses actually differ, how much each sees, and how many exercises each format yields.
import {readFile,writeFile} from 'node:fs/promises';
import {buildWorldGraph,lensView,lensOverlap} from '../src/lib/world-graph.js';
import {buildWorldTargets} from '../src/lib/world-exercises.js';
import {WORLD_FORMATS} from '../knowledge-build/lens-projections.mjs';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const graph=buildWorldGraph(data);
const now=new Date(`${data.perspectives.news.snapshotDate}T12:00:00Z`);
const views=graph.lenses.map(l=>lensView(graph,l.id,null,now));
const overlaps=[];
for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++)overlaps.push({a:views[i].lens.id,b:views[j].lens.id,overlap:lensOverlap(views[i],views[j])});
overlaps.sort((x,y)=>y.overlap-x.overlap);
const topSet=view=>new Set([...view.countryScores].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id])=>id));
const mapOverlaps=[];
for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++){const a=topSet(views[i]),b=topSet(views[j]);mapOverlaps.push([...a].filter(id=>b.has(id)).length/10);}
const topCountries=view=>[...view.countryScores].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id])=>graph.byId.get(id).label);
const targets=buildWorldTargets(data,graph);
const report={generatedFor:data.version,snapshotDate:data.perspectives.news.snapshotDate,
  meanTopOverlap:+(overlaps.reduce((s,o)=>s+o.overlap,0)/overlaps.length).toFixed(3),
  mostSimilarPairs:overlaps.slice(0,5),
  meanTopCountryOverlap:+(mapOverlaps.reduce((a,b)=>a+b,0)/mapOverlaps.length).toFixed(3),
  lenses:views.map(v=>({id:v.lens.id,name:v.lens.name,seesShare:+v.coverage.share.toFixed(3),
    topNodes:v.ranked.slice(0,5).map(e=>e.label),topCountries:topCountries(v),blindspot:v.lens.blindspot})),
  formats:Object.fromEntries(WORLD_FORMATS.map(f=>[f.id,targets.filter(t=>t.format===f.id).length])),
  note:'Overlapp er andelen felles noder blant de 25 høyest rangerte for hvert par linser, og andelen felles land blant de ti mørkeste på kartet. Lav verdi betyr at linsene faktisk ser forskjellige ting.'};
await writeFile('docs/perspective-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({meanTopOverlap:report.meanTopOverlap,meanTopCountryOverlap:report.meanTopCountryOverlap,mostSimilar:report.mostSimilarPairs.slice(0,3),formats:report.formats}));
