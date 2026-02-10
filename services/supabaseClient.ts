
import { createClient } from '@supabase/supabase-js';

// Helper to reliably retrieve environment variables
// This supports both Vite's build-time replacement (import.meta.env)
// and runtime injection via window.APP_ENV for Docker/Cloud builds.
const getEnv = (key: string): string => {
  let value = '';

  // 1. Try Vite import.meta.env
  // We must explicitly access properties for Vite's static analysis to work.
  // We check for existence to avoid crashes if import.meta.env is undefined.
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (key === 'VITE_SUPABASE_URL') {
        value = import.meta.env.VITE_SUPABASE_URL;
      } else if (key === 'VITE_SUPABASE_ANON_KEY') {
        value = import.meta.env.VITE_SUPABASE_ANON_KEY;
      }
    }
  } catch (e) {
    // Ignore errors in environments where import.meta is not supported
  }

  // 2. Try window.APP_ENV (Legacy/Runtime Injection)
  // This is used when environment variables are injected at runtime (e.g. via index.html)
  if (!value) {
    try {
      if (typeof window !== 'undefined' && (window as any).APP_ENV) {
        value = (window as any).APP_ENV[key];
      }
    } catch (e) {
      // Ignore errors if window is undefined
    }
  }

  return value || '';
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
