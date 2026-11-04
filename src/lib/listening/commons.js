// Henter innspillinger fra Wikimedia Commons ved kjøretid. Lydfiler bundles aldri i appen.
const API = 'https://commons.wikimedia.org/w/api.php';
const MP3 = 'audio/mpeg';
const PLAYABLE_ORIGINALS = [MP3, 'audio/wav', 'audio/x-wav'];

/** Godtar offentlig domene, CC0 og CC BY / CC BY-SA. Alt annet (NC, ND, GFDL, ukjent) avvises. */
export function isFreeLicence(name = '') {
  const value = String(name).trim().toLowerCase();
  if (/^public domain/.test(value)) return true;
  if (/^cc0(\s|$)/.test(value)) return true;
  return /^cc by(-sa)?(\s+\d(\.\d)?)?(\s+unported)?$/.test(value);
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const defaultCache = new Map();

function descriptionUrlFor(title) {
  const path = title.replace(/ /g, '_');
  return `https://commons.wikimedia.org/wiki/${encodeURI(path)}`;
}

/** Velger en avspillbar fil fra et Commons-treff, eller null hvis lisens eller format ikke passer. */
export function toRecording(page) {
  const image = page.imageinfo?.[0] ?? {};
  const video = page.videoinfo?.[0] ?? {};
  const meta = image.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? '';
  if (!isFreeLicence(license)) return null;
  const transcoded = (video.derivatives ?? []).find(d => d.type === MP3 && d.src);
  const original = PLAYABLE_ORIGINALS.includes(image.mime) ? image.url : null;
  const url = transcoded?.src ?? original;
  if (!url) return null;
  const title = String(page.title ?? '').replace(/^File:/, '');
  return {
    url,
    title,
    artist: stripHtml(meta.Artist?.value ?? '') || null,
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    descriptionUrl: descriptionUrlFor(page.title ?? ''),
    duration: typeof video.duration === 'number' ? video.duration : null,
    mime: transcoded ? MP3 : image.mime
  };
}

export function searchUrl(work) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrnamespace: '6', gsrlimit: '8',
    gsrsearch: `filetype:audio ${work.commonsSearch}`,
    prop: 'imageinfo|videoinfo', iiprop: 'url|extmetadata|mime|size', viprop: 'derivatives'
  });
  return `${API}?${params}`;
}

/**
 * Finner første lisensierte avspillbare innspilling for et verk.
 * Returnerer null når Commons ikke har en brukbar fil. Kaster feil ved nettverksproblemer.
 * Resultater (også null) caches i minnet per verk-id; feil caches ikke.
 */
export function findRecording(work, {fetch: fetchImpl = globalThis.fetch, cache = defaultCache} = {}) {
  if (cache.has(work.id)) return cache.get(work.id);
  const pending = (async () => {
    const response = await fetchImpl(searchUrl(work));
    if (!response?.ok) throw new Error(`commons-http-${response?.status ?? 'ukjent'}`);
    const data = await response.json();
    const pages = Object.values(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const page of pages) {
      const recording = toRecording(page);
      if (recording) return recording;
    }
    return null;
  })();
  cache.set(work.id, pending);
  pending.catch(() => cache.delete(work.id));
  return pending;
}

export function clearRecordingCache(cache = defaultCache) {
  cache.clear();
}
