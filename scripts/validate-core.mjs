import {readFile} from 'node:fs/promises';
import {validateCoreDomains} from '../src/lib/core-curriculum.js';
import {readCoreDomains} from './core-files.mjs';

const only = process.argv[2];
const all = await readCoreDomains();
const selected = only ? all.filter(file => file.domain?.id === only || file.file === `${only}.json`) : all;
if (!selected.length) { console.error(`Fant ikke fagområdet ${only}.`); process.exit(1); }
const media = JSON.parse(await readFile(new URL('../public/knowledge/media.json', import.meta.url), 'utf8'));
const result = validateCoreDomains(selected, {requireKnownPrerequisites: !only, mediaIds: new Set(media.map(item => item.entityId))});
if (only) {
  // A single domain may name prerequisites that another author is still writing.
  const known = new Set(all.flatMap(file => file.units || []).map(unit => unit.id));
  result.warnings = result.warnings.filter(text => !/ukjent forkunnskap (\S+)\./.test(text) || !known.has(text.match(/ukjent forkunnskap (\S+)\./)[1]));
}
for (const error of result.errors) console.log(`FEIL     ${error}`);
for (const warning of result.warnings) console.log(`ADVARSEL ${warning}`);
console.log(JSON.stringify({...result.counts, errors: result.errors.length, warnings: result.warnings.length}));
process.exitCode = result.errors.length ? 1 : 0;
