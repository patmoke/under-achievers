// src/app/page.tsx
import { supabaseServer } from '@/lib/supabaseServer';
import Link from 'next/link';

export default async function Home() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;

  return (
    <main className="flex flex-col items-center gap-6">
      {user ? (
        <>
          <p>Welcome, {user.email}</p>
          <form action="/auth/signout" method="post">
            <button className="px-4 py-2 bg-red-500 text-white rounded">Sign out</button>
          </form>
          <Link href="/play" className="underline">Play</Link>
          <Link href="/leaderboard" className="underline">Leaderboard</Link>
        </>
      ) : (
        <>
          <p>You are not signed in</p>
          <Link href="/under-achievers/login" className="px-4 py-2 bg-blue-600 text-white rounded">Sign in</Link>
        </>
      )}
    </main>
  );
}
