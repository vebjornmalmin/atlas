<script>
  import Flag from './Flag.svelte';
  import {lensView,relatedThrough,lensesFor,findPath,newsWeight,METRIC_NOTES,DEFAULT_RELEVANCE} from './world-graph.js';
  import PanZoomMap from './PanZoomMap.svelte';
  import {pathBounds,parseBox,regionAnchor,neighbourhoodFrame} from './map-view.js';
  import {WORLD_FORMAT_CHOICES} from './quiz-formats.js';
  import {PROJECTIONS,projectionById,worldFeatures,projectWorld,turnGlobe,rotationFor,globeDisc,dragRotation,interpolateRotation} from './projections.js';
  let {graph,dataset,relevance=$bindable({...DEFAULT_RELEVANCE}),typeLabel,relationLabel,onOpen,onQuiz,onSave,formatAvailable}=$props();

  const STORE='atlas-world';
  const SYMMETRIC=new Set(['borders']);
  let saved={};
  try {saved=JSON.parse(localStorage.getItem(STORE) || '{}');} catch {saved={};}
  let lensId=$state(saved.lensId ?? 'geopolitics');
  let focusId=$state(saved.focusId || 'norway');
  let pathFrom=$state(saved.pathFrom || ''),pathTo=$state(saved.pathTo || '');
  let fromQuery=$state(''),toQuery=$state('');
  const regionOf=id=>graph.byId.get(graph.countryOf.get(id))?.geo?.mapRegionId;
  // The same world in the projection the learner chose. The flat map file is the default and is drawn as it is.
  let features=null;
  const featuresNow=()=>features??=worldFeatures(dataset);
  const featureOf=region=>{const i=dataset.regions.findIndex(r=>r.id===region);return i<0?null:featuresNow()[i];};
  const startProjection=PROJECTIONS.some(p=>p.id===saved.projection)?saved.projection:'standard';
  const startFeature=startProjection==='globe' && !Array.isArray(saved.rotation)?featureOf(regionOf(saved.focusId || 'norway')):null;
  const startRotation=Array.isArray(saved.rotation)?saved.rotation:startFeature?rotationFor(startFeature):null;
  let projectionId=$state(startProjection);
  let rotation=$state.raw(startRotation);
  const draw=(id,turn)=>id==='standard'?dataset:projectWorld(dataset,featuresNow(),id,{rotation:turn});
  let world=$state.raw(draw(startProjection,startRotation));
  let projection=$derived(projectionById(projectionId));
  let disc=$derived(globeDisc(world));
  const regionBounds=region=>{const path=world.regions.find(r=>r.id===region)?.path;return path?pathBounds(path,true):null;};
  const focusFrame=id=>neighbourhoodFrame(regionBounds(regionOf(id)),(graph.neighbours.get(id)||[]).map(n=>regionBounds(graph.byId.get(n)?.geo?.mapRegionId)),parseBox(world.viewBox)[2]);
  // Each projection keeps its own view; the flat map opens on the focus country, the others show the whole world.
  const views={...(saved.views || {})};
  if(Array.isArray(saved.mapView) && !saved.views)views.standard=saved.mapView;
  let mapView=$state.raw(Array.isArray(views[startProjection])?views[startProjection]:startProjection==='standard'?focusFrame(saved.focusId || 'norway'):null);
  let projectionMenu=$state(false);
  let mapUnit=$state(1);
  let lensMenu=$state(false);
  let worldMap=$state();
  let rankedLimit=$state(10);
  $effect(()=>{const state={lensId,focusId,pathFrom,pathTo,mapView,projection:projectionId,rotation,views:{...views,[projectionId]:mapView}};try {localStorage.setItem(STORE,JSON.stringify(state));} catch {/* The explorer still works without saved position. */}});

  function setProjection(id){
    projectionMenu=false;
    if(id===projectionId)return;
    views[projectionId]=mapView;
    if(id==='globe' && !rotation){const f=featureOf(focusRegion);rotation=f?rotationFor(f):null;}
    world=draw(id,rotation);
    projectionId=id;
    mapView=Array.isArray(views[id])?views[id]:null;
  }
  // The globe turns under the finger instead of sliding; one redraw per frame however fast the finger moves.
  let drag=null,pending=null,frame=0,spin=0;
  function turnTo(next){
    pending=next;
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;rotation=pending;world=turnGlobe(world,featuresNow(),pending);});
  }
  const globeDragStart=point=>{if(projectionId!=='globe' || !world.projection)return false;cancelAnimationFrame(spin);drag={point,rotation:rotation || world.projection.rotate()};return true;};
  const globeDragMove=point=>{if(drag && point)turnTo(dragRotation(drag.rotation,point.x-drag.point.x,point.y-drag.point.y,world.projection.scale()));};
  const globeDragEnd=()=>{drag=null;};
  function spinTo(id){
    const f=featureOf(regionOf(id));
    if(!f)return;
    const from=rotation || world.projection.rotate(),to=rotationFor(f),turn=interpolateRotation(from,to);
    const finish=()=>{rotation=to;world=turnGlobe(world,featuresNow(),to);const box=focusFrame(id);if(box)worldMap?.flyTo(box);};
    cancelAnimationFrame(spin);
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
    const start=performance.now();
    const step=now=>{const t=Math.min(1,(now-start)/700),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;if(t<1){turnTo(turn(e));spin=requestAnimationFrame(step);}else finish();};
    spin=requestAnimationFrame(step);
  }


  const now=new Date();
  let view=$derived(lensView(graph,lensId,relevance,now));
  let lens=$derived(view.lens);
  let focus=$derived(graph.byId.get(focusId));
  let seenBy=$derived(focus?lensesFor(graph,focus.id):[]);
  // A lens only gets a heading over the connections when it actually says something about the place or topic.
  let lensSees=$derived(Boolean(lens && seenBy.some(x=>x.lens.id===lens.id)));
  let related=$derived(focus?relatedThrough(graph,focus.id,lensSees?view:{...view,lens:null},8):[]);
  let otherLenses=$derived(seenBy.slice(0,4));
  let neighbours=$derived(focus?(graph.neighbours.get(focus.id)||[]).map(id=>graph.byId.get(id)).sort((a,b)=>a.label.localeCompare(b.label,'nb')):[]);
  let focusNews=$derived(focus?graph.news.filter(n=>n.id===focus.id || graph.adjacency.get(n.id).some(l=>l.other===focus.id)):[]);
  let path=$derived(pathFrom && pathTo?findPath(graph,pathFrom,pathTo,lens):null);
  let focusRegion=$derived(graph.byId.get(graph.countryOf.get(focusId))?.geo?.mapRegionId);
  const percent=value=>Math.round(100*(value||0));
  const label=id=>graph.byId.get(id)?.label || id;
  const flagFor=entity=>entity?.iso2 && entity.geo?entity.iso2:'';
  // Names on the map: the focus country always, its neighbours once they are big enough on screen to hold one.
  let mapLabels=$derived.by(()=>{
    if(!focus)return [];
    const own=focusRegion && world.regions.find(r=>r.id===focusRegion && r.path);
    const labels=own?[{id:focus.id,text:focus.label,at:regionAnchor(own.path),main:true}]:[];
    for(const n of neighbours){
      const region=n.geo?.mapRegionId,b=regionBounds(region);
      if(b && b[2]/mapUnit>n.label.length*7+12)labels.push({id:n.id,text:n.label,at:regionAnchor(world.regions.find(r=>r.id===region).path),main:false});
    }
    return labels.filter(l=>l.at);
  });
  function choose(id,scroll=true){
    focusId=id;lensMenu=false;projectionMenu=false;
    if(projectionId==='globe')spinTo(id);
    else {const box=focusFrame(id);if(box)worldMap?.flyTo(box);}
    if(scroll)document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function fill(regionId){
    const id=graph.regionToCountry.get(regionId),value=view.countryScores.get(id);
    if(value===undefined)return 'var(--surface)';
    if(lens?.metric==='flow-balance'){const d=Math.abs(value-.5)*2;return `color-mix(in srgb, ${value>=.5?'var(--accent)':'var(--warm)'} ${Math.round(15+80*d)}%, var(--surface))`;}
    return `color-mix(in srgb, var(--accent) ${Math.round(8+87*value)}%, var(--surface))`;
  }
  function chooseLens(id){
    lensId=id;const next=graph.lenses.find(l=>l.id===id);
    if(next){relevance={...next.weights};onSave?.();}
  }
  const matches=q=>q.trim().length<2?[]:graph.data.entities.filter(e=>e.type!=='award-event' && e.label.toLocaleLowerCase('nb').includes(q.toLocaleLowerCase('nb'))).sort((a,b)=>a.label.length-b.label.length).slice(0,5);
  function setEndpoint(which,id){if(which==='from'){pathFrom=id;fromQuery='';}else{pathTo=id;toQuery='';}}
  const lensPracticeIds=()=>{const top=new Set(view.ranked.slice(0,120).map(e=>e.id));return top;};
</script>



{#snippet lensDock()}
<button type="button" class="map-pill lens-pill" aria-expanded={lensMenu} aria-controls="lens-menu" onclick={()=>{lensMenu=!lensMenu;projectionMenu=false;}}><small>Linse</small>{lens?.name || 'Ingen'}<svg viewBox="0 0 20 20" aria-hidden="true"><path d={lensMenu?'M5 12.5 10 7.5l5 5':'m5 7.5 5 5 5-5'}/></svg></button>
{#if lensMenu}<div class="lens-menu" id="lens-menu" role="group" aria-label="Velg historiesyn">
  <button type="button" class="lens-option" aria-pressed={!lens} onclick={()=>{lensId='';lensMenu=false;}}>Ingen linse</button>
  {#each graph.lenses as l}<button type="button" class="lens-option" aria-pressed={lensId===l.id} onclick={()=>{chooseLens(l.id);lensMenu=false;}}>{l.name}</button>{/each}
</div>{/if}
{/snippet}
{#snippet projectionDock()}
<button type="button" class="map-pill projection-pill" aria-expanded={projectionMenu} aria-controls="projection-menu" onclick={()=>{projectionMenu=!projectionMenu;lensMenu=false;}}><small>Kart</small>{projection.name}<svg viewBox="0 0 20 20" aria-hidden="true"><path d={projectionMenu?'M5 12.5 10 7.5l5 5':'m5 7.5 5 5 5-5'}/></svg></button>
{#if projectionMenu}<div class="projection-menu" id="projection-menu" role="group" aria-label="Velg kartprojeksjon">
  {#each PROJECTIONS as p}<button type="button" class="lens-option projection-option" aria-pressed={projectionId===p.id} onclick={()=>setProjection(p.id)}>{p.name}<small>{p.kind}</small></button>{/each}
</div>{/if}
{/snippet}
{#snippet focusPill()}{#if focus}<button class="map-pill" onclick={()=>document.querySelector('#world-focus')?.scrollIntoView({behavior:'smooth',block:'start'})}>{#if flagFor(focus)}<Flag iso2={flagFor(focus)} />{/if}{focus.label} <span aria-hidden="true">↓</span></button>{/if}{/snippet}
<div class="world-explorer atlas-kart">
{#snippet mapHud()}{@render focusPill()}{@render projectionDock()}{@render lensDock()}{/snippet}
{#key projectionId}
<PanZoomMap bind:this={worldMap} base={world.viewBox} bind:view={mapView} bind:unit={mapUnit} className={`world-map${projectionId==='standard'?'':' projected'}`} label={`Verdenskart${projectionId==='standard'?'':` i projeksjonen ${projection.name}`} vektet ${lens?`gjennom ${lens.name}`:'etter relevans'}. ${projectionId==='globe'?'Dra for å snu kloden, knip for å zoome':'Dra og knip for å utforske'}, trykk på et land.`} onTap={({region})=>{if(lensMenu || projectionMenu){lensMenu=false;projectionMenu=false;return;}const id=graph.regionToCountry.get(region);if(id)choose(id,false);}} onDragStart={globeDragStart} onDragMove={globeDragMove} onDragEnd={globeDragEnd} overlay={mapHud}>
    {#if world.sphere}<defs><clipPath id="map-sphere-clip"><path d={world.sphere} /></clipPath>{#if disc}<radialGradient id="globe-shade" cx="42%" cy="38%" r="62%"><stop offset="0" class="shade-light" /><stop offset="1" class="shade-dark" /></radialGradient>{/if}</defs><path class="map-sphere" d={world.sphere} />{/if}
    {#if world.graticule}<path class="map-graticule" d={world.graticule} clip-path={world.sphere?'url(#map-sphere-clip)':null} />{/if}
    {#each world.regions as region (region.id)}{#if region.path}<path d={region.path} data-region={region.id} fill-rule="evenodd" style:fill={fill(region.id)} class:focused={focusRegion===region.id} class:neighbour={neighbours.some(n=>n.geo?.mapRegionId===region.id)} />{/if}{/each}
    {#if disc}<circle class="globe-shade" cx={disc.x} cy={disc.y} r={disc.r} fill="url(#globe-shade)" />{/if}
    {#each mapLabels as l (l.id)}<text class="map-label" class:main={l.main} x={l.at.x} y={l.at.y} style:font-size={`${(l.main?14:11)*mapUnit}px`} style:stroke-width={`${3*mapUnit}px`}>{l.text}</text>{/each}
</PanZoomMap>
{/key}
{#if projectionId!=='standard'}<p class="projection-note"><strong>{projection.name}</strong> · {projection.kind}. {projection.note}</p>{/if}

{#if lens}
  <div class="card lens-card">
    <p class="eyebrow">Historiesyn {lens.order} av {graph.lenses.length} · {({event:'hendelser',generation:'generasjoner',century:'århundrer','longue-duree':'lang varighet',cosmic:'kosmisk tid'})[lens.timeScale] || lens.timeScale}</p>
    <h2>{lens.name}</h2>
    <p class="lens-question">«{lens.question}»</p>
    <p>{lens.summary}</p>
    {#if lens.thinkerIds.length}<div class="chips">{#each lens.thinkerIds as id}<button class="chip" onclick={()=>choose(id)}>{label(id)}</button>{/each}</div>{/if}
    <details><summary>Kritikk og blindsone</summary><p>{lens.critique}</p><p class="muted"><strong>Blindsone i Atlas:</strong> {lens.blindspot}</p><p class="muted">Linsen ser {view.coverage.nodes} av {graph.data.entities.length} noder ({percent(view.coverage.share)} %).{#if lens.evidenceStatus==='disputed'} Synet er omstridt blant historikere.{/if}</p></details>
  </div>
{/if}

<details class="card weights" id="world-weights" open={!lens}>
  <summary>Hva er relevant? Påvirkning {relevance.impact} · Aktualitet {relevance.actuality} · Nærhet {relevance.locality}</summary>
  {#each [['impact','Påvirkning','Hvor sentralt noden står i kunnskapsnettverket.'],['actuality','Aktualitet','Hvor mye den er i nyhetene nå. Vekten halveres hver 14. dag.'],['locality','Nærhet','Hvor nær Oslo stedet ligger.']] as [key,name,note]}
    <label class="slider">{name} <strong>{relevance[key]}</strong><input type="range" min="0" max="100" step="5" value={relevance[key]} oninput={e=>relevance={...relevance,[key]:Number(e.currentTarget.value)}} onchange={()=>onSave?.()}><small class="muted">{note}</small></label>
  {/each}
  {#if lens}<button class="quiet" onclick={()=>{relevance={...lens.weights};onSave?.();}}>Bruk linsens vekting</button>{/if}
  <p class="muted detail">Samme vekting avgjør hvilke spørsmål fri quiz henter fra registrene.</p>
</details>

<p class="muted map-note">{lens?.metric?METRIC_NOTES[lens.metric]:'Mørkere farge: mer av det linsen ser, knyttet til landet og vektet etter relevans.'} Trykk på et land.</p>

{#if focus}
  <div class="card focus-card" id="world-focus">
    <div class="focus-head">{#if flagFor(focus)}<span class="focus-flag"><Flag iso2={flagFor(focus)} size="medium" /></span>{/if}<div><p class="eyebrow">{typeLabel(focus.type)}</p><h2>{focus.label}</h2></div></div>
    <p>{focus.summary}</p>
    <div class="metric-row">
      <span><strong>{graph.perspectives.impact?.[focus.id] ?? 0}</strong>påvirkning</span>
      <span><strong>{percent(view.actuality.get(focus.id))}</strong>aktualitet</span>
      <span><strong>{focus.geo?`${focus.geo.distanceKm.toLocaleString('nb-NO')} km`:graph.countryOf.get(focus.id)==='norway'?'Norge':graph.byId.get(graph.countryOf.get(focus.id))?.geo?`${graph.byId.get(graph.countryOf.get(focus.id)).geo.distanceKm.toLocaleString('nb-NO')} km`:'–'}</strong>fra Oslo</span>
    </div>
    {#if otherLenses.length}<h3>Andre linser ser her</h3><div class="stack compact">{#each otherLenses as other}<button class="lens-switch" aria-pressed={other.lens.id===lensId} onclick={()=>chooseLens(other.lens.id)}><strong>{other.lens.name}</strong><small>{other.reason || other.lens.question}</small></button>{/each}</div>{/if}
    {#if neighbours.length}<h3>Naboland</h3><div class="chips">{#each neighbours as n}<button class="chip" onclick={()=>choose(n.id)}>{#if flagFor(n)}<Flag iso2={flagFor(n)} />{/if}{n.label}</button>{/each}</div>{/if}
    {#if related.length}<h3>{lensSees?`Gjennom ${lens.name.toLocaleLowerCase('nb')}`:'Sterkeste forbindelser'}</h3>{#if lens && !lensSees}<p class="muted detail">{lens.name} sier lite om {focus.label}. Forbindelsene er derfor ikke vektet gjennom linsen.</p>{/if}
      {#each related as r}<button class="entity-row" onclick={()=>choose(r.entity.id)}><span><small class="eyebrow">{relationLabel(r.relation.type)}{r.outgoing || SYMMETRIC.has(r.relation.type)?'':' · inngående'}</small><strong>{#if flagFor(r.entity)}<Flag iso2={flagFor(r.entity)} />{/if}{r.entity.label}</strong><small class="muted">{r.relation.context}</small></span></button>{/each}{/if}
    {#if focusNews.length}<h3>I nyhetene</h3>{#each focusNews as n}<p class="news-line"><small class="muted">{n.metadata.date} · {n.metadata.publisher}</small><br><button class="link-button" onclick={()=>choose(n.id)}>{n.label}</button></p>{/each}{/if}
    {#if focus.type==='news-event'}<p class="muted">{focus.metadata.background || ''}</p><a class="source-link" href={focus.metadata.url} target="_blank" rel="noreferrer">Les saken hos {focus.metadata.publisher} ↗</a>{/if}
    <div class="row wrap"><button class="secondary" onclick={()=>onOpen(focus.id)}>Åpne i biblioteket</button><button class="secondary" onclick={()=>{pathFrom=focus.id;document.querySelector('#world-path')?.scrollIntoView({behavior:'smooth'});}}>Finn sammenheng herfra</button></div>
  </div>
{/if}

<h2 class="section-title">{lens?'Det linsen ser først':'Mest relevant nå'}</h2>
<div class="card">{#each view.ranked.slice(0,rankedLimit) as e}<button class="entity-row ranked" onclick={()=>choose(e.id)}><span><small class="eyebrow">{typeLabel(e.type)}</small><strong>{#if flagFor(e)}<Flag iso2={flagFor(e)} />{/if}{e.label}</strong><span class="score-bar" style:width={`${Math.max(4,percent(view.scores.get(e.id)/(view.scores.get(view.ranked[0]?.id)||1)))}%`}></span></span></button>{/each}
  {#if view.ranked.length>rankedLimit}<button class="quiet" onclick={()=>rankedLimit+=10}>Vis flere</button>{/if}</div>
{#if lens}<button class="primary" onclick={()=>{const top=lensPracticeIds();onQuiz('mixed',{targetIds:null,entityIds:[...top],title:`Gjennom linsen: ${lens.name}`,depth:'advanced'});}}>Quiz gjennom denne linsen</button>{/if}

{#snippet endpoint(name,which)}
  {@const value=which==='from'?pathFrom:pathTo}{@const q=which==='from'?fromQuery:toQuery}
  <label>{name}{#if value}<span class="picked"><strong>{#if flagFor(graph.byId.get(value))}<Flag iso2={flagFor(graph.byId.get(value))} />{/if}{label(value)}</strong><button class="quiet" onclick={()=>setEndpoint(which,'')}>Endre</button></span>{:else}<input type="search" placeholder="Person, sted, idé eller nyhet" value={q} oninput={e=>{if(which==='from')fromQuery=e.currentTarget.value;else toQuery=e.currentTarget.value;}}>{#each matches(q) as m}<button class="entity-row" onclick={()=>setEndpoint(which,m.id)}><span><small class="eyebrow">{typeLabel(m.type)}</small><strong>{m.label}</strong></span></button>{/each}{/if}</label>
{/snippet}

<h2 class="section-title" id="world-path">Finn sammenhengen</h2>
<div class="card stack">
  {@render endpoint('Fra','from')}
  {@render endpoint('Til','to')}
  {#if pathFrom && pathTo}{#if path?.length}<ol class="path-list">{#each path as step}<li><small class="eyebrow">{relationLabel(step.relation.type)}</small><button class="link-button" onclick={()=>choose(step.to)}>{label(step.from)} → {label(step.to)}</button><small class="muted">{step.relation.context}</small></li>{/each}</ol><p class="muted detail">{path.length} steg. {lens?`Ruten foretrekker forbindelser som ${lens.name.toLocaleLowerCase('nb')} vektlegger.`:''} Store knutepunkter koster mer, så ruten går gjennom mer spesifikke forbindelser.</p>{:else}<p class="muted">Fant ingen sammenheng i nettverket.</p>{/if}{/if}
</div>

<h2 class="section-title">Aktuelt</h2>
<div class="card">
  <p class="muted detail">Nyheter per {new Date(`${graph.perspectives.news?.snapshotDate}T12:00:00Z`).toLocaleDateString('nb-NO',{day:'numeric',month:'long',year:'numeric'})}. Sakene teller mindre etter hvert som de blir eldre.</p>
  {#each graph.news.slice(0,8) as n}<button class="entity-row" onclick={()=>choose(n.id)}><span><small class="eyebrow">{n.metadata.date} · {n.metadata.publisher} · vekt {percent(newsWeight(n,now))}</small><strong>{#if flagFor(graph.byId.get(n.metadata.primaryEntityId))}<Flag iso2={flagFor(graph.byId.get(n.metadata.primaryEntityId))} />{/if}{n.label}</strong></span></button>{/each}
</div>

<h2 class="section-title">Lær verden på ti måter</h2>
<div class="format-grid world-formats">{#each WORLD_FORMAT_CHOICES as format}<button class="format-choice" disabled={!formatAvailable(format.id)} onclick={()=>onQuiz(format.id,{title:format.label,depth:'advanced'})}>{format.label}<small>{format.note}</small></button>{/each}</div>

<details class="card"><summary>Slik vektes verden</summary>{#each Object.entries(graph.perspectives.method || {}) as [key,text]}<p><strong>{({impact:'Påvirkning',locality:'Nærhet',actuality:'Aktualitet',borders:'Grenser'})[key] || key}.</strong> {text}</p>{/each}<p class="muted">Linsene er redaksjonelle tolkninger av historikernes perspektiver. De viser hva et blikk løfter fram, ikke hva som er sant.</p></details>
</div>
