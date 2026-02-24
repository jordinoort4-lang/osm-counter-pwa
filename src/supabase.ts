import { createClient } from '@supabase/supabase-js';

// ── Supabase credentials ──────────────────────────────────────────────
// These are hardcoded here because Vercel env vars weren't loading.
// The anon key is safe to expose in frontend code (it's row-level-security protected).
const SUPABASE_URL  = 'https://egzquylwclewcgpqnoig.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnenF1eWx3Y2xld2NncHFub2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzA0NzMsImV4cCI6MjA4NjIwNjQ3M30._iwiKPVMel-G2trMR_upwJEM0833pd-GcZEWgvzz55w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
