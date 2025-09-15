// src/app/auth/signout/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST() {
  const supabase = supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}
