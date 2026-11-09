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
    // After the excerpt has ended the audio stands at its end; start it over instead of finishing at once.
    if (status === 'done') return replay();
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
    draft = {...draft, choice};
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

<section class="listening" aria-label={target.prompt}>
  <div class="q-player">
    <button type="button" class="q-play" onclick={onPlay} aria-label={playLabel} disabled={status === 'loading'}>
      <svg viewBox="0 0 100 100" aria-hidden="true" class="q-ring">
        <circle cx="50" cy="50" r="46" class="q-track" />
        <circle cx="50" cy="50" r="46" class="q-progress" style="stroke-dasharray: {RING}; stroke-dashoffset: {ring};" />
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="q-glyph">
        {#if status === 'playing'}
          <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
        {:else}
          <path d="M8 5.5v13l10.5-6.5z" />
        {/if}
      </svg>
    </button>
    <p class="q-status" role="status" aria-live="polite">
      {#if status === 'loading'}Henter opptak …
      {:else if status === 'playing'}Spiller ({Math.ceil(Math.max(0, CLIP - elapsed))} s igjen)
      {:else if status === 'paused'}Pause
      {:else if status === 'done'}Ferdig med utdraget
      {:else if message}<span class="q-error">{message}</span>
      {:else}Trykk for å høre omtrent {CLIP} sekunder
      {/if}
    </p>
    <button type="button" class="secondary q-replay" onclick={replay} disabled={status === 'loading'}>Spill igjen</button>
  </div>

  <div class="s-choices" role="group" aria-label="Svaralternativer">
    {#each target.choices as choice, i (choice)}
      <button type="button" class="s-choice {classFor(choice) === 'correct' ? 'is-correct' : classFor(choice) === 'wrong' ? 'is-wrong' : ''}" aria-pressed={draft.choice === choice} disabled={revealed} onclick={() => choose(choice)}>
        <span class="s-choice-key" aria-hidden="true">{'ABCD'[i] || i + 1}</span><span class="s-choice-label">{choice}</span>
      </button>
    {/each}
  </div>

  {#if revealed}
    <div class="q-facts">
      <p><strong>{target.title}</strong> av {target.composer}</p>
      <p>{target.approximate ? 'ca. ' : ''}{target.year} · {target.era}</p>
      {#if recording}
        <p>Utøver: {recording.artist ?? 'ukjent'}</p>
        <p>
          Lisens: {recording.license}
          {#if recording.licenseUrl}(<a href={recording.licenseUrl} target="_blank" rel="noopener noreferrer">les mer</a>){/if}
        </p>
        <p><a href={recording.descriptionUrl} target="_blank" rel="noopener noreferrer">Opptaket på Wikimedia Commons</a></p>
      {:else if credit === 'offline'}
        <p class="q-error">{OFFLINE}</p>
      {:else if credit === 'missing'}
        <p>{MISSING}</p>
      {:else}
        <p>Henter kreditering …</p>
      {/if}
      {#if target.sources?.length}
        <p class="q-sources">
          {#each target.sources as source (source.url)}
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</section>
