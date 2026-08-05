import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, calculatePoints } from '../lib/scoring';
import { History, ChevronDown } from 'lucide-react';

const CURRENT_SEASON = 2026;

export default function HistoryPage() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [offseasonPicks, setOffseasonPicks] = useState([]);
  const [historyTab, setHistoryTab] = useState('offseason');

  useEffect(() => { fetchHistory(); }, [user]);

  async function fetchHistory() {
    if (!user) return;
    setLoading(true);
    const [{ data: weekly }, { data: offseason }] = await Promise.all([
      supabase.from('predictions')
        .select('*, games(home_team, away_team, home_team_abbr, away_team_abbr, actual_spread, status, home_score, away_score, game_time)')
        .eq('user_id', user.id).eq('season', CURRENT_SEASON).order('week', { ascending: false }),
      supabase.from('offseason_predictions')
        .select('*, offseason_props(description, team, line, actual_result, is_locked, category)')
        .eq('user_id', user.id).eq('season', CURRENT_SEASON).order('created_at', { ascending: false }),
    ]);
    if (weekly) {
      const grouped = {};
      weekly.forEach(p => { if (!grouped[p.week]) grouped[p.week] = []; grouped[p.week].push(p); });
      setHistory(grouped);
      const weeks = Object.keys(grouped).map(Number).sort((a, b) => b - a);
      setAvailableWeeks(weeks);
      if (weeks.length > 0) setSelectedWeek(weeks[0]);
    }
    setOffseasonPicks(offseason || []);
    setLoading(false);
  }

  function getWeekSummary(picks) {
    const withResults = picks.filter(p => p.games?.actual_spread !== null && p.games?.actual_spread !== undefined);
    const totalPoints = withResults.reduce((sum, p) => sum + calculatePoints(p.predicted_spread, p.games.actual_spread, p.confidence_points), 0);
    const avgDiff = withResults.length > 0
      ? withResults.reduce((sum, p) => sum + Math.abs(p.predicted_spread - p.games.actual_spread), 0) / withResults.length : null;
    return { totalPoints, avgDiff, total: picks.length, graded: withResults.length };
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton card" style={{ height: 200 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{CURRENT_SEASON} NFL Season</div>
        <h1 style={{ fontSize: 34, textTransform: 'none' }}>Pick history</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'offseason', label: 'Offseason props', count: offseasonPicks.length },
          { key: 'weekly', label: 'Weekly picks', count: Object.values(history).flat().length },
        ].map(t => (
          <button key={t.key} onClick={() => setHistoryTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: historyTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: historyTab === t.key ? 'var(--accent)' : 'var(--ink-soft)',
            fontWeight: 700, fontSize: 14,
            padding: '10px 20px', cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
          }}>
            {t.label}<span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* OFFSEASON TAB */}
      {historyTab === 'offseason' && (
        offseasonPicks.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <h3 style={{ fontSize: 21, marginBottom: 8, textTransform: 'none' }}>No offseason picks yet</h3>
            <p style={{ color: 'var(--ink-soft)' }}>Head to the Offseason Props page to make your predictions!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {['win_total', 'draft'].map(cat => {
              const catPicks = offseasonPicks.filter(p => p.offseason_props?.category === cat);
              if (catPicks.length === 0) return null;
              return (
                <div key={cat} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="eyebrow" style={{ padding: '12px 20px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)' }}>
                    {cat === 'win_total' ? 'Win totals' : 'Draft props'}
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-faint)', fontWeight: 400, textTransform: 'none' }}>{catPicks.length} picks</span>
                  </div>
                  {catPicks.map((p, idx) => {
                    const prop = p.offseason_props;
                    const hasResult = prop?.actual_result !== null && prop?.actual_result !== undefined;
                    const diff = hasResult ? Math.abs(p.predicted_value - prop.actual_result) : null;
                    return (
                      <div key={p.id} style={{ padding: '14px 20px', borderBottom: idx === catPicks.length - 1 ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{prop?.team || prop?.description}</div>
                          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                            Your pick: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{p.predicted_value}</span>
                            {prop?.is_locked
                              ? <>{' · '}Vegas: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{prop.line}</span>{hasResult && <>{' · '}Result: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{prop.actual_result}</span></>}</>
                              : <>{' · '}<span style={{ color: 'var(--lime)', fontStyle: 'italic' }}>Vegas line revealed after lock</span></>
                            }
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {diff !== null
                            ? <div style={{ fontSize: 14, fontWeight: 700, color: diff <= 1 ? 'var(--success)' : diff <= 3 ? 'var(--warning)' : 'var(--danger)' }}>Δ {diff.toFixed(1)}</div>
                            : prop?.is_locked
                              ? <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Awaiting result</span>
                              : <span className="badge badge-lime" style={{ fontSize: 10 }}>Pending</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* WEEKLY TAB */}
      {historyTab === 'weekly' && (
        availableWeeks.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <History size={36} style={{ color: 'var(--ink-faint)', marginBottom: 16 }} />
            <h3 style={{ fontSize: 21, marginBottom: 8, textTransform: 'none' }}>No weekly picks yet</h3>
            <p style={{ color: 'var(--ink-soft)' }}>Make your first predictions on the Games page!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {availableWeeks.map(week => {
              const picks = history[week] || [];
              const { totalPoints, avgDiff, total, graded } = getWeekSummary(picks);
              const isOpen = selectedWeek === week;
              return (
                <div key={week} className="card" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setSelectedWeek(isOpen ? null : week)} aria-expanded={isOpen} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22, textAlign: 'left' }}>Week {week}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'left' }}>{total} pick{total !== 1 ? 's' : ''} · {graded} graded</div>
                      </div>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <div>
                          <div className="label-muted">Points</div>
                          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 22, color: 'var(--accent)' }}>{totalPoints}</div>
                        </div>
                        {avgDiff !== null && (
                          <div>
                            <div className="label-muted">Avg Δ</div>
                            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 22, color: avgDiff <= 2 ? 'var(--success)' : avgDiff <= 4 ? 'var(--warning)' : 'var(--danger)' }}>{avgDiff.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={20} style={{ color: 'var(--ink-faint)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {isOpen && (
                    <div>
                      {picks.map(p => {
                        const g = p.games;
                        const hasResult = g?.actual_spread !== null && g?.actual_spread !== undefined;
                        const diff = hasResult ? Math.abs(p.predicted_spread - g.actual_spread) : null;
                        const pts = diff !== null ? calculatePoints(p.predicted_spread, g.actual_spread, p.confidence_points) : null;
                        return (
                          <div key={p.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>{g ? `${g.away_team_abbr} @ ${g.home_team_abbr}` : `Game ${p.game_id}`}</div>
                              {g && g.home_score !== null && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Final: {g.away_team_abbr} {g.away_score} — {g.home_team_abbr} {g.home_score}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ textAlign: 'center' }}>
                                <div className="label-muted">Your pick</div>
                                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19 }}>{formatSpread(p.predicted_spread)}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>×{p.confidence_points}</div>
                              </div>
                              {hasResult && (
                                <div style={{ textAlign: 'center' }}>
                                  <div className="label-muted">Actual</div>
                                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19 }}>{formatSpread(g.actual_spread)}</div>
                                  <div style={{ fontSize: 11, color: diff <= 1 ? 'var(--success)' : diff <= 3 ? 'var(--warning)' : 'var(--danger)' }}>Δ {diff?.toFixed(1)}</div>
                                </div>
                              )}
                              {pts !== null && <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20, color: 'var(--accent-dark)' }}>+{pts}</div>}
                              {!hasResult && <span className="badge badge-gold">Pending</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
