// The app's visual style ("stil"), chosen in Innstillinger. It is set as data-look on <html>;
// design.css is the Normal look, styles/desktop.css adds Morsom and styles/boring.css adds Kjedelig.
// A copy is kept in localStorage so the right look is on screen before the database has opened.
export const LOOKS = [
  {id: 'fun', label: 'Morsom', note: 'Vinduer, sterke farger og knapper som trykkes inn.'},
  {id: 'normal', label: 'Normal', note: 'Papir og blekk, dyp grønn og rolig typografi.'},
  {id: 'boring', label: 'Kjedelig', note: 'Grått, firkantet og helt uten pynt.'}
];
export const DEFAULT_LOOK = 'fun';
const STORAGE_KEY = 'atlas-look';
// Status bar colour for each look, light then dark. They match the page background behind the status bar.
const BAR_COLOURS = {fun: ['#8f868a', '#3b3447'], normal: ['#f3f0e6', '#141914'], boring: ['#ffffff', '#1c1c1c']};

export const normalizeLook = look => LOOKS.some(item => item.id === look) ? look : DEFAULT_LOOK;

export function storedLook(storage = globalThis.localStorage) {
  try { return normalizeLook(storage?.getItem(STORAGE_KEY)); } catch { return DEFAULT_LOOK; }
}

export function applyLook(look, doc = globalThis.document, storage = globalThis.localStorage) {
  const id = normalizeLook(look);
  if (!doc) return id;
  doc.documentElement.dataset.look = id;
  const [light, dark] = BAR_COLOURS[id];
  for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', meta.media?.includes('dark') ? dark : light);
  try { storage?.setItem(STORAGE_KEY, id); } catch { /* Private mode: the look still applies for this visit. */ }
  return id;
}
