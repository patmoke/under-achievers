import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const supabase = supabaseServer();
export async function GET() {
const supabase = createServer();
const season = new Date().getFullYear();
const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
url.searchParams.set('regions', 'us');
url.searchParams.set('markets', 'spreads');
url.searchParams.set('oddsFormat', 'american');
url.searchParams.set('apiKey', process.env.ODDS_API_KEY!);

const res = await fetch(url.toString(), { cache: 'no-store' });
if (!res.ok) return NextResponse.json({ ok:false, status:res.status }, { status:res.status });
const data = await res.json();

const upserts = [] as any[];
for (const ev of data) {
// derive teams & spread (consensus from first listed book)
const home = ev.home_team;
const away = ev.away_team;
const start = ev.commence_time; // ISO
const book = ev.bookmakers?.[0];
const market = book?.markets?.find((m:any)=>m.key==='spreads');
const outcomes = market?.outcomes || [];
const homeOut = outcomes.find((o:any)=>o.name === home);
const awayOut = outcomes.find((o:any)=>o.name === away);
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
odds_last_fetched: new Date().toISOString()
});
}

// lock all unlocked games for the current week
 const { data, error } = await supabase
   .from('games')
   .update({ locked: true })
   .eq('locked', false)
   .select();

   if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lockedGames: data });
  }

// batch upsert via RPC to reduce RLS friction (requires service role on server)
const { error } = await supabase.from('games').upsert(upserts, { onConflict: 'season,week,home_team,away_team' });
if (error) return NextResponse.json({ ok:false, error }, { status:500 });
return NextResponse.json({ ok:true, count: upserts.length });
