<script>
  import { onMount } from 'svelte';
  import '../lib/design.css';
  import '../lib/styles/today.css';
  import '../lib/styles/atlas-me.css';
  import '../lib/styles/quizoff.css';
  import '../lib/styles/desktop.css';
  import '../lib/styles/boring.css';
  import { applyLook, storedLook } from '../lib/look.js';

  // Show the chosen look before the database opens; the page confirms it from the saved preferences.
  if (typeof document !== 'undefined') applyLook(storedLook());

  let { children } = $props();
  let active = $state('today');
  let status = $state('');
  // True while a quiz-off is going on and another tab is open: the Quiz-off tab gets a dot.
  let quizoffLive = $state(false);
  const navigation = [
    { id: 'today', label: 'I dag' },
    { id: 'atlas', label: 'Atlas' },
    { id: 'quizoff', label: 'Quiz-off' },
    { id: 'me', label: 'Deg' }
  ];
  // Older links keep working: they open the part of Atlas or Deg that replaced them.
  const legacy = { learn: 'atlas', world: 'atlas', explore: 'atlas', focus: 'me', progress: 'me', settings: 'me' };

  onMount(() => {
    const syncRoute = () => {
      const hash = location.hash.slice(1).split('/')[0];
      const id = legacy[hash] || hash;
      active = navigation.some(item => item.id === id) ? id : 'today';
    };
    const updateStatus = event => {
      if (typeof event.detail === 'string') status = event.detail;
    };
    const updateQuizoff = event => { quizoffLive = event.detail === true; };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('atlas-status', updateStatus);
    window.addEventListener('atlas-quizoff-live', updateQuizoff);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('atlas-status', updateStatus);
      window.removeEventListener('atlas-quizoff-live', updateQuizoff);
    };
  });

  function skipToContent(event) {
    event.preventDefault();
    const main = document.getElementById('main-view');
    main?.focus();
    main?.scrollIntoView({ block: 'start' });
  }

  function navigate(id) {
    // Tapping the tab you are on goes back to its start and to the top, as in other iPhone apps.
    if (active === id && location.hash.slice(1).split('/')[0] === id) {
      window.dispatchEvent(new CustomEvent('atlas-tab-again', { detail: id }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    active = id;
    location.hash = id;
  }
</script>

<a class="skip-link" href="#main-view" onclick={skipToContent}>Hopp til innhold</a>
<div class="app-shell">
  <header class="app-header">
    <a href="#today" aria-label="Atlas hjem" class="brand">
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none"><path d="m16 4 10 24-10-5.5L6 28 16 4Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M16 4v18.5" stroke="currentColor" stroke-width="1.5"/></svg>
      </span>
      <span class="wordmark">atlas</span>
    </a>
    {#if status}<span id="connection" class="status" aria-live="polite">{status}</span>{/if}
  </header>
  {@render children()}
</div>
<nav class="bottom-nav" aria-label="Hovedmeny">
  {#each navigation as item}
    <button type="button" class="nav-button" class:active={active === item.id} data-nav={item.id} aria-current={active === item.id ? 'page' : undefined} onclick={() => navigate(item.id)}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {#if item.id === 'today'}
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>
        {:else if item.id === 'atlas'}
          <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>
        {:else if item.id === 'quizoff'}
          <circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.9-3 2.9-4.7 5.5-4.7 1.6 0 3 .6 4 1.8 1-1.2 2.4-1.8 4-1.8 2.6 0 4.6 1.7 5.5 4.7"/>
        {:else}
          <circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.4-6 8-6s6.5 2 8 6"/>
        {/if}
      </svg>
      <span>{item.label}</span>
      {#if item.id === 'quizoff' && quizoffLive && active !== 'quizoff'}<span class="nav-dot"><span class="sr-only">, spillet pågår</span></span>{/if}
    </button>
  {/each}
</nav>
