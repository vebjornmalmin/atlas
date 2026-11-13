// Where the learner was in the app, kept on this device so that closing and reopening returns there.
// Only navigation and choices live here; answers, progress and the active session are stored in
// IndexedDB and the session journal. After a long break the app opens on I dag again, but keeps
// the tabs, timeline view and quiz choices the learner had picked. A quiz-off saved on the phone
// (client.js) reopens its tab on its own, however long the break.
const KEY = 'atlas-ui';
export const UI_FRESH_HOURS = 12;
const VIEWS = ['today', 'atlas', 'quizoff', 'me'];
const ATLAS_TABS = ['tid', 'kart', 'emner'];
const ME_TABS = ['fremgang', 'okten', 'innstillinger'];
const PROGRESS_TABS = ['overview', 'levels', 'topics', 'history'];

export const uiDefaults = () => ({
  view: 'today', atlasTab: 'tid', meTab: 'fremgang', progressTab: 'overview',
  query: '', collectionFilter: '', selectedUnit: '', detailId: '',
  quizSetup: false, quiz: {collection: '', level: 2, mode: 'mixed'},
  timeline: {zoom: '', domain: '', selectedId: ''},
  scrollY: 0
});

const text = (value, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

/** The saved state, checked field by field so a damaged or older entry can't break the app. */
export function readUiState(storage, now = Date.now()) {
  const state = uiDefaults();
  let saved;
  try { saved = JSON.parse(storage.getItem(KEY)); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return state;
  // Before 1.11.0 quiz-off was a screen on I dag, remembered with a flag of its own.
  state.view = saved.quizoff === true && saved.view === 'today' ? 'quizoff' : oneOf(saved.view, VIEWS, state.view);
  state.atlasTab = oneOf(saved.atlasTab, ATLAS_TABS, state.atlasTab);
  state.meTab = oneOf(saved.meTab, ME_TABS, state.meTab);
  state.progressTab = oneOf(saved.progressTab, PROGRESS_TABS, state.progressTab);
  state.query = text(saved.query);
  state.collectionFilter = text(saved.collectionFilter, 80);
  state.selectedUnit = text(saved.selectedUnit, 120);
  state.detailId = text(saved.detailId, 200);
  state.quizSetup = saved.quizSetup === true;
  const quiz = saved.quiz || {};
  state.quiz = {collection: text(quiz.collection, 80), level: Number.isInteger(quiz.level) && quiz.level >= 0 && quiz.level <= 5 ? quiz.level : state.quiz.level, mode: text(quiz.mode, 40) || state.quiz.mode};
  const timeline = saved.timeline || {};
  state.timeline = {zoom: text(timeline.zoom, 40), domain: text(timeline.domain, 80), selectedId: text(timeline.selectedId, 120)};
  state.scrollY = Number.isFinite(saved.scrollY) && saved.scrollY > 0 ? Math.round(saved.scrollY) : 0;
  const fresh = Number.isFinite(saved.at) && now - saved.at >= 0 && now - saved.at < UI_FRESH_HOURS * 3600e3;
  if (!fresh) Object.assign(state, {view: 'today', query: '', selectedUnit: '', detailId: '', quizSetup: false, scrollY: 0, timeline: {...state.timeline, selectedId: ''}});
  return state;
}

export function saveUiState(storage, state, now = Date.now()) {
  storage.setItem(KEY, JSON.stringify({...state, at: now}));
}
