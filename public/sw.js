const CACHE = 'petverse-shell-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('petverse-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  // Nunca almacenar sesiones ni API. Offline muestra el shell y pide reconectar.
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok) {
      const copy = response.clone();
      try { const cache = await caches.open(CACHE); await cache.put(event.request, copy); }
      catch { /* Si falta espacio, seguir sirviendo la respuesta de red. */ }
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) ?? new Response('Necesitas conexión.', { status: 503 })));
});
