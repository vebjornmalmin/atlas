<script>
  import {onDestroy, onMount} from 'svelte';
  import {findRecording} from './listening/commons.js';

  // Props: target er et listen-mål fra buildListeningTargets(); draft.choice lagrer valgt svar.
  let {target, draft = $bindable({}), revealed = false} = $props();

  const CLIP = 20;
  const FADE = 1.5;
  const RING = 2 * Math.PI * 46;
  const OFFLINE = 'Opptaket krever nett. Prøv igjen når du er tilkoblet.';
  const MISSING = 'Fant ingen åpen innspilling av dette verket ennå.';

  let status = $state('idle');
  let message = $state('');
  let elapsed = $state(0);
  let recording = $state(null);
  let credit = $state(null);

  let audio = null;
  let loadedUrl = null;
  let context = null;
  let gain = null;
  let timer = null;

  const offset = $derived(target.offset ?? 0);
  const ring = $derived(RING * (1 - Math.min(elapsed, CLIP) / CLIP));
  const work = $derived({id: target.workId, commonsSearch: target.commonsSearch});

  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.playsInline = true;
  }

  /** Lager lydgrafen i samme brukerhandling som trykket, slik at iOS Safari tillater avspilling. */
  function ensureGraph() {
    ensureAudio();
    if (context) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      context = new Ctor();
      const source = context.createMediaElementSource(audio);
      gain = context.createGain();
      source.connect(gain);
      gain.connect(context.destination);
    } catch {
      context = null;
      gain = null;
    }
  }

  function scheduleFade() {
    if (!gain || !context) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    gain.gain.setValueAtTime(1, now + CLIP - FADE);
    gain.gain.linearRampToValueAtTime(0, now + CLIP);
  }

  async function fetchRecording() {
    if (recording) return recording;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    const found = await findRecording(work);
    if (!found) {
      status = 'missing';
      message = MISSING;
      return null;
    }
    recording = found;
    return found;
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (!audio) return;
      elapsed = Math.max(0, audio.currentTime - offset);
      if (elapsed >= CLIP - 0.05 || audio.ended) finish();
    }, 100);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function finish() {
    stopTimer();
    audio?.pause();
    elapsed = CLIP;
    status = 'done';
  }

  function playLoaded() {
    if (!audio || !recording) return;
    if (loadedUrl !== recording.url) {
      audio.src = recording.url;
      loadedUrl = recording.url;
    }
    if (offset > 0) {
      const seek = () => { audio.currentTime = offset; };
      if (audio.readyState >= 1) seek();
      else audio.addEventListener('loadedmetadata', seek, {once: true});
    }
    elapsed = 0;
    scheduleFade();
    context?.resume?.();
    const attempt = audio.play();
    status = 'playing';
    startTimer();
    attempt?.catch(() => {
      stopTimer();
      status = 'error';
      message = OFFLINE;
    });
  }

  /** Første trykk: klargjør lyd synkront, deretter hent opptak (om det ikke er hentet ennå) og spill. */
  async function begin() {
    message = '';
    status = 'loading';
    ensureGraph();
    try {
      if (!recording) {
        const found = await fetchRecording();
        if (!found) return;
      }
      playLoaded();
    } catch {
      status = 'error';
      message = OFFLINE;
    }
  }

  function pause() {
    stopTimer();
    audio?.pause();
    context?.suspend?.();
    status = 'paused';
  }

  function resume() {
    context?.resume?.();
    audio?.play().catch(() => {
      status = 'error';
      message = OFFLINE;
    });
    status = 'playing';
    startTimer();
  }

  function onPlay() {
    if (status === 'playing') return pause();
    if (status === 'paused') return resume();
    if (status === 'loading') return;
    return begin();
  }

  function replay() {
    if (!audio) return begin();
    stopTimer();
    audio.pause();
    audio.currentTime = offset;
    elapsed = 0;
    if (!recording) return begin();
    playLoaded();
  }

  function choose(choice) {
    if (revealed) return;
    draft.choice = choice;
  }

  function classFor(choice) {
    if (!revealed) return draft.choice === choice ? 'selected' : '';
    if (choice === target.answer) return 'correct';
    if (draft.choice === choice) return 'wrong';
    return '';
  }

  // Etter svar hentes kreditering dersom opptaket ikke er lastet ennå.
  $effect(() => {
    if (!revealed || recording || credit) return;
    findRecording(work).then(found => {
      if (found) recording = found;
      else credit = 'missing';
    }).catch(() => {
      credit = 'offline';
    });
  });

  // Forhåndshenter opptaket uten avspilling, slik at første trykk kan starte umiddelbart.
  onMount(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    findRecording(work).then(found => {
      if (found) recording = found;
      else status = 'missing';
    }).catch(() => {});
  });

  onDestroy(() => {
    stopTimer();
    audio?.pause();
    context?.close?.().catch?.(() => {});
  });

  const playLabel = $derived(status === 'playing' ? 'Pause' : status === 'paused' ? 'Fortsett' : 'Spill av');
</script>

<section class="listening" aria-labelledby="listen-{target.id}">
  <p class="eyebrow">Lytt</p>
  <h2 id="listen-{target.id}" class="question">{target.prompt}</h2>

  <div class="player">
    <button type="button" class="play" onclick={onPlay} aria-label={playLabel} disabled={status === 'loading'}>
      <svg viewBox="0 0 100 100" aria-hidden="true" class="ring">
        <circle cx="50" cy="50" r="46" class="track" />
        <circle cx="50" cy="50" r="46" class="progress" style="stroke-dasharray: {RING}; stroke-dashoffset: {ring};" />
      </svg>
      <span class="glyph" aria-hidden="true">
        {#if status === 'playing'}
          <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        {:else}
          <svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg>
        {/if}
      </span>
    </button>
    <p class="status" role="status" aria-live="polite">
      {#if status === 'loading'}Henter opptak …
      {:else if status === 'playing'}Spiller ({Math.ceil(Math.max(0, CLIP - elapsed))} s igjen)
      {:else if status === 'paused'}Pause
      {:else if status === 'done'}Ferdig med utdraget
      {:else if message}<span class="error">{message}</span>
      {:else}Trykk for å høre omtrent {CLIP} sekunder
      {/if}
    </p>
    <button type="button" class="secondary replay" onclick={replay} disabled={status === 'loading'}>Spill igjen</button>
  </div>

  <div class="choices" role="group" aria-label="Svaralternativer">
    {#each target.choices as choice (choice)}
      <button type="button" class="choice {classFor(choice)}" aria-pressed={draft.choice === choice} disabled={revealed} onclick={() => choose(choice)}>
        {choice}
      </button>
    {/each}
  </div>

  {#if revealed}
    <div class="answer-box reveal">
      <p class="answer-line"><strong>{target.title}</strong> av {target.composer}</p>
      <p class="muted">{target.approximate ? 'ca. ' : ''}{target.year} · {target.era}</p>
      {#if recording}
        <p class="credit">Utøver: {recording.artist ?? 'ukjent'}</p>
        <p class="credit">
          Lisens: {recording.license}
          {#if recording.licenseUrl}(<a href={recording.licenseUrl} target="_blank" rel="noopener noreferrer">les mer</a>){/if}
        </p>
        <p><a href={recording.descriptionUrl} target="_blank" rel="noopener noreferrer">Opptaket på Wikimedia Commons</a></p>
      {:else if credit === 'offline'}
        <p class="error">{OFFLINE}</p>
      {:else if credit === 'missing'}
        <p class="muted">{MISSING}</p>
      {:else}
        <p class="muted">Henter kreditering …</p>
      {/if}
      {#if target.sources?.length}
        <p class="sources">
          {#each target.sources as source (source.url)}
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .listening { display: flex; flex-direction: column; gap: 14px; }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
  .question { margin: 0; font-size: 22px; line-height: 1.3; color: var(--ink); }
  .player { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 14px 0 4px; }
  .play {
    position: relative; width: 104px; height: 104px; min-height: 104px; border-radius: 50%;
    border: 0; padding: 0; background: var(--accent); color: var(--surface);
    display: grid; place-items: center; cursor: pointer;
  }
  .play:disabled { opacity: 0.6; }
  .ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring circle { fill: none; stroke-width: 4; }
  .ring .track { stroke: var(--line); }
  .ring .progress { stroke: var(--surface); stroke-linecap: round; transition: stroke-dashoffset 0.12s linear; }
  .glyph svg { width: 38px; height: 38px; fill: currentColor; display: block; }
  .status { margin: 0; min-height: 22px; font-size: 14px; color: var(--muted); text-align: center; }
  .error { color: var(--danger); }
  .muted { color: var(--muted); font-size: 13px; margin: 4px 0; }
  .secondary {
    min-height: 44px; padding: 10px 18px; border-radius: 12px; border: 1px solid var(--line);
    background: var(--surface-2, var(--surface)); color: var(--ink); font-size: 14px; cursor: pointer;
  }
  .secondary:disabled { opacity: 0.45; }
  .choices { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .choice {
    min-height: 44px; padding: 12px 14px; text-align: left; border-radius: 12px;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 15px; line-height: 1.35; cursor: pointer;
  }
  .choice.selected, .choice[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft, var(--surface)); color: var(--accent); }
  .choice.correct { border-color: var(--success); background: var(--accent-soft, var(--surface)); color: var(--success); font-weight: 600; }
  .choice.wrong { border-color: var(--danger); color: var(--danger); }
  .choice:disabled { cursor: default; }
  .reveal { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); padding: 16px; }
  .answer-line { margin: 0 0 4px; font-size: 16px; color: var(--ink); }
  .credit { margin: 6px 0 0; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
  .reveal a { color: var(--accent); min-height: 44px; display: inline-flex; align-items: center; }
  .sources { display: flex; flex-direction: column; gap: 2px; font-size: 13px; margin: 8px 0 0; }
</style>
