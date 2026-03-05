import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, calculatePoints } from '../lib/scoring';
import { History, ChevronDown } from 'lucide-react';

const CURRENT_SEASON = 2025;

export default function HistoryPage() {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [availableWeeks, setAvailableWeeks] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, [user]);

  async function fetchHistory() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('predictions')
      .select('*, games(home_team, away_team, home_team_abbr, away_team_abbr, actual_spread, status, home_score, away_score, game_time)')
      .eq('user_id', user.id)
      .eq('season', CURRENT_SEASON)
      .order('week', { ascending: false });

    if (data) {
      const grouped = {};
      data.forEach(p => {
        if (!grouped[p.week]) grouped[p.week] = [];
        grouped[p.week].push(p);
      });
      setHistory(grouped);
      const weeks = Object.keys(grouped).map(Number).sort((a, b) => b - a);
      setAvailableWeeks(weeks);
      if (weeks.length > 0) setSelectedWeek(weeks[0]);
    }
    setLoading(false);
  }

  function getWeekSummary(picks) {
    const withResults = picks.filter(p => p.games?.actual_spread !== null && p.games?.actual_spread !== undefined);
    const totalPoints = withResults.reduce((sum, p) => {
      return sum + calculatePoints(p.predicted_spread, p.games.actual_spread, p.confidence_points);
    }, 0);
    const avgDiff = withResults.length > 0
      ? withResults.reduce((sum, p) => sum + Math.abs(p.predicted_spread - p.games.actual_spread), 0) / withResults.length
      : null;
    return { totalPoints, avgDiff, total: picks.length, graded: withResults.length };
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton card" style={{ height: 200 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
          {CURRENT_SEASON} NFL SEASON
        </div>
        <h1 style={{ fontSize: 42 }}>PICK <span style={{ color: 'var(--lime)' }}>HISTORY</span></h1>
      </div>

      {availableWeeks.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <History size={48} style={{ color: 'var(--slate)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>NO PICKS YET</h3>
          <p style={{ color: 'var(--slate)' }}>Make your first predictions on the Games page!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {availableWeeks.map(week => {
            const picks = history[week] || [];
            const { totalPoints, avgDiff, total, graded } = getWeekSummary(picks);
            const isOpen = selectedWeek === week;

            return (
              <div key={week} className="card" style={{ overflow: 'hidden' }}>
                {/* Week Header */}
                <button onClick={() => setSelectedWeek(isOpen ? null : week)} style={{
                  width: '100%', padding: '20px 24px', background: 'none', border: 'none',
                  color: 'var(--white)', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: isOpen ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 24, textAlign: 'left' }}>
                        WEEK {week}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate)', textAlign: 'left' }}>
                        {total} pick{total !== 1 ? 's' : ''} · {graded} graded
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>POINTS</div>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 24, color: 'var(--lime)' }}>{totalPoints}</div>
                      </div>
                      {avgDiff !== null && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>AVG Δ</div>
                          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 24, color: avgDiff <= 2 ? 'var(--green)' : avgDiff <= 4 ? 'var(--amber)' : 'var(--red)' }}>
                            {avgDiff.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown size={20} style={{ color: 'var(--slate)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {/* Week Details */}
                {isOpen && (
                  <div>
                    {picks.map(p => {
                      const g = p.games;
                      const hasResult = g?.actual_spread !== null && g?.actual_spread !== undefined;
                      const diff = hasResult ? Math.abs(p.predicted_spread - g.actual_spread) : null;
                      const pts = diff !== null ? calculatePoints(p.predicted_spread, g.actual_spread, p.confidence_points) : null;

                      return (
                        <div key={p.id} style={{ 
                          padding: '16px 24px', borderBottom: '1px solid var(--border)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          flexWrap: 'wrap', gap: 12
                        }}>
                          <div>
                            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>
                              {g ? `${g.away_team_abbr} @ ${g.home_team_abbr}` : `Game ${p.game_id}`}
                            </div>
                            {g && g.home_score !== null && (
                              <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                                Final: {g.away_team_abbr} {g.away_score} — {g.home_team_abbr} {g.home_score}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>YOUR PICK</div>
                              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>{formatSpread(p.predicted_spread)}</div>
                              <div style={{ fontSize: 11, color: 'var(--slate)' }}>×{p.confidence_points}</div>
                            </div>
                            {hasResult && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>ACTUAL</div>
                                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>{formatSpread(g.actual_spread)}</div>
                                <div style={{ fontSize: 11, color: diff <= 1 ? 'var(--green)' : diff <= 3 ? 'var(--amber)' : 'var(--red)' }}>
                                  Δ {diff?.toFixed(1)}
                                </div>
                              </div>
                            )}
                            {pts !== null && (
                              <div style={{ 
                                padding: '8px 16px', background: 'var(--lime-dim)',
                                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 22, color: 'var(--lime)'
                              }}>
                                +{pts}
                              </div>
                            )}
                            {!hasResult && (
                              <span className="badge badge-gold">PENDING</span>
                            )}
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
      )}
    </div>
  );
}
