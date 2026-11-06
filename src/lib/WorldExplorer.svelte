<script>
  import Flag from './Flag.svelte';
  import {lensView,relatedThrough,lensesFor,findPath,newsWeight,placeLinks,lensLinkWeights,METRIC_NOTES,DEFAULT_RELEVANCE} from './world-graph.js';
  import PanZoomMap from './PanZoomMap.svelte';
  import {pathBounds,parseBox,regionAnchor,regionFrame,unionBox,arrowGeometry} from './map-view.js';
  import {WORLD_FORMAT_CHOICES} from './quiz-formats.js';
  import {contentPlaces} from './content-places.js';
  import {PROJECTION_ICONS,LENS_ICON,HEAT_ICON} from './map-icons.js';
  import {PROJECTIONS,projectionById,worldFeatures,projectWorld,turnGlobe,rotationFor,globeDisc,dragRotation,interpolateRotation} from './projections.js';
  let {graph,dataset,relevance=$bindable({...DEFAULT_RELEVANCE}),typeLabel,relationLabel,onOpen,onQuiz,onSave,onUnit,formatAvailable}=$props();

  const STORE='atlas-world';
  const SYMMETRIC=new Set(['borders']);
  let saved={};
  try {saved=JSON.parse(localStorage.getItem(STORE) || '{}');} catch {saved={};}
  let lensId=$state(saved.lensId ?? 'geopolitics');
  let focusId=$state(saved.focusId || 'norway');
  // The heat map colours each country by how much of Atlas is tied to it, instead of by a lens.
  let heat=$state(saved.heat===true);
  // Switches for what the map draws over the countries: the sourced arrows and the dashed shared-topic lines.
  let showArrows=$state(saved.arrows!==false);
  let showTopics=$state(saved.topics!==false);
  let layerMenu=$state(false);
  const content=contentPlaces(graph);
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
  const focusFrame=id=>regionFrame(region=>world.regions.find(r=>r.id===region)?.path,regionOf(id),(graph.neighbours.get(id)||[]).map(n=>graph.byId.get(n)?.geo?.mapRegionId).filter(Boolean),parseBox(world.viewBox)[2]);
  // Each projection keeps its own view; the flat map opens on the focus country, the others show the whole world.
  const views={...(saved.views || {})};
  if(Array.isArray(saved.mapView) && !saved.views)views.standard=saved.mapView;
  let mapView=$state.raw(Array.isArray(views[startProjection])?views[startProjection]:startProjection==='standard'?focusFrame(saved.focusId || 'norway'):null);
  let projectionMenu=$state(false);
  let mapUnit=$state(1);
  let lensMenu=$state(false);
  // Once the learner starts working the map, the buttons on it shrink to their icon or flag so the map shows.
  // A tap on the flag shows the country's name for three seconds; the next touch on the map hides it again.
  let compact=$state(false),peek=$state(false),peekTimer=0;
  function interacted(){compact=true;peek=false;clearTimeout(peekTimer);}
  function showName(){peek=true;clearTimeout(peekTimer);peekTimer=setTimeout(()=>peek=false,3000);}
  function tapFocusPill(){
    if(compact && !peek && flagFor(focus)){showName();return;}
    document.querySelector('#world-focus')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  // The menus over the map stay out of the way: they close on a tap anywhere outside them, when the page
  // scrolls, and the switches a moment after the last change, so the map shows what changed.
  let menusClosedAt=0,layerTimer=0;
  function closeMenus(){lensMenu=false;projectionMenu=false;layerMenu=false;clearTimeout(layerTimer);}
  $effect(()=>{
    if(!lensMenu && !projectionMenu && !layerMenu)return;
    const outside=event=>{if(event.target.closest?.('.lens-menu,.projection-menu,.map-pill'))return;closeMenus();menusClosedAt=performance.now();};
    // Only a real scroll closes them, not the small shifts the page makes as it settles.
    const from=window.scrollY,scrolled=()=>{if(Math.abs(window.scrollY-from)>40)closeMenus();};
    const escape=event=>{if(event.key==='Escape')closeMenus();};
    document.addEventListener('pointerdown',outside,true);
    window.addEventListener('scroll',scrolled,{passive:true});
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('scroll',scrolled);document.removeEventListener('keydown',escape);};
  });
  function flipLayer(layer){
    layer.set(!layer.on);activeLink='';
    clearTimeout(layerTimer);
    layerTimer=setTimeout(()=>layerMenu=false,2500);
  }
  let worldMap=$state();
  let rankedLimit=$state(10);
  $effect(()=>{const state={lensId,focusId,heat,arrows:showArrows,topics:showTopics,pathFrom,pathTo,mapView,projection:projectionId,rotation,views:{...views,[projectionId]:mapView}};try {localStorage.setItem(STORE,JSON.stringify(state));} catch {/* The explorer still works without saved position. */}});

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
  // While the heat map is on no lens colours the map; the chosen lens comes back when it is turned off.
  let view=$derived(lensView(graph,heat?'':lensId,relevance,now));
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
  // Connections from the chosen place to other countries, drawn as arrows. Only the chosen place is
  // computed, and at most ten partners are drawn, so the map stays light.
  let places=$derived(focus?placeLinks(graph,focus.id,30,showTopics?content:null,{sourced:showArrows,lens}):{home:null,links:[],total:0});
  let inAtlas=$derived(focus?.geo?content.countries.get(focus.id):null);
  let topicLimit=$state(6);
  let activeLink=$state('');
  let active=$derived(places.links.find(l=>l.country===activeLink));
  const regionOfCountry=id=>graph.byId.get(id)?.geo?.mapRegionId;
  const anchorOf=id=>{const path=world.regions.find(r=>r.id===regionOfCountry(id))?.path;return path?regionAnchor(path):null;};
  let arcs=$derived.by(()=>{
    const from=places.home && anchorOf(places.home);
    if(!from)return [];
    // Arcs heading the same way (the USA to four European countries) bend by different amounts so they fan out.
    const seen=[];
    return places.links.map(link=>{
      const to=anchorOf(link.country);
      if(!to)return null;
      const angle=Math.atan2(to.y-from.y,to.x-from.x),near=seen.filter(a=>Math.abs(a-angle)<.35).length;
      seen.push(angle);
      const bend=(near%2?-1:1)*(.14+.05*Math.min(6,Math.ceil(near/2))),shape=link.out>=link.in?arrowGeometry(from,to,mapUnit,bend):arrowGeometry(to,from,mapUnit,-bend);
      // A shared topic has no direction: a dashed line without a head.
      const directed=link.out+link.in>0;
      // Under a lens that weights some kinds of line, the lines it does not weight are toned down.
      return {...link,directed,quiet:places.lensSees && !link.lensWeight,shaft:shape.shaft,tip:directed?shape.tip:'',width:1+1.4*Math.log10(1+link.count)};
    }).filter(Boolean);
  });
  const LENS_KIND_TEXT={nobel:'nobelpriser',ideas:'påvirkning mellom tenkere',news:'nyheter'};
  const joinNb=items=>items.length>1?`${items.slice(0,-1).join(', ')} og ${items.at(-1)}`:items[0] || '';
  // What the lens weights among the lines, in words: «nobelpriser og påvirkning mellom tenkere».
  let lensKinds=$derived(lens?joinNb(Object.entries(lensLinkWeights(lens)).filter(([kind,w])=>w>0 && LENS_KIND_TEXT[kind]).sort((a,b)=>b[1]-a[1]).map(([kind])=>LENS_KIND_TEXT[kind])):'');
  const KIND_NAMES={nobel:['Nobelpris-forbindelse','Nobelpris-forbindelser'],ideas:['påvirkning','påvirkninger'],news:['nyhet','nyheter'],topic:['felles emne','felles emner']};
  const kindText=link=>link.kinds.map(k=>`${k.count} ${KIND_NAMES[k.kind][k.count===1?0:1]}`).join(' · ');
  const directionText=link=>link.out&&link.in?' · begge veier':link.out?` · fra ${label(places.home)}`:link.in?` · til ${label(places.home)}`:'';
  const linkSign=link=>link.out&&link.in?'↔':link.out?'→':link.in?'←':'–';
  function selectLink(id,fly=false){
    activeLink=id;
    if(!fly)return;
    // The globe turns to the chosen place first; the far side of the globe is not drawn.
    if(projectionId==='globe'){spinTo(places.home);document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const box=unionBox([regionBounds(regionOfCountry(places.home)),regionBounds(regionOfCountry(id))],20);
    if(box)worldMap?.flyTo(box);
    document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showAllLinks(){
    if(projectionId==='globe'){activeLink='';spinTo(places.home);document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const box=unionBox([places.home,...places.links.map(l=>l.country)].map(id=>regionBounds(regionOfCountry(id))),20);
    activeLink='';
    if(box)worldMap?.flyTo(box);
    document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
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
    const partner=activeLink && world.regions.find(r=>r.id===regionOfCountry(activeLink) && r.path);
    if(partner && !labels.some(l=>l.id===activeLink))labels.push({id:activeLink,text:label(activeLink),at:regionAnchor(partner.path),main:false});
    return labels.filter(l=>l.at);
  });
  function choose(id,scroll=true){
    focusId=id;lensMenu=false;projectionMenu=false;layerMenu=false;activeLink='';topicLimit=6;
    if(compact)showName();
    if(projectionId==='globe')spinTo(id);
    else {const box=focusFrame(id);if(box)worldMap?.flyTo(box);}
    if(scroll)document.querySelector('.world-map')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function fill(regionId){
    const id=graph.regionToCountry.get(regionId);
    if(heat){
      const total=content.countries.get(id)?.total;
      if(!total)return 'var(--surface)';
      return `color-mix(in srgb, var(--accent) ${Math.round(10+85*Math.log1p(total)/Math.log1p(content.max))}%, var(--surface))`;
    }
    const value=view.countryScores.get(id);
    if(value===undefined)return 'var(--surface)';
    if(lens?.metric==='flow-balance'){const d=Math.abs(value-.5)*2;return `color-mix(in srgb, ${value>=.5?'var(--accent)':'var(--warm)'} ${Math.round(15+80*d)}%, var(--surface))`;}
    return `color-mix(in srgb, var(--accent) ${Math.round(8+87*value)}%, var(--surface))`;
  }
  function chooseLens(id){
    lensId=id;heat=false;const next=graph.lenses.find(l=>l.id===id);
    if(next){relevance={...next.weights};onSave?.();}
  }
  const matches=q=>q.trim().length<2?[]:graph.data.entities.filter(e=>e.type!=='award-event' && e.label.toLocaleLowerCase('nb').includes(q.toLocaleLowerCase('nb'))).sort((a,b)=>a.label.length-b.label.length).slice(0,5);
  function setEndpoint(which,id){if(which==='from'){pathFrom=id;fromQuery='';}else{pathTo=id;toQuery='';}}
  const lensPracticeIds=()=>{const top=new Set(view.ranked.slice(0,120).map(e=>e.id));return top;};
</script>



{#snippet layerDock()}
<button type="button" class="map-pill layer-pill" aria-label="Velg hva kartet viser" aria-expanded={layerMenu} aria-controls="layer-menu" onclick={()=>{const open=!layerMenu;closeMenus();layerMenu=open;}}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 3 7.5 4L10 11 2.5 7 10 3Z"/><path d="m2.5 10.5 7.5 4 7.5-4"/><path d="m2.5 14 7.5 4 7.5-4"/></svg></button>
{#if layerMenu}<div class="lens-menu layer-menu" id="layer-menu" role="group" aria-label="Vis på kartet">
  <p class="eyebrow">Vis på kartet</p>
  {#each [
    {on:showArrows,set:v=>showArrows=v,name:'Piler',note:'Kildebelagte forbindelser: nobelpriser, påvirkning og nyheter'},
    {on:showTopics,set:v=>showTopics=v,name:'Stiplede linjer',note:'Land som nevnes i samme emne i Atlas'},
    {on:heat,set:v=>heat=v,name:'Varmekart',note:'Farger landene etter hvor mye av Atlas som handler om dem, i stedet for linsen'}
  ] as layer (layer.name)}<button type="button" class="layer-option" role="switch" aria-checked={layer.on} onclick={()=>flipLayer(layer)}><span><strong>{layer.name}</strong><small>{layer.note}</small></span><span class="switch" aria-hidden="true"></span></button>{/each}
</div>{/if}
{/snippet}
{#snippet pillIcon(markup)}<svg class="pill-icon" viewBox="0 0 20 20" aria-hidden="true">{@html markup}</svg>{/snippet}
{#snippet chevron(open)}<svg class="pill-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d={open?'M5 12.5 10 7.5l5 5':'m5 7.5 5 5 5-5'}/></svg>{/snippet}
{#snippet lensDock()}
<button type="button" class="map-pill lens-pill" class:compact={compact && !lensMenu} aria-expanded={lensMenu} aria-controls="lens-menu" aria-label={heat?'Farge: Innhold i Atlas':`Linse: ${lens?.name || 'Ingen'}`} onclick={()=>{lensMenu=!lensMenu;projectionMenu=false;layerMenu=false;}}>{@render pillIcon(heat?HEAT_ICON:LENS_ICON)}<span class="pill-label">{heat?'Innhold i Atlas':lens?.name || 'Ingen'}</span>{@render chevron(lensMenu)}</button>
{#if lensMenu}<div class="lens-menu" id="lens-menu" role="group" aria-label="Velg historiesyn">
  <button type="button" class="lens-option" aria-pressed={!lensId && !heat} onclick={()=>{lensId='';heat=false;lensMenu=false;}}>Ingen linse</button>
  {#each graph.lenses as l}<button type="button" class="lens-option" aria-pressed={!heat && lensId===l.id} onclick={()=>{chooseLens(l.id);lensMenu=false;}}>{l.name}</button>{/each}
</div>{/if}
{/snippet}
{#snippet projectionDock()}
<button type="button" class="map-pill projection-pill" class:compact={compact && !projectionMenu} aria-expanded={projectionMenu} aria-controls="projection-menu" aria-label={`Kart: ${projection.name}`} onclick={()=>{projectionMenu=!projectionMenu;lensMenu=false;layerMenu=false;}}>{@render pillIcon(PROJECTION_ICONS[projectionId])}<span class="pill-label">{projection.name}</span>{@render chevron(projectionMenu)}</button>
{#if projectionMenu}<div class="projection-menu" id="projection-menu" role="group" aria-label="Velg kartprojeksjon">
  {#each PROJECTIONS as p}<button type="button" class="lens-option projection-option" aria-pressed={projectionId===p.id} onclick={()=>setProjection(p.id)}>{@render pillIcon(PROJECTION_ICONS[p.id])}<span>{p.name}<small>{p.kind}</small></span></button>{/each}
</div>{/if}
{/snippet}
{#snippet focusPill()}{#if focus}<button class="map-pill focus-pill" class:compact={compact && !peek && Boolean(flagFor(focus))} aria-label={`${focus.label}, gå til omtalen under kartet`} onclick={tapFocusPill}>{#if flagFor(focus)}<Flag iso2={flagFor(focus)} />{/if}<span class="pill-label">{focus.label}</span><span class="pill-down" aria-hidden="true">↓</span></button>{/if}{/snippet}
<div class="world-explorer atlas-kart">
{#snippet linkCard()}{#if active}<div class="link-card" role="status">
  <button type="button" class="link-close" aria-label="Lukk forbindelsen" onclick={()=>activeLink=''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
  <p class="eyebrow">{label(places.home)} {linkSign(active)} {label(active.country)}</p>
  <strong>{kindText(active)}</strong>
  {#if places.lensSees}<p class="muted link-lens">{active.lensWeight?`${lens.name} legger vekt på dette.`:`${lens.name} sier lite om dette.`}</p>{/if}
  <p>{active.examples[0].context}</p>
  {#if active.examples.some(e=>e.kind!=='topic') && active.examples.length>1}<p class="muted">Også: {active.examples.slice(1).filter(e=>e.kind!=='topic').map(e=>e.label).join(', ') || '–'}</p>{/if}
  {#if active.examples.some(e=>e.kind==='topic')}<p class="link-topics">{#each active.examples.filter(e=>e.kind==='topic') as e}<button type="button" class="link-button" onclick={()=>onUnit?.(e.unitId)}>«{e.label}»</button>{/each}</p>{/if}
  <button type="button" class="link-go" onclick={()=>choose(active.country,false)}>Gå til {label(active.country)} →</button>
</div>{/if}{/snippet}
{#snippet mapHud()}{@render focusPill()}{@render projectionDock()}{@render layerDock()}{@render lensDock()}{@render linkCard()}{/snippet}
{#key projectionId}
<PanZoomMap bind:this={worldMap} base={world.viewBox} bind:view={mapView} bind:unit={mapUnit} className={`world-map${projectionId==='standard'?'':' projected'}`} label={`Verdenskart${projectionId==='standard'?'':` i projeksjonen ${projection.name}`} vektet ${lens?`gjennom ${lens.name}`:'etter relevans'}. ${projectionId==='globe'?'Dra for å snu kloden, knip for å zoome':'Dra og knip for å utforske'}, trykk på et land.`} onTap={({region})=>{if(lensMenu || projectionMenu || layerMenu || performance.now()-menusClosedAt<800){closeMenus();return;}const id=graph.regionToCountry.get(region);if(!id)return;if(activeLink!==id && places.links.some(l=>l.country===id)){selectLink(id);return;}choose(id,false);}} onInteract={interacted} onDragStart={globeDragStart} onDragMove={globeDragMove} onDragEnd={globeDragEnd} overlay={mapHud}>
    {#if world.sphere}<defs><clipPath id="map-sphere-clip"><path d={world.sphere} /></clipPath>{#if disc}<radialGradient id="globe-shade" cx="42%" cy="38%" r="62%"><stop offset="0" class="shade-light" /><stop offset="1" class="shade-dark" /></radialGradient>{/if}</defs><path class="map-sphere" d={world.sphere} />{/if}
    {#if world.graticule}<path class="map-graticule" d={world.graticule} clip-path={world.sphere?'url(#map-sphere-clip)':null} />{/if}
    {#each world.regions as region (region.id)}{#if region.path}<path d={region.path} data-region={region.id} fill-rule="evenodd" style:fill={fill(region.id)} class:focused={focusRegion===region.id} class:neighbour={neighbours.some(n=>n.geo?.mapRegionId===region.id)} />{/if}{/each}
    {#if disc}<circle class="globe-shade" cx={disc.x} cy={disc.y} r={disc.r} fill="url(#globe-shade)" />{/if}
    {#if arcs.length}<g class="map-links" class:has-active={Boolean(active)} aria-hidden="true">{#each arcs as a (a.country)}<g class="map-link" class:active={a.country===activeLink} class:shared={!a.directed} class:quiet={a.quiet}><path class="link-casing" d={a.shaft} style:stroke-width={`${a.width+2.5}px`} /><path class="link-shaft" d={a.shaft} style:stroke-width={`${a.width}px`} />{#if a.tip}<path class="link-tip" d={a.tip} />{/if}</g>{/each}</g>{/if}
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

<p class="muted map-note">{heat?'Mørkere farge: flere emner, spørsmål, personer og steder i Atlas knyttet til landet slik det er i dag. Historiske riker er ikke oversatt til dagens land med mindre teksten nevner landet.':lens?.metric?METRIC_NOTES[lens.metric]:'Mørkere farge: mer av det linsen ser, knyttet til landet og vektet etter relevans.'} Trykk på et land.</p>

{#if focus}
  <div class="card focus-card" id="world-focus">
    <div class="focus-head">{#if flagFor(focus)}<span class="focus-flag"><Flag iso2={flagFor(focus)} size="medium" /></span>{/if}<div><p class="eyebrow">{typeLabel(focus.type)}</p><h2>{focus.label}</h2></div></div>
    <p>{focus.summary}</p>
    <div class="metric-row">
      <span><strong>{graph.perspectives.impact?.[focus.id] ?? 0}</strong>påvirkning</span>
      <span><strong>{percent(view.actuality.get(focus.id))}</strong>aktualitet</span>
      <span><strong>{focus.geo?`${focus.geo.distanceKm.toLocaleString('nb-NO')} km`:graph.countryOf.get(focus.id)==='norway'?'Norge':graph.byId.get(graph.countryOf.get(focus.id))?.geo?`${graph.byId.get(graph.countryOf.get(focus.id)).geo.distanceKm.toLocaleString('nb-NO')} km`:'–'}</strong>fra Oslo</span>
    </div>
    {#if inAtlas}<h3>I Atlas</h3><p class="muted detail">{inAtlas.topics.length} {inAtlas.topics.length===1?'emne':'emner'} · {inAtlas.questions.length} spørsmål · {inAtlas.entities} {inAtlas.entities===1?'person, sted eller verk':'personer, steder og verk'}</p>
      {#if inAtlas.topics.length}<div class="chips">{#each inAtlas.topics.slice(0,topicLimit) as unitId}<button class="chip" onclick={()=>onUnit?.(unitId)}>{label(`unit:${unitId}`)}</button>{/each}{#if inAtlas.topics.length>topicLimit}<button class="chip quiet" onclick={()=>topicLimit=inAtlas.topics.length}>+{inAtlas.topics.length-topicLimit} til</button>{/if}</div>{/if}
      {#if inAtlas.questions.length}<div class="row wrap"><button class="secondary" onclick={()=>onQuiz('mixed',{targetIds:inAtlas.questions,title:`Spørsmål om ${focus.label}`})}>Øv på spørsmål om {focus.label}</button></div>{/if}{/if}
    {#if otherLenses.length}<h3>Andre linser ser her</h3><div class="stack compact">{#each otherLenses as other}<button class="lens-switch" aria-pressed={other.lens.id===lensId} onclick={()=>chooseLens(other.lens.id)}><strong>{other.lens.name}</strong><small>{other.reason || other.lens.question}</small></button>{/each}</div>{/if}
    {#if places.links.length}<h3>Forbindelser på kartet</h3><p class="muted detail">{[showArrows && `Pilene viser kildebelagte forbindelser fra ${focus.label} til andre land: nobelprisvinnere og hvor de arbeidet, påvirkning mellom tenkere, og nyheter.`, showTopics && 'Stiplede linjer er land som nevnes i samme emne i Atlas.', places.lensSees?`${lens.name} legger vekt på ${lensKinds}. De står først, og de andre linjene er tonet ned.`:lens && (showArrows || showTopics)?`${lens.name} sier lite om disse forbindelsene, så alle vises likt.`:'', 'Trykk på et land med linje for å se forbindelsen, og trykk igjen for å gå dit.'].filter(Boolean).join(' ')}</p>
      {#each places.links as link (link.country)}<button class="entity-row link-row" class:quiet={places.lensSees && !link.lensWeight} aria-pressed={link.country===activeLink} onclick={()=>selectLink(link.country,true)}><span><small class="eyebrow">{kindText(link)}{directionText(link)}</small><strong>{#if flagFor(graph.byId.get(link.country))}<Flag iso2={flagFor(graph.byId.get(link.country))} />{/if}{label(link.country)}</strong><small class="muted">{link.examples[0].context}</small></span></button>{/each}
      <div class="row wrap"><button class="secondary" onclick={showAllLinks}>Vis alle {places.links.length} på kartet</button></div>{#if places.total>places.links.length}<p class="muted detail">Viser de {places.links.length} sterkeste av {places.total}.</p>{/if}{/if}
    {#if focus.geo && !showArrows && !showTopics}<h3>Forbindelser på kartet</h3><p class="muted detail">Pilene og de stiplede linjene er slått av.</p><div class="row wrap"><button class="secondary" onclick={()=>{showArrows=true;showTopics=true;}}>Slå på forbindelser</button></div>{/if}
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
