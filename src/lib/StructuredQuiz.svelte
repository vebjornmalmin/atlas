<script>
  import {buildTimelineExercise} from './exercises.js';
  import Flag from './Flag.svelte';
  import PanZoomMap from './PanZoomMap.svelte';
  import MatchLines from './MatchLines.svelte';
  import EstimateTimeline from './EstimateTimeline.svelte';
  import ThemeQuiz from './ThemeQuiz.svelte';
  import ListeningQuiz from './ListeningQuiz.svelte';
  import TimeDistanceQuiz from './TimeDistanceQuiz.svelte';
  import {TIME_ANCHORS} from '../../knowledge-build/time-anchors.mjs';
  import {regionAnchor,pathBounds,unionBox,arrowGeometry} from './map-view.js';
  let {target,draft=$bindable({}),dataset,revealed=false,graph=null}= $props();

  // Shared: anchors for every region used by the exercise.
  const anchors=$derived.by(()=>{
    const ids=new Set([...(target.regions||[]).map(r=>r.id)]);
    return new Map((dataset?.regions||[]).filter(r=>ids.has(r.id)).map(r=>[r.id,regionAnchor(r.path)]));
  });
  let unit=$state(.2);

  // Matching: answers in a stable shuffled order.
  const choices=$derived(target.pairs ? buildTimelineExercise({id:target.id,items:target.pairs.map((p,i)=>({...p,year:i}))}).items : []);

  // Arrows: drag from one country to another; tapping two countries also works.
  let drawing=$state(null);
  const candidates=$derived(new Set((target.regions||[]).map(r=>r.id)));
  const labelOf=id=>target.regions?.find(r=>r.id===id)?.label || id;
  function candidateAt(point,element){
    const id=element?.closest?.('[data-region]')?.dataset.region;
    if(id && candidates.has(id))return id;
    let best=null,distance=28*unit;
    for(const [rid,a] of anchors){const d=Math.hypot(a.x-point.x,a.y-point.y);if(d<distance){best=rid;distance=d;}}
    return best;
  }
  const arrowStart=(point,element)=>{if(revealed)return false;const id=candidateAt(point,element);if(!id)return false;drawing={from:id,cursor:null,over:null};return true;};
  const arrowMove=(point,element)=>{if(drawing){const over=candidateAt(point,element);drawing={...drawing,cursor:point,over:over!==drawing.from?over:null};}};
  const arrowEnd=(point,element,cancelled)=>{
    const d=drawing;drawing=null;
    if(!d?.cursor || cancelled || !point)return;
    const to=candidateAt(point,element);
    if(to && to!==d.from)draft={...draft,from:d.from,to};
  };
  function tapCountry({region}){
    if(revealed || !candidates.has(region))return;
    draft=draft.from && !draft.to && region!==draft.from?{...draft,to:region}:{...draft,from:region,to:''};
  }
  const arrowView=$derived(target.mode==='arrows'?unionBox([...anchors.values()].map(a=>[a.x,a.y,0,0]),14,40):null);
  const arrowPath=(a,b,extra=1)=>a&&b?arrowGeometry(a,b,unit*extra):null;

  // Border walk: tap a neighbouring country on the map, or use the list.
  const walk=$derived(target.mode==='border-walk'?[target.start,...(draft.path||[])]:[]);
  const here=$derived(walk.at(-1));
  const nextSteps=$derived(here && graph?(graph.neighbours.get(here)||[]).map(id=>graph.byId.get(id)).sort((a,b)=>a.label.localeCompare(b.label,'nb')):[]);
  const regionOf=id=>graph?.byId.get(id)?.geo?.mapRegionId;
  const walkView=$derived.by(()=>{
    if(target.mode!=='border-walk' || !dataset)return null;
    const ids=[...walk,target.goal,...nextSteps.map(n=>n.id)].map(regionOf).filter(Boolean);
    return unionBox(dataset.regions.filter(r=>ids.includes(r.id)).map(r=>pathBounds(r.path,true)),6,30);
  });
  function stepTo({region}){
    if(revealed || here===target.goal)return;
    const next=nextSteps.find(n=>regionOf(n.id)===region);
    if(next)draft={...draft,path:[...(draft.path||[]),next.id]};
  }
</script>

{#if target.mode==='matching'}
  <MatchLines pairs={target.pairs} {choices} bind:draft {revealed} />
{:else if target.mode==='theme'}
  <ThemeQuiz {target} bind:draft {revealed} />
{:else if target.mode==='listen'}
  <ListeningQuiz {target} bind:draft {revealed} />
{:else if target.mode==='distance'}
  <TimeDistanceQuiz {target} bind:draft {revealed} anchors={TIME_ANCHORS} />
{:else if target.mode==='estimate'}
  <EstimateTimeline {target} bind:draft {revealed} />
{:else if target.mode==='pick'}
  <div class="flag-choices">{#each target.choices as choice}<button class="flag-choice" aria-pressed={draft.choice===choice.id} aria-label={revealed?choice.label:'Flaggalternativ'} disabled={revealed} onclick={()=>draft={choice:choice.id}}><Flag iso2={choice.iso2} size="choice" />{#if revealed}<small class:success={choice.id===target.correctId}>{choice.label}</small>{/if}</button>{/each}</div>
{:else if target.mode==='border-walk' && graph && dataset}
  <PanZoomMap base={dataset.viewBox} initial={walkView} bind:unit label="Reiseruten. Trykk på et naboland for å gå dit." className="walk-board" onTap={stepTo}>
    {#each dataset.regions as region}{@const step=nextSteps.some(n=>regionOf(n.id)===region.id)}<path d={region.path} data-region={region.id} fill-rule="evenodd" class:walked={walk.some(id=>regionOf(id)===region.id)} class:goal={regionOf(target.goal)===region.id} class:here={regionOf(here)===region.id} class:step={!revealed && step && here!==target.goal} />{/each}
  </PanZoomMap>
  <p class="walk-route">{#each walk as id,i}<span><Flag iso2={graph.byId.get(id).iso2} />{graph.byId.get(id).label}</span>{#if i<walk.length-1}<span aria-hidden="true"> → </span>{/if}{/each}</p>
  {#if !revealed && here!==target.goal}<p class="muted map-note">Du er i {graph.byId.get(here).label}. Mål: <Flag iso2={graph.byId.get(target.goal).iso2} />{graph.byId.get(target.goal).label}. {walk.length-1} av {target.shortest} grenser krysset. Trykk på et uthevet naboland.</p>
    <details class="neighbour-list"><summary>Velg fra liste</summary><div class="neighbour-grid">{#each nextSteps as next}<button class="secondary" onclick={()=>draft={...draft,path:[...(draft.path||[]),next.id]}}><Flag iso2={next.iso2} />{next.label}</button>{:else}<p class="muted">Ingen landegrenser herfra på kartet.</p>{/each}</div></details>{/if}
  {#if !revealed && walk.length>1}<button class="quiet" onclick={()=>draft={...draft,path:(draft.path||[]).slice(0,-1)}}>Angre siste steg</button>{/if}
{:else if target.mode==='before-after'}
  <div class="stack">{#each target.items as item}<button class="secondary" aria-pressed={draft.first===item.id} disabled={revealed} onclick={()=>draft={first:item.id}}>{item.label}</button>{/each}</div>
{:else if target.mode==='arrows' && dataset}
  <PanZoomMap base={dataset.viewBox} initial={arrowView} bind:unit label="Tegn pilen: dra fra ett land til et annet" className="arrow-board"
    onTap={tapCountry} onDragStart={arrowStart} onDragMove={arrowMove} onDragEnd={arrowEnd}>
    {#each dataset.regions as region}<path d={region.path} data-region={candidates.has(region.id)?region.id:undefined} fill-rule="evenodd"
      class:candidate={candidates.has(region.id)} class:from={(drawing?.from ?? draft.from)===region.id} class:to={(drawing?.over ?? draft.to)===region.id} />{/each}
    {#if revealed && (draft.from!==target.from || draft.to!==target.to)}{@const right=arrowPath(anchors.get(target.from),anchors.get(target.to))}{#if right}<g class="arrow correct"><path class="shaft" d={right.shaft}/><path class="tip" d={right.tip}/></g>{/if}{/if}
    {#if drawing?.cursor}{@const live=arrowPath(anchors.get(drawing.from),drawing.over?anchors.get(drawing.over):drawing.cursor)}{#if live}<g class="arrow live"><path class="shaft" d={live.shaft}/><path class="tip" d={live.tip}/></g>{/if}
    {:else if draft.from && draft.to}{@const mine=arrowPath(anchors.get(draft.from),anchors.get(draft.to))}{#if mine}<g class="arrow" class:wrong={revealed && (draft.from!==target.from || draft.to!==target.to)} class:right={revealed && draft.from===target.from && draft.to===target.to}><path class="shaft" d={mine.shaft}/><path class="tip" d={mine.tip}/></g>{/if}{/if}
    {#each target.regions as region}{@const a=anchors.get(region.id)}{#if a}<g class="country-pin" class:active={draft.from===region.id || draft.to===region.id}><circle cx={a.x} cy={a.y} r={4.5*unit}/><text x={a.x} y={a.y-8*unit} font-size={11*unit} text-anchor="middle">{region.label}</text></g>{/if}{/each}
  </PanZoomMap>
  <p class="muted map-note">{revealed?'Grønn pil: riktig retning.':draft.from && !draft.to?`Fra ${labelOf(draft.from)}. Dra eller trykk på landet pilen skal til.`:draft.to?`${labelOf(draft.from)} → ${labelOf(draft.to)}. Dra en ny pil for å endre.`:'Dra fra ett land til et annet. Dagens grenser, forenklet retning.'}</p>
  <div class="sr-only" role="group" aria-label="Velg land med tastatur">{#each target.regions as r}<button type="button" disabled={revealed} onclick={()=>tapCountry({region:r.id})}>{r.label}{draft.from===r.id?' (fra)':draft.to===r.id?' (til)':''}</button>{/each}</div>
  {#if target.askYear!==false}<label class="arrow-year">År<input class="recall-year" inputmode="numeric" placeholder="Årstall" value={draft.year || ''} disabled={revealed} oninput={e=>draft={...draft,year:e.currentTarget.value}} /></label>{/if}
{/if}
