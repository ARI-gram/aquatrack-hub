// ── Customer SW — scoped to /customer/ only ──
const STATIC_CACHE = 'mywater-static-v1';
const DYNAMIC_CACHE = 'mywater-dynamic-v1';
const API_CACHE = 'mywater-api-v1';

const PRECACHE_ASSETS = [
  '/customer/login',
  '/manifest-customer.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  const CURRENT_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => !CURRENT_CACHES.includes(k))
            .map(k => {
              console.log('[Customer SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithTimeout(request, API_CACHE, 4000));
    return;
  }

  if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  e.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  const result = cached || await fetchPromise;

  return result || new Response('Offline', { status: 503 });
}

async function networkFirstWithTimeout(request, cacheName, timeout) {
  const cache = await caches.open(cacheName);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeout)
  );

  try {
    const response = await Promise.race([fetch(request), timeoutPromise]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)(\?.*)?$/.test(url.pathname);
}