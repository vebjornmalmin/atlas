import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOKS, DEFAULT_LOOK, normalizeLook, storedLook, applyLook} from '../src/lib/look.js';
import {DEFAULT_PREFERENCES} from '../src/lib/learning.js';

const memoryStorage = () => { const map = new Map(); return {getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v))}; };
const fakeDocument = () => {
  const metas = [{media: '(prefers-color-scheme: light)', content: '', setAttribute(_, v) { this.content = v; }}, {media: '(prefers-color-scheme: dark)', content: '', setAttribute(_, v) { this.content = v; }}];
  return {documentElement: {dataset: {}}, querySelectorAll: () => metas, metas};
};

test('the three looks are Morsom, Normal and Kjedelig, and new users get Morsom', () => {
  assert.deepEqual(LOOKS.map(l => l.label), ['Morsom', 'Normal', 'Kjedelig']);
  assert.equal(DEFAULT_LOOK, 'fun');
  assert.equal(DEFAULT_PREFERENCES.look, 'fun');
});

test('an unknown or missing look falls back to the default', () => {
  assert.equal(normalizeLook('boring'), 'boring');
  assert.equal(normalizeLook(undefined), 'fun');
  assert.equal(normalizeLook('neon'), 'fun');
  assert.equal(storedLook(undefined), 'fun');
  assert.equal(storedLook({getItem() { throw new Error('blocked'); }}), 'fun');
});

test('applying a look sets it on the page, matches the status bar and remembers it', () => {
  const doc = fakeDocument(), storage = memoryStorage();
  assert.equal(applyLook('boring', doc, storage), 'boring');
  assert.equal(doc.documentElement.dataset.look, 'boring');
  assert.deepEqual(doc.metas.map(m => m.content), ['#ffffff', '#1c1c1c']);
  assert.equal(storedLook(storage), 'boring');
  applyLook('normal', doc, storage);
  assert.deepEqual(doc.metas.map(m => m.content), ['#f3f0e6', '#141914']);
});

test('a look still applies when storage is blocked', () => {
  const doc = fakeDocument();
  assert.equal(applyLook('normal', doc, {setItem() { throw new Error('private mode'); }}), 'normal');
  assert.equal(doc.documentElement.dataset.look, 'normal');
});
