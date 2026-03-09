import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, UserCheck, ArrowLeft, Target, Trophy, Zap, Users } from 'lucide-react';
import { formatSpread } from '../lib/scoring';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [recentWeekly, setRecentWeekly] = useState([]);
  const [recentOffseason, setRecentOffseason] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect to own profile page if viewing yourself
    if (id === user.id) { navigate('/profile', { replace: true }); return; }
    fetchProfile();
  }, [id]);

  async function fetchProfile() {
    setLoading(true);
    const [{ data: prof }, { data: followRow }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle(),
    ]);

    if (!prof) { toast.error('User not found'); navigate('/feed'); return; }
    setProfile(prof);
    setIsFollowing(!!followRow);

    // Fetch their locked picks
    const [{ data: weekly }, { data: offseason }] = await Promise.all([
      supabase
        .from('predictions')
        .select('*, games(home_team_abbr, away_team_abbr, actual_spread, home_score, away_score)')
        .eq('user_id', id)
        .eq('season', CURRENT_SEASON)
        .not('games.actual_spread', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('offseason_predictions')
        .select('*, offseason_props(description, team, line, actual_result, is_locked, category)')
        .eq('user_id', id)
        .eq('season', CURRENT_SEASON)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    setRecentWeekly(weekly || []);
    setRecentOffseason((offseason || []).filter(p => p.offseason_props?.is_locked));
    setLoading(false);
  }

  async function toggleFollow() {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
      setIsFollowing(false);
      setProfile(p => ({ ...p, follower_count: Math.max((p.follower_count || 1) - 1, 0) }));
      toast.success('Unfollowed');
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      if (error) { toast.error('Could not follow user'); return; }
      setIsFollowing(true);
      setProfile(p => ({ ...p, follower_count: (p.follower_count || 0) + 1 }));
      toast.success('Following!');
    }
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton card" style={{ height: 200, marginBottom: 16 }} />
      <div className="skeleton card" style={{ height: 300 }} />
    </div>
  );

  if (!profile) return null;

  const stats = [
    { label: 'TOTAL PICKS', value: profile.total_predictions || 0, icon: <Target size={16} />, color: 'var(--lime)' },
    { label: 'TOTAL POINTS', value: profile.total_points || 0, icon: <Zap size={16} />, color: 'var(--lime)' },
    { label: 'FOLLOWERS', value: profile.follower_count || 0, icon: <Users size={16} />, color: 'var(--slate)' },
    { label: 'FOLLOWING', value: profile.following_count || 0, icon: <UserCheck size={16} />, color: 'var(--slate)' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Back */}
      <button onClick={() => navigate(-1)} style={{
        background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 24, padding: 0,
      }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Profile header */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{
              width: 72, height: 72, background: 'var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 36, color: 'var(--white)',
            }}>
              {profile.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: 32, marginBottom: 4 }}>{profile.display_name || profile.username}</h1>
              <div style={{ fontSize: 14, color: 'var(--slate)' }}>@{profile.username}</div>
              {profile.favorite_team && (
                <div style={{ marginTop: 8 }}>
                  <span className="badge badge-lime">🏈 {profile.favorite_team}</span>
                </div>
              )}
              {profile.bio && (
                <p style={{ marginTop: 10, fontSize: 14, color: 'var(--slate)', maxWidth: 400 }}>{profile.bio}</p>
              )}
            </div>
          </div>
          <button
            onClick={toggleFollow}
            className={isFollowing ? 'btn btn-secondary' : 'btn btn-primary'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
          >
            {isFollowing ? <><UserCheck size={16} /> FOLLOWING</> : <><UserPlus size={16} /> FOLLOW</>}
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24 }}>
          {stats.map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div style={{ color: s.color, fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent picks */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 20 }}>RECENT PICKS <span style={{ fontSize: 13, color: 'var(--slate)', fontWeight: 400 }}>(locked only)</span></h3>
        </div>

        {recentWeekly.length === 0 && recentOffseason.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>
            No locked picks yet this season.
          </div>
        ) : (
          <>
            {recentOffseason.length > 0 && (
              <>
                <div style={{ padding: '8px 20px', background: 'rgba(192,255,0,0.05)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}>
                  🏖️ OFFSEASON PROPS
                </div>
                {recentOffseason.map(p => {
                  const prop = p.offseason_props;
                  const diff = prop?.actual_result !== null && prop?.actual_result !== undefined
                    ? Math.abs(p.predicted_value - prop.actual_result)
                    : prop?.line ? Math.abs(p.predicted_value - Number(prop.line)) : null;
                  const diffColor = diff === null ? 'var(--slate)' : diff <= 1 ? 'var(--green)' : diff <= 3 ? 'var(--amber)' : 'var(--red)';
                  return (
                    <div key={p.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{prop?.team || prop?.description}</div>
                        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                          Pick: <strong style={{ color: 'var(--white)' }}>{p.predicted_value}</strong>
                          {prop?.line && <> · Vegas: <strong style={{ color: 'var(--white)' }}>{prop.line}</strong></>}
                          {prop?.actual_result !== null && prop?.actual_result !== undefined && <> · Result: <strong style={{ color: 'var(--lime)' }}>{prop.actual_result}</strong></>}
                        </div>
                      </div>
                      {diff !== null && <span style={{ color: diffColor, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>Δ{diff.toFixed(1)}</span>}
                    </div>
                  );
                })}
              </>
            )}
            {recentWeekly.length > 0 && (
              <>
                <div style={{ padding: '8px 20px', background: 'rgba(192,255,0,0.05)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}>
                  🏈 WEEKLY PICKS
                </div>
                {recentWeekly.map(p => {
                  const g = p.games;
                  const diff = g?.actual_spread !== null && g?.actual_spread !== undefined
                    ? Math.abs(p.predicted_spread - g.actual_spread) : null;
                  const diffColor = diff === null ? 'var(--slate)' : diff <= 1 ? 'var(--green)' : diff <= 3 ? 'var(--amber)' : 'var(--red)';
                  return (
                    <div key={p.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>
                          {g ? `${g.away_team_abbr} @ ${g.home_team_abbr}` : 'Game'}
                          <span style={{ fontSize: 12, color: 'var(--slate)', marginLeft: 8 }}>Wk {p.week}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                          Spread: <strong style={{ color: 'var(--white)' }}>{formatSpread(p.predicted_spread)}</strong>
                          {g?.actual_spread !== null && g?.actual_spread !== undefined && <> · Actual: <strong style={{ color: 'var(--white)' }}>{formatSpread(g.actual_spread)}</strong></>}
                          <span style={{ marginLeft: 10 }}>Conf: ×{p.confidence_points}</span>
                        </div>
                      </div>
                      {diff !== null && <span style={{ color: diffColor, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>Δ{diff.toFixed(1)}</span>}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
