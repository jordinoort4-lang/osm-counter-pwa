// ─────────────────────────────────────────────────────────────────────────────
//  OSM Counter NG — Service Worker  (v2)
//  Strategy: cache-first for the app shell, network-first for everything else.
//  IMPORTANT: only pre-cache files that actually exist in the production build.
//  Dev-mode paths like /src/main.tsx are NOT served from Vite in production.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = "osm-counter-v2";

// Only pre-cache the true app shell (files that always exist at these exact URLs)
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Pre-cache failed (non-fatal):", err);
      });
    })
  );
  // Activate immediately — don't wait for existing tabs to close
  self.skipWaiting();
});

// ── Activate: delete stale caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET over http(s)
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // ── Hashed asset files (/assets/*.js, /assets/*.css) → cache-first
  //    Vite outputs these with content-hash names so they are immutable.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── API / Supabase calls → network-only (never cache auth/data)
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/functions/")
  ) {
    return; // let the browser handle it natively
  }

  // ── Everything else → network-first, fall back to cache, then "/"
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
  );
});
