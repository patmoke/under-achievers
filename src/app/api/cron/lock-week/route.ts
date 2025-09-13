import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = supabaseServer();

  // Lock all unlocked games for the current week
  const { data: lockedGames, error: lockError } = await supabase
    .from('games')
    .update({ locked: true })
    .eq('locked', false)
    .select();

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    lockedCount: lockedGames?.length ?? 0,
    lockedGames,
  });
}
