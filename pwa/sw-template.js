/* birdybird offline service worker.
 * Generated at build time by the `offline-pwa` plugin in vite.config.js —
 * do not edit dist/sw.js by hand. The __PLACEHOLDERS__ below are filled with
 * the content-hashed cache name, the precache file list and the index URL.
 *
 * Strategy:
 *   - navigations  → network-first, fall back to the cached app shell (offline)
 *   - same-origin  → cache-first (hashed assets are immutable)
 *   - MediaPipe CDN → cache-first runtime cache (so webcam/pose mode also works
 *                     offline after one online load; the tilt core needs none)
 */
const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
const INDEX_URL = '__INDEX_URL__';
const RUNTIME_CACHE = CACHE_NAME + '-runtime';
// Third-party asset CDNs the game pulls at runtime: jsdelivr + googleapis
// (MediaPipe wasm/model) and dl.polyhaven.org (terrain/house diffuse maps).
// Runtime-cached so they survive offline after one online load.
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://storage.googleapis.com',
  'https://dl.polyhaven.org',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(fallbackUrl, response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await caches.match(fallbackUrl)) || (await caches.match(request));
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, INDEX_URL));
    return;
  }
  if (CDN_ORIGINS.includes(url.origin)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
});
