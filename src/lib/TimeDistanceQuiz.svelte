<script>
  import {distanceFacts} from './time-distance.js';
  import {formatYear} from './core-curriculum.js';

  let {target, draft = $bindable({}), revealed = false, anchors = []} = $props();

  const byId = $derived(new Map(anchors.map(item => [item.id, item])));
  const anchor = $derived(byId.get(target.anchor));
  const options = $derived(target.options.map(id => byId.get(id)).filter(Boolean));
  const facts = $derived(anchor && options.length === 2 ? distanceFacts(anchor, options[0], options[1]) : null);
  const approximate = $derived(Boolean(anchor && options.some(item => item.approximate) || anchor?.approximate));

  const WIDTH = 340, PAD = 28, AXIS_Y = 86;
  const scale = $derived.by(() => {
    if (!anchor || options.length !== 2) return null;
    const years = [anchor, ...options].map(item => item.year);
    const min = Math.min(...years), max = Math.max(...years);
    const span = Math.max(1, max - min);
    return year => PAD + ((year - min) / span) * (WIDTH - 2 * PAD);
  });

  const when = item => `${item.approximate ? 'omkring ' : ''}${formatYear(item.year)}`;
  const withSpace = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const distanceLabel = (from, to) => `${approximate ? '≈ ' : ''}${withSpace(Math.abs(to.year - from.year))} år`;
  const isCorrect = $derived(revealed && facts && draft.choice === target.correctId);

  function choose(id) {
    if (!revealed) draft.choice = id;
  }

  function role(item) {
    if (!revealed || !facts) return '';
    return item.id === facts.near.id ? 'near' : 'far';
  }

  function bracketPath(from, to, above) {
    const x1 = scale(from.year), x2 = scale(to.year);
    const y = above ? 44 : 128, tick = above ? 60 : 112;
    return `M ${x1} ${tick} V ${y} H ${x2} V ${tick}`;
  }
</script>

{#if anchor}
  <section class="distance" aria-labelledby="distance-question">
    <p id="distance-question" class="question">Hva ligger nærmest i tid?</p>
    <p class="anchor">{anchor.label}</p>

    {#if !revealed}
      <div class="choices" role="group" aria-label="Velg ett alternativ">
        {#each options as option (option.id)}
          <button
            type="button"
            class="choice"
            class:selected={draft.choice === option.id}
            aria-pressed={draft.choice === option.id}
            onclick={() => choose(option.id)}
          >{option.label}</button>
        {/each}
      </div>
    {:else}
      <p class="verdict" class:correct={isCorrect} class:wrong={!isCorrect}>
        {isCorrect ? 'Riktig.' : 'Ikke helt.'} Nærmest er {target.answer}.
      </p>

      <svg class="timeline" viewBox="0 0 {WIDTH} 170" role="img" aria-label="Tidslinje med {anchor.label} og de to alternativene">
        <line class="axis" x1={PAD} x2={WIDTH - PAD} y1={AXIS_Y} y2={AXIS_Y} />

        <path class="bracket near" d={bracketPath(anchor, facts.near, true)} />
        <text class="gap near" x={(scale(anchor.year) + scale(facts.near.year)) / 2} y="34" text-anchor="middle">{distanceLabel(anchor, facts.near)}</text>

        <path class="bracket far" d={bracketPath(anchor, facts.far, false)} />
        <text class="gap far" x={(scale(anchor.year) + scale(facts.far.year)) / 2} y="150" text-anchor="middle">{distanceLabel(anchor, facts.far)}</text>

        <circle class="dot anchor-dot" cx={scale(anchor.year)} cy={AXIS_Y} r="9" />

        {#each [facts.near, facts.far] as item (item.id)}
          <circle class="dot {role(item)}" cx={scale(item.year)} cy={AXIS_Y} r="9" />
        {/each}
      </svg>

      <ul class="legend">
        <li><span class="swatch anchor-dot"></span><strong>{anchor.label}</strong> <span class="when">{when(anchor)}</span></li>
        {#each [facts.near, facts.far] as item (item.id)}
          <li class:closest={role(item) === 'near'}><span class="swatch {role(item)}"></span>{item.label} <span class="when">{when(item)}</span></li>
        {/each}
      </ul>

      <p class="note">Avstanden i tid er ofte større enn den føles.</p>
    {/if}
  </section>
{/if}

<style>
  .distance {
    display: grid;
    gap: 14px;
    padding: 0 16px;
    color: var(--ink, #1d2430);
  }
  .question {
    margin: 0;
    color: var(--muted, #6b7280);
    font-size: 0.95rem;
  }
  .anchor {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .choices {
    display: grid;
    gap: 12px;
  }
  .choice {
    min-height: 72px;
    padding: 14px 16px;
    border: 2px solid var(--line, #d7dce3);
    border-radius: 14px;
    background: var(--surface, #fff);
    color: var(--ink, #1d2430);
    font: inherit;
    font-size: 1.1rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }
  .choice.selected {
    border-color: var(--accent, #2f6f5e);
    box-shadow: inset 0 0 0 1px var(--accent, #2f6f5e);
  }
  .choice:focus-visible {
    outline: 3px solid var(--accent, #2f6f5e);
    outline-offset: 2px;
  }
  .verdict {
    margin: 0;
    font-weight: 700;
  }
  .verdict.correct {
    color: var(--success, #15803d);
  }
  .verdict.wrong {
    color: var(--danger, #b91c1c);
  }
  .timeline {
    width: 100%;
    height: auto;
    max-width: 480px;
    overflow: visible;
  }
  .axis {
    stroke: var(--line, #d7dce3);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .bracket {
    fill: none;
    stroke: var(--muted, #6b7280);
    stroke-width: 1.5;
  }
  .bracket.near {
    stroke: var(--success, #15803d);
    stroke-width: 2.5;
  }
  .gap {
    fill: var(--ink, #1d2430);
    font-size: 12px;
    font-weight: 600;
  }
  .gap.near {
    fill: var(--success, #15803d);
  }
  .gap.far {
    fill: var(--muted, #6b7280);
  }
  .dot {
    fill: var(--muted, #6b7280);
  }
  .dot.near {
    fill: var(--success, #15803d);
  }
  .dot.far {
    fill: var(--surface, #fff);
    stroke: var(--muted, #6b7280);
    stroke-width: 2;
  }
  .dot.anchor-dot {
    fill: var(--accent, #2f6f5e);
  }
  .legend {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.95rem;
  }
  .legend li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .legend li.closest {
    font-weight: 700;
  }
  .swatch {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    align-self: center;
    background: var(--muted, #6b7280);
  }
  .swatch.anchor-dot {
    background: var(--accent, #2f6f5e);
  }
  .swatch.near {
    background: var(--success, #15803d);
  }
  .when {
    color: var(--muted, #6b7280);
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 0;
    color: var(--muted, #6b7280);
    font-size: 0.95rem;
  }
  @media (min-width: 600px) {
    .choices {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
