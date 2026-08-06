import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lock, Unlock, Plus, Save, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;

const NFL_TEAMS = [
  'Arizona Cardinals','Atlanta Falcons','Baltimore Ravens','Buffalo Bills',
  'Carolina Panthers','Chicago Bears','Cincinnati Bengals','Cleveland Browns',
  'Dallas Cowboys','Denver Broncos','Detroit Lions','Green Bay Packers',
  'Houston Texans','Indianapolis Colts','Jacksonville Jaguars','Kansas City Chiefs',
  'Las Vegas Raiders','Los Angeles Chargers','Los Angeles Rams','Miami Dolphins',
  'Minnesota Vikings','New England Patriots','New Orleans Saints','New York Giants',
  'New York Jets','Philadelphia Eagles','Pittsburgh Steelers','San Francisco 49ers',
  'Seattle Seahawks','Tampa Bay Buccaneers','Tennessee Titans','Washington Commanders'
];

export default function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('games');
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showAddGame, setShowAddGame] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // New game form
  const [newGame, setNewGame] = useState({ week: '', home_team: '', home_team_abbr: '', away_team: '', away_team_abbr: '', game_time: '', actual_spread: '', bookmaker: 'DraftKings' });

  useEffect(() => {
    // Guard: redirect non-admins
    if (profile && !profile.is_admin) {
      navigate('/games');
      return;
    }
    if (profile?.is_admin) fetchAll();
  }, [profile]);

  async function fetchAll() {
    setLoading(true);
    const [gamesRes, usersRes] = await Promise.all([
      supabase.from('games').select('*').order('week', { ascending: false }).order('game_time').limit(50),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    setGames(gamesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }

  // --- GAMES ---
  async function toggleGameLock(game) {
    setSaving(s => ({ ...s, [game.id]: true }));
    const { error } = await supabase
      .from('games')
      .update({ is_locked: !game.is_locked })
      .eq('id', game.id);
    if (error) toast.error(error.message);
    else { toast.success(game.is_locked ? 'Game unlocked' : 'Game locked!'); fetchAll(); }
    setSaving(s => ({ ...s, [game.id]: false }));
  }

  async function saveGameResult(game, homeScore, awayScore, actualSpread) {
    setSaving(s => ({ ...s, [`score_${game.id}`]: true }));
    const updates = {
      is_locked: true,
      status: 'final',
    };
    if (homeScore !== '') updates.home_score = parseInt(homeScore);
    if (awayScore !== '') updates.away_score = parseInt(awayScore);
    if (actualSpread !== '') updates.actual_spread = parseFloat(actualSpread);

    const { error } = await supabase.from('games').update(updates).eq('id', game.id);
    if (error) toast.error(error.message);
    else { toast.success('Game result saved!'); fetchAll(); }
    setSaving(s => ({ ...s, [`score_${game.id}`]: false }));
  }

  async function addGame() {
    const required = ['week', 'home_team', 'home_team_abbr', 'away_team', 'away_team_abbr', 'game_time'];
    for (const f of required) {
      if (!newGame[f]) { toast.error(`${f.replace('_', ' ')} is required`); return; }
    }
    const id = `${CURRENT_SEASON}-w${newGame.week}-${newGame.away_team_abbr.toLowerCase()}-${newGame.home_team_abbr.toLowerCase()}`;
    const { error } = await supabase.from('games').insert({
      id,
      week: parseInt(newGame.week),
      season: CURRENT_SEASON,
      home_team: newGame.home_team,
      home_team_abbr: newGame.home_team_abbr.toUpperCase(),
      away_team: newGame.away_team,
      away_team_abbr: newGame.away_team_abbr.toUpperCase(),
      game_time: newGame.game_time,
      actual_spread: newGame.actual_spread ? parseFloat(newGame.actual_spread) : null,
      bookmaker: newGame.bookmaker,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Game added!');
      setNewGame({ week: '', home_team: '', home_team_abbr: '', away_team: '', away_team_abbr: '', game_time: '', actual_spread: '', bookmaker: 'DraftKings' });
      setShowAddGame(false);
      fetchAll();
    }
  }

  async function syncGames() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-games', { method: 'POST' });
      if (error) throw error;
      const errCount = data?.errors?.length || 0;
      toast.success(`Synced ${data?.synced ?? 0} games${errCount ? ` (${errCount} errors)` : ''}`);
      if (errCount) console.warn('sync-games errors:', data.errors);
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  // Loading / access guard
  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>;
  if (!profile.is_admin) return null;

  const TABS = [
    { key: 'games', label: 'Games', count: games.length },
    { key: 'users', label: 'Users', count: users.length },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--danger)' }}>
            Admin only · {profile.email}
          </div>
          <h1 style={{ fontSize: 34, textTransform: 'none' }}>Admin dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'games' && (
            <>
              <button className="btn btn-secondary" onClick={syncGames} disabled={syncing} title="Pull the season schedule, lines, and results from nflverse" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={16} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} /> {syncing ? 'Syncing…' : 'Sync games'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowAddGame(!showAddGame)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} /> Add game
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === t.key ? 'var(--accent)' : 'var(--ink-soft)',
            fontWeight: 700, fontSize: 14,
            padding: '10px 20px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s'
          }}>
            {t.label}
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton card" style={{ height: 64 }} />)}
        </div>
      ) : (
        <>
          {/* ── GAMES ── */}
          {activeTab === 'games' && (
            <div>
              {showAddGame && (
                <AddGameForm
                  game={newGame}
                  onChange={setNewGame}
                  onSave={addGame}
                  onCancel={() => setShowAddGame(false)}
                  teams={NFL_TEAMS}
                />
              )}
              {games.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>
                  No games yet. Add the first game above.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {games.map((game, idx) => (
                    <GameAdminRow
                      key={game.id}
                      game={game}
                      isLast={idx === games.length - 1}
                      saving={saving}
                      onToggleLock={() => toggleGameLock(game)}
                      onSaveResult={(home, away, spread) => saveGameResult(game, home, away, spread)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {activeTab === 'users' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 12 }}>
                {['Username', 'Email', 'Picks', 'Points', 'Admin'].map(h => (
                  <div key={h} className="label-muted">{h}</div>
                ))}
              </div>
              {users.map((u, idx) => (
                <div key={u.id} style={{
                  padding: '14px 20px',
                  borderBottom: idx === users.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 12, alignItems: 'center'
                }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16 }}>
                    {u.username}
                    {u.is_admin && <span className="badge badge-lime" style={{ marginLeft: 8 }}>Admin</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  <div style={{ fontSize: 14 }}>{u.total_predictions || 0}</div>
                  <div style={{ fontSize: 14, color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{u.total_points || 0}</div>
                  <div style={{ fontSize: 13, color: u.is_admin ? 'var(--success)' : 'var(--ink-faint)' }}>
                    {u.is_admin ? '✓ Admin' : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──

function GameAdminRow({ game, isLast, saving, onToggleLock, onSaveResult }) {
  const [homeScore, setHomeScore] = useState(game.home_score !== null ? String(game.home_score) : '');
  const [awayScore, setAwayScore] = useState(game.away_score !== null ? String(game.away_score) : '');
  const [spread, setSpread] = useState(game.actual_spread !== null ? String(game.actual_spread) : '');
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: game.is_locked ? 'rgba(200,50,44,0.03)' : 'transparent'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>
            Wk{game.week} · {game.away_team_abbr} @ {game.home_team_abbr}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            {new Date(game.game_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {game.actual_spread !== null && <span style={{ marginLeft: 12 }}>Spread: <span style={{ color: 'var(--ink)' }}>{game.actual_spread > 0 ? '+' : ''}{game.actual_spread}</span></span>}
            {game.home_score !== null && <span style={{ marginLeft: 12, color: 'var(--success)' }}>Final: {game.away_score}–{game.home_score}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div className={game.is_locked ? 'badge badge-red' : 'badge badge-lime'}>
            {game.is_locked ? <><Lock size={10} style={{ marginRight: 4 }} />Locked</> : <><Unlock size={10} style={{ marginRight: 4 }} />Open</>}
          </div>
          <span className={`badge ${game.status === 'final' ? 'badge-green' : 'badge-gold'}`}>{game.status}</span>
          <button onClick={onToggleLock} disabled={saving[game.id]} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            {saving[game.id] ? '...' : game.is_locked ? 'Unlock' : 'Lock'}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 20px 16px', background: 'rgba(15,122,77,0.03)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div className="label-muted" style={{ marginBottom: 6 }}>
                {game.away_team_abbr} score
              </div>
              <input type="number" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0" style={{ width: 80, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <div>
              <div className="label-muted" style={{ marginBottom: 6 }}>
                {game.home_team_abbr} score
              </div>
              <input type="number" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0" style={{ width: 80, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <div>
              <div className="label-muted" style={{ marginBottom: 6 }}>
                Actual spread (home perspective)
              </div>
              <input type="number" step="0.5" value={spread} onChange={e => setSpread(e.target.value)} placeholder="-3.5" style={{ width: 100, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onSaveResult(homeScore, awayScore, spread)}
              disabled={saving[`score_${game.id}`]}
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} /> {saving[`score_${game.id}`] ? 'Saving…' : 'Save result'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddGameForm({ game, onChange, onSave, onCancel, teams }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: 'rgba(15,122,77,0.3)' }}>
      <h3 style={{ fontSize: 19, marginBottom: 20, textTransform: 'none' }}>Add new game</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Week</label>
          <input type="number" min="1" max="22" placeholder="1" value={game.week} onChange={e => onChange(g => ({ ...g, week: e.target.value }))} />
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Away team</label>
          <select value={game.away_team} onChange={e => {
            const abbr = e.target.value.split(' ').pop().substring(0, 3).toUpperCase();
            onChange(g => ({ ...g, away_team: e.target.value, away_team_abbr: abbr }));
          }}>
            <option value="">Select...</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Away abbr</label>
          <input placeholder="BUF" maxLength={3} value={game.away_team_abbr} onChange={e => onChange(g => ({ ...g, away_team_abbr: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Home team</label>
          <select value={game.home_team} onChange={e => {
            const abbr = e.target.value.split(' ').pop().substring(0, 3).toUpperCase();
            onChange(g => ({ ...g, home_team: e.target.value, home_team_abbr: abbr }));
          }}>
            <option value="">Select...</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Home abbr</label>
          <input placeholder="KC" maxLength={3} value={game.home_team_abbr} onChange={e => onChange(g => ({ ...g, home_team_abbr: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Game time</label>
          <input type="datetime-local" value={game.game_time} onChange={e => onChange(g => ({ ...g, game_time: e.target.value }))} />
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Spread (optional)</label>
          <input type="number" step="0.5" placeholder="-3.5" value={game.actual_spread} onChange={e => onChange(g => ({ ...g, actual_spread: e.target.value }))} />
        </div>
        <div>
          <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Bookmaker</label>
          <select value={game.bookmaker} onChange={e => onChange(g => ({ ...g, bookmaker: e.target.value }))}>
            <option value="DraftKings">DraftKings</option>
            <option value="FanDuel">FanDuel</option>
            <option value="BetMGM">BetMGM</option>
            <option value="Caesars">Caesars</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Add game
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
