# ⚽ OSM Counter NG

> Professional tactical engine for **Online Soccer Manager** — calculate the optimal
> formation, style of play and player role instructions against any opponent.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://osm-counter-pwa.vercel.app)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue?logo=googlechrome)](https://osm-counter-pwa.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://typescriptlang.org)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Vite 5](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)](https://vitejs.dev)

---

## Features

| | Free | Epic €2.99 | Elite €5.99 | Legendary €9.99 |
|--|------|------------|-------------|-----------------|
| Unlimited blurred calculations | ✅ | ✅ | ✅ | ✅ |
| Formation + Style of Play | ✅ | ✅ | ✅ | ✅ |
| Win probability | 🔒 | ✅ | ✅ | ✅ |
| Player role instructions | 🔒 | ✅ | ✅ | ✅ |
| Match indices & gauges | 🔒 | 🔒 | ✅ | ✅ |
| AI tactical notes | 🔒 | 🔒 | 🔒 | ✅ |
| Offline (PWA) | ✅ | ✅ | ✅ | ✅ |

---

## Quick Start

```bash
git clone https://github.com/jordinoort4-lang/osm-counter-pwa.git
cd osm-counter-pwa
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

---

## Deployment

Pushes to `main` auto-deploy via Vercel.

**Vercel settings:**
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

---

## ⚠️ Critical Dev Rules

### 1. Service worker filename is `/sw.js` — never rename it
Three files must always agree on this name:
- `public/sw.js` — the file itself
- `src/main.tsx` — `navigator.serviceWorker.register('/sw.js')`
- `vercel.json` — cache header `"source": "/sw.js"`

### 2. Bump `CACHE_VERSION` in `public/sw.js` on every deploy
`'osm-ng-v6'` → `'osm-ng-v7'` etc. Without this, users see stale code from the old cache.

### 3. All local images live in `public/images/`
Referenced in code as `/images/filename.png`.
**Never put images at the repo root.**

### 4. One Supabase client — `src/supabase.ts`
`src/supabase_client.ts` has been deleted. All imports must point to `supabase.ts`.

### 5. Unused state setters need `_` prefix
TypeScript's `noUnusedLocals` is `true`. Any declared-but-unused variable
causes a **hard build error**. Prefix with `_` to suppress: `_setHasPaidPlan`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Stale code after deploy | Bump `CACHE_VERSION` in `public/sw.js`, push, hard-reload |
| Images 404 | Confirm files are in `public/images/`, src uses `/images/filename.png` |
| `supabaseUrl is required` | Check `src/supabase.ts` has the URL hardcoded |
| TypeScript build fails | Prefix unused vars with `_` |
| SW not registering | Must be HTTPS or localhost; DevTools → Application → Service Workers |
| Old SW still serving | DevTools → Application → Service Workers → Unregister → hard reload |

---

© 2025 OSM Counter NG. Not affiliated with Online Soccer Manager / Gamebasics B.V.
