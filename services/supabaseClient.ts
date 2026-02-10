
import { createClient } from '@supabase/supabase-js';

// Support both Vite env vars and window global injection for backwards compatibility
// We access import.meta.env properties directly (statically) to ensure Vite can replace them at build time.
// We use optional chaining and checks to avoid crashes if import.meta.env is undefined.

const getSupabaseUrl = () => {
  // Try Vite env first
  // Check if import.meta is defined (avoids ReferenceError in non-module envs)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }
  
  // Try Legacy/Window injection
  if (typeof window !== 'undefined' && (window as any).APP_ENV?.VITE_SUPABASE_URL) {
    return (window as any).APP_ENV.VITE_SUPABASE_URL;
  }
  return '';
};

const getSupabaseAnonKey = () => {
  // Try Vite env first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  // Try Legacy/Window injection
  if (typeof window !== 'undefined' && (window as any).APP_ENV?.VITE_SUPABASE_ANON_KEY) {
    return (window as any).APP_ENV.VITE_SUPABASE_ANON_KEY;
  }
  return '';
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Check .env file or APP_ENV injection.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
