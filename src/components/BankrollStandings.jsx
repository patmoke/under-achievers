import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Info } from 'lucide-react';

const fmt = (n, dp = 0) =>
  n === null || n === undefined ? '—'
    : Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: 2 });

const signed = n => (Number(n) > 0 ? `+${fmt(n, 2)}` : fmt(n, 2));

/**
 * The league board, and the house counter under it.
 *
 * Balance is the score, so it sorts on that. Everything else is context for
 * why someone is where they are — a big balance off two lucky parlays reads
 * very differently from one off thirty disciplined singles, and the record
 * and the biggest win are what tell those apart.
 */
export default function BankrollStandings({ leagueId, currentUserId, currentWeek }) {
  const [rows, setRows] = useState([]);
  const [house, setHouse] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [standingsRes, houseRes] = await Promise.all([
      supabase.rpc('bankroll_standings', { p_league_id: leagueId }),
      supabase.rpc('bankroll_house', { p_league_id: leagueId }),
    ]);
    const sorted = (standingsRes.data || []).slice().sort(
      (a, b) => Number(b.balance) - Number(a.balance) || a.username.localeCompare(b.username));
    setRows(sorted);
    setHouse((houseRes.data || [])[0] || null);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Loading standings…</p>;

  const settledBets = rows.reduce((n, r) => n + r.won + r.lost + r.pushed, 0);

  return (
    <div>
      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['', 'Player', 'Balance', 'W–L–P', 'Best win', `Week ${currentWeek}`].map((h, i) => (
                <th key={h + i} className="label-muted" style={{
                  textAlign: i >= 2 ? 'right' : 'left',
                  padding: '8px 10px', borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user_id === currentUserId;
              return (
                <tr key={r.user_id} style={{ background: isMe ? 'var(--accent-soft)' : 'transparent' }}>
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', width: 34 }}>
                    <span style={{
                      fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16,
                      color: i === 0 ? 'var(--gold)' : 'var(--ink-faint)',
                    }}>{i + 1}</span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontWeight: isMe ? 700 : 500 }}>
                    {r.username}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', textAlign: 'right',
                               fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(r.balance)}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', textAlign: 'right',
                               color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {r.won}–{r.lost}{r.pushed > 0 && `–${r.pushed}`}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', textAlign: 'right',
                               color: Number(r.biggest_win) > 0 ? 'var(--accent)' : 'var(--ink-faint)',
                               fontVariantNumeric: 'tabular-nums' }}>
                    {Number(r.biggest_win) > 0 ? `+${fmt(r.biggest_win)}` : '—'}
                  </td>
                  {/* The deliberate middle ground: you can see that someone has
                      bet and how much is at risk, never what it is on. */}
                  <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', textAlign: 'right',
                               color: r.bets_this_week === 0 ? 'var(--ink-faint)' : 'var(--ink-soft)',
                               fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {r.bets_this_week === 0
                      ? 'nothing yet'
                      : `${r.bets_this_week} bet${r.bets_this_week === 1 ? '' : 's'} · ${fmt(r.staked_this_week)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: -18, marginBottom: 28 }}>
        <Info size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
        You can see how many bets someone has placed this week, never what they
        are on. Slips become public once every game on them has kicked off.
      </p>

      {/* The house */}
      <h3 style={{ fontSize: 20, textTransform: 'none', marginBottom: 4 }}>The house</h3>
      {!house || house.bets === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Nothing settled yet — the house has taken nothing.
        </p>
      ) : (
        <>
          <div className="card" style={{ padding: 18, display: 'grid', gap: 18,
                                         gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <Figure label="Take" value={signed(house.take)}
                    hint="Stakes in, returns out" tone={Number(house.take) >= 0 ? 'accent' : 'danger'} />
            <Figure label="Vig" value={fmt(house.vig, 2)}
                    hint="The edge in the prices" />
            <Figure label="Luck" value={signed(house.luck)}
                    hint={Number(house.luck) >= 0 ? 'The house ran hot' : 'The room ran hot'}
                    tone={Number(house.luck) >= 0 ? 'ink' : 'accent'} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 10, lineHeight: 1.6 }}>
            Across {settledBets} settled bet{settledBets === 1 ? '' : 's'}. The vig is what the
            house should keep from the prices alone; take is what it actually kept. Over enough
            bets the two converge — the difference is nobody&apos;s skill, just variance.
          </p>
        </>
      )}
    </div>
  );
}

function Figure({ label, value, hint, tone = 'ink' }) {
  const color = tone === 'accent' ? 'var(--accent)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)';
  return (
    <div>
      <div className="label-muted" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 28, lineHeight: 1,
                    color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>{hint}</div>
    </div>
  );
}
