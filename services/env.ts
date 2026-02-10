
// Centralized Environment Variable Access
// Prioritizes Runtime Injection (window.APP_ENV) > Build Time (Vite/Process)

export const getEnv = (key: string): string => {
  // 1. Try window.APP_ENV (Runtime Injection for Docker/Cloud)
  try {
    if (typeof window !== 'undefined' && (window as any).APP_ENV && (window as any).APP_ENV[key]) {
      return (window as any).APP_ENV[key];
    }
  } catch (e) {
    // Ignore window access errors
  }

  // 2. Try Vite import.meta.env (Build Time)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // Explicit mapping for static analysis where possible
      if (key === 'VITE_SUPABASE_URL') return import.meta.env.VITE_SUPABASE_URL;
      if (key === 'VITE_SUPABASE_ANON_KEY') return import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (key === 'API_KEY') return import.meta.env.API_KEY || '';
      
      // Fallback for others
      return (import.meta.env as any)[key] || '';
    }
  } catch (e) {
    // Ignore import.meta errors
  }

  // 3. Try process.env (Node/Legacy Polyfills)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] || '';
    }
  } catch (e) {
    // Ignore process errors
  }

  return '';
};
