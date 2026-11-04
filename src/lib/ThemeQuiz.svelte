<script>
  import {createPlayer, parseTheme} from './listening/synth.js';

  let {target, draft = $bindable({}), revealed = false} = $props();

  const player = createPlayer();
  let isPlaying = $state(false);
  let activeIndex = $state(-1);

  const notes = $derived(parseTheme(target.melody));

  const roll = $derived.by(() => {
    const width = 300;
    const height = 120;
    const pad = 10;
    const low = Math.min(...notes.map(note => note.midi)) - 1;
    const high = Math.max(...notes.map(note => note.midi)) + 1;
    const end = Math.max(...notes.map(note => note.start + note.duration));
    const bars = notes.map((note, index) => ({
      index,
      x: pad + (note.start / end) * (width - 2 * pad),
      width: Math.max(5, (note.duration / end) * (width - 2 * pad) - 2),
      y: pad + (1 - (note.midi - low) / (high - low)) * (height - 2 * pad) - 6,
      height: 12
    }));
    return {width, height, bars};
  });

  function togglePlay() {
    if (isPlaying) {
      player.stop();
      isPlaying = false;
      activeIndex = -1;
      return;
    }
    isPlaying = true;
    const started = player.play(target.melody, {
      onNote: index => { activeIndex = index; },
      onEnd: () => { isPlaying = false; activeIndex = -1; }
    });
    if (!started) isPlaying = false;
  }

  function replay() {
    player.stop();
    isPlaying = false;
    activeIndex = -1;
    togglePlay();
  }

  function choose(choice) {
    if (revealed) return;
    draft = {...draft, choice};
  }

  $effect(() => () => player.stop());
</script>

<section class="theme-quiz">

  <div class="q-melody">
    <button type="button" class="q-melody-play" onclick={togglePlay} aria-pressed={isPlaying}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{#if isPlaying}<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />{:else}<path d="M8 5.5v13l10.5-6.5z" />{/if}</svg>
      <span>{isPlaying ? 'Stopp' : 'Spill melodien'}</span>
    </button>

    <svg class="q-roll" viewBox="0 0 {roll.width} {roll.height}" role="img" aria-label="Melodiens form, uten tonenavn">
      {#each roll.bars as bar (bar.index)}
        <rect
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx="4"
          class:active={bar.index === activeIndex}
        />
      {/each}
    </svg>
  </div>

  <div class="s-choices" role="group" aria-label="Svaralternativer">
    {#each target.choices as choice, i (choice)}
      <button
        type="button"
        class="s-choice"
        class:is-correct={revealed && choice === target.answer}
        class:is-wrong={revealed && draft.choice === choice && choice !== target.answer}
        aria-pressed={draft.choice === choice}
        disabled={revealed}
        onclick={() => choose(choice)}
      ><span class="s-choice-key" aria-hidden="true">{'ABCD'[i] || i + 1}</span><span class="s-choice-label">{choice}</span></button>
    {/each}
  </div>

  {#if revealed}
    <div class="q-facts">
      <p><strong>{target.composer}</strong></p>
      <p>{target.approximate ? 'ca. ' : ''}{target.year} · {target.era}</p>
      <button type="button" class="secondary q-replay" onclick={replay}>Spill igjen</button>
    </div>
  {/if}
</section>
