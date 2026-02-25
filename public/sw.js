/* ═══════════════════════════════════════════════════════════
   OSM Counter NG — Service Worker
   Filename: public/sw.js  →  served at /sw.js
   BUMP CACHE_VERSION on every deploy to force cache invalidation.
═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'osm-ng-v6';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(PRECACHE_URLS).catch(err =>
        console.warn('[SW] Precache partial failure:', err)
      )
    )
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => {
            console.log('[SW] Deleting stale cache:', k);
            return caches.delete(k);
          })
      )
    )
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Network-only: Supabase API
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-only: external CDN / fonts / image hosts
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Network-first: HTML navigation (always get fresh shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/')))
    );
    return;
  }

  // Cache-first: hashed JS/CSS bundles in /assets/
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          fetch(request)
            .then(fresh => caches.open(STATIC_CACHE).then(c => c.put(request, fresh)))
            .catch(() => {});
          return cached;
        }
        return fetch(request).then(res => {
          caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Cache-first: images
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  // Network-first + cache fallback: everything else
  event.respondWith(
    fetch(request)
      .then(res => {
        caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
