import test from 'node:test';
import assert from 'node:assert/strict';
import {readUiState,saveUiState,uiDefaults,UI_FRESH_HOURS} from '../src/lib/ui-state.js';

const memory = () => { const data = new Map(); return {getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v))}; };
const HOUR = 3600e3;
const visit = {...uiDefaults(), view: 'atlas', atlasTab: 'emner', meTab: 'innstillinger', progressTab: 'levels', query: 'Ibsen', selectedUnit: 'nh-1814',
  detailId: 'person:ibsen', quizSetup: true, quizoff: true, quiz: {collection: 'world-geography', level: 3, mode: 'map'}, timeline: {zoom: 'nineteenth', domain: 'verdenshistorie', selectedId: 'vh-napoleon'}, scrollY: 640};

test('reopening the app soon after returns to the same place with the same choices', () => {
  const storage = memory();
  saveUiState(storage, visit, 1000);
  assert.deepEqual(readUiState(storage, 1000 + 2 * HOUR), visit);
});

test('after a long break the app opens on I dag but keeps tabs, timeline view and quiz choices', () => {
  const storage = memory();
  saveUiState(storage, visit, 1000);
  const state = readUiState(storage, 1000 + (UI_FRESH_HOURS + 1) * HOUR);
  assert.equal(state.view, 'today');
  assert.equal(state.detailId, '');
  assert.equal(state.query, '');
  assert.equal(state.quizSetup, false);
  assert.equal(state.quizoff, false);
  assert.equal(state.scrollY, 0);
  assert.equal(state.timeline.selectedId, '');
  assert.equal(state.atlasTab, 'emner');
  assert.equal(state.meTab, 'innstillinger');
  assert.deepEqual(state.quiz, visit.quiz);
  assert.equal(state.timeline.zoom, 'nineteenth');
  assert.equal(state.timeline.domain, 'verdenshistorie');
});

test('missing, damaged or foreign saved state falls back to the defaults', () => {
  assert.deepEqual(readUiState(memory()), uiDefaults());
  const broken = memory(); broken.setItem('atlas-ui', '{not json');
  assert.deepEqual(readUiState(broken), uiDefaults());
  const odd = memory();
  odd.setItem('atlas-ui', JSON.stringify({at: 1000, view: 'admin', atlasTab: 7, quiz: {level: 99, mode: {}}, timeline: 'x', scrollY: -5, query: {}, quizoff: 'yes'}));
  const state = readUiState(odd, 2000);
  assert.equal(state.view, 'today');
  assert.equal(state.atlasTab, 'tid');
  assert.equal(state.quiz.level, 2);
  assert.equal(state.quiz.mode, 'mixed');
  assert.deepEqual(state.timeline, {zoom: '', domain: '', selectedId: ''});
  assert.equal(state.scrollY, 0);
  assert.equal(state.query, '');
  assert.equal(state.quizoff, false);
});

test('a clock that moved backwards does not count as a fresh visit', () => {
  const storage = memory();
  saveUiState(storage, visit, 10 * HOUR);
  assert.equal(readUiState(storage, 2 * HOUR).view, 'today');
});

test('a progress view that no longer exists opens the overview instead of an empty page', () => {
  const storage = memory();
  storage.setItem('atlas-ui', JSON.stringify({...visit, progressTab: 'library', at: 1000}));
  assert.equal(readUiState(storage, 2000).progressTab, 'overview');
});
