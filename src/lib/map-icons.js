// Small icons for the map buttons, drawn on a 20 × 20 grid with a 1.4 stroke. Each projection's icon is
// the outline of that map with a hint of its grid, so the button shows which kind of map is open.
// The lens icon is an eye whose iris is a magnifying lens: a way of seeing that brings some things closer.

const equalEarth = 'M5.4 4.5h9.2c2.9 2.4 3.4 8.6 0 11H5.4c-3.4-2.4-2.9-8.6 0-11Z';

export const PROJECTION_ICONS = {
  // Equirectangular: a 2 : 1 rectangle of equal squares.
  standard: '<rect x="2" y="5" width="16" height="10" rx="1"/><path d="M2 10h16M7.3 5v10M12.7 5v10"/>',
  // Orthographic: the ball seen from space.
  globe: '<circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.2 2.1 3.2 4.6 3.2 7.5s-1 5.4-3.2 7.5c-2.2-2.1-3.2-4.6-3.2-7.5s1-5.4 3.2-7.5Z"/>',
  // Mercator: a tall rectangle whose parallels spread apart towards the poles.
  mercator: '<rect x="3.5" y="2" width="13" height="16" rx="1"/><path d="M3.5 10h13M3.5 7.6h13M3.5 12.4h13M10 2v16"/>',
  // Equal Earth: flat poles and rounded sides.
  'equal-earth': `<path d="${equalEarth}"/><path d="M2.9 10h14.2M10 4.5v11"/>`,
  // Goode: the peel cut open in the oceans, one cut from the top and two from the bottom.
  goode: '<path d="M2 10c0-3.2 2.6-5.3 6.2-5.5l.4 3.8.4-3.8c5.4.1 9 2.3 9 5.5s-2.4 5.2-4.2 5.4l-.4-3.6-.4 3.6c-2 .2-4 .2-6 0l-.4-3.6-.4 3.4C3.8 14.8 2 12.8 2 10Z"/>',
  // South up: the same Equal Earth outline with an arrow pointing south, upwards.
  'south-up': `<path d="${equalEarth}"/><path d="M10 13V7M7.6 9.2 10 6.8l2.4 2.4"/>`,
  // Azimuthal equidistant from Oslo: rings of equal distance around one point.
  oslo: '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.2"/><circle class="dot" cx="10" cy="10" r="1.2"/>',
  // Werner: the heart.
  heart: '<path d="M10 16.8C5.9 13.9 2.5 11.1 2.5 7.4 2.5 5 4.2 3.4 6.3 3.4c1.6 0 3 .9 3.7 2.3.7-1.4 2.1-2.3 3.7-2.3 2.1 0 3.8 1.6 3.8 4 0 3.7-3.4 6.5-7.5 9.4Z"/>',
  // Peirce quincuncial: the world in a square, the hemispheres meeting in a diamond.
  square: '<rect x="2.5" y="2.5" width="15" height="15" rx="1"/><path d="M10 2.5 17.5 10 10 17.5 2.5 10Z"/>'
};

export const LENS_ICON = '<path d="M1.5 9.5S4.6 4.5 10 4.5s8.5 5 8.5 5-1.2 2-3.4 3.4M11.5 14.4c-.5.1-1 .1-1.5.1-5.4 0-8.5-5-8.5-5"/><circle cx="10" cy="9.5" r="3.2"/><path d="M12.3 11.8 17 16.5"/><path class="glint" d="M8.4 8.6a1.9 1.9 0 0 1 1.5-1.2"/>';

export const HEAT_ICON = '<rect class="cell" x="3" y="3" width="6" height="6" rx="1.2" style="opacity:.3"/><rect class="cell" x="11" y="3" width="6" height="6" rx="1.2" style="opacity:.6"/><rect class="cell" x="3" y="11" width="6" height="6" rx="1.2" style="opacity:.8"/><rect class="cell" x="11" y="11" width="6" height="6" rx="1.2"/>';
