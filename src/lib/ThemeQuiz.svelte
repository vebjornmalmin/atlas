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
  <h2 class="prompt">{target.prompt}</h2>

  <div class="player">
    <button type="button" class="play" onclick={togglePlay} aria-pressed={isPlaying}>
      {isPlaying ? 'Stopp' : 'Spill melodien'}
    </button>

    <svg class="roll" viewBox="0 0 {roll.width} {roll.height}" role="img" aria-label="Melodiens form, uten tonenavn">
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

  <div class="choices" role="group" aria-label="Svaralternativer">
    {#each target.choices as choice (choice)}
      <button
        type="button"
        class="choice"
        class:selected={draft.choice === choice}
        class:correct={revealed && choice === target.answer}
        aria-pressed={draft.choice === choice}
        disabled={revealed}
        onclick={() => choose(choice)}
      >
        {choice}
      </button>
    {/each}
  </div>

  {#if revealed}
    <div class="reveal">
      <h3>{target.answer}</h3>
      <p>{target.composer}</p>
      <p class="meta">{target.approximate ? 'ca. ' : ''}{target.year} · {target.era}</p>
      <button type="button" class="again" onclick={replay}>Spill igjen</button>
    </div>
  {/if}
</section>

<style>
  .theme-quiz {
    color: var(--ink);
    font-size: 16px;
  }
  .prompt {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    margin: 4px 0 14px;
  }
  .player {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }
  .play {
    min-height: 56px;
    width: 100%;
    border: 0;
    border-radius: 14px;
    background: var(--accent);
    color: var(--surface);
    font-size: 17px;
    font-weight: 600;
  }
  .roll {
    width: 100%;
    height: auto;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 14px;
  }
  .roll rect {
    fill: var(--line);
    transition: fill 0.1s;
  }
  .roll rect.active {
    fill: var(--accent);
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .choice {
    min-height: 48px;
    text-align: left;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
  }
  .choice.selected {
    border-color: var(--accent);
    background: var(--accent-soft, var(--surface-2));
    color: var(--accent);
    font-weight: 600;
  }
  .choice.correct {
    border-color: var(--success);
    color: var(--success);
    font-weight: 600;
  }
  .choice:disabled {
    opacity: 1;
  }
  .reveal {
    margin-top: 18px;
    padding: 16px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .reveal h3 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 400;
    margin: 0 0 6px;
  }
  .reveal p {
    margin: 0 0 4px;
    color: var(--muted);
    font-size: 14px;
  }
  .reveal .meta {
    font-size: 13px;
  }
  .again {
    margin-top: 12px;
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--ink);
    font-size: 14px;
  }
</style>
