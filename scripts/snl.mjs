// Look up Store norske leksikon articles while writing curriculum units.
// node scripts/snl.mjs search <query>   → candidate articles with canonical URLs
// node scripts/snl.mjs read <url|slug>   → canonical URL, title and plain article text
const [command, ...rest] = process.argv.slice(2);
const query = rest.join(' ');
const plain = html => html.replace(/<\/(p|h\d|li)>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

if (command === 'search' && query) {
  const rows = await fetchJson(`https://snl.no/api/v1/search?query=${encodeURIComponent(query)}&limit=8`);
  for (const row of rows) console.log(`${row.article_url}  ·  ${row.headword}${row.clarification ? ` (${row.clarification})` : ''}  ·  ${row.taxonomy_title || ''}`);
} else if (command === 'read' && query) {
  const slug = query.replace(/^https:\/\/snl\.no\//, '').replace(/\.json$/, '');
  const article = await fetchJson(`https://snl.no/${slug}.json`);
  console.log(`URL: ${article.url}\nTITTEL: ${article.title}\n`);
  console.log(plain(article.xhtml_body).slice(0, Number(process.env.SNL_LIMIT || 9000)));
} else {
  console.error('Bruk: node scripts/snl.mjs search <søk> | read <url eller slug>');
  process.exitCode = 1;
}
