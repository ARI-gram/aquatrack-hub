// ── Cache names — bump version to force refresh ──
const STATIC_CACHE = 'aquatrack-static-v1';
const DYNAMIC_CACHE = 'aquatrack-dynamic-v1';
const API_CACHE = 'aquatrack-api-v1';

// Pre-cache these on install — the app shell
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/customer/login',
  '/manifest-staff.json',
  '/manifest-customer.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
];

// ── Install: pre-cache the app shell immediately ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', e => {
  const CURRENT_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => !CURRENT_CACHES.includes(k))
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route by request type ──
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 1. API calls → network first, short timeout, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithTimeout(request, API_CACHE, 4000));
    return;
  }

  // 2. Static assets (JS, CSS, fonts, images) → cache first
  if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. HTML navigation → stale-while-revalidate (instant load + background refresh)
  e.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ── Strategies ──

// Cache first — fastest for assets that don't change often
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

// Stale-while-revalidate — instant from cache, updates in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Network first with timeout — for API calls
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

// ── Helpers ──
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)(\?.*)?$/.test(url.pathname);
}