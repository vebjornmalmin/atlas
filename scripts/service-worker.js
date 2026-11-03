const CACHE = '__CACHE__';
const ASSETS = __ASSETS__;
// Bypass the HTTP cache so a release never stores a previous release's page next to its own assets.
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'}))))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = (await caches.keys()).filter(name => name.startsWith('atlas-release-'));
  for (const name of names.slice(0, -2)) if (name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    const offlineTest = url.searchParams.has('offline-test') || (client && new URL(client.url).searchParams.has('offline-test'));
    if(url.pathname==='/version.json'){
      if(offlineTest)return new Response('Offline test',{status:503});
      try{return await fetch(event.request,{cache:'no-store'});}catch{return new Response('Offline',{status:503});}
    }
    const key = event.request.mode === 'navigate' ? '/' : url.pathname;
    const cached = await (await caches.open(CACHE)).match(key);
    if (offlineTest) return cached || new Response('Not available offline', {status:503});
    if (event.request.cache === 'no-store') {
      try { return await fetch(event.request); } catch { return cached || new Response('Offline', {status:503}); }
    }
    if (cached) return cached;
    try { return await fetch(event.request); } catch {
      return await caches.match(key) || new Response('Offline', {status:503});
    }
  })());
});
