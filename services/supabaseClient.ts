
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials to ensure connectivity regardless of environment variable loading issues
// Matches LoginPage.tsx fallback
const SUPABASE_URL = 'https://xtgztxbbkduxfcaocjhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z3p0eGJia2R1eGZjYW9jamhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjY3OTMsImV4cCI6MjA4NTAwMjc5M30._fYCizbbpv1mkyd2qNufDVLOFRc-wI5Yo6zKA3Mp4Og';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
