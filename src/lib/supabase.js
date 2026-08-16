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

/**
 * A second client used for exactly one thing: asking for a password reset.
 *
 * PKCE is right for Google sign-in and wrong for an emailed link. A reset
 * requested through the PKCE client mints a `pkce_`-prefixed token, and that
 * can only be redeemed by exchanging a code against a verifier sitting in the
 * localStorage of the browser that asked. Request it on your phone, open the
 * mail on a laptop, and the link is dead — which is exactly what people do.
 *
 * Asking through an implicit-flow client mints a plain token the reset page
 * can redeem on any device. Verified against the API directly: a `pkce_` token
 * comes back 403 otp_expired, a plain one comes back with a session.
 *
 * It never holds a session of its own — persistSession off, its own storage
 * key — so it cannot disturb whoever the main client has signed in.
 */
export const supabaseEmailFlow = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'ua-email-flow',
  }
});
