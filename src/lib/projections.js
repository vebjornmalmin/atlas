// Map projections for Atlas → Kart. The world map ships as equirectangular SVG paths
// (x = 2(lon + 180), y = 2(85 − lat)), so longitude and latitude can be read straight back
// from the paths and drawn again in any projection. The quizzes keep the flat map.
import {geoArea, geoCentroid, geoEqualEarth, geoGraticule10, geoMercator, geoOrthographic, geoAzimuthalEquidistant, geoPath} from 'd3-geo';
import {geoBonne, geoInterruptedHomolosine, geoPeirceQuincuncial} from 'd3-geo-projection';

export const WIDTH = 720;
export const OSLO = [10.75, 59.91];

/** The projections a learner can choose, each with what it keeps and what it gives up. */
export const PROJECTIONS = [
  {id: 'standard', name: 'Standard', kind: 'Ekvirektangulær', note: 'Lengde- og breddegrader blir et rutenett av like store ruter. Enkelt å regne med, men landene strekkes mer i bredden jo nærmere polene de ligger.'},
  {id: 'globe', name: 'Globus', kind: 'Ortografisk', note: 'Jorda slik den ser ut fra langt ute i rommet. Midt på er alt riktig, men du ser bare halve kloden om gangen, og alt trykkes sammen mot kanten. Dra for å snu kloden.'},
  {id: 'mercator', name: 'Mercator', kind: 'Mercator, 1569', note: 'Laget for sjøfart: en fast kompasskurs blir en rett linje. Prisen er arealet. Grønland ser omtrent like stort ut som Afrika, men Afrika er omtrent fjorten ganger større.'},
  {id: 'equal-earth', name: 'Riktige arealer', kind: 'Equal Earth, 2018', note: 'Alle land har riktig størrelse i forhold til hverandre. Formene blir litt skjeve ut mot kantene, men ingen land vokser eller krymper.'},
  {id: 'goode', name: 'Appelsinskall', kind: 'Goodes homolosine, 1923', note: 'Kloden skrelles som et appelsinskall. Kuttene legges i havene, slik at kontinentene får riktig areal og nesten riktig form.'},
  {id: 'south-up', name: 'Sør opp', kind: 'Equal Earth, snudd', note: 'Like riktig som nord opp. At nord står øverst på kart, er en vane og ikke en naturlov. Al-Idrisis verdenskart fra 1154 hadde sør øverst.'},
  {id: 'oslo', name: 'Fra Oslo', kind: 'Asimutal ekvidistant', note: 'Avstand og retning fra Oslo er riktig til hvert eneste sted. Alt annet blir mer forvrengt jo lenger unna det ligger, og punktet rett på motsatt side av jorda, i Sørishavet, blir hele ytterkanten.'},
  {id: 'heart', name: 'Hjerte', kind: 'Werner, 1514', note: 'Et hjerteformet verdenskart fra renessansen. Arealene er riktige, men landene vris kraftig ut mot sidene.'},
  {id: 'square', name: 'Kvadrat', kind: 'Peirce, 1879', note: 'Hele kloden i et kvadrat med Nordpolen i midten. Vinklene er riktige nesten overalt, og kartet kan legges side om side i alle retninger uten skjøter.'}
];
export const projectionById = id => PROJECTIONS.find(p => p.id === id) || PROJECTIONS[0];

const signedArea = ring => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return sum / 2;
};
const inside = ([x, y], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

/** Longitude/latitude rings from one flat map path, with long edges split so they keep following parallels. */
export function ringsFromPath(path, step = 2) {
  return String(path).split(/(?=M)/).map(piece => {
    const n = piece.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const points = [];
    for (let i = 0; i + 1 < n.length; i += 2) points.push([Math.max(-180, Math.min(180, n[i] / 2 - 180)), Math.max(-90, Math.min(90, 85 - n[i + 1] / 2))]);
    if (points.length < 3) return null;
    const ring = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      ring.push(a);
      const parts = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step);
      for (let k = 1; k < parts; k++) ring.push([a[0] + (b[0] - a[0]) * k / parts, a[1] + (b[1] - a[1]) * k / parts]);
    }
    ring.push(ring[0]);
    return ring;
  }).filter(Boolean);
}

/**
 * GeoJSON polygons from the flat map. Rings inside a larger ring of the same region are holes
 * (Lesotho in South Africa). d3 reads polygons on the sphere, so each ring is turned so that it
 * encloses the small side of the globe and holes the large side.
 */
export function regionFeature(region) {
  const rings = ringsFromPath(region.path).sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  const polygons = [];
  for (const ring of rings) {
    const outer = polygons.find(p => inside(ring[0], p[0]) && inside(ring[Math.floor(ring.length / 2)], p[0]));
    if (outer) outer.push(ring); else polygons.push([ring]);
  }
  const turn = (ring, small) => {
    const area = geoArea({type: 'Polygon', coordinates: [ring]});
    return (area < 2 * Math.PI) === small ? ring : [...ring].reverse();
  };
  return {type: 'Feature', id: region.id, properties: {}, geometry: {type: 'MultiPolygon', coordinates: polygons.map(([outer, ...holes]) => [turn(outer, true), ...holes.map(hole => turn(hole, false))])}};
}

export function worldFeatures(dataset) { return dataset.regions.map(regionFeature); }

/** Point the globe at a region: the rotation that puts its centre in the middle of the disc. */
export function rotationFor(feature) {
  const [lon, lat] = geoCentroid(feature);
  return [-lon, Math.max(-60, Math.min(60, -lat))];
}

function makeProjection(id, rotation) {
  switch (id) {
    case 'globe': return geoOrthographic().rotate(rotation || [-OSLO[0], -OSLO[1] + 20]).clipAngle(90);
    case 'mercator': return geoMercator();
    case 'equal-earth': return geoEqualEarth();
    case 'goode': return geoInterruptedHomolosine();
    case 'south-up': return geoEqualEarth().angle(180);
    case 'oslo': return geoAzimuthalEquidistant().rotate([-OSLO[0], -OSLO[1]]);
    case 'heart': return geoBonne().parallel(90);
    case 'square': return geoPeirceQuincuncial();
    default: return null;
  }
}

const SPHERE = {type: 'Sphere'};
const pad = ([[x0, y0], [x1, y1]], margin) => [x0 - margin, y0 - margin, x1 - x0 + 2 * margin, y1 - y0 + 2 * margin];
const round = view => view.map(n => Math.round(n * 10) / 10).join(' ');

/**
 * The world drawn in one projection, in the same shape as the flat map file:
 * {viewBox, regions:[{id, path}]}, plus the outline of the whole globe and a 10° grid.
 * Regions on the far side of the globe get an empty path.
 */
export function projectWorld(dataset, features, id, {rotation = null} = {}) {
  const projection = makeProjection(id, rotation);
  if (!projection) return {...dataset, projectionId: 'standard'};
  // Mercator never reaches the poles, so it is framed by the countries rather than the sphere.
  const frame = id === 'mercator' ? {type: 'FeatureCollection', features} : SPHERE;
  projection.precision(.4).fitWidth(WIDTH, frame);
  const path = geoPath(projection).digits(1);
  const bounds = path.bounds(frame);
  return {
    ...dataset, projectionId: id, projection,
    viewBox: round(pad(bounds, 8)),
    regions: dataset.regions.map((region, i) => ({...region, path: path(features[i]) || ''})),
    // Mercator's sea is the whole frame; every other projection has an outline of the globe.
    sphere: id === 'mercator' ? `M${bounds[0][0]},${bounds[0][1]}H${bounds[1][0]}V${bounds[1][1]}H${bounds[0][0]}Z` : path(SPHERE) || '',
    graticule: path(geoGraticule10()) || ''
  };
}

/** The globe for a new rotation without fitting it again: the disc keeps its size and place while it turns. */
export function turnGlobe(world, features, rotation) {
  const projection = makeProjection('globe', rotation).precision(.4).scale(world.projection.scale()).translate(world.projection.translate());
  const path = geoPath(projection).digits(1);
  return {...world, projection, regions: world.regions.map((region, i) => ({...region, path: path(features[i]) || ''})), graticule: path(geoGraticule10()) || ''};
}

/** Centre and radius of the globe's disc, for shading it like a ball. */
export function globeDisc(world) {
  if (world.projectionId !== 'globe') return null;
  const [x, y] = world.projection.translate();
  return {x, y, r: world.projection.scale()};
}

/** Turn by a drag of (dx, dy) map units: the point under the finger follows it, and the poles stop the tilt. */
export function dragRotation(start, dx, dy, scale) {
  const k = 180 / Math.PI / scale;
  return [start[0] + dx * k, Math.max(-89, Math.min(89, start[1] - dy * k))];
}

/** The shortest turn between two rotations, for gliding to a country. */
export function interpolateRotation(from, to) {
  const d = ((to[0] - from[0]) % 360 + 540) % 360 - 180;
  return t => [from[0] + d * t, from[1] + (to[1] - from[1]) * t];
}
