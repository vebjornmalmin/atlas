<script>
  import { onMount } from 'svelte';
  import '../lib/design.css';

  let { children } = $props();
  let active = $state('today');
  let status = $state('Starter');
  const navigation = [
    { id: 'today', label: 'I dag' },
    { id: 'learn', label: 'Emner' },
    { id: 'world', label: 'Verden' },
    { id: 'explore', label: 'Søk' },
    { id: 'progress', label: 'Fremgang' },
    { id: 'settings', label: 'Innstillinger' }
  ];

  onMount(() => {
    const syncRoute = () => {
      const hash = location.hash.slice(1).split('/')[0];
      active = navigation.some(item => item.id === hash) ? hash : 'today';
    };
    const syncConnection = () => { status = navigator.onLine ? '' : 'Uten nett'; };
    const updateStatus = event => {
      if (typeof event.detail === 'string') status = event.detail;
    };
    syncRoute();
    syncConnection();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    window.addEventListener('atlas-status', updateStatus);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
      window.removeEventListener('atlas-status', updateStatus);
    };
  });

  function skipToContent(event) {
    event.preventDefault();
    const main = document.getElementById('main-view');
    main?.focus();
    main?.scrollIntoView({ block: 'start' });
  }

  function navigate(id) {
    active = id;
    location.hash = id;
  }
</script>

<a class="skip-link" href="#main-view" onclick={skipToContent}>Hopp til innhold</a>
<div class="app-shell">
  <header class="app-header">
    <a href="#today" aria-label="Atlas hjem" class="brand">
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none"><path d="m16 5 9 22-9-5-9 5L16 5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 5v17M10 19h12" stroke="currentColor" stroke-width="1.25"/></svg>
      </span>
      <span>atlas</span>
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
        {:else if item.id === 'learn'}
          <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4Z"/><path d="M9 8h6M9 12h6"/>
        {:else if item.id === 'world'}
          <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/>
        {:else if item.id === 'explore'}
          <path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5v14c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5v-14Z"/><path d="M12 6v14"/>
        {:else if item.id === 'progress'}
          <path d="M4 4v16h16M8 15l4-4 4 2 5-7"/><path d="M17 6h4v4"/>
        {:else}
          <path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>
        {/if}
      </svg>
      <span>{item.label}</span>
    </button>
  {/each}
</nav>
