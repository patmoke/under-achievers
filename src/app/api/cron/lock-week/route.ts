// src/app/api/cron/lock-week/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = supabaseServer();

  // Lock all unlocked games
  const { data: lockedGames, error: lockError } = await supabase
    .from('games')
    .update({ locked: true })
    .eq('locked', false)
    .select();

  if (lockError) {
    return NextResponse.json({ ok:false, error: lockError.message }, { status: 500 });
  }

  // compute weekly results (simple example: require picks table schema)
  // NOTE: Keep compute logic server-side cron if you want automated scoring.

  return NextResponse.json({ ok:true, lockedCount: lockedGames?.length ?? 0 });
}
