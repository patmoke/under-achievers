// src/app/under-achievers/login/page.tsx
'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function Login() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/` } });
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Sign in</h2>
      {sent ? (
        <p>Check your email for a magic link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className="border p-2 rounded" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
          <button className="px-4 py-2 bg-green-600 text-white rounded">Send Link</button>
        </form>
      )}
    </div>
  );
}
