// Geometry for the gesture-driven map: a view is [x, y, width, height] in SVG units.
export function parseBox(box) {
  if (Array.isArray(box)) return box.map(Number);
  return String(box || '0 0 100 100').trim().split(/[\s,]+/).map(Number);
}
export const boxString = view => view.map(n => Math.round(n * 1000) / 1000).join(' ');

/** Expand a box so it matches the element's aspect ratio without cutting anything off. */
export function fitAspect(box, aspect) {
  const [x, y, w, h] = parseBox(box);
  if (!(aspect > 0)) return [x, y, w, h];
  if (w / h > aspect) { const nh = w / aspect; return [x, y - (nh - h) / 2, w, nh]; }
  const nw = h * aspect; return [x - (nw - w) / 2, y, nw, h];
}

/** Keep the view's centre over the map and its size between full map and maximum zoom. */
export function clampView(view, base, maxZoom = 24) {
  let [x, y, w, h] = view;
  const [bx, by, bw, bh] = base;
  const aspect = w / h;
  const maxW = Math.max(bw, bh * aspect), minW = bw / maxZoom;
  if (w > maxW) { w = maxW; h = w / aspect; }
  if (w < minW) { w = minW; h = w / aspect; }
  const cx = Math.min(bx + bw, Math.max(bx, x + view[2] / 2));
  const cy = Math.min(by + bh, Math.max(by, y + view[3] / 2));
  // When the whole map fits, centre it instead of letting it drift.
  const fx = w >= bw ? bx + bw / 2 : cx, fy = h >= bh ? by + bh / 2 : cy;
  return [fx - w / 2, fy - h / 2, w, h];
}

/** Zoom by `factor` (>1 zooms in) keeping the SVG point (px, py) fixed on screen. */
export function zoomAt(view, factor, px, py) {
  const [x, y, w, h] = view;
  const nw = w / factor, nh = h / factor;
  return [px - (px - x) * (nw / w), py - (py - y) * (nh / h), nw, nh];
}

export function panBy(view, dx, dy) { return [view[0] - dx, view[1] - dy, view[2], view[3]]; }

/** Bounding box of an SVG path made of absolute M/L coordinates (the map files use only these). */
export function pathBounds(path, largestOnly = false) {
  const pieces = largestOnly ? String(path).split(/(?=M)/) : [String(path)];
  const boxes = pieces.map(piece => {
    const n = piece.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
    return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
  }).filter(Boolean);
  if (!boxes.length) return null;
  const pick = largestOnly ? [boxes.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0]] : boxes;
  const x0 = Math.min(...pick.map(b => b[0])), y0 = Math.min(...pick.map(b => b[1]));
  return [x0, y0, Math.max(...pick.map(b => b[2])) - x0, Math.max(...pick.map(b => b[3])) - y0];
}

/** Centre of the largest part of a region, used as the anchor for arrows and labels. */
export function regionAnchor(path) {
  const b = pathBounds(path, true);
  return b ? {x: b[0] + b[2] / 2, y: b[1] + b[3] / 2} : null;
}

export function unionBox(boxes, pad = 0, minSize = 0) {
  const list = boxes.filter(Boolean);
  if (!list.length) return null;
  const x0 = Math.min(...list.map(b => b[0])), y0 = Math.min(...list.map(b => b[1]));
  const x1 = Math.max(...list.map(b => b[0] + b[2])), y1 = Math.max(...list.map(b => b[1] + b[3]));
  const w = Math.max(minSize, x1 - x0 + 2 * pad), h = Math.max(minSize, y1 - y0 + 2 * pad);
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/** A gently curved arrow from a to b; the head is a filled triangle that keeps its size on screen. */
export function arrowGeometry(a, b, unit = 1, bend = 0.18) {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const c = {x: (a.x + b.x) / 2 + nx * length * bend, y: (a.y + b.y) / 2 + ny * length * bend};
  const head = Math.min(length * 0.45, 9 * unit), wing = head * 0.55;
  // Direction of the curve at its end point.
  const tx = b.x - c.x, ty = b.y - c.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
  const base = {x: b.x - ux * head, y: b.y - uy * head};
  const shaft = `M${a.x} ${a.y}Q${c.x} ${c.y} ${base.x} ${base.y}`;
  const tip = `M${b.x} ${b.y}L${base.x - uy * wing} ${base.y + ux * wing}L${base.x + uy * wing} ${base.y - ux * wing}Z`;
  return {shaft, tip, control: c};
}
