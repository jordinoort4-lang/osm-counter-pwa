import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { devLog, devWarn } from './lib/logger';

// ── Supabase credentials ──────────────────────────────────────────────
// Required environment variables:
// - VITE_SUPABASE_URL: Your Supabase project URL
// - VITE_SUPABASE_ANON_KEY: Your Supabase anon key
//
// Set these in:
// - Local: Create a .env file (gitignored)
// - Vercel: Project Settings → Environment Variables

const getSupabaseUrl = (): string | null => {
  return import.meta.env.VITE_SUPABASE_URL || null;
};

const getSupabaseAnonKey = (): string | null => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || null;
};

/**
 * Check if Supabase is properly configured with environment variables.
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(getSupabaseUrl() && getSupabaseAnonKey());
};

/**
 * Lazy-initialized Supabase client.
 * Returns null if environment variables are missing (graceful degradation).
 * Use isSupabaseConfigured() to check availability before use.
 */
let _supabase: SupabaseClient | null = null;
let _initError: string | null = null;

const initSupabase = (): SupabaseClient | null => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  
  if (!url || !key) {
    const missing = !url ? 'VITE_SUPABASE_URL' : 'VITE_SUPABASE_ANON_KEY';
    _initError = `[Supabase] Missing ${missing}. Create a .env file from env.example or set Vercel environment variables.`;
    devWarn(_initError);
    return null;
  }
  
  try {
    _supabase = createClient(url, key);
    devLog('[Supabase] Client initialized successfully');
    return _supabase;
  } catch (err) {
    _initError = err instanceof Error ? err.message : '[Supabase] Failed to initialize client';
    devWarn(_initError);
    return null;
  }
};

/**
 * Get the Supabase client instance.
 * Returns null if not configured - handle gracefully in components.
 *
 * @example
 * const client = getSupabase();
 * if (!client) {
 *   // Show graceful error or fallback
 *   return;
 * }
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!_supabase) {
    return initSupabase();
  }
  return _supabase;
};

/**
 * Get any initialization error that occurred.
 * Useful for debugging configuration issues.
 */
export const getSupabaseError = (): string | null => {
  return _initError;
};

/**
 * @deprecated Use getSupabase() instead for lazy initialization.
 * This export returns null to alert developers to migrate.
 *
 * Migration:
 *   Old: import { supabase } from './supabase';
 *   New: import { getSupabase, isSupabaseConfigured } from './supabase';
 *        const client = getSupabase();
 *        if (!client) {
 *          // Handle missing configuration
 *          return;
 *        }
 */
export const supabase: SupabaseClient | null = null;
