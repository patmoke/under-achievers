import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const supabase = supabaseServer();

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: Outcome[];
}

interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
  week?: number;
  round?: number;
}

export async function GET() {
  const season = new Date().getFullYear();
  const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', process.env.ODDS_API_KEY!);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ ok: false, status: res.status }, { status: res.status });
  }

  const data: OddsEvent[] = await res.json();

  const upserts = data.map(ev => {
    const home = ev.home_team;
    const away = ev.away_team;
    const start = ev.commence_time;
    const book = ev.bookmakers?.[0];
    const market = book?.markets.find(m => m.key === 'spreads');
    const outcomes = market?.outcomes ?? [];
    const homeOut = outcomes.find(o => o.name === home);
    const awayOut = outcomes.find(o => o.name === away);

    return {
      season,
      week: ev.week ?? ev.round ?? 0,
      start_time: start,
      home_team: home,
      away_team: away,
      bookmaker: book?.title ?? null,
      spread_home: homeOut?.point ?? null,
      spread_away: awayOut?.point ?? null,
      odds_last_fetched: new Date().toISOString(),
    };
  });

  // lock all unlocked games for the current week
  const { data: lockedGames, error: lockError } = await supabase
    .from('games')
    .update({ locked: true })
    .eq('locked', false)
    .select();

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  // batch upsert
  const { error: upsertError } = await supabase
    .from('games')
    .upsert(upserts, { onConflict: 'season,week,home_team,away_team' });

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: upserts.length, lockedGames });
}
