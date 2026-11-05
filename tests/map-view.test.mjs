import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseBox,pathBounds,neighbourhoodFrame,regionFrame,nearestPieceBounds} from '../src/lib/map-view.js';

const world = JSON.parse(fs.readFileSync(new URL('../public/maps/world.json', import.meta.url)));
const width = parseBox(world.viewBox)[2];
const bounds = id => pathBounds(world.regions.find(r => r.id === id).path, true);
const inside = (inner, outer) => inner[0] >= outer[0] && inner[1] >= outer[1] && inner[0] + inner[2] <= outer[0] + outer[2] && inner[1] + inner[3] <= outer[1] + outer[3];

test('a chosen country is framed together with its neighbours', () => {
  const frame = neighbourhoodFrame(bounds('nor'), [bounds('swe'), bounds('fin')], width);
  for (const id of ['nor', 'swe', 'fin']) assert.ok(inside(bounds(id), frame), `${id} is in view`);
  assert.ok(frame[2] < width / 2, 'the frame is closer than the whole world');
});

test('a tiny country keeps enough surroundings to recognise where it is', () => {
  const frame = neighbourhoodFrame(bounds('lux'), [], width);
  assert.ok(frame[2] >= width * .1 - 1e-9);
  assert.ok(inside(bounds('lux'), frame));
});

test('a neighbourhood wider than most of the world falls back to the country itself', () => {
  const near = ['chn', 'kaz', 'mng', 'fin', 'nor', 'ukr', 'blr'].map(bounds);
  const frame = neighbourhoodFrame(bounds('rus'), near, width);
  assert.ok(inside(bounds('rus'), frame));
  assert.ok(frame[2] <= Math.max(width * .6, bounds('rus')[2] * 1.7));
  assert.equal(neighbourhoodFrame(null, [], width), null);
});

const pathOf = id => world.regions.find(r => r.id === id)?.path;
const contains = (box, x, y) => x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3];

test('a neighbour across an ocean counts only with the part that borders the country', () => {
  // France borders Brazil through French Guiana; the frame must not reach mainland France.
  const frame = regionFrame(pathOf, 'bra', ['arg', 'ury', 'pry', 'bol', 'per', 'col', 'ven', 'guy', 'sur', 'fra'], width);
  const paris = bounds('fra');
  assert.ok(inside(bounds('bra'), frame), 'Brazil is in view');
  assert.ok(!contains(frame, paris[0] + paris[2] / 2, paris[1] + paris[3] / 2), 'mainland France is not');
  const guiana = nearestPieceBounds(pathOf('fra'), bounds('bra'));
  assert.ok(inside(guiana, frame), 'French Guiana is');
  assert.ok(frame[2] < width * .3, `${frame[2]} is a close-up of South America`);
});

test('a huge neighbour does not pull the frame away from a small country', () => {
  const frame = regionFrame(pathOf, 'aze', ['rus', 'irn', 'tur', 'arm', 'geo'], width);
  for (const id of ['aze', 'arm', 'geo']) assert.ok(inside(bounds(id), frame), `${id} is in view`);
  assert.ok(frame[2] < width * .15, `${frame[2]} stays on the Caucasus`);
});

test('Norway still opens on Scandinavia rather than all of Russia', () => {
  const frame = regionFrame(pathOf, 'nor', ['fin', 'rus', 'swe'], width);
  for (const id of ['nor', 'swe', 'fin']) assert.ok(inside(bounds(id), frame), `${id} is in view`);
  assert.ok(frame[2] < width * .25, `${frame[2]}`);
});
