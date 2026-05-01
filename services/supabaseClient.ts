
import { createClient } from '@supabase/supabase-js';

// Retrieve credentials primarily from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xtgztxbbkduxfcaocjhh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z3p0eGJia2R1eGZjYW9jamhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjY3OTMsImV4cCI6MjA4NTAwMjc5M30._fYCizbbpv1mkyd2qNufDVLOFRc-wI5Yo6zKA3Mp4Og';

// SAFELY OVERRIDE NAVIGATOR LOCKS
// This prevents the "Acquiring an exclusive Navigator LockManager lock timed out" error
// caused by browser environment restrictions or zombie locks.
// We patch it globally because passing it in createClient config caused a TypeError in some bundles.
if (typeof window !== 'undefined') {
  try {
    const debugLock = {
      request: async (name: string, optionsOrFn: any, fn?: any) => {
        // Handle overload: request(name, callback) vs request(name, options, callback)
        const callback = fn || optionsOrFn;
        // Execute immediately, bypassing the actual browser lock manager
        return await callback({ name });
      },
      query: async () => ({ pending: [], held: [] })
    };
    
    // Forcefully override the browser's LockManager
    // This is safe because we only need basic locking for session persistence which we are bypassing here
    Object.defineProperty(window.navigator, 'locks', {
      value: debugLock,
      configurable: true,
      writable: true
    });
    console.log('Navigator LockManager patched for stability.');
  } catch (e) {
    console.warn('Could not patch Navigator LockManager:', e);
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
