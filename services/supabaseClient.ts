
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials to ensure stability
const supabaseUrl = 'https://ervfxsdwurppznjhsbht.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydmZ4c2R3dXJwcHpuamhzYmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjUzNjIsImV4cCI6MjA4NDk0MTM2Mn0.MIQOHcsAKpoOfx4OjAZ4C8meqrUcFEmELjtspnbQ8-U';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
