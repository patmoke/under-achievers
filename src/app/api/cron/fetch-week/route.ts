import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = supabaseServer();
  const season = new Date().getFullYear();

  // Build API request
  const url = new URL(
    'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds'
  );
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', process.env.ODDS_API_KEY!);

  // Fetch odds API
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, status: res.status },
      { status: res.status }
    );
  }
  const data = await res.json();

  // Build upsert rows
  const upserts: any[] = [];
  for (const ev of data) {
    const home = ev.home_team;
    const away = ev.away_team;
    const start = ev.commence_time; // ISO string
    const book = ev.bookmakers?.[0];
    const market = book?.markets?.find((m: any) => m.key === 'spreads');
    const outcomes = market?.outcomes || [];
    const homeOut = outcomes.find((o: any) => o.name === home);
    const awayOut = outcomes.find((o: any) => o.name === away);

    const spread_home = homeOut?.point ?? null;
    const spread_away = awayOut?.point ?? null;

    upserts.push({
      season,
      week: ev.week ?? ev.round ?? 0,
      start_time: start,
      home_team: home,
      away_team: away,
      bookmaker: book?.title ?? null,
      spread_home,
      spread_away,
      odds_last_fetched: new Date().toISOString(),
    });
  }

  // Lock all unlocked games for the current week
  const { data: lockedGames, error: lockError } = await supabase
    .from('games')
    .update({ locked: true })
    .eq('locked', false)
    .select();

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  // Upsert new game odds
  const { error: upsertError } = await supabase
    .from('games')
    .upsert(upserts, {
      onConflict: 'season,week,home_team,away_team',
    });

  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    count: upserts.length,
    lockedGames,
  });
}
