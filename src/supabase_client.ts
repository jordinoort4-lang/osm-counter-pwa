// ============================================================================
// Supabase Client Configuration
// Location: frontend/src/supabase_client.ts
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Explicit checks – these will fail the build if variables are missing
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not defined in build environment");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not defined in build environment");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
