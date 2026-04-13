// ── Customer SW – scoped to /customer/ only ──
//
// CACHE STRATEGY OVERVIEW:
//   HTML / SPA routes  →  network-first, no caching (always fresh on deploy)
//   JS / CSS / fonts   →  cache-first   (safe: Vite hashes filenames on every build)
//   Images / icons     →  cache-first   (static, rarely change)
//   API calls          →  network-first with 4 s timeout, fallback to cache
//
// DEPLOYING: bump CACHE_VERSION below. The activate handler will automatically
// delete all old caches so every user gets fresh assets with zero manual clearing.

const CACHE_VERSION   = 'v2'; // ← increment on every deploy
const STATIC_CACHE    = `mywater-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE   = `mywater-dynamic-${CACHE_VERSION}`;
const API_CACHE       = `mywater-api-${CACHE_VERSION}`;
const CURRENT_CACHES  = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];

// Only pre-cache truly static assets (no HTML, no JS bundles)
const PRECACHE_ASSETS = [
  '/manifest-customer.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete every cache not in CURRENT_CACHES ───────────────────────
self.addEventListener('activate', e => {
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

// ── Message: allow main thread to force activation ───────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 1. API calls → network-first with timeout, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithTimeout(request, API_CACHE, 4000));
    return;
  }

  // 2. Hashed JS / CSS / font / image assets → cache-first
  //    (Vite changes the filename hash on every build, so cached = correct version)
  if (isHashedAsset(url)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. HTML and SPA navigation routes → network-first, no caching
  //    This guarantees users always load the latest HTML shell and discover
  //    new bundle hashes immediately after a deploy.
  if (isNavigationRequest(request, url)) {
    e.respondWith(networkFirstNoCache(request));
    return;
  }

  // 4. Everything else (manifest, icons already pre-cached) → cache-first
  e.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────

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

// Network-first with no caching — used for HTML so deploys are always instant
async function networkFirstNoCache(request) {
  try {
    return await fetch(request);
  } catch {
    // Offline: try cache as last resort so app still opens
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Matches Vite's content-hashed bundles: index-ABC123.js, chunk-XYZ.css etc.
// The hash segment ensures a new deploy = new filename = automatic cache miss.
function isHashedAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)(\?.*)?$/.test(url.pathname)
    && /[a-f0-9]{8}/.test(url.pathname); // only cache files with a hash in the name
}

// Navigation requests are full-page loads / SPA route changes
function isNavigationRequest(request, url) {
  return request.mode === 'navigate'
    || (request.headers.get('accept') || '').includes('text/html');
}