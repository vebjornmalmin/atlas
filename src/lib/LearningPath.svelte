<script>
  import {UNIT_STATUS} from './progression.js';
  import {STEP_LABELS} from './core-curriculum.js';
  let {curriculum, progress, sources = [], selectedUnit = $bindable(''), onstart, onreview, busy = false} = $props();
  let openDomain = $state('');
  let layout = $state('domains');
  const yearLabel = year => year < 0 ? `${-year} f.Kr.` : String(year);
  const dated = $derived(curriculum.units.filter(u => u.years).sort((a, b) => a.years.from - b.years.from || a.years.to - b.years.to));
  const unitById = $derived(new Map(curriculum.units.map(unit => [unit.id, unit])));
  const unit = $derived(unitById.get(selectedUnit));
  const state = $derived(unit ? progress.units.get(unit.id) : null);
  const sourceFor = id => sources.find(source => source.id === id);
  const percent = row => row?.total ? Math.round(100 * row.correct / row.total) : 0;
  const tierLabel = tier => ({1: 'Grunnmur', 2: 'Bygger videre', 3: 'Fordypning'}[tier]);
  $effect(() => { if (!openDomain && curriculum.domains.length) openDomain = curriculum.domains[0].id; });
</script>

{#if unit && state}
  <button class="quiet back-button" onclick={() => selectedUnit = ''}>← Alle emner</button>
  <section class="hero unit-hero">
    <p class="eyebrow">{curriculum.domains.find(d => d.id === unit.domainId)?.title} · {tierLabel(unit.tier)}</p>
    <h1>{unit.title}</h1>
    <p class="lead">{unit.summary}</p>
  </section>
  <div class="card unit-status">
    <div class="row"><strong>{UNIT_STATUS[state.status].label}</strong><span class="muted">{state.correct} av {state.total} riktig sist</span></div>
    <div class="step-bars" aria-label="Fremgang per steg">
      {#each [1, 2, 3, 4] as step}{#if state.steps[step].total}
        <div class="step-bar"><span class="bar"><span style={`width:${100 * state.steps[step].correct / state.steps[step].total}%`}></span></span><small>{STEP_LABELS[step]}</small></div>
      {/if}{/each}
    </div>
    {#if !state.ready}<p class="muted">Anbefalt først: {state.missing.map(id => unitById.get(id)?.title).join(', ')}. Du kan likevel begynne her.</p>{/if}
    {#if state.unseen.length}
      <button class="primary" disabled={busy} onclick={() => onstart(unit.id)}>{state.status === 'new' ? 'Begynn på emnet' : `Fortsett · ${state.unseen.length} nye kort`}</button>
    {/if}
    {#if state.attempted}<button class="secondary" disabled={busy} onclick={() => onreview(unit.id)}>Øv på emnet{state.weak.length ? ` · ${state.weak.length} å styrke` : ''}</button>{/if}
  </div>
  {#if state.status !== 'new'}
    <div class="card lesson-card">
      <h2>Kort fortalt</h2>
      {#each unit.lesson as paragraph}<p>{paragraph}</p>{/each}
      <h3>Dette skal sitte</h3>
      <ul class="key-points">{#each unit.keyPoints as point}<li>{point}</li>{/each}</ul>
    </div>
  {:else}
    <div class="card"><p class="muted">Emnet begynner med en kort innføring. Deretter kommer spørsmål i fire steg: oversikt, kjerne, sammenheng og detaljer. Nye kort spres over flere dager, og repetisjoner kommer når du er i ferd med å glemme.</p></div>
  {/if}
  {#if unit.prerequisites.length || curriculum.units.some(other => other.prerequisites.includes(unit.id))}
    <div class="card">
      {#if unit.prerequisites.length}<h3>Bygger på</h3>{#each unit.prerequisites as id}<button class="entity-row" onclick={() => selectedUnit = id}><span><strong>{unitById.get(id)?.title}</strong><small class="muted">{UNIT_STATUS[progress.units.get(id)?.status]?.label}</small></span><span aria-hidden="true">→</span></button>{/each}{/if}
      {#if curriculum.units.some(other => other.prerequisites.includes(unit.id))}<h3>Fører videre til</h3>{#each curriculum.units.filter(other => other.prerequisites.includes(unit.id)) as next}<button class="entity-row" onclick={() => selectedUnit = next.id}><span><strong>{next.title}</strong><small class="muted">{UNIT_STATUS[progress.units.get(next.id)?.status]?.label}</small></span><span aria-hidden="true">→</span></button>{/each}{/if}
    </div>
  {/if}
  <details class="card"><summary>Kilder</summary>{#each unit.sourceIds as id}{@const source = sourceFor(id)}{#if source}<p><a class="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></p>{/if}{/each}</details>
{:else}
  <section class="hero"><h1>Emner</h1><p class="lead">Hvert emne starter med en kort innføring og bygger seg opp fra oversikt til detaljer.</p></section>
  {#if dated.length > 2}<div class="chips layout-switch" role="group" aria-label="Visning"><button class="chip" class:active={layout === 'domains'} aria-pressed={layout === 'domains'} onclick={() => layout = 'domains'}>Fagområder</button><button class="chip" class:active={layout === 'timeline'} aria-pressed={layout === 'timeline'} onclick={() => layout = 'timeline'}>Tidslinje</button></div>{/if}
  {#if layout === 'timeline'}
    <div class="card"><p class="muted">Emner med en tydelig periode, på tvers av fagområdene.</p><ol class="unit-list timeline-units">
      {#each dated as item}{@const row = progress.units.get(item.id)}
        <li><button class="unit-row" data-status={row.status} onclick={() => selectedUnit = item.id}>
          <span class="unit-years">{yearLabel(item.years.from)}<br><small>{yearLabel(item.years.to)}</small></span>
          <span class="unit-dot" aria-hidden="true"></span>
          <span class="unit-text"><strong>{item.title}</strong><small class="muted">{curriculum.domains.find(d => d.id === item.domainId)?.title} · {UNIT_STATUS[row.status].label}</small></span>
        </button></li>
      {/each}
    </ol></div>
  {:else}
  {#each curriculum.domains as domain}
    {@const summary = progress.domains.get(domain.id)}
    <section class="card domain-card">
      <button class="domain-header" aria-expanded={openDomain === domain.id} onclick={() => openDomain = openDomain === domain.id ? '' : domain.id}>
        <span><strong>{domain.title}</strong><small class="muted">{summary.started ? `${summary.complete} av ${summary.units} gjennomført · ${percent(summary)} % riktig` : `${summary.units} emner`}</small></span>
        <span class="bar small"><span style={`width:${percent(summary)}%`}></span></span>
      </button>
      {#if openDomain === domain.id}
        <p class="muted domain-description">{domain.description}</p>
        <ol class="unit-list">
          {#each domain.unitIds as id}{@const item = unitById.get(id)}{@const row = progress.units.get(id)}
            <li><button class="unit-row" class:later={!row.ready && row.status === 'new'} data-status={row.status} onclick={() => selectedUnit = id}>
              <span class="unit-dot" aria-hidden="true"></span>
              <span class="unit-text"><strong>{item.title}</strong><small class="muted">{row.status === 'new' ? (row.ready ? tierLabel(item.tier) : `Etter ${row.missing.map(m => unitById.get(m)?.title).join(', ')}`) : `${UNIT_STATUS[row.status].label} · ${row.correct}/${row.total}`}</small></span>
              <span aria-hidden="true">›</span>
            </button></li>
          {/each}
        </ol>
      {/if}
    </section>
  {/each}
  {/if}
{/if}
