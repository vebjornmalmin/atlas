import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const text=await readFile('public/knowledge/foundation.json','utf8');
const pkg=JSON.parse(text);
await writeFile('public/knowledge/manifest.json',JSON.stringify({schemaVersion:1,packages:[{id:pkg.id,version:pkg.version,url:'/knowledge/foundation.json',hash:createHash('sha256').update(text).digest('hex')}]},null,2)+'\n');
