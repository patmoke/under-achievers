import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Trophy, TrendingUp, Award, Sunset } from 'lucide-react';

const CURRENT_WEEK = 20;
const CURRENT_SEASON = 2025;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('weekly');
  const [weeklyData, setWeeklyData] = useState([]);
  const [seasonData, setSeasonData] = useState([]);
  const [offseasonData, setOffseasonData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(CURRENT_WEEK);

  useEffect(() => {
    fetchLeaderboards();
  }, [tab, selectedWeek]);

  async function fetchOffseasonLeaderboard() {
    setLoading(true);
    // Build from offseason_predictions directly
    const { data } = await supabase
      .from('offseason_predictions')
      .select('*, profiles(username, display_name), offseason_props(line, actual_result)')
      .eq('season', 2026);

    if (!data) { setLoading(false); return; }

    const userMap = {};
    data.forEach(p => {
      if (!p.profiles) return;
      const uid = p.user_id;
      if (!userMap[uid]) {
        userMap[uid] = { user_id: uid, username: p.profiles.username, display_name: p.profiles.display_name, diffs: [], points: 0 };
      }
      if (p.offseason_props?.actual_result !== null && p.offseason_props?.actual_result !== undefined) {
        const diff = Math.abs(p.predicted_value - p.offseason_props.actual_result);
        userMap[uid].diffs.push(diff);
      }
      userMap[uid].points += p.points_earned || 0;
    });

    const rows = Object.values(userMap)
      .map(u => ({
        ...u,
        total_predictions: data.filter(p => p.user_id === u.user_id).length,
        avg_difference: u.diffs.length > 0 ? u.diffs.reduce((a,b) => a+b, 0) / u.diffs.length : null,
      }))
      .sort((a, b) => (b.total_predictions - a.total_predictions))
      .map((u, i) => ({ ...u, rank: i + 1 }));

    setOffseasonData(rows);
    setLoading(false);
  }

  async function fetchLeaderboards() {
    setLoading(true);
    if (tab === 'weekly') {
      const { data } = await supabase
        .from('weekly_leaderboards')
        .select('*, profiles(username, display_name)')
        .eq('week', selectedWeek)
        .eq('season', CURRENT_SEASON)
        .order('rank');
      setWeeklyData(data || []);
    } else {
      const { data } = await supabase
        .from('season_leaderboards')
        .select('*, profiles(username, display_name)')
        .eq('season', CURRENT_SEASON)
        .order('rank');
      setSeasonData(data || []);
    }
    setLoading(false);
  }

  // Build from predictions if leaderboard table is empty
  async function fetchFromPredictions() {
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
  }

  useEffect(() => {
    if (tab === 'weekly' && weeklyData.length === 0 && !loading) {
      fetchFromPredictions();
    }
    if (tab === 'offseason' && offseasonData.length === 0 && !loading) {
      fetchOffseasonLeaderboard();
    }
  }, [weeklyData, offseasonData, loading, tab]);

  const displayData = tab === 'weekly' ? weeklyData : tab === 'season' ? seasonData : offseasonData;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
          {CURRENT_SEASON} NFL SEASON
        </div>
        <h1 style={{ fontSize: 42 }}>LEADER<span style={{ color: 'var(--lime)' }}>BOARD</span></h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'weekly', label: 'THIS WEEK', icon: <TrendingUp size={14} /> },
          { key: 'season', label: 'SEASON', icon: <Trophy size={14} /> },
          { key: 'offseason', label: 'OFFSEASON', icon: <span>🏖️</span> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--lime)' : '2px solid transparent',
            color: tab === t.key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.08em', padding: '12px 24px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: -1, transition: 'all 0.15s'
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        {tab === 'weekly' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--slate)' }}>WEEK:</span>
            <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
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
                boxShadow: rank === 1 ? `0 0 30px rgba(245,158,11,0.15)` : 'none'
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icons[podiumIdx]}</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: colors[podiumIdx] }}>
                  {username}
                </div>
                <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 4 }}>
                  {entry.points_earned !== undefined ? `${entry.points_earned} pts` : `${entry.total_points || 0} pts`}
                </div>
                {entry.avg_difference !== null && entry.avg_difference !== undefined && (
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
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
          <Award size={48} style={{ color: 'var(--slate)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>NO DATA YET</h3>
          <p style={{ color: 'var(--slate)' }}>Make your picks to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['RANK', 'PLAYER', 'PICKS', tab === 'weekly' ? 'AVG Δ' : 'ACCURACY', 'POINTS'].map(h => (
                    <th key={h} style={{ 
                      padding: '14px 16px', textAlign: h === 'RANK' || h === 'PLAYER' ? 'left' : 'right',
                      fontFamily: 'Barlow Condensed', fontSize: 11, letterSpacing: '0.1em',
                      color: 'var(--slate)', fontWeight: 700
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
                      background: isMe ? 'rgba(192,255,0,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      outline: isMe ? '1px solid rgba(192,255,0,0.2)' : 'none'
                    }}>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20,
                          color: rank === 1 ? 'var(--gold)' : rank === 2 ? 'var(--silver)' : rank === 3 ? 'var(--bronze)' : 'var(--slate)'
                        }}>
                          {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ 
                            width: 30, height: 30, background: isMe ? 'var(--lime)' : 'var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13,
                            color: isMe ? 'var(--navy)' : 'var(--white)', flexShrink: 0
                          }}>
                            {username[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: isMe ? 'var(--lime)' : 'var(--white)' }}>
                            {username} {isMe && <span style={{ fontSize: 11, color: 'var(--lime)' }}>(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--slate)' }}>
                        {entry.total_predictions}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {tab === 'weekly' 
                          ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>{Number(entry.avg_difference || 0).toFixed(2)}</span>
                          : <span style={{ color: 'var(--green)', fontWeight: 600 }}>{Number(entry.avg_accuracy || 0).toFixed(1)}%</span>
                        }
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--lime)' }}>
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
