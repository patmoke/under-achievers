// src/app/leaderboard/page.tsx
import { supabaseServer } from '@/lib/supabaseServer';

export default async function Leaderboard() {
  const supabase = supabaseServer();
  const { data } = await supabase.from('leaderboard').select('*');
  const rows = data ?? [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
      <table className="w-full text-left">
        <thead><tr><th>User</th><th>Correct</th><th>Played</th><th>Accuracy</th></tr></thead>
        <tbody>
          {rows.map((r:any) => (
            <tr key={r.user_id} className="border-t">
              <td className="py-2">{r.username}</td>
              <td>{r.correct_guesses}</td>
              <td>{r.total_picks}</td>
              <td>{r.accuracy}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
