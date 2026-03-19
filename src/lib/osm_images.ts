/**
 * osm_images.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central image map for the OSM Counter NG app.
 *
 * ✅ WHY LOCAL?
 *   External CDN URLs (e.g. imgbb) can go down, get rate-limited, or expire.
 *   Keeping images in /public ensures reliability and PWA offline support.
 *
 * ✅ SUPABASE STORAGE:
 *   Additional images are fetched from Supabase storage bucket 'ef'
 *   for dynamic content and rotating banners.
 */

import { fetchSupabaseImages } from './bannerManager';

export const OSM_IMAGES = {
  /** Subscribe / newsletter promo image */
  subscribe:        "/images/free-tier-subscribe.png",
  /** Free-tier card illustration */
  freeTierCard:     "/images/free-tier-card.png",
} as const;

export type OsmImageKey = keyof typeof OSM_IMAGES;

// Cache for Supabase images
let supabaseImagesCache: string[] | null = null;

/**
 * Get all Supabase storage images (cached after first fetch)
 */
export const getSupabaseImages = async (): Promise<string[]> => {
  if (supabaseImagesCache === null) {
    supabaseImagesCache = await fetchSupabaseImages();
  }
  return supabaseImagesCache;
};

/**
 * Get all available images (local + Supabase)
 */
export const getAllImages = async (): Promise<{ local: Record<string, string>; supabase: string[] }> => {
  const supabaseImages = await getSupabaseImages();
  return {
    local: OSM_IMAGES,
    supabase: supabaseImages,
  };
};
