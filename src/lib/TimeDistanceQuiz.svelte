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

  function choose(id) {
    if (!revealed) draft = {...draft, choice: id};
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
    <p id="distance-question" class="q-note">Nærmest i tid til</p>
    <p class="q-anchor">{anchor.label}</p>

    {#if !revealed}
      <div class="s-choices" role="group" aria-label="Velg ett alternativ">
        {#each options as option, i (option.id)}
          <button
            type="button"
            class="s-choice"
            aria-pressed={draft.choice === option.id}
            onclick={() => choose(option.id)}
          ><span class="s-choice-key" aria-hidden="true">{'ABCD'[i]}</span><span class="s-choice-label">{option.label}</span></button>
        {/each}
      </div>
    {:else}
      <svg class="q-timeline" viewBox="0 0 {WIDTH} 170" role="img" aria-label="Tidslinje med {anchor.label} og de to alternativene">
        <line class="q-axis" x1={PAD} x2={WIDTH - PAD} y1={AXIS_Y} y2={AXIS_Y} />

        <path class="q-bracket near" d={bracketPath(anchor, facts.near, true)} />
        <text class="q-gap near" x={(scale(anchor.year) + scale(facts.near.year)) / 2} y="34" text-anchor="middle">{distanceLabel(anchor, facts.near)}</text>

        <path class="q-bracket far" d={bracketPath(anchor, facts.far, false)} />
        <text class="q-gap far" x={(scale(anchor.year) + scale(facts.far.year)) / 2} y="150" text-anchor="middle">{distanceLabel(anchor, facts.far)}</text>

        <circle class="q-dot anchor-dot" cx={scale(anchor.year)} cy={AXIS_Y} r="9" />

        {#each [facts.near, facts.far] as item (item.id)}
          <circle class="q-dot {role(item)}" cx={scale(item.year)} cy={AXIS_Y} r="9" />
        {/each}
      </svg>

      <ul class="q-legend">
        <li><span class="q-swatch anchor-dot"></span><strong>{anchor.label}</strong> <span class="q-when">{when(anchor)}</span></li>
        {#each [facts.near, facts.far] as item (item.id)}
          <li class:closest={role(item) === 'near'}><span class="q-swatch {role(item)}"></span>{item.label} <span class="q-when">{when(item)}</span></li>
        {/each}
      </ul>

      <p class="q-note">Avstanden i tid er ofte større enn den føles.</p>
    {/if}
  </section>
{/if}
