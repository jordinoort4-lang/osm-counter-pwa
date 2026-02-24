/* ═══════════════════════════════════════════════════════════
   OSM Counter NG — Service Worker  v5.2
   Filename: service-worker.js  (matches Vercel deployment)
   - skipWaiting + clients.claim for instant activation
   - Network-first for HTML navigation
   - Cache-first for static assets (JS/CSS/fonts/images)
   - Network-only for Supabase API calls
═══════════════════════════════════════════════════════════ */

const CACHE_VERSION  = 'osm-ng-v5-3';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE  = `${CACHE_VERSION}-dynamic`;

// Files to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', event => {
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache failed for some URLs:', err);
      });
    })
  );
});

// ── Activate ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  // Claim all clients immediately so new SW serves pages right away
  self.clients.claim();

  // Delete all old cache versions
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  // 2. Network-only for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Network-only for external CDN / analytics / fonts APIs
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('i.ibb.co') ||
    !url.origin.includes(self.location.origin)
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 4. Network-first for HTML navigation (always get fresh shell)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // 5. Cache-first for versioned static assets (JS/CSS with hash in filename)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Background update
          fetch(request).then(fresh => {
            caches.open(STATIC_CACHE).then(cache => cache.put(request, fresh));
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 6. Cache-first for images (long-lived)
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 7. Network-first with cache fallback for everything else
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
