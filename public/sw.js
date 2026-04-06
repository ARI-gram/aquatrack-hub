const STAFF_CACHE = 'aquatrack-staff-v1';
const CUSTOMER_CACHE = 'aquatrack-customer-v1';

const STAFF_ASSETS = ['/', '/login', '/dashboard'];
const CUSTOMER_ASSETS = ['/customer/login', '/customer/orders', '/customer/account'];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(STAFF_CACHE).then(c => c.addAll(STAFF_ASSETS)),
      caches.open(CUSTOMER_CACHE).then(c => c.addAll(CUSTOMER_ASSETS)),
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Remove any old caches that are no longer needed
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STAFF_CACHE && k !== CUSTOMER_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isCustomer = url.pathname.startsWith('/customer');
  const cacheName = isCustomer ? CUSTOMER_CACHE : STAFF_CACHE;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful GET responses
        if (e.request.method === 'GET' && response.ok) {
          const copy = response.clone();
          caches.open(cacheName).then(c => c.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});