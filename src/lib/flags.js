// Country flags are SVG images from one bundle, loaded on first use and cached by the service worker.
let bundle;

export const hasFlag = iso2 => /^[A-Z]{2}$/.test(iso2 || '');

export async function flagSrc(iso2) {
  if (!hasFlag(iso2)) return '';
  bundle ??= fetch('/flags.json').then(r => r.ok ? r.json() : Promise.reject(new Error('Flaggene kunne ikke lastes.')));
  try {
    const svg = (await bundle)[iso2.toLowerCase()];
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  } catch {
    bundle = undefined;
    return '';
  }
}
