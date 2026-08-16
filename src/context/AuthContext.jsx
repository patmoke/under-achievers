import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  }

  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Derived, not hardcoded: this used to name the vercel.app domain, so
        // moving to underachievers.mokelabs.dev would have sent every
        // confirmation link back to the old host. It also means preview
        // deployments confirm to themselves.
        emailRedirectTo: window.location.origin,
        data: { username },
      },
    });
    if (error) throw error;
    // No profile write here: the handle_new_user trigger on auth.users creates
    // the row from the username passed above. Doing it from the client also
    // failed whenever email confirmation was on, since there's no session yet
    // for the insert policy to match against.
    return data;
  }

  /**
   * Hands off to the provider and comes back to whatever page we left from.
   *
   * There's no session to wait for here — the browser navigates away, and the
   * session is picked up from the URL on return by detectSessionInUrl, which
   * fires onAuthStateChange above.
   */
  async function signInWithProvider(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href,
        // Shared laptops are a real thing in a friends league; without this
        // Google silently reuses whichever account signed in last.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /**
   * Sends a reset link. Deliberately reports success either way — telling a
   * stranger whether an address has an account here is an enumeration oracle,
   * and it isn't worth one for the sake of a slightly friendlier message.
   */
  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function setPassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function updateProfile(updates) {
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signInWithProvider, requestPasswordReset, setPassword, signOut, updateProfile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Colocated with the provider on purpose. Splitting it into its own module
// would satisfy fast refresh but scatter the auth surface across two files for
// a dev-only nicety.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
