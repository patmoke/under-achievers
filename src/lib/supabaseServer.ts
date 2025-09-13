import { createServerClient } from '@supabase/ssr';

// dummy cookie methods (not actually used in cron jobs)
const serverCookies = {
  get: (_name: string) => undefined,
  set: (_name: string, _value: string) => {},
  delete: (_name: string) => {},
};

export const supabaseServer = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: serverCookies }
  );
