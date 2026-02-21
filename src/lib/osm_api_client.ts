// ============================================================================
// OSM API CLIENT
// Location: frontend/src/lib/osm_api_client.ts
// 
// This file ONLY makes HTTP calls to the backend
// NO logic here - just API communication
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Calls the backend tactical engine
 * Backend URL: /functions/v1/osm_tactical_engine
 * Backend location: supabase/functions/osm_tactical_engine/index.ts
 */
export async function callTacticalEngine(
  formation: string,
  strength: string
) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/osm_tactical_engine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ formation, strength })
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: "API call failed"
    };
  }
}

export const AVAILABLE_FORMATIONS = [
  "532",
  "631A",
  "541A",
  "541B",
  "5311",
  "442B",
  "442A",
  "451",
  "523A",
  "523B",
  "4231",
  "334A",
  "334B",
  "433A",
  "433B",
  "343A",
  "343B",
  "3322",
  "424"
];

export const STRENGTH_OPTIONS = [
  "much-weaker",
  "weaker",
  "equal",
  "stronger",
  "much-stronger"
];