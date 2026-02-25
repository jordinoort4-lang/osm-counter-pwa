/**
 * Daily Banner Auto-Update Script
 * 
 * This script runs daily to fetch new OSM scouting options and update the banner.
 * It uses an LLM to generate realistic young talented players for OSM.
 * 
 * Usage:
 *   npx ts-node scripts/daily-banner-update.ts
 * 
 * Schedule with cron:
 *   0 8 * * * cd /path/to/osm-counter-pwa && npx ts-node scripts/daily-banner-update.ts
 */

import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize Supabase
const supabaseUrl = 'https://REDACTED.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GeneratedPlayer {
  playerName: string;
  age: number;
  marketValue: string;
  position: string;
  rating: number;
  imageUrl: string;
  description: string;
}

/**
 * Generate a new OSM scouting player using LLM
 */
async function generateNewPlayer(): Promise<GeneratedPlayer> {
  const prompt = `You are an OSM (Online Soccer Manager) scouting expert. Generate a realistic young talented player that would be interesting for the OSM community.

Generate a JSON response with the following structure:
{
  "playerName": "Player's full name",
  "age": number between 15-22,
  "marketValue": "Market value in euros (e.g., €500K, €1.2M)",
  "position": "Position code (ST, CM, LB, CB, GK, etc.)",
  "rating": number between 6-9,
  "description": "Brief scouting report (1-2 sentences about potential and playing style)"
}

Make sure the player is realistic and interesting for OSM players. Vary the positions and nationalities.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from LLM response');
    }

    const playerData = JSON.parse(jsonMatch[0]);

    // Validate the data
    if (!playerData.playerName || !playerData.age || !playerData.marketValue || 
        !playerData.position || playerData.rating === undefined || !playerData.description) {
      throw new Error('Invalid player data structure');
    }

    // Generate a placeholder image URL (you can replace with a real image service)
    const imageUrl = `https://i.ibb.co/tMSMxmwN/Gemini-Generated-Image-ticrt2ticrt2ticr.png`;

    return {
      ...playerData,
      imageUrl,
    };
  } catch (error) {
    console.error('❌ Error generating player:', error);
    throw error;
  }
}

/**
 * Update the banner with a new player
 */
async function updateBanner(player: GeneratedPlayer): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('osm_banner')
      .insert([
        {
          player_name: player.playerName,
          age: player.age,
          market_value: player.marketValue,
          position: player.position,
          rating: player.rating,
          image_url: player.imageUrl,
          description: player.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('❌ Supabase error:', error);
      return false;
    }

    console.log(`✅ Banner updated with: ${player.playerName} (${player.age} years old, ${player.position})`);
    return true;
  } catch (error) {
    console.error('❌ Error updating banner:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🎯 Starting daily banner auto-update...');
  console.log(`📅 Time: ${new Date().toISOString()}`);

  try {
    console.log('🤖 Generating new player with LLM...');
    const newPlayer = await generateNewPlayer();
    
    console.log(`📊 Generated player: ${newPlayer.playerName}`);
    console.log(`   Age: ${newPlayer.age}`);
    console.log(`   Position: ${newPlayer.position}`);
    console.log(`   Rating: ${newPlayer.rating}/10`);
    console.log(`   Market Value: ${newPlayer.marketValue}`);

    console.log('💾 Updating banner in Supabase...');
    const success = await updateBanner(newPlayer);

    if (success) {
      console.log('✅ Daily banner update completed successfully!');
      process.exit(0);
    } else {
      console.error('❌ Failed to update banner');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the main function
main();
