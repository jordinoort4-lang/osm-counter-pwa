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

/**
 * Fetch the current banner data from Supabase
 */
export const fetchBannerData = async (): Promise<BannerData | null> => {
  try {
    const { data, error } = await supabase
      .from('osm_banner')
      .select('*')
      .order('updatedAt', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[Banner] Fetch error:', error);
      return null;
    }

    return data as BannerData;
  } catch (err) {
    console.error('[Banner] Exception:', err);
    return null;
  }
};

/**
 * Update or create banner data
 */
export const updateBannerData = async (bannerData: BannerData): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('osm_banner')
      .upsert([
        {
          ...bannerData,
          updatedAt: new Date().toISOString(),
        },
      ], { onConflict: 'id' });

    if (error) {
      console.error('[Banner] Update error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Banner] Update exception:', err);
    return false;
  }
};

/**
 * Create a new banner entry
 */
export const createBannerEntry = async (bannerData: BannerData): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('osm_banner')
      .insert([
        {
          ...bannerData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('[Banner] Create error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Banner] Create exception:', err);
    return false;
  }
};

/**
 * Get all banner history
 */
export const getBannerHistory = async (): Promise<BannerData[]> => {
  try {
    const { data, error } = await supabase
      .from('osm_banner')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) {
      console.error('[Banner] History fetch error:', error);
      return [];
    }

    return data as BannerData[];
  } catch (err) {
    console.error('[Banner] History fetch exception:', err);
    return [];
  }
};
