<script>
  // The curriculum as one story through time: every dated unit on a logarithmic time line,
  // grouped into eras, with timeless units after. Colour shows how well each part sits.
  import {yearToPosition} from './levels.js';
  import {ERAS,eraOf,yearSpan,storyCursor} from './story.js';
  import {UNIT_STATUS} from './progression.js';
  let {curriculum,progress,highlight=[],compact=false,onOpen=()=>{}}=$props();
  const domainTitle=id=>curriculum.domains.find(d=>d.id===id)?.title || '';
  const dated=$derived(curriculum.units.filter(u=>u.years).sort((a,b)=>a.years.from-b.years.from || a.years.to-b.years.to));
  const timeless=$derived(curriculum.domains.map(d=>({domain:d,units:curriculum.units.filter(u=>!u.years && u.domainId===d.id)})).filter(g=>g.units.length));
  const cursor=$derived(storyCursor(curriculum,progress));
  const status=id=>progress.units.get(id)?.status || 'new';
  const pos=year=>`${(yearToPosition(Math.max(-3500,year))*100).toFixed(2)}%`;
  const ticks=$derived(compact?[-3000,0,1000,1500,1800,2000]:[-3000,0,1000,1500,1800,1900,2000]);
  const groups=$derived(ERAS.map(era=>({era,units:dated.filter(u=>eraOf(u.years.from).id===era.id)})).filter(g=>g.units.length));
</script>

<div class="story-strip" class:compact aria-hidden={compact}>
  <span class="story-line"></span>
  {#each ticks as tick}<span class="story-tick" style:left={pos(tick)}><small>{tick<0?`${-tick} f.Kr.`:tick}</small></span>{/each}
  {#each dated as unit}<span class="story-dot" data-status={status(unit.id)} class:today={highlight.includes(unit.id)} style:left={pos(unit.years.from)} title={unit.title}></span>{/each}
  {#if cursor!==null}<span class="story-cursor" style:left={pos(cursor)}><small>Du er her</small></span>{/if}
</div>
{#if !compact}
  <p class="muted story-intro">Emnene åpnes omtrent i tidsrekkefølge, på tvers av fag, med et tidløst emne innimellom. Slik bygger hver økt videre på forrige kapittel.</p>
  {#each groups as group}
    <h3 class="story-era">{group.era.label}</h3>
    <div class="card story-list">{#each group.units as unit}{@const s=status(unit.id)}
      <button class="unit-row" data-status={s} class:today={highlight.includes(unit.id)} onclick={()=>onOpen(unit.id)}>
        <span class="unit-dot" aria-hidden="true"></span>
        <span class="unit-text"><strong>{unit.title}</strong><small class="muted">{yearSpan(unit)} · {domainTitle(unit.domainId)} · {UNIT_STATUS[s].label}</small></span><span aria-hidden="true">›</span>
      </button>{/each}</div>
  {/each}
  <h3 class="story-era">Tidløst</h3>
  {#each timeless as group}<details class="card story-list"><summary>{group.domain.title} <span class="muted">· {group.units.filter(u=>status(u.id)!=='new').length} av {group.units.length} påbegynt</span></summary>
    {#each group.units as unit}{@const s=status(unit.id)}<button class="unit-row" data-status={s} onclick={()=>onOpen(unit.id)}><span class="unit-dot" aria-hidden="true"></span><span class="unit-text"><strong>{unit.title}</strong><small class="muted">{UNIT_STATUS[s].label}</small></span><span aria-hidden="true">›</span></button>{/each}
  </details>{/each}
{/if}
