import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env as any).SUPABASE_URL || '';
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);