<script>
  import {flagSrc} from './flags.js';
  // size: inline (beside a name), medium (headings), choice (answer options) or large (the flag being asked about).
  // label is only for flags that carry meaning on their own; it must never name the country before an answer.
  let {iso2, size = 'inline', label = ''} = $props();
  let src = $state('');
  $effect(() => {
    let live = true;
    src = '';
    flagSrc(iso2).then(value => { if (live) src = value; });
    return () => { live = false; };
  });
</script>

<span class="flag {size}" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>{#if src}<img {src} alt="" draggable="false">{/if}</span>

<style>
  .flag{display:inline-block;flex-shrink:0;aspect-ratio:4/3;vertical-align:-.15em;background:var(--surface-2);box-shadow:0 0 0 1px var(--line);border-radius:2px;overflow:hidden}
  .flag img{display:block;width:100%;height:100%;object-fit:cover;border-radius:0}
  .inline{width:1.25em;margin-right:.35em}
  .medium{width:44px;border-radius:3px}
  .choice{display:block;width:min(100%,128px);border-radius:3px}
  .large{display:block;width:min(64%,220px);margin:6px auto 14px;border-radius:4px;box-shadow:0 0 0 1px var(--line),0 10px 28px #1b231a1f}
</style>
