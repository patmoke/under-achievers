'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase'; // ✅ import your client

export default function Login() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      console.error(error);
      return;
    }

    setSent(true);
  }

  return (
    <div>
      {sent ? (
        <p>Check your email for a login link</p>
      ) : (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <button type="submit">Login</button>
        </form>
      )}
    </div>
  );
}
