// Florix AI Service Worker — v2 (Dev-Safe)
const CACHE_NAME = 'florix-v2';

// ── Install: skip waiting immediately ───────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate: clean all old caches and unregister if localhost ───────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => {
      if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
        return self.registration.unregister();
      }
    })
  );
  self.clients.claim();
});

// ── Fetch: bypass cache completely on localhost/dev ─────────────────────────
self.addEventListener('fetch', (event) => {
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return; // Direct network, never cache Vite dev assets
  }

  const url = new URL(event.request.url);

  // Always go network for API calls
  if (url.port === '8000' || url.pathname.startsWith('/api')) {
    return;
  }

  // Navigation: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
