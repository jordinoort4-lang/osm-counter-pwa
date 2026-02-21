// ============================================================================
// Supabase Client Configuration
// Location: frontend/src/supabase_client.ts
// 
// This sets up the Supabase client for authentication
// NOT for tactical logic - just auth
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);