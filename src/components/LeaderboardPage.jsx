import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentWeek } from '../lib/useCurrentWeek';

const CURRENT_SEASON = 2026;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('weekly');
  const [weeklyData, setWeeklyData] = useState([]);
  const [seasonData, setSeasonData] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = useCurrentWeek(CURRENT_SEASON);
  // null until the user chooses, so the selector follows the derived
  // current week once it resolves instead of freezing at the estimate.
  const [selectedWeekOverride, setSelectedWeekOverride] = useState(null);
  const selectedWeek = selectedWeekOverride ?? currentWeek;
  const setSelectedWeek = setSelectedWeekOverride;

  // Declared before fetchLeaderboards, which falls back to it when the
  // precomputed weekly_leaderboards table has no rows for the week.
  const fetchFromPredictions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('predictions')
      .select('*, profiles(username, display_name), games(actual_spread)')
      .eq('week', selectedWeek)
      .eq('season', CURRENT_SEASON)
      .not('games.actual_spread', 'is', null);

    if (!data) { setLoading(false); return; }

    // Group by user
    const userMap = {};
    data.forEach(p => {
      if (!p.profiles) return;
      const uid = p.user_id;
      if (!userMap[uid]) {
        userMap[uid] = { user_id: uid, username: p.profiles.username, display_name: p.profiles.display_name, picks: [], points: 0 };
      }
      const diff = p.games?.actual_spread !== null && p.games?.actual_spread !== undefined
        ? Math.abs(p.predicted_spread - p.games.actual_spread) : null;
      userMap[uid].picks.push(diff);
      userMap[uid].points += p.points_earned || 0;
    });

    const rows = Object.values(userMap)
      .filter(u => u.picks.length > 0)
      .map(u => {
        const validDiffs = u.picks.filter(d => d !== null);
        const avg = validDiffs.length > 0 ? validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length : null;
        return { ...u, total_predictions: u.picks.length, avg_difference: avg };
      })
      .sort((a, b) => (a.avg_difference || 99) - (b.avg_difference || 99))
      .map((u, i) => ({ ...u, rank: i + 1 }));

    setWeeklyData(rows);
    setLoading(false);
  }, [selectedWeek]);

  const fetchLeaderboards = useCallback(async () => {
    setLoading(true);
    if (tab === 'weekly') {
      const { data } = await supabase
        .from('weekly_leaderboards')
        .select('*, profiles(username, display_name)')
        .eq('week', selectedWeek)
        .eq('season', CURRENT_SEASON)
        .order('rank');
      if (data && data.length > 0) {
        setWeeklyData(data);
        setLoading(false);
      } else {
        // Fall back to live predictions when the leaderboard table is empty
        await fetchFromPredictions();
      }
    } else {
      const { data } = await supabase
        .from('season_leaderboards')
        .select('*, profiles(username, display_name)')
        .eq('season', CURRENT_SEASON)
        .order('rank');
      setSeasonData(data || []);
      setLoading(false);
    }
  }, [tab, selectedWeek, fetchFromPredictions]);

  useEffect(() => { fetchLeaderboards(); }, [fetchLeaderboards]);

  const displayData = tab === 'weekly' ? weeklyData : seasonData;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{CURRENT_SEASON} NFL Season</div>
        <h1 style={{ fontSize: 34, textTransform: 'none' }}>Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'weekly', label: 'This week', icon: <TrendingUp size={14} /> },
          { key: 'season', label: 'Season', icon: <Trophy size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--ink-soft)',
            fontWeight: 700, fontSize: 14,
            padding: '10px 20px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            marginBottom: -1, transition: 'all 0.15s'
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        {tab === 'weekly' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <label htmlFor="lb-week" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Week:</label>
            <select id="lb-week" value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>W{w}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Top 3 Podium */}
      {!loading && displayData.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12, marginBottom: 32, alignItems: 'end' }}>
          {[displayData[1], displayData[0], displayData[2]].map((entry, podiumIdx) => {
            if (!entry) return <div key={podiumIdx} />;
            const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
            const colors = ['var(--silver)', 'var(--gold)', 'var(--bronze)'];
            const heights = [140, 180, 120];
            const icons = ['🥈', '🥇', '🥉'];
            const username = entry.username || entry.profiles?.username || 'Unknown';
            return (
              <div key={rank} className="card" style={{ 
                padding: '20px 16px', textAlign: 'center',
                borderTop: `3px solid ${colors[podiumIdx]}`,
                minHeight: heights[podiumIdx],
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                boxShadow: rank === 1 ? `0 0 30px rgba(184,134,11,0.15)` : 'none'
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icons[podiumIdx]}</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: colors[podiumIdx] }}>
                  {username}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  {entry.points_earned !== undefined ? `${entry.points_earned} pts` : `${entry.total_points || 0} pts`}
                </div>
                {entry.avg_difference !== null && entry.avg_difference !== undefined && (
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Avg Δ {Number(entry.avg_difference).toFixed(2)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton card" style={{ height: 56 }} />)}
        </div>
      ) : displayData.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Award size={36} style={{ color: 'var(--ink-faint)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 21, marginBottom: 8, textTransform: 'none' }}>No data yet</h3>
          <p style={{ color: 'var(--ink-soft)' }}>Make your picks to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
                  {['Rank', 'Player', 'Picks', tab === 'weekly' ? 'Avg Δ' : 'Accuracy', 'Points'].map(h => (
                    <th key={h} className="label-muted" style={{
                      padding: '12px 16px', textAlign: h === 'Rank' || h === 'Player' ? 'left' : 'right',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((entry, idx) => {
                  const isMe = entry.user_id === user?.id;
                  const rank = entry.rank || idx + 1;
                  const username = entry.username || entry.profiles?.username || 'Unknown';
                  return (
                    <tr key={entry.user_id || idx} style={{
                      borderBottom: '1px solid var(--border)',
                      background: isMe ? 'var(--accent-soft)' : idx % 2 === 0 ? 'transparent' : 'rgba(22,24,28,0.02)',
                    }}>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19,
                          color: rank === 1 ? 'var(--gold)' : rank === 2 ? 'var(--silver)' : rank === 3 ? 'var(--bronze)' : 'var(--ink-faint)'
                        }}>
                          {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: isMe ? 'var(--accent)' : 'var(--surface-alt)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13,
                            color: isMe ? 'var(--accent-ink)' : 'var(--ink)', flexShrink: 0
                          }}>
                            {username[0]?.toUpperCase()}
                          </div>
                          <span
                            onClick={() => !isMe && navigate(`/users/${entry.user_id}`)}
                            style={{ fontWeight: 600, color: isMe ? 'var(--accent-dark)' : 'var(--ink)', cursor: isMe ? 'default' : 'pointer' }}
                          >
                            {username} {isMe && <span style={{ fontSize: 11, color: 'var(--accent)' }}>(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                        {entry.total_predictions}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {tab === 'weekly'
                          ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{Number(entry.avg_difference || 0).toFixed(2)}</span>
                          : <span style={{ color: 'var(--success)', fontWeight: 600 }}>{Number(entry.avg_accuracy || 0).toFixed(1)}%</span>
                        }
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>
                          {entry.points_earned || entry.total_points || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
