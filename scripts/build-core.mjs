import {readFile, writeFile} from 'node:fs/promises';
import {applyCorrections, compileCore, mergeCore, validateCoreDomains} from '../src/lib/core-curriculum.js';
import {readCoreDomains} from './core-files.mjs';

const domains = await readCoreDomains();
const media = JSON.parse(await readFile('public/knowledge/media.json', 'utf8'));
const check = validateCoreDomains(domains, {mediaIds: new Set(media.map(item => item.entityId))});
if (check.errors.length) throw new Error(`Kunnskapskjernen har feil:\n${check.errors.join('\n')}`);
const data = JSON.parse(await readFile('public/knowledge/foundation.json', 'utf8'));
const corrections = JSON.parse(await readFile('knowledge-build/corrections.json', 'utf8'));
const merged = mergeCore(applyCorrections(data, corrections), compileCore(domains));
Object.assign(merged, {version: '2.0.0', generatedAt: '2026-11-02T06:00:00Z'});
await writeFile('public/knowledge/foundation.json', JSON.stringify(merged, null, 2) + '\n');
console.log(JSON.stringify({...check.counts, warnings: check.warnings.length, targets: merged.targets.length}));
