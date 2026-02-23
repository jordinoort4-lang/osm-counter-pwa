/* ═══════════════════════════════════════════════════════════════════
   OSM Counter NG — Service Worker  v5.1
   public/sw.js  — served at /sw.js by Vercel

   Strategy:
     • App shell / static assets  → Cache-first (fast repeat loads)
     • Supabase API / OAuth        → Network-only (never cache auth)
     • Everything else             → Network-first, cache fallback

   Fixes: "script has an unsupported MIME type 'text/html'"
   Root cause: /sw.js was 404-ing and Vercel returned its HTML 404
   page instead. This file being present in public/ resolves that.
═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'osm-ng-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/images/freeproductcardimage-removebg-preview.png',
  '/images/epicproductcardimage.png',
  '/images/eliteproductcardimage-removebg-preview.png',
  '/images/legendaryproductcardimage-removebg-preview.png',
  '/images/friendreferralnobg.png',
  '/images/iamgeforpwainstallpopup.png',
];

/* ── INSTALL ── precache app shell ─────────────────────────── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v5…');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add known-good static assets; if any fail, installation still succeeds
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] Could not precache', url, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Precache complete');
      // Activate immediately without waiting for old clients to close
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE ── clean stale caches ───────────────────────── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v5…');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => {
      console.log('[SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

/* ── FETCH ── request interception ────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Skip non-GET requests entirely ──────────────────────
  if (request.method !== 'GET') return;

  // ── 2. Skip Supabase / auth / external API calls ───────────
  //    Always go to the network for these — never serve stale auth.
  const isSupabase = url.hostname.includes('supabase.co');
  const isOAuth    = url.hostname.includes('accounts.google.com') ||
                     url.hostname.includes('discord.com');
  const isExternal = url.hostname !== self.location.hostname &&
                     !url.hostname.includes('fonts.googleapis.com') &&
                     !url.hostname.includes('fonts.gstatic.com');

  if (isSupabase || isOAuth || isExternal) {
    event.respondWith(fetch(request));
    return;
  }

  // ── 3. Cache-first for known static assets (JS/CSS/images/fonts) ─
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|eot)(\?.*)?$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── 4. Network-first for HTML navigation and everything else ─
  event.respondWith(networkFirst(request));
});

/* ──────────────────────────────────────────────────────────────
   STRATEGY HELPERS
────────────────────────────────────────────────────────────── */

/**
 * Cache-first: serve from cache immediately; update cache in background.
 * Ideal for versioned JS/CSS bundles and image assets.
 */
async function cacheFirst(request) {
  const cache    = await caches.open(CACHE_NAME);
  const cached   = await cache.match(request);
  if (cached) {
    // Serve from cache and refresh in the background (stale-while-revalidate)
    refreshCache(cache, request);
    return cached;
  }
  // Not in cache — fetch, store, and return
  return fetchAndCache(cache, request);
}

/**
 * Network-first: try network; fall back to cache if offline.
 * Ideal for HTML pages and dynamic content.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Offline — try the cache
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Offline — serving from cache:', request.url);
      return cached;
    }
    // Last resort: serve the cached index.html for navigation requests
    if (request.mode === 'navigate') {
      const indexFallback = await cache.match('/index.html');
      if (indexFallback) return indexFallback;
    }
    // Nothing available — let the browser handle the failure
    throw err;
  }
}

/** Fetch and store a fresh copy in the cache. */
async function fetchAndCache(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    console.warn('[SW] Network error for', request.url, err);
    throw err;
  }
}

/** Background revalidation — update cached asset silently. */
function refreshCache(cache, request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response).catch(() => {});
      }
    })
    .catch(() => {
      // Silently ignore background refresh failures
    });
}

/* ── MESSAGE HANDLER ── allow clients to force SW update ──── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — updating now');
    self.skipWaiting();
  }
});
