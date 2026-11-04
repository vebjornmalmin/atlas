<script>
  // Place a year on a logarithmic timeline. Recent centuries get more room, so the tolerance,
  // which grows with age, is roughly the same width wherever the answer lies.
  import {yearToPosition,positionToYear,PRESENT_YEAR} from './levels.js';
  import {formatYear} from './core-curriculum.js';
  let {target,draft=$bindable({}),revealed=false}=$props();
  let track=$state();
  let active=$state(false);
  const ticks=[-3000,0,1000,1500,1800,1900,2000];
  const pct=year=>`${(yearToPosition(year)*100).toFixed(2)}%`;
  const year=$derived(Number.isFinite(draft.year)?draft.year:null);
  function at(event){
    const r=track.getBoundingClientRect();
    return positionToYear((event.clientX-r.left)/r.width);
  }
  function down(event){
    if(revealed||event.button>0)return;
    active=true;track.setPointerCapture?.(event.pointerId);
    draft={...draft,year:at(event)};
  }
  function move(event){if(active)draft={...draft,year:at(event)};}
  function up(){active=false;}
  function nudge(step){if(!revealed)draft={...draft,year:Math.min(PRESENT_YEAR,(year ?? 1500)+step)};}
  function key(event){
    const steps={ArrowLeft:-1,ArrowRight:1,ArrowDown:-10,ArrowUp:10,PageDown:-100,PageUp:100};
    if(steps[event.key]){event.preventDefault();nudge(steps[event.key]);}
  }
  const off=$derived(revealed && year!==null ? year-target.year : null);
</script>

<div class="estimate">
  <p class="estimate-value" aria-live="polite">{#if year!==null}<strong>{active?'':'ca. '}{formatYear(year)}</strong>{:else}<span class="muted">Trykk eller dra på tidslinjen</span>{/if}</p>
  <div class="estimate-track" bind:this={track} role="slider" tabindex={revealed?-1:0} aria-label="Velg årstall på tidslinjen"
    aria-valuemin={-3500} aria-valuemax={PRESENT_YEAR} aria-valuenow={year ?? undefined} aria-valuetext={year!==null?formatYear(year):'Ikke valgt'}
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={key}>
    <span class="estimate-line" aria-hidden="true"></span>
    {#each ticks as tick}<span class="estimate-tick" style:left={pct(tick)} aria-hidden="true"><i></i><small>{tick<0?`${-tick} f.Kr.`:tick}</small></span>{/each}
    {#if revealed}<span class="estimate-band" style:left={pct(target.year-target.tolerance)} style:width={`calc(${pct(Math.min(PRESENT_YEAR,target.year+target.tolerance))} - ${pct(target.year-target.tolerance)})`} aria-hidden="true"></span>
      <span class="estimate-pin answer" style:left={pct(target.year)} aria-hidden="true"><b>{formatYear(target.year)}</b></span>{/if}
    {#if year!==null}<span class="estimate-pin" class:dragging={active} class:wrong={revealed && Math.abs(off)>target.tolerance} style:left={pct(year)} aria-hidden="true"></span>{/if}
  </div>
  {#if !revealed}<div class="estimate-nudge" role="group" aria-label="Juster årstallet">
    <button type="button" class="quiet" disabled={year===null} onclick={()=>nudge(-10)}>−10</button><button type="button" class="quiet" disabled={year===null} onclick={()=>nudge(-1)}>−1</button>
    <button type="button" class="quiet" disabled={year===null} onclick={()=>nudge(1)}>+1</button><button type="button" class="quiet" disabled={year===null} onclick={()=>nudge(10)}>+10</button>
  </div>
  <p class="muted map-note">Du trenger ikke treffe eksakt. Jo lenger tilbake noe skjedde, desto større slingringsmonn.</p>
  {:else if off!==null}<p class="muted map-note">{off===0?'Helt presist.':`Du var ${Math.abs(off)} år ${off<0?'for tidlig':'for sent'}.`} Godkjent innenfor ±{target.tolerance} år.</p>{/if}
</div>
