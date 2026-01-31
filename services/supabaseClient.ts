
import { createClient } from '@supabase/supabase-js';

// Using process.env as per standard for this environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (!supabase) {
  console.warn(
    'Supabase client is not fully initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}
