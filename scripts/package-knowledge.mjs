import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {keepTextTogether} from '../src/lib/typography.js';
// Last step before publishing: numbers and eras stay on one line on a phone, then the package is hashed.
const pkg=keepTextTogether(JSON.parse(await readFile('public/knowledge/foundation.json','utf8')));
const text=JSON.stringify(pkg,null,2)+'\n';
await writeFile('public/knowledge/foundation.json',text);
await writeFile('public/knowledge/manifest.json',JSON.stringify({schemaVersion:1,packages:[{id:pkg.id,version:pkg.version,url:'/knowledge/foundation.json',hash:createHash('sha256').update(text).digest('hex')}]},null,2)+'\n');
