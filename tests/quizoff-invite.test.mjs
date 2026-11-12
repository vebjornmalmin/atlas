import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteUrl, codeFromUrl, inviteText, withoutInvite} from '../src/lib/quizoff/invite.js';
import {qrCode, qrMatrix, qrPath, qrVersion, capacity, formatBits, versionBits, MAX_VERSION} from '../src/lib/quizoff/qr.js';

test('invite link round trip', () => {
  const url = inviteUrl('https://atlas.example/', 'ABCD');
  assert.equal(url, 'https://atlas.example/?quizoff=ABCD');
  assert.equal(codeFromUrl(url), 'ABCD');
  assert.equal(codeFromUrl(inviteUrl('http://localhost:8799', 'XYZW')), 'XYZW');
});

test('codeFromUrl is tolerant and strict where it matters', () => {
  assert.equal(codeFromUrl('?quizoff=abcd'), 'ABCD');
  assert.equal(codeFromUrl('quizoff=AbCd'), 'ABCD');
  assert.equal(codeFromUrl('https://x.test/?a=1&quizoff=WXYZ&b=2#today'), 'WXYZ');
  assert.equal(codeFromUrl('https://x.test/?quizoff=%20abcd.'), 'ABCD');
  assert.equal(codeFromUrl('https://x.test/?quizoff=ab-cd'), 'ABCD');
  assert.equal(codeFromUrl('?quizoff=ABIO'), '', 'I and O are never in a code');
  assert.equal(codeFromUrl('?quizoff=ABC'), '');
  assert.equal(codeFromUrl('?quizoff=ABCDE'), '');
  assert.equal(codeFromUrl('?quizoff=AB12'), '');
  assert.equal(codeFromUrl('?quizoff=ÆØÅB'), '');
  assert.equal(codeFromUrl('?quizoff='), '');
  assert.equal(codeFromUrl('?other=ABCD'), '');
  for (const junk of [undefined, null, '', 42, {}, [], '%%%', '?quizoff=%E0%A4%A', 'https://', 'quizoff', '?quizoff'])
    assert.equal(codeFromUrl(junk), '');
});

test('withoutInvite keeps the other parameters', () => {
  assert.equal(withoutInvite('?quizoff=ABCD'), '');
  assert.equal(withoutInvite('?offline-test=1&quizoff=ABCD'), '?offline-test=1');
  assert.equal(withoutInvite(''), '');
});

test('the invitation names the code, the link goes in the url field', () => {
  assert.match(inviteText('ABCD'), /ABCD/);
  assert.doesNotMatch(inviteText('ABCD'), /https?:/);
});

// The matrices below were decoded by an independent reader (Apple Vision, VNDetectBarcodesRequest) to exactly their input.
const hexRows = rows => rows.split(' ').map((h, _, all) => [...BigInt('0x' + h).toString(2).padStart(all.length, '0')].map(b => b === '1'));
const KNOWN = [
  {text:'ABCD', version:1, mask:4, rows:'1fdf7f 104541 17425d 17505d 175b5d 105541 1fd57f 001400 1175f9 0e39c7 13c18e 00af22 0a6a77 001b27 1fd276 1044d0 1759c5 1749cf 174588 104728 1fd675'},
  {text:'https://atlas-first-app.atlas-memory.workers.dev/?quizoff=ABCD', version:4, mask:2, rows:'1fcc0b37f 1041b5441 175c40b5d 175f6855d 1755b335d 105065c41 1fd55557f 001545f00 17caf847c 02271ba6d 1fdb7dcd6 0c96259de 19722b4bb 080f37acb 11d6355da 179b64bcc 0e4bac5b9 0a2e5ea6d 05ed68d36 031571c7e 04d5c969a 193e3f645 126c39832 15a7b7c9d 17d74b5fb 001697d15 1fc469756 105236b1e 1758391fb 175246993 175ca53ec 104ad3854 1fd43b7e2'},
  {text:'Blåbærsyltetøy på Ærø – ÆØÅ æøå', version:4, mask:4, rows:'1fd2c567f 1048e6441 174d5db5d 175c38e5d 17599235d 1055e5641 1fd55557f 001383400 117de15f9 1c113da2b 09c9d7229 03abb2717 1c7d92517 1f03470ce 09d76141e 0eaab4255 0fd0c7a57 1e9166617 0277bae07 1ca63cbfc 00f627283 1e1c12f97 014616d06 00b14bcfe 19ecb8dfc 001328d1e 1fd104150 104990513 175f525f3 174287b42 174461fc8 1049f0aa4 1fd203a85'},
];

test('QR matrices match the ones confirmed with a decoder', () => {
  for (const k of KNOWN) {
    const c = qrCode(k.text);
    assert.equal(c.version, k.version, k.text);
    assert.equal(c.mask, k.mask, k.text);
    assert.deepEqual(c.matrix, hexRows(k.rows), k.text);
  }
});

test('QR capacity and version choice for level M, byte mode', () => {
  assert.deepEqual(Array.from({length:MAX_VERSION}, (_, i) => capacity(i + 1)), [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]);
  for (let v = 1; v <= MAX_VERSION; v++) {
    const text = 'x'.repeat(capacity(v));
    assert.equal(qrVersion(text), v);
    assert.equal(qrMatrix(text).length, 17 + 4 * v);
    if (v < MAX_VERSION) assert.equal(qrVersion(text + 'x'), v + 1);
  }
  assert.equal(qrVersion('æ'.repeat(7)), 1, 'Norwegian letters are two bytes each');
  assert.equal(qrVersion('æ'.repeat(8)), 2);
  assert.throws(() => qrMatrix('x'.repeat(214)), RangeError);
});

const finderAt = (m, x0, y0) => {
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
    if (m[y0 + y][x0 + x] !== (d !== 2)) return false;
  }
  return true;
};
// Copy one of the format information: (8,0..5), (8,7), (8,8), (7,8), (5..0,8) as bits 0..14.
function readFormat(m) {
  const at = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  return at.reduce((bits, [x, y], i) => bits | (m[y][x] ? 1 << i : 0), 0);
}
function readFormat2(m) {
  const n = m.length, at = [];
  for (let i = 0; i < 8; i++) at.push([n - 1 - i, 8]);
  for (let i = 8; i < 15; i++) at.push([8, n - 15 + i]);
  return at.reduce((bits, [x, y], i) => bits | (m[y][x] ? 1 << i : 0), 0);
}

test('QR structure: finders, separators, timing, dark module, format and version information', () => {
  for (const text of ['A', 'https://atlas.example/?quizoff=ABCD', 'x'.repeat(122), 'y'.repeat(200)]) {
    const {matrix:m, version, mask} = qrCode(text), n = m.length;
    assert.ok(finderAt(m, 0, 0) && finderAt(m, n - 7, 0) && finderAt(m, 0, n - 7), 'three finders');
    for (let i = 0; i < 8; i++) {
      assert.ok(!m[7][i] && !m[i][7] && !m[7][n - 1 - i] && !m[i][n - 8] && !m[n - 8][i] && !m[n - 1 - i][7], 'separators are light');
    }
    for (let i = 8; i < n - 8; i++) assert.ok(m[6][i] === (i % 2 === 0) && m[i][6] === (i % 2 === 0), 'timing');
    assert.equal(m[n - 8][8], true, 'dark module');
    const format = readFormat(m);
    assert.equal(format, readFormat2(m), 'both format copies agree');
    assert.equal(format, formatBits(mask));
    const info = (format ^ 0x5412) >> 10;
    assert.equal(info >> 3, 0b00, 'level M');
    assert.equal(info & 7, mask);
    if (version >= 7) {
      let a = 0, b = 0;
      for (let i = 0; i < 18; i++) { const p = n - 11 + i % 3, q = Math.floor(i / 3); if (m[q][p]) a |= 1 << i; if (m[p][q]) b |= 1 << i; }
      assert.equal(a, versionBits(version));
      assert.equal(b, versionBits(version));
    }
  }
  assert.equal(formatBits(0), 0b101010000010010, 'M, mask 0 from the standard table');
  assert.equal(versionBits(7), 0x07c94, 'version 7 from the standard table');
  assert.equal(versionBits(10), 0x0a4d3);
});

test('qrPath draws exactly the dark modules, shifted by the quiet zone', () => {
  const m = qrMatrix('ABCD'), d = qrPath(m);
  let area = 0;
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    assert.ok(Number(x) >= 4 && Number(y) >= 4);
    for (let i = 0; i < Number(w); i++) assert.equal(m[y - 4][x - 4 + i], true);
    area += Number(w);
  }
  assert.equal(area, m.flat().filter(Boolean).length);
});
