import { supabase } from '../supabase';

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

// Static banner image URL from Supabase
const STATIC_BANNER_IMAGE = 'https://egzquylwclewcgpqnoig.supabase.co/storage/v1/object/public/ef/Gemini_Generated_Image_3q1iy3q1iy3q1iy3.png';

/**
 * Fetch the current banner data
 * Now returns a static banner as requested
 */
export const fetchBannerData = async (): Promise<BannerData | null> => {
    return {
          playerName: 'Legendary Strategist',
          age: 2026,
          marketValue: '€100M+',
          position: 'Manager',
          rating: 99,
          imageUrl: STATIC_BANNER_IMAGE,
          description: 'Mastering the art of OSM tactics with 78% reverse-engineered precision.',
          updatedAt: new Date().toISOString()
    };
};

/**
 * Update or create banner data (Disabled for static mode)
 */
export const updateBannerData = async (bannerData: BannerData): Promise<boolean> => {
    console.log('Banner updates are disabled in static mode');
    return true;
};

/**
 * Create a new banner entry (Disabled for static mode)
 */
export const createBannerEntry = async (bannerData: BannerData): Promise<boolean> => {
    console.log('Banner creation is disabled in static mode');
    return true;
};

/**
 * Get all banner history (Returns empty in static mode)
 */
export const getBannerHistory = async (): Promise<BannerData[]> => {
    return [];
};
