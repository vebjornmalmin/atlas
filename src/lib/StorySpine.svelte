<script>
  // The curriculum as one story through time. The full line is logarithmic, so the crowded recent
  // centuries get room; each unit is a span stacked in lanes, coloured by how well it sits.
  // Drag along the line to see what was under way in a year, tap a span to select it, pick an era
  // to zoom in, or a subject to highlight it. Timeless units follow the dated list.
  import {ERAS,eraOf,yearSpan,storyCursor,STORY_VIEW,eraView,storyPosition,storyYear,storyTicks,storyLanes,unitsAt,concurrentUnits} from './story.js';
  import {formatYear} from './core-curriculum.js';
  import {UNIT_STATUS} from './progression.js';
  let {curriculum,progress,highlight=[],compact=false,onOpen=()=>{}}=$props();
  const LANE=8, TOP=22;
  const domainTitle=id=>curriculum.domains.find(d=>d.id===id)?.title || '';
  const dated=$derived(curriculum.units.filter(u=>u.years).sort((a,b)=>a.years.from-b.years.from || a.years.to-b.years.to));
  const timeless=$derived(curriculum.domains.map(d=>({domain:d,units:curriculum.units.filter(u=>!u.years && u.domainId===d.id)})).filter(g=>g.units.length));
  const datedDomains=$derived(curriculum.domains.filter(d=>dated.some(u=>u.domainId===d.id)));
  const cursor=$derived(storyCursor(curriculum,progress));
  const status=id=>progress.units.get(id)?.status || 'new';
  const pct=x=>`${(x*100).toFixed(2)}%`;
  const label=year=>year<0?`${-year} f.Kr.`:String(year);

  let zoom=$state(''), domain=$state(''), selectedId=$state(''), scrubYear=$state(null), hoverYear=$state(null);
  let chartEl=$state(), width=$state(0), drag=null;
  const view=$derived(zoom?eraView(ERAS.find(e=>e.id===zoom)):STORY_VIEW);
  const lanes=$derived(storyLanes(dated,view,width||360));
  const chartHeight=$derived(TOP+lanes.lanes*LANE+30);
  const ticks=$derived(storyTicks(view));
  const bands=$derived(ERAS.filter(e=>e.to>=view.from && e.from<=view.to).map((era,i)=>{const x=storyPosition(Math.max(era.from,view.from),view), end=storyPosition(Math.min(era.to+1,view.to),view);return {era,i,x,w:end-x};}));
  const readYear=$derived(hoverYear ?? scrubYear);
  const underway=$derived(readYear===null?[]:unitsAt(domain?dated.filter(u=>u.domainId===domain):dated,readYear));
  const selected=$derived(dated.find(u=>u.id===selectedId) || null);
  const alongside=$derived(selected?concurrentUnits(selected,dated):[]);
  const alongsideIds=$derived(new Set(alongside.map(u=>u.id)));
  const dim=unit=>(domain && unit.domainId!==domain) || (readYear!==null && !(unit.years.from<=readYear && unit.years.to>=readYear)) || (!!selected && unit.id!==selected.id && !alongsideIds.has(unit.id));
  const groups=$derived(ERAS.filter(era=>!zoom || era.id===zoom).map(era=>({era,units:dated.filter(u=>eraOf(u.years.from).id===era.id && (!domain || u.domainId===domain))})).filter(g=>g.units.length));
  const timelessShown=$derived(zoom?[]:timeless.filter(g=>!domain || g.domain.id===domain));

  function select(id){selectedId=id; scrubYear=null; hoverYear=null;}
  function setZoom(id){zoom=id; scrubYear=null; if(selected && id){const v=eraView(ERAS.find(e=>e.id===id)); if(selected.years.to<v.from || selected.years.from>v.to) selectedId='';}}
  function point(e){const r=chartEl.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:e.clientY-r.top,px:e.clientX-r.left};}
  function hit({px,y}){
    let best=null, score=Infinity;
    for (const row of lanes.rows) {
      const left=row.x*width, right=left+row.w*width, dx=px<left?left-px:px>right?px-right:0, dy=Math.abs(TOP+row.lane*LANE+2-y);
      if (dx<16 && dy<18 && dx+dy*.7<score) {best=row; score=dx+dy*.7;}
    }
    return best;
  }
  function down(e){drag={x0:e.clientX,moved:false}; if(e.pointerType==='mouse') chartEl.setPointerCapture(e.pointerId);}
  function move(e){
    const p=point(e);
    if (drag) { if (Math.abs(e.clientX-drag.x0)>6) drag.moved=true; if (drag.moved) {selectedId=''; scrubYear=storyYear(p.x,view);} }
    else if (e.pointerType==='mouse') hoverYear=storyYear(p.x,view);
  }
  function up(e){
    if (drag && !drag.moved) { const row=hit(point(e)); if (row) select(row.unit.id===selectedId?'':row.unit.id); else {selectedId=''; scrubYear=storyYear(point(e).x,view);} }
    drag=null;
  }
  function key(e){
    const step={ArrowLeft:-.01,ArrowRight:.01,PageDown:-.1,PageUp:.1}[e.key];
    if (step) { e.preventDefault(); selectedId=''; scrubYear=storyYear(storyPosition(readYear ?? cursor ?? view.from,view)+step,view); }
    else if (e.key==='Home' || e.key==='End') { e.preventDefault(); selectedId=''; scrubYear=e.key==='Home'?view.from:view.to; }
    else if (e.key==='Escape') { scrubYear=null; selectedId=''; }
  }
</script>

{#if compact}
  <div class="story-strip compact" aria-hidden="true">
    <span class="story-line"></span>
    {#each [-3000,0,1000,1500,1800,1900,2000] as tick}<span class="story-tick" style:left={pct(storyPosition(tick))}><small>{label(tick)}</small></span>{/each}
    {#each dated as unit}<span class="story-dot" data-status={status(unit.id)} class:today={highlight.includes(unit.id)} style:left={pct(storyPosition(unit.years.from))}></span>{/each}
    {#if cursor!==null}<span class="story-cursor" style:left={pct(storyPosition(cursor))}><small>Du er her</small></span>{/if}
  </div>
{:else}
  <section class="tl" aria-label="Tidslinje">
    <div class="chips scroll tl-eras" role="group" aria-label="Zoom inn på en epoke">
      <button type="button" class="chip" aria-pressed={!zoom} onclick={()=>setZoom('')}>Hele tiden</button>
      {#each ERAS as era}<button type="button" class="chip" aria-pressed={zoom===era.id} onclick={()=>setZoom(era.id)}>{era.label}</button>{/each}
    </div>
    <div class="tl-chart" class:focus={!!domain || readYear!==null || !!selected} bind:this={chartEl} bind:clientWidth={width} style:height={`${chartHeight}px`} tabindex="0" role="slider"
      aria-label="Tidslinje. Dra eller bruk piltastene for å se hva som pågikk samtidig." aria-valuemin={view.from} aria-valuemax={view.to} aria-valuenow={readYear ?? view.from}
      aria-valuetext={readYear===null?'Ingen år valgt':`${formatYear(readYear)}: ${underway.length} emner pågår`}
      onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={()=>drag=null} onpointerleave={()=>hoverYear=null} onkeydown={key}>
      {#each bands as band}<span class="tl-band" class:alt={band.i%2} style:left={pct(band.x)} style:width={pct(band.w)}>{#if band.w*(width||360)>70}<small>{band.era.label}</small>{/if}</span>{/each}
      {#each ticks as tick}{@const x=storyPosition(tick,view)}<span class="tl-tick" class:start={x<.06} class:end={x>.94} style:left={pct(x)} style:top={`${chartHeight-24}px`}><small>{label(tick)}</small></span>{/each}
      {#if cursor!==null && cursor>=view.from && cursor<=view.to}<span class="tl-cursor" style:left={pct(storyPosition(cursor,view))} style:height={`${chartHeight-26}px`}><small>Du er her</small></span>{/if}
      {#each lanes.rows as row (row.unit.id)}<span class="tl-bar" data-status={status(row.unit.id)} class:today={highlight.includes(row.unit.id)} class:picked={row.unit.id===selectedId} class:dim={dim(row.unit)} style:left={pct(row.x)} style:width={pct(row.w)} style:top={`${TOP+row.lane*LANE}px`}></span>{/each}
      {#if readYear!==null}<span class="tl-scrub" style:left={pct(storyPosition(readYear,view))} style:height={`${chartHeight-26}px`}><small>{formatYear(readYear)}</small></span>{/if}
    </div>
    <div class="tl-readout" aria-live="polite">
      {#if selected}
        <p class="eyebrow">{eraOf(selected.years.from).label} · {domainTitle(selected.domainId)}</p>
        <h3 class="tl-title">{selected.title}</h3>
        <p class="tl-meta">{yearSpan(selected)} · {UNIT_STATUS[status(selected.id)].label}</p>
        {#if alongside.length}<p class="tl-sub">Samtidig i andre fag</p>
          <div class="tl-links">{#each alongside.slice(0,4) as unit}<button type="button" class="tl-link" onclick={()=>select(unit.id)}><span>{unit.title}</span><small>{yearSpan(unit)}</small></button>{/each}</div>{/if}
        <div class="tl-actions"><button type="button" class="primary" onclick={()=>onOpen(selected.id)}>Åpne emnet</button><button type="button" class="secondary" onclick={()=>select('')}>Lukk</button></div>
      {:else if readYear!==null}
        <p class="eyebrow">{eraOf(readYear).label}</p>
        <h3 class="tl-year">{formatYear(readYear)}</h3>
        <p class="tl-meta">{underway.length===0?'Ingen av emnene pågår akkurat da.':underway.length===1?'Ett emne pågår.':`${underway.length} emner pågår samtidig.`}</p>
        {#if underway.length}<div class="tl-links">{#each underway.slice(0,6) as unit}<button type="button" class="tl-link" onclick={()=>select(unit.id)}><span>{unit.title}</span><small>{domainTitle(unit.domainId)}</small></button>{/each}</div>{/if}
      {:else}
        <p class="tl-hint">Dra langs tidslinjen for å se hva som pågikk samtidig. Trykk på en strek for å velge et emne, eller velg en epoke for å zoome inn.</p>
      {/if}
    </div>
    <div class="chips scroll tl-domains" role="group" aria-label="Fremhev et fag">
      <button type="button" class="chip" aria-pressed={!domain} onclick={()=>domain=''}>Alle fag</button>
      {#each datedDomains as d}<button type="button" class="chip" aria-pressed={domain===d.id} onclick={()=>domain=domain===d.id?'':d.id}>{d.title}</button>{/each}
    </div>
  </section>
  {#each groups as group}
    <h3 class="story-era">{group.era.label}</h3>
    <div class="card story-list">{#each group.units as unit}{@const s=status(unit.id)}
      <button class="unit-row" data-status={s} class:today={highlight.includes(unit.id)} class:picked={unit.id===selectedId} onclick={()=>onOpen(unit.id)}>
        <span class="unit-dot" aria-hidden="true"></span>
        <span class="unit-text"><strong>{unit.title}</strong><small class="muted">{yearSpan(unit)} · {domainTitle(unit.domainId)} · {UNIT_STATUS[s].label}</small></span><span aria-hidden="true">›</span>
      </button>{/each}</div>
  {:else}
    <p class="muted tl-empty">Ingen emner i {domainTitle(domain)} i denne epoken.</p>
  {/each}
  {#if timelessShown.length}<h3 class="story-era">Tidløst</h3>{/if}
  {#each timelessShown as group}<details class="card story-list"><summary>{group.domain.title} <span class="muted">· {group.units.filter(u=>status(u.id)!=='new').length} av {group.units.length} påbegynt</span></summary>
    {#each group.units as unit}{@const s=status(unit.id)}<button class="unit-row" data-status={s} onclick={()=>onOpen(unit.id)}><span class="unit-dot" aria-hidden="true"></span><span class="unit-text"><strong>{unit.title}</strong><small class="muted">{UNIT_STATUS[s].label}</small></span><span aria-hidden="true">›</span></button>{/each}
  </details>{/each}
{/if}
