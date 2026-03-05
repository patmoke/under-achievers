import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculatePoints, formatSpread, getAccuracyColor } from '../lib/scoring';
import { Clock, CheckCircle, Lock, ChevronUp, ChevronDown, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENT_WEEK = 20;
const CURRENT_SEASON = 2025;

export default function GamesPage() {
  const { user, profile } = useAuth();
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [savedPredictions, setSavedPredictions] = useState({});
  const [confidence, setConfidence] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(CURRENT_WEEK);

  useEffect(() => {
    fetchGames();
    fetchUserPredictions();
  }, [selectedWeek, user]);

  async function fetchGames() {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .eq('season', CURRENT_SEASON)
      .order('game_time');
    if (!error) setGames(data || []);
    setLoading(false);
  }

  async function fetchUserPredictions() {
    if (!user) return;
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .eq('week', selectedWeek)
      .eq('season', CURRENT_SEASON);
    if (data) {
      const predMap = {};
      const confMap = {};
      data.forEach(p => {
        predMap[p.game_id] = String(p.predicted_spread);
        confMap[p.game_id] = p.confidence_points;
        setSavedPredictions(prev => ({ ...prev, [p.game_id]: p }));
      });
      setPredictions(predMap);
      setConfidence(confMap);
    }
  }

  async function submitPredictions() {
    if (!user) return;
    setSubmitting(true);
    try {
      const rows = games
        .filter(g => !g.is_locked && predictions[g.id] !== undefined && predictions[g.id] !== '')
        .map(g => ({
          user_id: user.id,
          game_id: g.id,
          week: selectedWeek,
          season: CURRENT_SEASON,
          predicted_spread: parseFloat(predictions[g.id]),
          confidence_points: confidence[g.id] || 1,
        }));

      if (rows.length === 0) {
        toast.error('No valid predictions to submit');
        return;
      }

      const { error } = await supabase.from('predictions').upsert(rows, { onConflict: 'user_id,game_id' });
      if (error) throw error;

      // Update total_predictions in profile
      await supabase.from('profiles').update({ total_predictions: (profile?.total_predictions || 0) + rows.length }).eq('id', user.id);

      toast.success(`${rows.length} prediction${rows.length !== 1 ? 's' : ''} locked in! 🎯`);
      fetchUserPredictions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const unlocked = games.filter(g => !g.is_locked);
  const picksMade = unlocked.filter(g => predictions[g.id] !== undefined && predictions[g.id] !== '').length;

  function formatGameTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + 
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 12, color: 'var(--lime)', letterSpacing: '0.1em', marginBottom: 6 }}>
            {CURRENT_SEASON} NFL SEASON
          </div>
          <h1 style={{ fontSize: 42 }}>WEEK {selectedWeek} <span style={{ color: 'var(--lime)' }}>PICKS</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--slate)' }}>WEEK:</span>
          <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} style={{ width: 80, padding: '8px 12px' }}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>W{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Games */}
      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton card" style={{ height: 140 }} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏈</div>
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>NO GAMES THIS WEEK</h3>
          <p style={{ color: 'var(--slate)' }}>Check back when the schedule is posted, or try a different week.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {games.map(game => {
            const saved = savedPredictions[game.id];
            const userPick = predictions[game.id];
            const conf = confidence[game.id] || 1;

            return (
              <div key={game.id} className="card" style={{ 
                padding: 24,
                borderLeft: game.is_locked ? '3px solid var(--border)' : saved ? '3px solid var(--green)' : '3px solid var(--lime)',
                opacity: game.is_locked ? 0.85 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  {/* Teams */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 8 }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {formatGameTime(game.game_time)}
                      {game.bookmaker && <span style={{ marginLeft: 12, color: 'var(--lime)', opacity: 0.7 }}>· {game.bookmaker}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28 }}>{game.away_team_abbr}</div>
                        <div style={{ fontSize: 11, color: 'var(--slate)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.away_team}</div>
                        {game.away_score !== null && <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20, color: 'var(--white)', marginTop: 4 }}>{game.away_score}</div>}
                      </div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--slate)' }}>@</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28 }}>{game.home_team_abbr}</div>
                        <div style={{ fontSize: 11, color: 'var(--slate)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.home_team}</div>
                        {game.home_score !== null && <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20, color: 'var(--white)', marginTop: 4 }}>{game.home_score}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Prediction Area */}
                  <div style={{ minWidth: 200 }}>
                    {game.is_locked ? (
                      <LockedGame game={game} saved={saved} />
                    ) : (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 8 }}>YOUR SPREAD PICK</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                          <input
                            type="number"
                            step="0.5"
                            placeholder="-3.5"
                            value={userPick || ''}
                            onChange={e => setPredictions(prev => ({ ...prev, [game.id]: e.target.value }))}
                            style={{ width: 100, padding: '10px 14px', fontSize: 18, fontFamily: 'Barlow Condensed', fontWeight: 700 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button onClick={() => setPredictions(prev => ({ ...prev, [game.id]: String((parseFloat(prev[game.id] || 0) + 0.5)) }))} 
                              style={{ background: 'var(--border)', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: '4px 8px' }}>
                              <ChevronUp size={14} />
                            </button>
                            <button onClick={() => setPredictions(prev => ({ ...prev, [game.id]: String((parseFloat(prev[game.id] || 0) - 0.5)) }))}
                              style={{ background: 'var(--border)', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: '4px 8px' }}>
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>CONFIDENCE (×{conf})</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => setConfidence(prev => ({ ...prev, [game.id]: n }))} style={{
                                width: 28, height: 28, background: conf >= n ? 'var(--lime)' : 'var(--border)',
                                border: 'none', cursor: 'pointer', fontSize: 14,
                                color: conf >= n ? 'var(--navy)' : 'var(--slate)',
                                fontWeight: 700, transition: 'all 0.1s'
                              }}>★</button>
                            ))}
                          </div>
                        </div>
                        {saved && (
                          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Saved: {formatSpread(saved.predicted_spread)} (×{saved.confidence_points})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Bar */}
      {unlocked.length > 0 && (
        <div style={{ 
          position: 'sticky', bottom: 0, marginTop: 24,
          background: 'var(--navy-card)', borderTop: '1px solid var(--border)',
          padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--lime)' }}>{picksMade}</span>
            <span style={{ color: 'var(--slate)', fontSize: 15 }}> / {unlocked.length} picks made</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={submitPredictions} disabled={submitting || picksMade === 0} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={16} /> {submitting ? 'SAVING...' : 'LOCK IN PICKS'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LockedGame({ game, saved }) {
  if (!saved) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="badge badge-red" style={{ marginBottom: 8 }}><Lock size={10} style={{ marginRight: 4 }} /> LOCKED</div>
        {game.actual_spread !== null && (
          <div style={{ fontSize: 13, color: 'var(--slate)' }}>
            Actual line: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{formatSpread(game.actual_spread)}</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 4 }}>No pick submitted</div>
      </div>
    );
  }

  const diff = game.actual_spread !== null ? Math.abs(saved.predicted_spread - game.actual_spread) : null;
  const pts = diff !== null ? calculatePoints(saved.predicted_spread, game.actual_spread, saved.confidence_points) : null;

  return (
    <div style={{ textAlign: 'right' }}>
      <div className="badge badge-red" style={{ marginBottom: 10, marginLeft: 'auto' }}><Lock size={10} style={{ marginRight: 4 }} /> FINAL</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>YOUR PICK</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>{formatSpread(saved.predicted_spread)}</div>
          <div style={{ fontSize: 11, color: 'var(--slate)' }}>×{saved.confidence_points} conf</div>
        </div>
        {game.actual_spread !== null && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>ACTUAL</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>{formatSpread(game.actual_spread)}</div>
            {diff !== null && (
              <div style={{ fontSize: 11, color: getAccuracyColor(diff) }}>Δ {diff.toFixed(1)}</div>
            )}
          </div>
        )}
      </div>
      {pts !== null && (
        <div className="gradient-win" style={{ marginTop: 12, padding: '8px 12px', display: 'inline-block' }}>
          <span className="gradient-hero-text" style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>+{pts} pts</span>
        </div>
      )}
    </div>
  );
}
