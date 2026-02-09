import { createClient } from '@supabase/supabase-js';

// Access variables from shim in index.html or use fallback values provided in configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ervfxsdwurppznjhsbht.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydmZ4c2R3dXJwcHpuamhzYmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjUzNjIsImV4cCI6MjA4NDk0MTM2Mn0.MIQOHcsAKpoOfx4OjAZ4C8meqrUcFEmELjtspnbQ8-U';

if (!supabaseUrl) {
  throw new Error("Supabase initialization failed: VITE_SUPABASE_URL is not defined in the environment.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
