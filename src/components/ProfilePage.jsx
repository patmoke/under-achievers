import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit2, Save, X, Target, Trophy, TrendingUp } from 'lucide-react';
import { formatSpread } from '../lib/scoring';
import toast from 'react-hot-toast';

const NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [recentPicks, setRecentPicks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecentPicks = useCallback(async () => {
    if (!user) return;
    const { data: weekly } = await supabase
      .from('predictions')
      .select('*, games(home_team, away_team, home_team_abbr, away_team_abbr, actual_spread, status, home_score, away_score)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentPicks(weekly || []);
  }, [user]);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        favorite_team: profile.favorite_team || '',
      });
    }
  }, [profile]);

  useEffect(() => { fetchRecentPicks(); }, [fetchRecentPicks]);

  async function handleSave() {
    setLoading(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const stats = [
    { label: 'Total picks', value: profile?.total_predictions || 0, icon: <Target size={18} />, color: 'var(--accent)' },
    { label: 'Season rank', value: profile?.season_rank ? `#${profile.season_rank}` : '—', icon: <Trophy size={18} />, color: 'var(--gold)' },
    { label: 'Weeks won', value: profile?.weekly_wins || 0, icon: <TrendingUp size={18} />, color: 'var(--gold)' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>My account</div>
        <h1 style={{ fontSize: 34, textTransform: 'none' }}>My profile</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Profile Card */}
        <div className="card" style={{ padding: 28 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, background: 'var(--accent)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 34,
            color: 'var(--accent-ink)', marginBottom: 16
          }}>
            {profile?.username?.[0]?.toUpperCase() || '?'}
          </div>

          {editing ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label className="label-muted" style={{ display: 'block', marginBottom: 4 }}>Display name</label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} maxLength={30} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="label-muted" style={{ display: 'block', marginBottom: 4 }}>Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} maxLength={200} rows={3} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="label-muted" style={{ display: 'block', marginBottom: 4 }}>Favorite team</label>
                <select value={form.favorite_team} onChange={e => setForm(f => ({ ...f, favorite_team: e.target.value }))}>
                  <option value="">Select team...</option>
                  {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1, justifyContent: 'center', padding: '10px' }}>
                  <Save size={14} /> {loading ? '...' : 'Save'}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)} aria-label="Cancel editing" style={{ padding: '10px 14px' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22 }}>{profile?.display_name || profile?.username}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 2 }}>@{profile?.username}</div>
              {profile?.favorite_team && (
                <div style={{ marginTop: 10 }}>
                  <span className="badge badge-lime">{profile.favorite_team}</span>
                </div>
              )}
              {profile?.bio && (
                <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{profile.bio}</p>
              )}
              <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ marginTop: 20, width: '100%', justifyContent: 'center', padding: '10px' }}>
                <Edit2 size={14} /> Edit profile
              </button>
            </div>
          )}
        </div>

        {/* Right: Stats + Activity */}
        <div>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            {stats.map(s => (
              <div key={s.label} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.color, marginBottom: 8 }}>
                  {s.icon}
                  <span className="label-muted" style={{ color: 'var(--ink-soft)' }}>{s.label}</span>
                </div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 32, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Recent Picks */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 17, textTransform: 'none' }}>Recent picks</h3>
            </div>
            {recentPicks.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
                No predictions yet. Make your first picks!
              </div>
            ) : (
              recentPicks.map(p => {
                const g = p.games;
                const diff = g?.actual_spread !== null && g?.actual_spread !== undefined
                  ? Math.abs(p.predicted_spread - g.actual_spread) : null;
                return (
                  <div key={p.id} style={{
                    padding: '14px 20px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {g ? `${g.away_team_abbr} @ ${g.home_team_abbr}` : 'Game'}
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 8 }}>Wk {p.week}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                        Your pick: <span style={{ color: 'var(--ink)' }}>{formatSpread(p.predicted_spread)}</span>
                        {g?.actual_spread !== null && g?.actual_spread !== undefined && (
                          <> · Actual: <span style={{ color: 'var(--ink)' }}>{formatSpread(g.actual_spread)}</span></>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {diff !== null ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600, color: diff <= 1 ? 'var(--success)' : diff <= 3 ? 'var(--warning)' : 'var(--danger)' }}>Δ {diff.toFixed(1)}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>×{p.confidence_points}</div>
                        </>
                      ) : (
                        <span className="badge badge-lime" style={{ fontSize: 10 }}>Pending</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Responsive fix */}
      <style>{`
        @media (max-width: 640px) {
          div[style*="gridTemplateColumns: '1fr 2fr'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
