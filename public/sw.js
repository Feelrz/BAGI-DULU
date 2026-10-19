const CACHE = 'bagi-v6-splitbill-shell';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bagi-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache Supabase, authentication, arbitrary APIs, or other origins.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/ocr/') || CORE.slice(1).includes(url.pathname);
  const isPage = request.mode === 'navigate';
  if (!isStatic && !isPage) return;
  event.respondWith((async () => {
    if (isStatic) { const cached = await caches.match(request); if (cached) return cached; }
    try {
      const response = await fetch(request);
      if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      return cached || (isPage ? await caches.match('/') : null) || Response.error();
    }
  })());
});
