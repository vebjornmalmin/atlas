// Packs the flags of every country in the knowledge pack into public/flags.json.
// Source: the 4x3 SVGs from the flag-icons package (MIT), minified with svgo (floatPrecision 1).
// Usage: node scripts/pack-flags.mjs <folder with xx.svg files>
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/pack-flags.mjs <folder with xx.svg files>');
const pack = JSON.parse(fs.readFileSync('public/knowledge/foundation.json', 'utf8'));
const codes = [...new Set(pack.entities.filter(e => e.iso2 && e.geo).map(e => e.iso2.toLowerCase()))].sort();
const flags = {};
for (const code of codes) {
  const file = path.join(source, `${code}.svg`);
  if (!fs.existsSync(file)) throw new Error(`Missing flag for ${code}`);
  flags[code] = fs.readFileSync(file, 'utf8').trim();
}
fs.writeFileSync('public/flags.json', JSON.stringify(flags));
console.log(`Packed ${codes.length} flags`);
