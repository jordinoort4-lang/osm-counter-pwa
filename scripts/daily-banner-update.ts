/**
 * Static Banner Configuration
 * 
 * This script sets up a static banner from Supabase storage.
 * Run once to initialize, or use for reference in your frontend code.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = 'https://egzquylwclewcgpqnoig.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Static banner configuration - Mobile optimized
const STATIC_BANNER = {
  imageUrl: 'https://egzquylwclewcgpqnoig.supabase.co/storage/v1/object/public/ef/Gemini_Generated_Image_3q1iy3q1iy3q1iy3.png',
  title: 'GTO Strategy Calculator',
  description: 'Optimize your OSM strategy with our advanced calculator tool',
  link: '/gto-calculator',
  isActive: true,
  // Responsive breakpoints for mobile optimization
  responsive: {
    mobile: { width: '100%', height: 'auto', maxHeight: '200px' },
    tablet: { width: '100%', height: 'auto', maxHeight: '280px' },
    desktop: { width: '100%', height: 'auto', maxHeight: '400px' }
  }
};

/**
 * Initialize static banner (run once)
 */
async function initializeStaticBanner(): Promise<boolean> {
  try {
    // Clear any existing banners
    await supabase
      .from('osm_banner')
      .delete()
      .neq('id', 0);

    // Insert static banner
    const { error } = await supabase
      .from('osm_banner')
      .insert([
        {
          image_url: STATIC_BANNER.imageUrl,
          title: STATIC_BANNER.title,
          description: STATIC_BANNER.description,
          link: STATIC_BANNER.link,
          is_active: STATIC_BANNER.isActive,
          is_static: true, // Flag to identify static banner
          responsive_config: STATIC_BANNER.responsive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('❌ Supabase error:', error);
      return false;
    }

    console.log('✅ Static banner initialized successfully');
    console.log('📱 Mobile optimized: 100% width, auto height');
    return true;
  } catch (error) {
    console.error('❌ Error initializing banner:', error);
    return false;
  }
}

// Run once to set up
initializeStaticBanner().then(success => {
  process.exit(success ? 0 : 1);
});
