// src/app/page.tsx
import { supabaseServer } from '@/lib/supabaseServer';
import Link from 'next/link';

export default async function Home() {
  const supabase = supabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error fetching user:', error.message);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      {user ? (
        <>
          <h1 className="text-2xl font-bold mb-4">Welcome, {user.email}!</h1>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Sign out
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-4">You are not signed in</h1>
          <Link
            href="/under-achievers/login"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Sign in
          </Link>
        </>
      )}
    </main>
  );
}
