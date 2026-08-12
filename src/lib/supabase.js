import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Pinned rather than left to the library default, which is still
    // 'implicit'. PKCE keeps the tokens out of the URL fragment on the way
    // back from the OAuth provider — the fragment survives in history and in
    // anything that logs referrers.
    flowType: 'pkce'
  }
});
