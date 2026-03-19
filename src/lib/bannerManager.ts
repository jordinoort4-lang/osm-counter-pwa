// Supabase client import
import { getSupabase, isSupabaseConfigured } from '../supabase';
import { devLog, devWarn } from './logger';

// Get storage URL from environment or return fallback for missing env vars
const getStorageUrl = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_STORAGE_URL;
  if (!url) {
    // Construct from the main Supabase URL if available
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/ef/`;
    }
    devWarn(
      '[BannerManager] Missing VITE_SUPABASE_URL or VITE_SUPABASE_STORAGE_URL. ' +
      'Using fallback image. Create a .env file from env.example or set Vercel environment variables.'
    );
    return null;
  }
  return url;
};

const SUPABASE_STORAGE_URL = getStorageUrl();

export interface BannerData {
    id?: string;
    playerName: string;
    age: number;
    marketValue: string;
    position: string;
    rating: number;
    imageUrl: string;
    description: string;
    createdAt?: string;
    updatedAt?: string;
}

// Static banner image URL from Supabase (derived from storage URL)
const getStaticBannerImage = (): string => {
  const storageUrl = getStorageUrl();
  if (!storageUrl) {
    return '/images/freeproductcardimage-removebg-preview.png';
  }
  // Allow configurable banner image via environment variable
  const bannerImage = import.meta.env.VITE_SUPABASE_BANNER_IMAGE || 'Gemini_Generated_Image_3q1iy3q1iy3q1iy3.png';
  return `${storageUrl}${bannerImage}`;
};

/**
 * Fetch the current banner data
 * Now returns a static banner as requested
 */
export const fetchBannerData = async (): Promise<BannerData | null> => {
    devLog('[BannerManager] Fetching banner data...');
    devLog('[BannerManager] Static banner image URL:', getStaticBannerImage());
    
    return {
          playerName: 'Legendary Strategist',
          age: 2026,
          marketValue: '€100M+',
          position: 'Manager',
          rating: 99,
          imageUrl: getStaticBannerImage(),
          description: 'Mastering the art of OSM tactics with 78% reverse-engineered precision.',
          updatedAt: new Date().toISOString()
    };
};

/**
 * Update or create banner data (Disabled for static mode)
 */
export const updateBannerData = async (_bannerData: BannerData): Promise<boolean> => {
    devLog('Banner updates are disabled in static mode');
    return true;
};

/**
 * Create a new banner entry (Disabled for static mode)
 */
export const createBannerEntry = async (_bannerData: BannerData): Promise<boolean> => {
    devLog('Banner creation is disabled in static mode');
    return true;
};

/**
 * Get all banner history (Returns empty in static mode)
 */
export const getBannerHistory = async (): Promise<BannerData[]> => {
    return [];
};

/**
 * Fetch all image URLs from Supabase storage bucket 'ef'
 */
export const fetchSupabaseImages = async (): Promise<string[]> => {
    // Return empty if Supabase is not configured
    if (!isSupabaseConfigured()) {
        devWarn('[BannerManager] Supabase not configured - skipping image fetch');
        return [];
    }
    
    const supabaseClient = getSupabase();
    if (!supabaseClient) {
        devWarn('[BannerManager] Supabase client not initialized - skipping image fetch');
        return [];
    }
    
    try {
        const { data, error } = await supabaseClient.storage.from('ef').list('', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
        });

        if (error) {
            devWarn('[BannerManager] Error listing storage files:', error);
            return [];
        }

        if (!data || data.length === 0) {
            devLog('[BannerManager] No files found in storage bucket');
            return [];
        }

        // Return empty if storage URL is not configured
        if (!SUPABASE_STORAGE_URL) {
            devWarn('[BannerManager] Storage URL not configured');
            return [];
        }

        // Filter for image files and create full URLs
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const imageUrls = data
            .filter(file => {
                const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
                return imageExtensions.includes(ext);
            })
            .map(file => `${SUPABASE_STORAGE_URL}${file.name}`);

        devLog('[BannerManager] Found images in storage:', imageUrls);

        return imageUrls;
    } catch (err) {
        devWarn('[BannerManager] Exception fetching images:', err);
        return [];
    }
};
