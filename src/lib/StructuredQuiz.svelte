<script>
  import {buildTimelineExercise} from './exercises.js';
  import {flagEmoji} from './world-graph.js';
  let {target,draft=$bindable({}),dataset,revealed=false,graph=null}= $props();
  const walk=$derived(target.mode==='border-walk'?[target.start,...(draft.path||[])]:[]);
  const here=$derived(walk.at(-1));
  const nextSteps=$derived(here && graph?(graph.neighbours.get(here)||[]).map(id=>graph.byId.get(id)).sort((a,b)=>a.label.localeCompare(b.label,'nb')):[]);
  const regionOf=id=>graph?.byId.get(id)?.geo?.mapRegionId;
  function walkBounds(){
    const ids=[...walk,target.goal].map(regionOf).filter(Boolean);
    const numbers=dataset.regions.filter(r=>ids.includes(r.id)).flatMap(r=>r.path.split(/(?=M)/).sort((a,b)=>b.length-a.length)[0].match(/-?\d+(?:\.\d+)?/g).map(Number));
    const xs=numbers.filter((_,i)=>i%2===0),ys=numbers.filter((_,i)=>i%2===1);
    const pad=8,x=Math.min(...xs)-pad,y=Math.min(...ys)-pad,w=Math.max(40,Math.max(...xs)-x+pad),h=Math.max(30,Math.max(...ys)-y+pad);
    return `${x} ${y} ${w} ${h}`;
  }
  let drawing=$state(false);
  let cursor=$state(null);
  const choices=$derived(target.pairs ? buildTimelineExercise({id:target.id,items:target.pairs.map((p,i)=>({...p,year:i}))}).items : []);
  const from=$derived(target.regions?.find(r=>r.id===draft.from));
  const to=$derived(target.regions?.find(r=>r.id===draft.to));
  function choose(id){if(revealed)return;draft=draft.from && !draft.to?{...draft,to:id}:{...draft,from:id,to:''};}
  function point(event){const svg=event.currentTarget;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  function start(event){if(revealed)return;const id=event.target.closest('[data-country]')?.dataset.country;if(!id)return;event.preventDefault();drawing=true;cursor=point(event);draft={...draft,from:id,to:''};event.currentTarget.setPointerCapture(event.pointerId);}
  function finish(event){if(!drawing)return;const p=point(event);const nearest=target.regions.map(r=>({id:r.id,d:Math.hypot(r.x-p.x,r.y-p.y)})).sort((a,b)=>a.d-b.d)[0];if(nearest.d<5 && nearest.id!==draft.from)draft={...draft,to:nearest.id};drawing=false;cursor=null;}
</script>
{#if target.mode==='matching'}
  <div class="pair-list">{#each target.pairs as pair,i}<label><span>{i+1}. {pair.label}</span><select disabled={revealed} value={draft[pair.id] || ''} onchange={e=>draft={...draft,[pair.id]:e.currentTarget.value}}><option value="">Velg et svar</option>{#each choices as choice}<option value={choice.id} disabled={target.pairs.some(p=>p.id!==pair.id && draft[p.id]===choice.id)}>{choice.answer}</option>{/each}</select></label>{/each}</div>
{:else if target.mode==='pick'}
  <div class="flag-choices">{#each target.choices as choice}<button class="flag-choice" aria-pressed={draft.choice===choice.id} aria-label={revealed?choice.label:'Flaggalternativ'} disabled={revealed} onclick={()=>draft={choice:choice.id}}><span class="flag-glyph" aria-hidden="true">{choice.flag}</span>{#if revealed}<small class:success={choice.id===target.correctId}>{choice.label}</small>{/if}</button>{/each}</div>
{:else if target.mode==='border-walk' && graph && dataset}
  <div class="map-board walk-board"><svg viewBox={walkBounds()} role="img" aria-label="Reiseruten på kartet">{#each dataset.regions as region}<path d={region.path} fill-rule="evenodd" class:walked={walk.some(id=>regionOf(id)===region.id)} class:goal={regionOf(target.goal)===region.id} class:here={regionOf(here)===region.id} />{/each}</svg></div>
  <p class="walk-route">{#each walk as id,i}<span>{flagEmoji(graph.byId.get(id).iso2)} {graph.byId.get(id).label}</span>{#if i<walk.length-1}<span aria-hidden="true"> → </span>{/if}{/each}</p>
  {#if !revealed && here!==target.goal}<p class="muted map-note">Du er i {graph.byId.get(here).label}. Mål: {flagEmoji(graph.byId.get(target.goal).iso2)} {graph.byId.get(target.goal).label}. {walk.length-1} av {target.shortest} grenser krysset.</p>
    <div class="neighbour-grid">{#each nextSteps as next}<button class="secondary" onclick={()=>draft={...draft,path:[...(draft.path||[]),next.id]}}>{flagEmoji(next.iso2)} {next.label}</button>{:else}<p class="muted">Ingen landegrenser herfra på kartet.</p>{/each}</div>{/if}
  {#if !revealed && walk.length>1}<button class="quiet" onclick={()=>draft={...draft,path:(draft.path||[]).slice(0,-1)}}>Angre siste steg</button>{/if}
{:else if target.mode==='before-after'}
  <div class="stack">{#each target.items as item}<button class="secondary" aria-pressed={draft.first===item.id} disabled={revealed} onclick={()=>draft={first:item.id}}>{item.label}</button>{/each}</div>
{:else if target.mode==='arrows' && dataset}
  <p class="muted map-note">Dagens grenser · forenklet retning. Dra eller velg land.</p>
  <div class="map-board arrow-board"><svg viewBox="335 24 80 66" role="group" aria-label="Tegn en historisk forbindelse på Europakartet" onpointerdown={start} onpointermove={e=>{if(drawing)cursor=point(e);}} onpointerup={finish} onpointercancel={()=>{drawing=false;cursor=null;}}>
    <defs><marker id="arrow-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" /></marker></defs>
    {#each dataset.regions as region}<path d={region.path} fill-rule="evenodd" />{/each}
    {#if from && (to || cursor)}<line x1={from.x} y1={from.y} x2={to?.x ?? cursor.x} y2={to?.y ?? cursor.y} marker-end="url(#arrow-tip)" />{/if}
    {#each target.regions as region}<g data-country={region.id} role="button" tabindex={revealed?-1:0} aria-label={region.label} aria-pressed={draft.from===region.id || draft.to===region.id} onkeydown={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(region.id);}}}><circle cx={region.x} cy={region.y} r="3.4" class:selected={draft.from===region.id || draft.to===region.id} /><text x={region.x} y={region.y-4.5} text-anchor="middle">{region.label}</text></g>{/each}
  </svg></div>
  <div class="arrow-controls"><label>Fra<select disabled={revealed} value={draft.from || ''} onchange={e=>draft={...draft,from:e.currentTarget.value}}><option value="">Velg land</option>{#each target.regions as r}<option value={r.id}>{r.label}</option>{/each}</select></label><label>Til<select disabled={revealed} value={draft.to || ''} onchange={e=>draft={...draft,to:e.currentTarget.value}}><option value="">Velg land</option>{#each target.regions as r}<option value={r.id}>{r.label}</option>{/each}</select></label>
  <label>År<input class="recall-year" inputmode="numeric" placeholder="Årstall" value={draft.year || ''} disabled={revealed} oninput={e=>draft={...draft,year:e.currentTarget.value}} /></label></div>
{/if}
