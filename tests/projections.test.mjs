import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geoArea } from 'd3-geo';
import { PROJECTIONS, worldFeatures, regionFeature, projectWorld, turnGlobe, rotationFor, dragRotation, interpolateRotation, globeDisc } from '../src/lib/projections.js';
import { pathBounds, parseBox, regionAnchor } from '../src/lib/map-view.js';

const dataset = JSON.parse(await readFile(new URL('../public/maps/world.json', import.meta.url), 'utf8'));
const features = worldFeatures(dataset);
const index = id => dataset.regions.findIndex(r => r.id === id);

test('the flat map reads back as longitude and latitude with every ring on the small side of the globe', () => {
  assert.equal(features.length, dataset.regions.length);
  for (const feature of features) assert.ok(geoArea(feature) < 2 * Math.PI, feature.id);
  // Norway lies between about 4° and 31° east, 58° and 71° north (Svalbard reaches 80°).
  const coords = features[index('nor')].geometry.coordinates.flat(2);
  assert.ok(coords.every(([lon, lat]) => lon > 3 && lon < 34 && lat > 57 && lat < 81));
  // Lesotho is a hole in South Africa, not a second piece of it.
  const zaf = regionFeature(dataset.regions[index('zaf')]);
  assert.ok(zaf.geometry.coordinates.some(polygon => polygon.length === 2));
});

test('every projection draws every country in a frame the map can pan and zoom', () => {
  assert.equal(new Set(PROJECTIONS.map(p => p.id)).size, PROJECTIONS.length);
  for (const { id, name, note } of PROJECTIONS) {
    assert.ok(name && note.length > 60, id);
    const world = projectWorld(dataset, features, id);
    const [, , w, h] = parseBox(world.viewBox);
    assert.ok(w > 0 && h > 0, id);
    assert.equal(world.regions.length, dataset.regions.length, id);
    assert.deepEqual(world.regions.map(r => r.id), dataset.regions.map(r => r.id), id);
    const visible = world.regions.filter(r => r.path);
    assert.ok(visible.length > (id === 'globe' ? 60 : 170), `${id}: ${visible.length}`);
    for (const region of visible) assert.ok(pathBounds(region.path), `${id} ${region.id}`);
    assert.ok(regionAnchor(world.regions[index('nor')].path), id);
  }
  assert.equal(projectWorld(dataset, features, 'standard').regions, dataset.regions);
});

test('the globe turns to a country and hides the far side', () => {
  const towardNorway = rotationFor(features[index('nor')]);
  const globe = projectWorld(dataset, features, 'globe', { rotation: towardNorway });
  assert.ok(globe.regions[index('nor')].path);
  assert.equal(globe.regions[index('aus')].path, '');
  const turned = turnGlobe(globe, features, rotationFor(features[index('aus')]));
  assert.ok(turned.regions[index('aus')].path);
  assert.equal(turned.regions[index('nor')].path, '');
  assert.equal(turned.viewBox, globe.viewBox, 'the disc keeps its place while it turns');
  assert.deepEqual(globeDisc(turned), globeDisc(globe));
  assert.equal(globeDisc(projectWorld(dataset, features, 'mercator')), null);
});

test('dragging stops at the poles and gliding takes the short way round', () => {
  assert.equal(dragRotation([0, 80], 0, -1000, 300)[1], 89);
  assert.equal(dragRotation([0, -80], 0, 1000, 300)[1], -89);
  const [lon] = dragRotation([0, 0], 300, 0, 300);
  assert.ok(Math.abs(lon - 180 / Math.PI) < 1e-9, 'a drag of one radius turns one radian');
  const glide = interpolateRotation([170, 0], [-170, 10]);
  assert.deepEqual(glide(.5), [180, 5]);
});
