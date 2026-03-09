import { createClient } from '@supabase/supabase-js';

// Handle both VITE_ prefixed and non-prefixed environment variables
// Also handles the typo SUPABASE_ANON_KAY from Netlify
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KAY) : undefined);

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');

if (!isConfigured) {
  console.warn('Supabase credentials missing or invalid. Please check your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: { 'x-application-name': 'consigna-beauty' },
      fetch: (url, options) => {
        if (!isConfigured) {
          return Promise.reject(new Error('Supabase is not configured. Please set seu VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'));
        }
        return fetch(url, options).catch(err => {
          console.error('Supabase fetch error:', err);
          throw err;
        });
      }
    }
  }
);
