// ============================================================================
// Supabase Client Configuration
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG: Log the actual values
console.log("🔍 VITE_SUPABASE_URL (raw):", supabaseUrl);
console.log("🔍 VITE_SUPABASE_ANON_KEY (raw):", supabaseAnonKey);
console.log("🔍 Type of URL:", typeof supabaseUrl);
console.log("🔍 Length of URL:", supabaseUrl ? supabaseUrl.length : "undefined");

// Explicit checks
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not defined");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not defined");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
