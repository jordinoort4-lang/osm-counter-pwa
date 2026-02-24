/* ═══════════════════════════════════════════════════════════
   OSM Counter NG — Service Worker Registration
   Place this file at: src/registerSW.ts
   Import it in src/main.tsx with: import './registerSW';
   
   CRITICAL: filename must be 'service-worker.js' — this is
   what Vercel deploys (matches /public/service-worker.js)
═══════════════════════════════════════════════════════════ */

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported in this browser.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      // ✅ Must match the filename in /public/ — which Vercel deploys as /service-worker.js
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('[SW] Registered successfully. Scope:', registration.scope);

      // Listen for updates — notify user or auto-reload
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new SW has installed and the page is controlled by an old one.
            // Since our SW uses skipWaiting, it will activate automatically.
            console.log('[SW] New version available — reloading for fresh content.');
            window.location.reload();
          }
        });
      });

    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  });
}
