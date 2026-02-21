# 🚀 Netlify Deployment Guide — OSM Tactical Engine

## ✅ Pre-flight checklist

- [ ] Code pushed to a GitHub / GitLab / Bitbucket repository
- [ ] Supabase project URL and anon key are ready
- [ ] Netlify account exists (free tier is fine)

---

## 1 — Connect your repo to Netlify

1. Go to **[app.netlify.com](https://app.netlify.com)** → **"Add new site"** → **"Import an existing project"**
2. Choose your Git provider and authorise Netlify
3. Select the repository that contains this project

---

## 2 — Configure the build settings

In the **"Build settings"** screen set:

| Setting | Value |
|---|---|
| **Base directory** | `osm-tactical-engine-v5/frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

> ⚠️ The **Base directory** is critical when the repo root is not the frontend folder.  
> Netlify will automatically pick up the `netlify.toml` inside that folder — all redirects, cache headers, and security headers are already configured there.

---

## 3 — Add environment variables

In Netlify → **Site configuration** → **Environment variables** → **"Add a variable"**:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://REDACTED.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(your actual Supabase anon key)* |

> 🔑 Get your anon key from **[supabase.com/dashboard](https://supabase.com/dashboard)** →  
> Your project → **Settings** → **API** → **Project API keys → anon / public**

---

## 4 — Deploy

Click **"Deploy site"**. Netlify will:

1. Clone the repo
2. `cd` into `osm-tactical-engine-v5/frontend`
3. Run `npm install` (using the committed `package-lock.json` for reproducibility)
4. Run `npm run build` → `tsc && vite build`
5. Publish the `dist/` folder

Build time is typically **under 60 seconds**.

---

## 5 — Custom domain (optional)

**Netlify → Domain management → Add custom domain**  
Follow the DNS instructions shown — Netlify issues a free HTTPS certificate automatically.

---

## What's already configured in `netlify.toml`

| Feature | Detail |
|---|---|
| **SPA routing** | All routes (`/*`) fall back to `index.html` so React Router works |
| **Service Worker** | `no-cache` headers so browsers always fetch the latest SW |
| **Immutable assets** | `/assets/*` cached for 1 year (Vite content-hashed filenames) |
| **Security headers** | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| **Node version** | Pinned to Node 20 |

---

## Re-deploying after changes

Every `git push` to your **main** branch triggers an automatic redeploy — no manual steps needed.

To redeploy manually: **Netlify → Deploys → "Trigger deploy"**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with `tsc` errors | Run `npm run build` locally first and fix TypeScript errors |
| Blank page / white screen | Check browser console; likely a missing env variable (`VITE_SUPABASE_*`) |
| Routes return 404 | Confirm the `[[redirects]]` block in `netlify.toml` is present |
| Old service worker cached | Hard-refresh with `Ctrl+Shift+R` or clear Site Data in DevTools |
