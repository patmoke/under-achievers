import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Lock, Unlock, Plus, Save, Users, Trophy, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const ADMIN_EMAIL = 'patrickrmoke@gmail.com';
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
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('offseason');
  const [offseasonProps, setOffseasonProps] = useState([]);
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showAddProp, setShowAddProp] = useState(false);
  const [showAddGame, setShowAddGame] = useState(false);

  // New prop form
  const [newProp, setNewProp] = useState({ category: 'win_total', team: '', description: '', line: '', closes_at: '' });
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
    const [propsRes, gamesRes, usersRes] = await Promise.all([
      supabase.from('offseason_props').select('*').eq('season', CURRENT_SEASON).order('category').order('team'),
      supabase.from('games').select('*').order('week', { ascending: false }).order('game_time').limit(50),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    setOffseasonProps(propsRes.data || []);
    setGames(gamesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }

  // --- OFFSEASON PROPS ---
  async function togglePropLock(prop) {
    setSaving(s => ({ ...s, [prop.id]: true }));
    const { error } = await supabase
      .from('offseason_props')
      .update({ is_locked: !prop.is_locked })
      .eq('id', prop.id);
    if (error) toast.error(error.message);
    else {
      toast.success(prop.is_locked ? 'Prop unlocked' : 'Prop locked!');
      fetchAll();
    }
    setSaving(s => ({ ...s, [prop.id]: false }));
  }

  async function saveActualResult(prop, result) {
    if (result === '' || isNaN(parseFloat(result))) {
      toast.error('Enter a valid number');
      return;
    }
    setSaving(s => ({ ...s, [`result_${prop.id}`]: true }));
    const { error } = await supabase
      .from('offseason_props')
      .update({ actual_result: parseFloat(result), is_locked: true })
      .eq('id', prop.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Result saved & prop locked!');
      fetchAll();
    }
    setSaving(s => ({ ...s, [`result_${prop.id}`]: false }));
  }

  async function addProp() {
    if (!newProp.description || !newProp.line) {
      toast.error('Description and line are required');
      return;
    }
    const { error } = await supabase.from('offseason_props').insert({
      season: CURRENT_SEASON,
      category: newProp.category,
      team: newProp.team || null,
      description: newProp.description,
      line: parseFloat(newProp.line),
      closes_at: newProp.closes_at || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Prop added!');
      setNewProp({ category: 'win_total', team: '', description: '', line: '', closes_at: '' });
      setShowAddProp(false);
      fetchAll();
    }
  }

  async function deleteProp(id) {
    if (!confirm('Delete this prop? This cannot be undone.')) return;
    const { error } = await supabase.from('offseason_props').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Prop deleted'); fetchAll(); }
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

  // Loading / access guard
  if (!profile) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>Loading...</div>;
  if (!profile.is_admin) return null;

  const TABS = [
    { key: 'offseason', label: '🏖️ OFFSEASON PROPS', count: offseasonProps.length },
    { key: 'games', label: '🏈 GAMES', count: games.length },
    { key: 'users', label: '👥 USERS', count: users.length },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
            🔐 ADMIN ONLY · {profile.email}
          </div>
          <h1 style={{ fontSize: 42 }}>ADMIN <span style={{ color: 'var(--lime)' }}>DASHBOARD</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'offseason' && (
            <button className="btn btn-primary" onClick={() => setShowAddProp(!showAddProp)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> ADD PROP
            </button>
          )}
          {activeTab === 'games' && (
            <button className="btn btn-primary" onClick={() => setShowAddGame(!showAddGame)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> ADD GAME
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--lime)' : '2px solid transparent',
            color: activeTab === t.key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.08em', padding: '12px 24px',
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
          {/* ── OFFSEASON PROPS ── */}
          {activeTab === 'offseason' && (
            <div>
              {showAddProp && (
                <AddPropForm
                  prop={newProp}
                  onChange={setNewProp}
                  onSave={addProp}
                  onCancel={() => setShowAddProp(false)}
                />
              )}
              {['win_total', 'draft'].map(cat => {
                const catProps = offseasonProps.filter(p => p.category === cat);
                if (catProps.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 12, color: 'var(--lime)' }}>
                      {cat === 'win_total' ? '🏈 WIN TOTALS' : '📋 DRAFT PROPS'}
                    </h3>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      {catProps.map((prop, idx) => (
                        <PropAdminRow
                          key={prop.id}
                          prop={prop}
                          isLast={idx === catProps.length - 1}
                          saving={saving}
                          onToggleLock={() => togglePropLock(prop)}
                          onSaveResult={(result) => saveActualResult(prop, result)}
                          onDelete={() => deleteProp(prop.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>
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
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: 12 }}>
                {['USERNAME', 'EMAIL', 'PICKS', 'POINTS', 'ADMIN'].map(h => (
                  <div key={h} style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}>{h}</div>
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
                    {u.is_admin && <span className="badge badge-lime" style={{ marginLeft: 8 }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--slate)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  <div style={{ fontSize: 14 }}>{u.total_predictions || 0}</div>
                  <div style={{ fontSize: 14, color: 'var(--lime)', fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{u.total_points || 0}</div>
                  <div style={{ fontSize: 13, color: u.is_admin ? 'var(--green)' : 'var(--slate)' }}>
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

function PropAdminRow({ prop, isLast, saving, onToggleLock, onSaveResult, onDelete }) {
  const [result, setResult] = useState(prop.actual_result !== null && prop.actual_result !== undefined ? String(prop.actual_result) : '');
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: prop.is_locked ? 'rgba(239,68,68,0.03)' : 'transparent'
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16 }}>
            {prop.team || prop.description}
          </div>
          {prop.team && (
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2, maxWidth: 400 }}>{prop.description}</div>
          )}
          <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 12 }}>
            <span style={{ color: 'var(--slate)' }}>Line: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{prop.line}</span></span>
            {prop.actual_result !== null && prop.actual_result !== undefined && (
              <span style={{ color: 'var(--green)' }}>Result: <span style={{ fontWeight: 600 }}>{prop.actual_result}</span></span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div className={prop.is_locked ? 'badge badge-red' : 'badge badge-lime'}>
            {prop.is_locked ? <><Lock size={10} style={{ marginRight: 4 }} />LOCKED</> : <><Unlock size={10} style={{ marginRight: 4 }} />OPEN</>}
          </div>
          <button onClick={onToggleLock} disabled={saving[prop.id]} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            {saving[prop.id] ? '...' : prop.is_locked ? 'UNLOCK' : 'LOCK'}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '6px' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 20px 16px', background: 'rgba(192,255,0,0.03)', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>SET ACTUAL RESULT:</div>
          <input
            type="number"
            step="0.5"
            placeholder="e.g. 13"
            value={result}
            onChange={e => setResult(e.target.value)}
            style={{ width: 100, padding: '8px 12px', fontSize: 15 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => onSaveResult(result)}
            disabled={saving[`result_${prop.id}`]}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Check size={14} /> {saving[`result_${prop.id}`] ? 'SAVING...' : 'SAVE & LOCK'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--slate)' }}>This will lock the prop and record the result for scoring.</span>
        </div>
      )}
    </div>
  );
}

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
        background: game.is_locked ? 'rgba(239,68,68,0.03)' : 'transparent'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>
            Wk{game.week} · {game.away_team_abbr} @ {game.home_team_abbr}
          </div>
          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
            {new Date(game.game_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {game.actual_spread !== null && <span style={{ marginLeft: 12 }}>Spread: <span style={{ color: 'var(--white)' }}>{game.actual_spread > 0 ? '+' : ''}{game.actual_spread}</span></span>}
            {game.home_score !== null && <span style={{ marginLeft: 12, color: 'var(--green)' }}>Final: {game.away_score}–{game.home_score}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div className={game.is_locked ? 'badge badge-red' : 'badge badge-lime'}>
            {game.is_locked ? <><Lock size={10} style={{ marginRight: 4 }} />LOCKED</> : <><Unlock size={10} style={{ marginRight: 4 }} />OPEN</>}
          </div>
          <span className={`badge ${game.status === 'final' ? 'badge-green' : 'badge-gold'}`} style={{ textTransform: 'uppercase' }}>{game.status}</span>
          <button onClick={onToggleLock} disabled={saving[game.id]} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            {saving[game.id] ? '...' : game.is_locked ? 'UNLOCK' : 'LOCK'}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 20px 16px', background: 'rgba(192,255,0,0.03)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 6 }}>
                {game.away_team_abbr} SCORE
              </div>
              <input type="number" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0" style={{ width: 80, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 6 }}>
                {game.home_team_abbr} SCORE
              </div>
              <input type="number" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0" style={{ width: 80, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 6 }}>
                ACTUAL SPREAD (home perspective)
              </div>
              <input type="number" step="0.5" value={spread} onChange={e => setSpread(e.target.value)} placeholder="-3.5" style={{ width: 100, padding: '8px 12px', fontSize: 15 }} />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onSaveResult(homeScore, awayScore, spread)}
              disabled={saving[`score_${game.id}`]}
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} /> {saving[`score_${game.id}`] ? 'SAVING...' : 'SAVE RESULT'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPropForm({ prop, onChange, onSave, onCancel }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: 'rgba(192,255,0,0.3)' }}>
      <h3 style={{ fontSize: 20, marginBottom: 20 }}>ADD NEW PROP</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>CATEGORY</label>
          <select value={prop.category} onChange={e => onChange(p => ({ ...p, category: e.target.value }))}>
            <option value="win_total">Win Total</option>
            <option value="draft">Draft Prop</option>
          </select>
        </div>
        {prop.category === 'win_total' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>TEAM</label>
            <select value={prop.team} onChange={e => onChange(p => ({ ...p, team: e.target.value, description: `${e.target.value} ${CURRENT_SEASON} regular season wins` }))}>
              <option value="">Select team...</option>
              {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>VEGAS LINE</label>
          <input type="number" step="0.5" placeholder="11.5" value={prop.line} onChange={e => onChange(p => ({ ...p, line: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>LOCKS AT</label>
          <input type="datetime-local" value={prop.closes_at} onChange={e => onChange(p => ({ ...p, closes_at: e.target.value }))} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>DESCRIPTION</label>
        <input value={prop.description} onChange={e => onChange(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Kansas City Chiefs 2026 regular season wins" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> ADD PROP
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}

function AddGameForm({ game, onChange, onSave, onCancel, teams }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: 'rgba(192,255,0,0.3)' }}>
      <h3 style={{ fontSize: 20, marginBottom: 20 }}>ADD NEW GAME</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>WEEK</label>
          <input type="number" min="1" max="22" placeholder="1" value={game.week} onChange={e => onChange(g => ({ ...g, week: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>AWAY TEAM</label>
          <select value={game.away_team} onChange={e => {
            const abbr = e.target.value.split(' ').pop().substring(0, 3).toUpperCase();
            onChange(g => ({ ...g, away_team: e.target.value, away_team_abbr: abbr }));
          }}>
            <option value="">Select...</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>AWAY ABBR</label>
          <input placeholder="BUF" maxLength={3} value={game.away_team_abbr} onChange={e => onChange(g => ({ ...g, away_team_abbr: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>HOME TEAM</label>
          <select value={game.home_team} onChange={e => {
            const abbr = e.target.value.split(' ').pop().substring(0, 3).toUpperCase();
            onChange(g => ({ ...g, home_team: e.target.value, home_team_abbr: abbr }));
          }}>
            <option value="">Select...</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>HOME ABBR</label>
          <input placeholder="KC" maxLength={3} value={game.home_team_abbr} onChange={e => onChange(g => ({ ...g, home_team_abbr: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>GAME TIME</label>
          <input type="datetime-local" value={game.game_time} onChange={e => onChange(g => ({ ...g, game_time: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>SPREAD (optional)</label>
          <input type="number" step="0.5" placeholder="-3.5" value={game.actual_spread} onChange={e => onChange(g => ({ ...g, actual_spread: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>BOOKMAKER</label>
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
          <Plus size={16} /> ADD GAME
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}
