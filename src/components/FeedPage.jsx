import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Users, Rss, Search } from 'lucide-react';
import { formatSpread } from '../lib/scoring';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;

export default function FeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('feed');
  const [feedItems, setFeedItems] = useState([]);
  const [following, setFollowing] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchFollowing();
    fetchFeed();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const t = setTimeout(() => searchUsers(searchQuery), 300);
      return () => clearTimeout(t);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  async function fetchFollowing() {
    const { data } = await supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, total_points, total_predictions, favorite_team)')
      .eq('follower_id', user.id);

    const rows = data || [];
    setFollowing(rows.map(r => r.profiles));
    setFollowedIds(new Set(rows.map(r => r.following_id)));
  }

  async function fetchFeed() {
    setLoading(true);
    // Get who we follow
    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const ids = (followData || []).map(f => f.following_id);

    if (ids.length === 0) { setFeedItems([]); setLoading(false); return; }

    // Fetch their locked weekly picks (games with actual_spread set = locked)
    const { data: weeklyPicks } = await supabase
      .from('predictions')
      .select('*, profiles(username, display_name), games(home_team_abbr, away_team_abbr, actual_spread, home_score, away_score, week, status)')
      .in('user_id', ids)
      .eq('season', CURRENT_SEASON)
      .not('games.actual_spread', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch their offseason picks where prop is locked
    const { data: offseasonPicks } = await supabase
      .from('offseason_predictions')
      .select('*, profiles(username, display_name), offseason_props(description, team, line, actual_result, is_locked, category)')
      .in('user_id', ids)
      .eq('season', CURRENT_SEASON)
      .eq('offseason_props.is_locked', true)
      .order('created_at', { ascending: false })
      .limit(50);

    // Merge and sort by created_at
    const weekly = (weeklyPicks || []).map(p => ({ ...p, type: 'weekly' }));
    const offseason = (offseasonPicks || []).filter(p => p.offseason_props?.is_locked).map(p => ({ ...p, type: 'offseason' }));
    const merged = [...weekly, ...offseason].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFeedItems(merged);
    setLoading(false);
  }

  async function searchUsers(q) {
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, total_points, total_predictions, favorite_team, follower_count')
      .ilike('username', `%${q}%`)
      .neq('id', user.id)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function follow(profileId) {
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
    if (error) { toast.error('Could not follow user'); return; }
    setFollowedIds(prev => new Set([...prev, profileId]));
    toast.success('Following!');
    fetchFollowing();
    fetchFeed();
  }

  async function unfollow(profileId) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
    setFollowedIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
    toast.success('Unfollowed');
    fetchFollowing();
    fetchFeed();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', marginBottom: 6 }}>
          SOCIAL
        </div>
        <h1 style={{ fontSize: 42 }}>PICK <span style={{ color: 'var(--lime)' }}>FEED</span></h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'feed', label: 'FEED', icon: <Rss size={14} /> },
          { key: 'following', label: `FOLLOWING (${following.length})`, icon: <Users size={14} /> },
          { key: 'discover', label: 'DISCOVER', icon: <Search size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--lime)' : '2px solid transparent',
            color: tab === t.key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
            letterSpacing: '0.08em', padding: '12px 20px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* FEED TAB */}
      {tab === 'feed' && (
        <div>
          {following.length === 0 ? (
            <div className="card" style={{ padding: 56, textAlign: 'center' }}>
              <Rss size={48} style={{ color: 'var(--slate)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 24, marginBottom: 8 }}>YOUR FEED IS EMPTY</h3>
              <p style={{ color: 'var(--slate)', marginBottom: 20 }}>Follow other pickers to see their locked picks here.</p>
              <button className="btn btn-primary" onClick={() => setTab('discover')}>
                <Search size={14} /> FIND PEOPLE TO FOLLOW
              </button>
            </div>
          ) : loading ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton card" style={{ height: 80 }} />)}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ color: 'var(--slate)' }}>No locked picks from people you follow yet. Check back once games kick off!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {feedItems.map(item => (
                <FeedCard key={item.id} item={item} onProfileClick={id => navigate(`/users/${id}`)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOLLOWING TAB */}
      {tab === 'following' && (
        <div>
          {following.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <Users size={48} style={{ color: 'var(--slate)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 22, marginBottom: 8 }}>NOT FOLLOWING ANYONE YET</h3>
              <p style={{ color: 'var(--slate)', marginBottom: 20 }}>Head to Discover to find people to follow.</p>
              <button className="btn btn-primary" onClick={() => setTab('discover')}><Search size={14} /> DISCOVER</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {following.map(profile => profile && (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  isFollowing={true}
                  onFollow={() => follow(profile.id)}
                  onUnfollow={() => unfollow(profile.id)}
                  onClick={() => navigate(`/users/${profile.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISCOVER TAB */}
      {tab === 'discover' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              style={{ width: '100%', fontSize: 16, padding: '12px 16px' }}
              autoFocus
            />
          </div>
          {searching && (
            <div style={{ display: 'grid', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton card" style={{ height: 72 }} />)}
            </div>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--slate)' }}>
              No users found for "{searchQuery}"
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {searchResults.map(profile => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  isFollowing={followedIds.has(profile.id)}
                  onFollow={() => follow(profile.id)}
                  onUnfollow={() => unfollow(profile.id)}
                  onClick={() => navigate(`/users/${profile.id}`)}
                />
              ))}
            </div>
          )}
          {searchQuery.length < 2 && (
            <div style={{ textAlign: 'center', color: 'var(--slate)', fontSize: 14, padding: 32 }}>
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, onProfileClick }) {
  const username = item.profiles?.display_name || item.profiles?.username || 'Unknown';
  const initial = username[0]?.toUpperCase();

  if (item.type === 'weekly') {
    const g = item.games;
    const diff = g?.actual_spread !== null && g?.actual_spread !== undefined
      ? Math.abs(item.predicted_spread - g.actual_spread) : null;
    const diffColor = diff === null ? 'var(--slate)' : diff <= 1 ? 'var(--green)' : diff <= 3 ? 'var(--amber)' : 'var(--red)';

    return (
      <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <button onClick={() => onProfileClick(item.user_id)} style={{
          width: 38, height: 38, background: 'var(--border)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--white)',
        }}>{initial}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <button onClick={() => onProfileClick(item.user_id)} style={{
                background: 'none', border: 'none', color: 'var(--lime)', fontWeight: 700,
                fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans',
              }}>{username}</button>
              <span style={{ color: 'var(--slate)', fontSize: 13 }}> picked </span>
              <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16 }}>
                {g ? `${g.away_team_abbr} @ ${g.home_team_abbr}` : 'game'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--slate)', marginLeft: 8 }}>Wk {item.week}</span>
            </div>
            {diff !== null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: diffColor, flexShrink: 0 }}>Δ{diff.toFixed(1)}</span>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--slate)' }}>Spread: <strong style={{ color: 'var(--white)' }}>{formatSpread(item.predicted_spread)}</strong></span>
            {g?.actual_spread !== null && g?.actual_spread !== undefined && (
              <span style={{ color: 'var(--slate)' }}>Actual: <strong style={{ color: 'var(--white)' }}>{formatSpread(g.actual_spread)}</strong></span>
            )}
            <span style={{ color: 'var(--slate)' }}>Conf: <strong style={{ color: 'var(--white)' }}>×{item.confidence_points}</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Offseason pick
  const prop = item.offseason_props;
  const diff = prop?.actual_result !== null && prop?.actual_result !== undefined
    ? Math.abs(item.predicted_value - prop.actual_result) : null;
  const vegasDiff = prop?.line !== null && prop?.line !== undefined
    ? Math.abs(item.predicted_value - Number(prop.line)) : null;
  const displayDiff = diff ?? vegasDiff;
  const diffColor = displayDiff === null ? 'var(--slate)' : displayDiff <= 1 ? 'var(--green)' : displayDiff <= 3 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <button onClick={() => onProfileClick(item.user_id)} style={{
        width: 38, height: 38, background: 'var(--border)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--white)',
      }}>{initial}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <button onClick={() => onProfileClick(item.user_id)} style={{
              background: 'none', border: 'none', color: 'var(--lime)', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans',
            }}>{username}</button>
            <span style={{ color: 'var(--slate)', fontSize: 13 }}> picked </span>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 15 }}>
              {prop?.team || prop?.description || 'offseason prop'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--lime)', marginLeft: 8, fontFamily: 'Barlow Condensed' }}>
              {prop?.category === 'win_total' ? 'WIN TOTAL' : 'DRAFT'}
            </span>
          </div>
          {displayDiff !== null && (
            <span style={{ fontSize: 13, fontWeight: 700, color: diffColor, flexShrink: 0 }}>Δ{displayDiff.toFixed(1)}</span>
          )}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--slate)' }}>Pick: <strong style={{ color: 'var(--white)' }}>{item.predicted_value}</strong></span>
          <span style={{ color: 'var(--slate)' }}>Vegas: <strong style={{ color: 'var(--white)' }}>{prop?.line}</strong></span>
          {prop?.actual_result !== null && prop?.actual_result !== undefined && (
            <span style={{ color: 'var(--slate)' }}>Result: <strong style={{ color: 'var(--lime)' }}>{prop.actual_result}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
}

function UserCard({ profile, isFollowing, onFollow, onUnfollow, onClick }) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <button onClick={onClick} style={{
        width: 44, height: 44, background: 'var(--border)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--white)',
      }}>
        {profile.username?.[0]?.toUpperCase()}
      </button>
      <div style={{ flex: 1, minWidth: 0 }} onClick={onClick} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17 }}>
          {profile.display_name || profile.username}
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 1 }}>
          @{profile.username}
          {profile.favorite_team && <span style={{ marginLeft: 10 }}>🏈 {profile.favorite_team}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--slate)' }}>
          <div style={{ color: 'var(--lime)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16 }}>{profile.total_points || 0} pts</div>
          <div>{profile.follower_count || 0} followers</div>
        </div>
        <button
          onClick={isFollowing ? onUnfollow : onFollow}
          className={isFollowing ? 'btn btn-secondary' : 'btn btn-primary'}
          style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          {isFollowing ? 'UNFOLLOW' : <><UserPlus size={13} /> FOLLOW</>}
        </button>
      </div>
    </div>
  );
}
