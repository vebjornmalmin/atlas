import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateKnowledge} from '../src/lib/content.js';

/** Validate a complete package before it can replace an installed version. */
export const validatePackage = validateKnowledge;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const data = JSON.parse(await readFile(process.argv[2] || 'public/knowledge/foundation.json', 'utf8'));
    const result = validateKnowledge(data);
    console.log(JSON.stringify({...result, warnings: result.warnings.length}, null, 2));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
