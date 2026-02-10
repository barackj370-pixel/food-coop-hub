
import { createClient } from '@supabase/supabase-js';

// Support both Vite env vars and window global injection for backwards compatibility
// Use optional chaining for import.meta.env to prevent crashes if it is undefined or if 'env' is missing
const getEnvVar = (key: string) => {
  // Check import.meta.env first (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  // Check window.APP_ENV (Legacy/Injected)
  if (typeof window !== 'undefined' && (window as any).APP_ENV && (window as any).APP_ENV[key]) {
    return (window as any).APP_ENV[key];
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

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
