// src/app/play/page.tsx
import { supabaseServer } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function Play() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/under-achievers/login');

  const season = new Date().getFullYear();
  const { data: games } = await supabase.from('games').select('*').eq('locked', false).order('game_time', { ascending: true });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Make your guesses</h2>
      {games?.length ? (
        <ul className="space-y-3">
          {games.map((g:any) => (
            <li key={g.id} className="border rounded p-3">
              <div>{g.away_team} @ {g.home_team} — {new Date(g.game_time).toLocaleString()}</div>
              <div className="text-sm opacity-70">Consensus: {g.spread_home ?? 'N/A'}</div>
            </li>
          ))}
        </ul>
      ) : <p>No open games.</p>}
    </div>
  );
}
