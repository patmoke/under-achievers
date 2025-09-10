'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
const supabase = createClient();
const [email, setEmail] = useState('');
const [sent, setSent] = useState(false);

async function send() {
await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
setSent(true);
}

return (
<div className="min-h-screen grid place-items-center p-6">
<div className="max-w-md w-full rounded-2xl shadow p-6 space-y-4">
<h1 className="text-2xl font-bold">Under Achievers</h1>
<p>Sign in with a magic link.</p>
<input className="w-full border rounded p-2" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
<button className="w-full rounded-2xl p-2 shadow" onClick={send}>Send Link</button>
{sent && <p>Check your email.</p>}
</div>
</div>
);
}
