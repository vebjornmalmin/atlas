import test from 'node:test';
import assert from 'node:assert/strict';
import {LISTENING_WORKS} from '../src/lib/listening/works.js';
import {buildListeningTargets, gradeListening, listeningReady} from '../src/lib/listening/exercises.js';
import {findRecording, isFreeLicence, toRecording, stripHtml} from '../src/lib/listening/commons.js';

const ERAS = ['barokk', 'wienerklassisisme', 'romantikk', 'nasjonalromantikk', '1900-tallet'];

test('works are unique, sourced and plausibly dated', () => {
  assert.ok(LISTENING_WORKS.length >= 25 && LISTENING_WORKS.length <= 40, `unexpected count ${LISTENING_WORKS.length}`);
  const ids = new Set();
  const titles = new Set();
  for (const work of LISTENING_WORKS) {
    assert.ok(!ids.has(work.id), `duplicate id ${work.id}`);
    ids.add(work.id);
    assert.ok(work.title && work.composer && work.commonsSearch, `${work.id}: missing field`);
    assert.ok(!titles.has(work.title), `duplicate title ${work.title}`);
    titles.add(work.title);
    assert.ok(work.year >= 1600 && work.year <= 1930, `${work.id}: implausible year ${work.year}`);
    assert.ok(ERAS.includes(work.era), `${work.id}: unknown era ${work.era}`);
    assert.ok(work.sources.length >= 1, `${work.id}: no sources`);
    for (const source of work.sources) assert.match(source.url, /^https:\/\//, `${work.id}: source must be https`);
  }
});

test('every listening target has four stable choices with the answer exactly once', () => {
  const first = buildListeningTargets();
  const second = buildListeningTargets();
  assert.deepEqual(first, second, 'targets must be deterministic');
  const ids = new Set();
  for (const target of first) {
    assert.ok(!ids.has(target.id), `duplicate target ${target.id}`);
    ids.add(target.id);
    assert.equal(target.mode, 'listen');
    assert.equal(target.kind, 'recognition');
    assert.deepEqual(target.collectionIds, ['kunst-musikk']);
    assert.equal(target.requiresNetwork, true);
    assert.ok([1, 2, 3].includes(target.familiarity));
    assert.equal(target.choices.length, 4, target.id);
    assert.equal(new Set(target.choices).size, 4, `${target.id}: choices must be distinct`);
    assert.equal(target.choices.filter(c => c === target.answer).length, 1, `${target.id}: answer must appear once`);
    assert.ok(target.sources.length >= 1);
  }
  assert.ok(ids.has('listen:maanesonaten') && ids.has('listen-composer:maanesonaten'));
});

test('composer variant offers composers and work variant offers titles', () => {
  const composer = buildListeningTargets().find(t => t.id === 'listen-composer:maanesonaten');
  assert.equal(composer.ask, 'composer');
  assert.equal(composer.answer, 'Ludwig van Beethoven');
  const work = buildListeningTargets().find(t => t.id === 'listen:maanesonaten');
  assert.equal(work.answer, 'Måneskinnssonaten');
  assert.ok(work.choices.every(c => LISTENING_WORKS.some(w => w.title === c)));
});

test('grading and readiness use the chosen label', () => {
  const target = buildListeningTargets().find(t => t.id === 'listen:maanesonaten');
  const wrong = target.choices.find(c => c !== target.answer);
  assert.equal(listeningReady(target, {}), false);
  assert.equal(listeningReady(target, {choice: wrong}), true);
  assert.deepEqual(gradeListening(target, {choice: target.answer}), {correct: true});
  assert.deepEqual(gradeListening(target, {choice: wrong}), {correct: false});
  assert.deepEqual(gradeListening(target, {}), {correct: false});
});

test('licence filter accepts public domain, CC0 and CC BY(-SA) only', () => {
  for (const ok of ['Public domain', 'CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0', 'cc by-sa 2.5']) assert.equal(isFreeLicence(ok), true, ok);
  for (const bad of ['CC BY-NC-SA 4.0', 'CC BY-ND 4.0', 'GFDL', '', 'All rights reserved']) assert.equal(isFreeLicence(bad), false, bad);
});

test('html artist credits are stripped to plain text', () => {
  assert.equal(stripHtml('<a href="/x">Jane &amp; Co</a><br/>Orchestra'), 'Jane & Co Orchestra');
});

function page(index, title, {license, mime = 'audio/ogg', url = `https://upload.wikimedia.org/${index}.ogg`, derivatives = []} = {}) {
  return {
    index, title,
    imageinfo: [{url, mime, extmetadata: {LicenseShortName: {value: license}, Artist: {value: '<span>Test &amp; Orkester</span>'}, LicenseUrl: {value: 'https://creativecommons.org/licenses/by-sa/4.0/'}}}],
    videoinfo: [{derivatives}]
  };
}

function mockFetch(pages, {ok = true, status = 200} = {}) {
  const calls = [];
  const fetch = async url => {
    calls.push(String(url));
    return {ok, status, json: async () => ({query: {pages: Object.fromEntries(pages.map((p, i) => [i + 1, p]))}})};
  };
  return {fetch, calls};
}

const work = {id: 'test-work', commonsSearch: 'Test Work'};

test('commons picks the first free file and prefers an mp3 transcode', async () => {
  const {fetch, calls} = mockFetch([
    page(1, 'File:Noncommercial.ogg', {license: 'CC BY-NC 4.0'}),
    page(2, 'File:Free.ogg', {license: 'CC BY-SA 4.0', derivatives: [{type: 'audio/mpeg', src: 'https://upload.wikimedia.org/transcoded/Free.ogg.mp3'}]}),
    page(3, 'File:Other.ogg', {license: 'Public domain'})
  ]);
  const recording = await findRecording(work, {fetch, cache: new Map()});
  assert.equal(recording.url, 'https://upload.wikimedia.org/transcoded/Free.ogg.mp3');
  assert.equal(recording.title, 'Free.ogg');
  assert.equal(recording.license, 'CC BY-SA 4.0');
  assert.equal(recording.artist, 'Test & Orkester');
  assert.equal(recording.descriptionUrl, 'https://commons.wikimedia.org/wiki/File:Free.ogg');
  assert.equal(recording.mime, 'audio/mpeg');
  assert.match(calls[0], /commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(calls[0], /origin=%2A|origin=\*/);
  assert.match(calls[0], /gsrsearch=filetype%3Aaudio\+Test\+Work|gsrsearch=filetype:audio\+Test\+Work/);
});

test('commons rejects non-free licences and ogg originals without a transcode', async () => {
  const {fetch} = mockFetch([
    page(1, 'File:Restricted.mp3', {license: 'CC BY-ND 4.0', mime: 'audio/mpeg'}),
    page(2, 'File:OggOnly.ogg', {license: 'Public domain', mime: 'audio/ogg'})
  ]);
  assert.equal(await findRecording(work, {fetch, cache: new Map()}), null);
});

test('commons falls back to an mp3 or wav original when there is no transcode', () => {
  const mp3 = toRecording(page(1, 'File:Plain.mp3', {license: 'Public domain', mime: 'audio/mpeg', url: 'https://upload.wikimedia.org/plain.mp3'}));
  assert.equal(mp3.url, 'https://upload.wikimedia.org/plain.mp3');
  const wav = toRecording(page(1, 'File:Plain.wav', {license: 'CC0', mime: 'audio/wav', url: 'https://upload.wikimedia.org/plain.wav'}));
  assert.equal(wav.url, 'https://upload.wikimedia.org/plain.wav');
});

test('commons caches per work id, does not cache failures, and surfaces network errors', async () => {
  const cache = new Map();
  const ok = mockFetch([page(1, 'File:A.ogg', {license: 'CC0', derivatives: [{type: 'audio/mpeg', src: 'https://upload.wikimedia.org/a.mp3'}]})]);
  await findRecording(work, {fetch: ok.fetch, cache});
  await findRecording(work, {fetch: ok.fetch, cache});
  assert.equal(ok.calls.length, 1);

  const failing = mockFetch([], {ok: false, status: 503});
  await assert.rejects(findRecording({id: 'other', commonsSearch: 'x'}, {fetch: failing.fetch, cache}));
  assert.equal(cache.has('other'), false);
});
