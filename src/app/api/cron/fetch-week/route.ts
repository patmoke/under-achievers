// src/app/api/cron/fetch-week/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import type { Bookmaker, OddsEvent } from '@/types/odds';
import { currentSeason } from '@/lib/nfl';

export async function GET() {
  const supabase = supabaseServer();
  const season = currentSeason();

  const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', process.env.ODDS_API_KEY!);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ ok:false, status:res.status }, { status:res.status });
  const data: OddsEvent[] = await res.json();

  const upserts = data.map(ev => {
    const home = ev.home_team;
    const away = ev.away_team;
    const start = ev.commence_time;
    const book = (ev.bookmakers && ev.bookmakers[0]) as Bookmaker | undefined;
    const market = book?.markets?.find(m => m.key === 'spreads');
    const outcomes = market?.outcomes ?? [];
    const homeOut = outcomes.find(o => o.name === home);
    const awayOut = outcomes.find(o => o.name === away);

    return {
      season,
      week: ev.week ?? ev.round ?? 0,
      game_time: start,
      home_team: home,
      away_team: away,
      spread: homeOut?.point ?? null,
      bookmaker: book?.title ?? null,
      odds_last_fetched: new Date().toISOString()
    };
  });

  // Upsert rows
  const { error: upsertError } = await supabase
    .from('games')
    .upsert(upserts, { onConflict: 'season,week,home_team,away_team' });

  if (upsertError) {
    return NextResponse.json({ ok:false, error: upsertError.message }, { status:500 });
  }

  return NextResponse.json({ ok:true, count: upserts.length });
}
