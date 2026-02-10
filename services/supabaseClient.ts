
import { createClient } from '@supabase/supabase-js';

// Support both Vite env vars and window global injection for backwards compatibility
// Use optional chaining for import.meta.env to prevent crashes if it is undefined
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || (window as any).APP_ENV?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (window as any).APP_ENV?.VITE_SUPABASE_ANON_KEY;

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
