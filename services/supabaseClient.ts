
import { createClient } from '@supabase/supabase-js';

// Helper to reliably retrieve environment variables
// This supports both Vite's build-time replacement (import.meta.env)
// and runtime injection via window.APP_ENV for Docker/Cloud builds.
// Priority is given to window.APP_ENV to allow runtime configuration overrides.
const getEnv = (key: string): string => {
  // 1. Try window.APP_ENV (Legacy/Runtime Injection) - High Priority
  try {
    if (typeof window !== 'undefined' && (window as any).APP_ENV && (window as any).APP_ENV[key]) {
      return (window as any).APP_ENV[key];
    }
  } catch (e) {
    // Ignore errors if window is undefined
  }

  // 2. Try Vite import.meta.env (Build Time) - Fallback
  // We must explicitly access properties for Vite's static analysis to work.
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (key === 'VITE_SUPABASE_URL') {
        return import.meta.env.VITE_SUPABASE_URL;
      } else if (key === 'VITE_SUPABASE_ANON_KEY') {
        return import.meta.env.VITE_SUPABASE_ANON_KEY;
      }
    }
  } catch (e) {
    // Ignore errors in environments where import.meta is not supported
  }

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Check .env file or APP_ENV injection.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
