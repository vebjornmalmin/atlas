// QR code (ISO/IEC 18004) for the quiz-off join link: byte mode, error correction level M, versions 1–10. Pure, no platform APIs.
// The matrix is rows of booleans (true = dark), matrix[y][x].

// Level M per version: [error correction codewords per block, [blocks, data codewords per block], …].
const BLOCKS = [null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
export const MAX_VERSION = 10;
const LEVEL_M = 0b00; // Format bits for the levels are L 01, M 00, Q 11, H 10.

const dataCodewords = v => BLOCKS[v].slice(1).reduce((n, [blocks, size]) => n + blocks * size, 0);
// Bytes that fit: mode (4 bits) and count (8 bits up to version 9, 16 from 10) come first.
export const capacity = v => Math.floor((dataCodewords(v) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

// Reed–Solomon: the remainder of data·x^n divided by (x − α^0)…(x − α^(n−1)).
function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsRemainder(data, n) {
  const g = rsGenerator(n), rem = new Array(n).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= mul(g[i + 1], factor);
  }
  return rem;
}

// Bits of the BCH-coded format (15 bits) and version (18 bits) information.
function bch(value, bits, poly, polyBits) {
  let rem = value << (polyBits - 1);
  for (let i = bits + polyBits - 2; i >= polyBits - 1; i--) if ((rem >> i) & 1) rem ^= poly << (i - polyBits + 1);
  return (value << (polyBits - 1)) | rem;
}
export const formatBits = mask => bch((LEVEL_M << 3) | mask, 5, 0x537, 11) ^ 0x5412;
export const versionBits = v => bch(v, 6, 0x1f25, 13);

function codewords(bytes, v) {
  const bits = [];
  const put = (value, n) => { for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1); };
  const total = dataCodewords(v) * 8;
  put(0b0100, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, total - bits.length)); // Terminator, shortened when the symbol is full.
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xec; bits.length < total; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  // Split into blocks, add error correction to each, then interleave column by column.
  const [ec, ...groups] = BLOCKS[v], blocks = [];
  let at = 0;
  for (const [count, size] of groups) for (let i = 0; i < count; i++) { const d = data.slice(at, at += size); blocks.push({d, e:rsRemainder(d, ec)}); }
  const out = [], longest = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];

// The fixed parts of a version: finders, separators, timing, alignment, the dark module, and reserved format/version areas.
function base(v) {
  const size = 17 + 4 * v;
  const dark = Array.from({length:size}, () => new Array(size).fill(false));
  const fixed = Array.from({length:size}, () => new Array(size).fill(false));
  const set = (x, y, on) => { if (x >= 0 && y >= 0 && x < size && y < size) { dark[y][x] = on; fixed[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4); // Ring of light at 2, separator at 4.
    }
  const at = ALIGN[v], last = at.length - 1;
  for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue; // Under a finder.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(at[i] + dx, at[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  drawFormat(set, size, 0);
  if (v >= 7) drawVersion(set, size, v);
  return {size, dark, fixed};
}
// Format bit i: copy one around the top-left finder, copy two split between the other two; plus the dark module.
function drawFormat(set, size, mask) {
  const bits = formatBits(mask), bit = i => ((bits >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
}
// Version bit i sits in a 6×3 block above the bottom-left finder and its mirror left of the top-right finder.
function drawVersion(set, size, v) {
  const bits = versionBits(v);
  for (let i = 0; i < 18; i++) {
    const on = ((bits >> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3);
    set(a, b, on); set(b, a, on);
  }
}

// Data bits go up and down in two-module columns from the bottom right, skipping the vertical timing column.
function placeData(dark, fixed, size, words) {
  let i = 0;
  const total = words.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let k = 0; k < size; k++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - k : k;
      if (fixed[y][x]) continue;
      dark[y][x] = i < total && ((words[i >> 3] >> (7 - (i & 7))) & 1) === 1; // Leftover remainder bits stay light.
      i++;
    }
  }
}

// Penalty rules N1–N4. The finder-like rule treats the quiet zone around the symbol as light.
export function penalty(m) {
  const size = m.length;
  let score = 0, dark = 0;
  const lines = [];
  for (let y = 0; y < size; y++) { lines.push(m[y]); lines.push(m.map(row => row[y])); }
  const finder = [true, false, true, true, true, false, true];
  for (const line of lines) {
    for (let x = 0, run = 1; x < size; x++) {
      if (x + 1 < size && line[x + 1] === line[x]) { run++; continue; }
      if (run >= 5) score += 3 + run - 5;
      run = 1;
    }
    const padded = [...new Array(4).fill(false), ...line, ...new Array(4).fill(false)];
    for (let x = 0; x + 7 <= padded.length; x++) {
      if (!finder.every((b, k) => padded[x + k] === b)) continue;
      const before = x >= 4 && padded.slice(x - 4, x).every(b => !b);
      const after = x + 11 <= padded.length && padded.slice(x + 7, x + 11).every(b => !b);
      if (before || after) score += 40;
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x + 1 < size && y + 1 < size && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  }
  const total = size * size;
  score += 10 * Math.floor(Math.abs(dark * 20 - total * 10) / total);
  return score;
}

const utf8 = text => new TextEncoder().encode(String(text));
export const qrVersion = text => { const n = utf8(text).length; for (let v = 1; v <= MAX_VERSION; v++) if (n <= capacity(v)) return v; return 0; };

// Returns {matrix, version, mask}. Throws when the text needs more than version 10 (213 bytes).
export function qrCode(text, forceMask = -1) {
  const bytes = utf8(text), version = qrVersion(text);
  if (!version) throw new RangeError(`QR: ${bytes.length} bytes do not fit in version ${MAX_VERSION}`);
  const {size, dark, fixed} = base(version), words = codewords(bytes, version);
  placeData(dark, fixed, size, words);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask >= 0 && mask !== forceMask) continue;
    const m = dark.map((row, y) => row.map((on, x) => fixed[y][x] ? on : on !== MASKS[mask](x, y)));
    drawFormat((x, y, on) => { m[y][x] = on; }, size, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = {matrix:m, version, mask, score};
  }
  return best;
}
export const qrMatrix = text => qrCode(text).matrix;

// One SVG path for the dark modules, one rectangle per horizontal run, shifted by the quiet zone.
export function qrPath(matrix, margin = 4) {
  let d = '';
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < row.length && row[end + 1]) end++;
      d += `M${x + margin} ${y + margin}h${end - x + 1}v1h${x - end - 1}z`;
      x = end;
    }
  });
  return d;
}
