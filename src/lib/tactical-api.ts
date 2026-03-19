/**
 * Tactical API Client
 * 
 * Integrates with Supabase Edge Function for advanced tactic calculations.
 * Provides both throwing (backward compatible) and safe (error object) methods.
 * 
 * Edge Function URL: https://eljlxaowizfjmpndmsqc.supabase.co/functions/v1/osm-counter-tactics
 */

import { devLog, devWarn } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamStats {
  formation: string;
  overallRating: number;
  attackRating: number;
  midfieldRating: number;
  defenseRating: number;
}

export interface TacticalPayload {
  myTeam: TeamStats;
  opponentTeam: TeamStats;
  isHome: boolean;
  competition: string;
  useHighPress: boolean;
  useLongBall: boolean;
  prioritizeWingers: boolean;
  useOffsideTrap: boolean;
}

export interface TacticalResponse {
  // Core result
  recommendedFormation: string;
  styleOfPlay: string;
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
  
  // Tactical details
  tacticalBrief: string;
  detailedTactics: string;
  playerRoles: Array<{
    position: string;
    role: string;
    instruction: string;
    priority: 'High' | 'Medium' | 'Normal';
  }>;
  
  // Alternative formations
  alternativeFormations: Array<{
    formation: string;
    type: string;
    winProbability: number;
    strengths: string;
    weaknesses: string;
  }>;
  
  // Advanced metrics
  pressureIndex: number;
  transitionScore: number;
  defensiveShape: string;
  attackingWidth: string;
  keyMatchup: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  formationChanged: boolean;
}

export interface TacticalError {
  error: string;
  message?: string;
  code?: string;
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Get the Edge Function base URL from environment.
 * Constructs: {SUPABASE_URL}/functions/v1/osm-counter-tactics
 */
const getEdgeFunctionUrl = (): string | null => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    devWarn('[TacticalAPI] Missing VITE_SUPABASE_URL');
    return null;
  }
  return `${supabaseUrl}/functions/v1/osm-counter-tactics`.trim();
};

/**
 * Get the anon key from environment.
 */
const getAnonKey = (): string | null => {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    devWarn('[TacticalAPI] Missing VITE_SUPABASE_ANON_KEY');
    return null;
  }
  return key;
};

/**
 * Check if the Edge Function is configured.
 */
export const isTacticalApiConfigured = (): boolean => {
  return !!(getEdgeFunctionUrl() && getAnonKey());
};

// ============================================================================
// PRIMARY API (throws on error - backward compatible)
// ============================================================================

/**
 * Calculate tactic using Supabase Edge Function.
 * 
 * @param payload - The tactical inputs
 * @returns Promise resolving to TacticalResponse
 * @throws Error if API is not configured or request fails
 * 
 * @example
 * try {
 *   const result = await calculateTactic({
 *     myTeam: { formation: '4-3-3', overallRating: 85, ... },
 *     opponentTeam: { formation: '4-4-2', overallRating: 82, ... },
 *     isHome: true,
 *     competition: 'League Match',
 *     useHighPress: false,
 *     useLongBall: false,
 *     prioritizeWingers: true,
 *     useOffsideTrap: false
 *   });
 *   console.log(result.recommendedFormation);
 * } catch (err) {
 *   console.error('Failed to calculate:', err.message);
 * }
 */
export const calculateTactic = async (payload: TacticalPayload): Promise<TacticalResponse> => {
  const edgeUrl = getEdgeFunctionUrl();
  const anonKey = getAnonKey();

  // Fail fast if not configured
  if (!edgeUrl || !anonKey) {
    const msg = '[TacticalAPI] Not configured: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY';
    devWarn(msg);
    throw new Error(msg);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    devLog('[TacticalAPI] Calculating tactic...', { formation: payload.myTeam.formation });

    const response = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'X-Client-Version': '8.2.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusText = response.statusText;
      const errorText = await response.text().catch(() => 'Unknown error');
      const msg = `[TacticalAPI] HTTP ${response.status}: ${statusText} - ${errorText}`;
      devWarn(msg);
      throw new Error(msg);
    }

    const data = await response.json();
    
    // Handle error responses from the edge function
    if (data.error) {
      throw new Error(data.error);
    }

    devLog('[TacticalAPI] Calculation successful');
    return data as TacticalResponse;

  } catch (err) {
    clearTimeout(timeoutId);
    
    if ((err as Error).name === 'AbortError') {
      devWarn('[TacticalAPI] Request timed out');
      throw new Error('Request timed out. Please try again.');
    }
    
    devLog('[TacticalAPI] Error:', err);
    throw err;
  }
};

// ============================================================================
// SAFE API (returns error object instead of throwing)
// ============================================================================

/**
 * Calculate tactic with safe error handling.
 * Returns a result object instead of throwing exceptions.
 * 
 * @param payload - The tactical inputs
 * @returns Promise resolving to { data: TacticalResponse } or { error: string }
 * 
 * @example
 * const result = await calculateTacticSafe(payload);
 * if (result.error) {
 *   console.error('Failed:', result.error);
 * } else {
 *   console.log('Formation:', result.data.recommendedFormation);
 * }
 */
export const calculateTacticSafe = async (
  payload: TacticalPayload
): Promise<{ data?: TacticalResponse; error?: string }> => {
  try {
    const data = await calculateTactic(payload);
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    devLog('[TacticalAPI] Safe call error:', message);
    return { error: message };
  }
};

// ============================================================================
// PRESET VALUES HELPERS
// ============================================================================

/**
 * Preset team configurations for quick testing/demo.
 */
export const PRESET_TEAMS = {
  topTeam: {
    formation: '4-3-3',
    overallRating: 88,
    attackRating: 90,
    midfieldRating: 87,
    defenseRating: 85,
  },
  strongTeam: {
    formation: '4-4-2',
    overallRating: 82,
    attackRating: 80,
    midfieldRating: 83,
    defenseRating: 82,
  },
  averageTeam: {
    formation: '4-2-3-1',
    overallRating: 75,
    attackRating: 74,
    midfieldRating: 76,
    defenseRating: 74,
  },
  weakTeam: {
    formation: '5-4-1',
    overallRating: 68,
    attackRating: 65,
    midfieldRating: 70,
    defenseRating: 72,
  },
} as const;

/**
 * Create a test payload using preset values.
 * 
 * @param myPreset - Key from PRESET_TEAMS for user's team
 * @param oppPreset - Key from PRESET_TEAMS for opponent
 * @param options - Additional tactical options
 * @returns TacticalPayload ready for API call
 */
export const createTestPayload = (
  myPreset: keyof typeof PRESET_TEAMS,
  oppPreset: keyof typeof PRESET_TEAMS,
  options?: Partial<Omit<TacticalPayload, 'myTeam' | 'opponentTeam'>>
): TacticalPayload => {
  return {
    myTeam: { ...PRESET_TEAMS[myPreset] },
    opponentTeam: { ...PRESET_TEAMS[oppPreset] },
    isHome: true,
    competition: 'League Match',
    useHighPress: false,
    useLongBall: false,
    prioritizeWingers: false,
    useOffsideTrap: false,
    ...options,
  };
};
