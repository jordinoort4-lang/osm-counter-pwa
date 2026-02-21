/**
 * osm_images.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central image map for the OSM Counter NG app.
 *
 * ✅ WHY LOCAL?
 *   External CDN URLs (e.g. imgbb) can go down, get rate-limited, or expire.
 *   Keeping images in /public ensures reliability and PWA offline support.
 */

export const OSM_IMAGES = {
  /** Subscribe / newsletter promo image */
  subscribe:        "/images/free-tier-subscribe.png",
  /** Free-tier card illustration */
  freeTierCard:     "/images/free-tier-card.png",
} as const;

export type OsmImageKey = keyof typeof OSM_IMAGES;
