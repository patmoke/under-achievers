import { cookies as nextCookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const supabaseServer = () => {
  const cookieMethods = {
    get: (name: string) => nextCookies().get(name),
    set: (name: string, value: string) => {
      nextCookies().set(name, value);
    },
    delete: (name: string) => {
      nextCookies().delete(name);
    },
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods }
  );
};
