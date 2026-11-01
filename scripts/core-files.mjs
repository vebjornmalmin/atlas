import {readdir, readFile} from 'node:fs/promises';

const directory = new URL('../knowledge-build/core/', import.meta.url);
export async function readCoreDomains() {
  const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  return Promise.all(files.map(async name => ({file: name, ...JSON.parse(await readFile(new URL(name, directory), 'utf8'))})));
}
