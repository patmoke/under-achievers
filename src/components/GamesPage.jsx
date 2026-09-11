import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, getAccuracyColor, describeSpread } from '../lib/scoring';
import { useCurrentWeek } from '../lib/useCurrentWeek';
import { useUnsavedWork } from '../lib/unsavedWork';
import { Clock, CheckCircle, Lock, ChevronUp, ChevronDown, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;

export default function GamesPage() {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [savedPredictions, setSavedPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const currentWeek = useCurrentWeek(CURRENT_SEASON);
  // null until the user chooses, so the selector follows the derived
  // current week once it resolves instead of freezing at the estimate.
  const [selectedWeekOverride, setSelectedWeekOverride] = useState(null);
  const selectedWeek = selectedWeekOverride ?? currentWeek;
  const setSelectedWeek = setSelectedWeekOverride;

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .eq('season', CURRENT_SEASON)
      .order('game_time');
    if (!error) setGames(data || []);
    setLoading(false);
  }, [selectedWeek]);

  const fetchUserPredictions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .eq('week', selectedWeek)
      .eq('season', CURRENT_SEASON);
    if (data) {
      const predMap = {};
      data.forEach(p => {
        predMap[p.game_id] = String(p.predicted_spread);
        setSavedPredictions(prev => ({ ...prev, [p.game_id]: p }));
      });
      setPredictions(predMap);
    }
  }, [selectedWeek, user]);

  useEffect(() => {
    fetchGames();
    fetchUserPredictions();
  }, [fetchGames, fetchUserPredictions]);

  async function submitPredictions() {
    if (!user) return;
    setSubmitting(true);
    try {
      const rows = games
        .filter(g => !g.weekly_locked && predictions[g.id] !== undefined && predictions[g.id] !== '')
        .map(g => ({
          user_id: user.id,
          game_id: g.id,
          week: selectedWeek,
          season: CURRENT_SEASON,
          predicted_spread: parseFloat(predictions[g.id]),
        }));

      if (rows.length < unlocked.length) {
        toast.error(`Every game needs a pick — ${unlocked.length - rows.length} still to go.`);
        return;
      }

      const { error } = await supabase.from('predictions').upsert(rows, { onConflict: 'user_id,game_id' });
      if (error) throw error;

      toast.success(`${rows.length} prediction${rows.length !== 1 ? 's' : ''} locked in!`);
      fetchUserPredictions();
      // A submission can be the one that completes the week -- the database
      // locks the whole week the moment everyone's picks are in, not just at
      // kickoff. Refetching games picks that up immediately instead of
      // leaving the board showing games as open until the next reload.
      fetchGames();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const unlocked = games.filter(g => !g.weekly_locked);
  const pickedGameIds = unlocked
    .filter(g => predictions[g.id] !== undefined && predictions[g.id] !== '')
    .map(g => g.id);
  const picksMade = pickedGameIds.length;
  const unpickedCount = unlocked.length - picksMade;
  const allPicked = unpickedCount === 0;

  // Submitting a full week locks it in for you specifically, whether or not
  // anyone else has finished or any game has kicked off — the database
  // enforces this on writes; this just mirrors it so the UI never offers an
  // edit RLS would reject. Read from savedPredictions (what actually landed)
  // rather than the in-progress draft, so a half-typed edit can't flip this
  // early.
  const myWeekComplete = games.length > 0 && games.every(g => savedPredictions[g.id] !== undefined);

  // A week of spreads lives in component state until it's submitted, so a
  // service-worker reload here would throw it away. Declaring it lets the
  // update hold off until the week is in.
  const hasUnsavedEdits = unlocked.some(g => {
    const entered = predictions[g.id];
    if (entered === undefined || entered === '') return false;
    const saved = savedPredictions[g.id];
    if (!saved) return true;
    return Number(entered) !== Number(saved.predicted_spread);
  });
  useUnsavedWork('weekly-picks', hasUnsavedEdits);

  function formatGameTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{CURRENT_SEASON} NFL Season</div>
          <h1 style={{ fontSize: 34, textTransform: 'none' }}>Week {selectedWeek} picks</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="week-select" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Week:</label>
          <select id="week-select" value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} style={{ width: 80, padding: '8px 12px' }}>
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
          <h3 style={{ fontSize: 22, marginBottom: 8, textTransform: 'none' }}>No games this week</h3>
          <p style={{ color: 'var(--ink-soft)' }}>Check back when the schedule is posted, or try a different week.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {games.map(game => {
            const saved = savedPredictions[game.id];
            const userPick = predictions[game.id];
            const spreadReading = describeSpread(userPick, game.home_team_abbr, game.away_team_abbr);

            const cardLocked = game.weekly_locked || myWeekComplete;
            return (
              <div key={game.id} className="card" style={{
                padding: 22,
                borderLeft: cardLocked ? '3px solid var(--border-strong)' : saved ? '3px solid var(--success)' : '3px solid var(--accent)',
                opacity: cardLocked ? 0.9 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  {/* Teams */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      {formatGameTime(game.game_time)}
                      {game.bookmaker && game.actual_spread !== null && (
                        <span style={{ marginLeft: 8, color: 'var(--accent)' }}>· Line: {game.bookmaker}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 26 }}>{game.away_team_abbr}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.away_team}</div>
                        {game.away_score !== null && <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19, color: 'var(--ink)', marginTop: 4 }}>{game.away_score}</div>}
                      </div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--ink-faint)' }}>@</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 26 }}>{game.home_team_abbr}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.home_team}</div>
                        {game.home_score !== null && <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19, color: 'var(--ink)', marginTop: 4 }}>{game.home_score}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Prediction Area */}
                  <div style={{ minWidth: 200 }}>
                    {cardLocked ? (
                      <LockedGame game={game} saved={saved} />
                    ) : (
                      <div>
                        <div className="label-muted" style={{ marginBottom: 8 }}>
                          {game.home_team_abbr} (home) spread
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                          <input
                            type="number"
                            step="0.5"
                            placeholder="-3.5"
                            aria-label={`Spread pick for ${game.away_team_abbr} at ${game.home_team_abbr}`}
                            value={userPick || ''}
                            onChange={e => setPredictions(prev => ({ ...prev, [game.id]: e.target.value }))}
                            style={{ width: 100, padding: '10px 14px', fontSize: 17, fontFamily: 'Barlow Condensed', fontWeight: 700 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              aria-label="Increase spread by 0.5"
                              onClick={() => setPredictions(prev => ({ ...prev, [game.id]: String((parseFloat(prev[game.id] || 0) + 0.5)) }))}
                              style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--ink)', cursor: 'pointer', padding: '4px 8px' }}>
                              <ChevronUp size={14} />
                            </button>
                            <button
                              aria-label="Decrease spread by 0.5"
                              onClick={() => setPredictions(prev => ({ ...prev, [game.id]: String((parseFloat(prev[game.id] || 0) - 0.5)) }))}
                              style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--ink)', cursor: 'pointer', padding: '4px 8px' }}>
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                        {spreadReading && (
                          <div style={{
                            fontSize: 12, color: 'var(--accent-dark)', background: 'var(--accent-soft)',
                            border: '1px solid rgba(15,122,77,0.18)', borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px', marginBottom: 12,
                          }}>
                            {spreadReading}
                          </div>
                        )}
                        {saved && (
                          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Saved: {formatSpread(saved.predicted_spread)}
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
      {unlocked.length > 0 && !myWeekComplete && (
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 24,
          background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-card-hover)',
          padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          <div>
            <div>
              <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, color: 'var(--accent)' }}>{picksMade}</span>
              <span style={{ color: 'var(--ink-soft)', fontSize: 15 }}> / {unlocked.length} picks made</span>
            </div>
            {!allPicked && (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                every game needs a pick
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={submitPredictions}
              disabled={submitting || !allPicked}
              title={!allPicked ? `Pick every game first — ${unpickedCount} still to go` : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Save size={16} /> {submitting ? 'Saving…' : allPicked ? 'Lock in picks' : `${unpickedCount} game${unpickedCount === 1 ? '' : 's'} left`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Rendered once a game is weekly_locked (settled — frozen for everyone,
// win/loss decided) OR the viewer has personally completed their week (their
// own pick is locked, but the game itself and its line are still live). The
// two read differently on purpose: a personal lock shows the CURRENT line,
// clearly not final, since it can still move before the game itself locks.
function LockedGame({ game, saved }) {
  const settled = game.weekly_locked;

  if (!saved) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="badge badge-red" style={{ marginBottom: 8 }}><Lock size={10} style={{ marginRight: 4 }} /> Locked</div>
        {game.actual_spread !== null && (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {settled ? 'Actual line' : 'Current line'}: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatSpread(game.actual_spread)}</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>No pick submitted</div>
      </div>
    );
  }

  const diff = game.actual_spread !== null ? Math.abs(saved.predicted_spread - game.actual_spread) : null;

  return (
    <div style={{ textAlign: 'right' }}>
      <div className="badge badge-red" style={{ marginBottom: 10, marginLeft: 'auto' }}>
        <Lock size={10} style={{ marginRight: 4 }} /> {settled ? 'Final' : 'Locked in'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className="label-muted">Your pick</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19 }}>{formatSpread(saved.predicted_spread)}</div>
        </div>
        {game.actual_spread !== null && (
          <div>
            <div className="label-muted">{settled ? 'Actual' : 'Current line'}</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19 }}>{formatSpread(game.actual_spread)}</div>
            {diff !== null && (
              <div style={{ fontSize: 11, color: getAccuracyColor(diff) }}>Δ {diff.toFixed(1)}</div>
            )}
          </div>
        )}
      </div>
      {!settled && game.actual_spread !== null && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-faint)' }}>
          Still tracking the market until this game locks — it can move before then.
        </div>
      )}
      {/* No points here: scoring is relative, so a pick is only worth
          something once it is compared against a field. The same pick can win
          one league and lose another, so points live in the standings. */}
      {diff !== null && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-faint)' }}>
          Points are awarded in each league's standings
        </div>
      )}
    </div>
  );
}
