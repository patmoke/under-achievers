import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, calculatePoints, getCurrentNFLWeek } from '../lib/scoring';
import { Users, Copy, Check, Eye, EyeOff, LogOut, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = getCurrentNFLWeek(CURRENT_SEASON);

export default function LeaguePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [tab, setTab] = useState('leaderboard');
  const [weeklyTab, setWeeklyTab] = useState(CURRENT_WEEK);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [weekAllSubmitted, setWeekAllSubmitted] = useState(false);
  const [offseasonAllSubmitted, setOffseasonAllSubmitted] = useState(false);

  const [weeklyPicks, setWeeklyPicks] = useState([]);
  const [offseasonPicks, setOffseasonPicks] = useState([]);
  const [games, setGames] = useState([]);
  const [offseasonProps, setOffseasonProps] = useState([]);
  const [myWeekPicks, setMyWeekPicks] = useState([]);
  const [myOffseasonPicks, setMyOffseasonPicks] = useState([]);

  useEffect(() => { fetchLeague(); }, [id, user]);

  useEffect(() => {
    if (league && members.length > 0) checkAllSubmittedThenFetch();
  }, [league, members, weeklyTab]);

  async function fetchLeague() {
    setLoading(true);
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues').select('*').eq('id', id).single();

    if (leagueError || !leagueData) {
      toast.error('Could not load league');
      navigate('/leagues');
      return;
    }
    setLeague(leagueData);

    const { data: membersData, error: membersError } = await supabase
      .from('league_members')
      .select('*, profiles(username, display_name, total_points, total_predictions)')
      .eq('league_id', id)
      .order('joined_at');

    setMembers(membersData || []);
    const me = (membersData || []).find(m => m.user_id === user.id);
    setMyMembership(me);

    if (membersData && membersData.length > 0 && !me) {
      toast.error('You are not a member of this league');
      navigate('/leagues');
      return;
    }
    setLoading(false);
  }

  async function checkAllSubmittedThenFetch() {
    const [{ data: weekResult }, { data: offseasonResult }] = await Promise.all([
      supabase.rpc('league_week_all_locked', { p_league_id: id, p_week: weeklyTab, p_season: CURRENT_SEASON }),
      supabase.rpc('league_offseason_all_locked', { p_league_id: id, p_season: CURRENT_SEASON }),
    ]);
    setWeekAllSubmitted(!!weekResult);
    setOffseasonAllSubmitted(!!offseasonResult);
    await fetchPicks(!!weekResult, !!offseasonResult);
  }

  async function fetchPicks(weekAllDone, offseasonAllDone) {
    const memberIds = members.map(m => m.user_id);

    const { data: myWeek } = await supabase
      .from('predictions')
      .select('*, games(home_team_abbr, away_team_abbr, actual_spread, home_score, away_score, status)')
      .eq('user_id', user.id).eq('week', weeklyTab).eq('season', CURRENT_SEASON);
    setMyWeekPicks(myWeek || []);

    const { data: myOffseason } = await supabase
      .from('offseason_predictions')
      .select('*, offseason_props(description, team, line, actual_result, is_locked, category)')
      .eq('user_id', user.id).eq('season', CURRENT_SEASON);
    setMyOffseasonPicks(myOffseason || []);

    const { data: gamesData } = await supabase
      .from('games').select('*').eq('week', weeklyTab).eq('season', CURRENT_SEASON).order('game_time');
    setGames(gamesData || []);

    const { data: propsData } = await supabase
      .from('offseason_props').select('*').eq('season', CURRENT_SEASON).order('category').order('team');
    setOffseasonProps(propsData || []);

    if (weekAllDone && memberIds.length > 0) {
      const { data: allWeek } = await supabase
        .from('predictions')
        .select('*, profiles(username), games(home_team_abbr, away_team_abbr, actual_spread)')
        .in('user_id', memberIds).eq('week', weeklyTab).eq('season', CURRENT_SEASON);
      setWeeklyPicks(allWeek || []);
    }

    if (offseasonAllDone && memberIds.length > 0) {
      const { data: allOffseason } = await supabase
        .from('offseason_predictions')
        .select('*, profiles(username), offseason_props(description, team, line, actual_result, is_locked)')
        .in('user_id', memberIds).eq('season', CURRENT_SEASON);
      setOffseasonPicks(allOffseason || []);
    }
  }

  async function leaveLeague() {
    if (myMembership?.role === 'owner') { toast.error('Transfer ownership or delete the league before leaving'); return; }
    if (!confirm('Leave this league?')) return;
    await supabase.from('league_members').delete().eq('league_id', id).eq('user_id', user.id);
    toast.success('Left league');
    navigate('/leagues');
  }

  async function deleteLeague() {
    if (!confirm(`Delete "${league.name}"? This cannot be undone.`)) return;
    await supabase.from('leagues').delete().eq('id', id);
    toast.success('League deleted');
    navigate('/leagues');
  }

  function copyCode() {
    navigator.clipboard.writeText(league.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Join code copied!');
  }

  function buildWeeklyLeaderboard() {
    const userMap = {};
    members.forEach(m => {
      userMap[m.user_id] = { user_id: m.user_id, username: m.profiles?.username || 'Unknown', picks: 0, points: 0, diffs: [] };
    });
    const picks = weekAllSubmitted ? weeklyPicks : myWeekPicks;
    picks.forEach(p => {
      if (!userMap[p.user_id]) return;
      userMap[p.user_id].picks++;
      if (p.games?.actual_spread !== null && p.games?.actual_spread !== undefined) {
        const diff = Math.abs(p.predicted_spread - p.games.actual_spread);
        userMap[p.user_id].diffs.push(diff);
        userMap[p.user_id].points += calculatePoints(p.predicted_spread, p.games.actual_spread, p.confidence_points || 1);
      }
    });
    return Object.values(userMap)
      .sort((a, b) => b.points - a.points)
      .map((u, i) => ({ ...u, rank: i + 1, avgDiff: u.diffs.length ? u.diffs.reduce((a, b) => a + b, 0) / u.diffs.length : null }));
  }

  function buildOffseasonLeaderboard() {
    const userMap = {};
    members.forEach(m => {
      userMap[m.user_id] = { user_id: m.user_id, username: m.profiles?.username || 'Unknown', picks: 0, diffs: [] };
    });
    const picks = offseasonAllSubmitted ? offseasonPicks : myOffseasonPicks;
    picks.forEach(p => {
      if (!userMap[p.user_id]) return;
      userMap[p.user_id].picks++;
      const prop = p.offseason_props;
      if (prop?.actual_result !== null && prop?.actual_result !== undefined) {
        userMap[p.user_id].diffs.push(Math.abs(p.predicted_value - prop.actual_result));
      }
    });
    return Object.values(userMap)
      .sort((a, b) => {
        // Sort by avgDiff if available, else by picks count
        const aAvg = a.diffs.length ? a.diffs.reduce((x, y) => x + y, 0) / a.diffs.length : null;
        const bAvg = b.diffs.length ? b.diffs.reduce((x, y) => x + y, 0) / b.diffs.length : null;
        if (aAvg !== null && bAvg !== null) return aAvg - bAvg;
        return b.picks - a.picks;
      })
      .map((u, i) => ({
        ...u, rank: i + 1,
        avgDiff: u.diffs.length ? u.diffs.reduce((a, b) => a + b, 0) / u.diffs.length : null
      }));
  }

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton card" style={{ height: 200 }} />
    </div>
  );

  const isOwner = myMembership?.role === 'owner';
  const weeklyBoard = buildWeeklyLeaderboard();
  const offseasonBoard = buildOffseasonLeaderboard();
  const competeOn = league.compete_on;

  const TABS = [
    { key: 'leaderboard', label: '🏆 LEADERBOARD' },
    ...(competeOn !== 'offseason' ? [{ key: 'weekly', label: '🏈 WEEKLY PICKS' }] : []),
    ...(competeOn !== 'weekly' ? [{ key: 'offseason', label: '🏖️ OFFSEASON PICKS' }] : []),
    { key: 'members', label: `👥 MEMBERS (${members.length})` },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* League Header */}
      <div className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 36 }}>{league.name}</h1>
              {league.is_public
                ? <span className="badge badge-lime">PUBLIC</span>
                : <span className="badge" style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--slate)', border: '1px solid var(--border)' }}>PRIVATE</span>
              }
            </div>
            {league.description && <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 12 }}>{league.description}</p>}
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--slate)', flexWrap: 'wrap' }}>
              <span><Users size={12} style={{ display: 'inline', marginRight: 4 }} />{members.length} / {league.max_members} members</span>
              <span>🏈 {competeOn === 'both' ? 'Weekly + Offseason' : competeOn === 'weekly' ? 'Weekly Picks' : 'Offseason Props'}</span>
              <span>2026 Season</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={copyCode} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Barlow Condensed', letterSpacing: '0.15em' }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {league.join_code}
            </button>
            {!isOwner && (
              <button onClick={leaveLeague} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', borderColor: 'var(--red)' }}>
                <LogOut size={14} /> LEAVE
              </button>
            )}
            {isOwner && (
              <button onClick={deleteLeague} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', borderColor: 'var(--red)' }}>
                DELETE
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Blind Picks Banner */}
      <BlindPicksBanner
        weekAllSubmitted={weekAllSubmitted}
        offseasonAllSubmitted={offseasonAllSubmitted}
        competeOn={competeOn}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', whiteSpace: 'nowrap',
            borderBottom: tab === t.key ? '2px solid var(--lime)' : '2px solid transparent',
            color: tab === t.key ? 'var(--lime)' : 'var(--slate)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
            letterSpacing: '0.08em', padding: '12px 20px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* LEADERBOARD */}
      {tab === 'leaderboard' && (
        <div>
          {competeOn !== 'offseason' && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ fontSize: 22 }}>🏈 WEEK {weeklyTab} STANDINGS</h3>
                <select value={weeklyTab} onChange={e => setWeeklyTab(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Wk {w}</option>)}
                </select>
              </div>
              {!weekAllSubmitted && (
                <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <EyeOff size={14} /> Other members' picks are hidden until everyone has submitted for Week {weeklyTab}.
                </div>
              )}
              <LeaderboardTable board={weeklyBoard} currentUserId={user.id} revealed={weekAllSubmitted} type="weekly" />
            </div>
          )}
          {competeOn !== 'weekly' && (
            <div>
              <h3 style={{ fontSize: 22, marginBottom: 16 }}>🏖️ OFFSEASON STANDINGS</h3>
              {!offseasonAllSubmitted && (
                <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <EyeOff size={14} /> Offseason picks are hidden until all members have submitted at least one pick.
                </div>
              )}
              <LeaderboardTable board={offseasonBoard} currentUserId={user.id} revealed={offseasonAllSubmitted} type="offseason" />
            </div>
          )}
        </div>
      )}

      {/* WEEKLY PICKS */}
      {tab === 'weekly' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 22 }}>WEEK {weeklyTab} PICKS</h3>
            <select value={weeklyTab} onChange={e => setWeeklyTab(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Wk {w}</option>)}
            </select>
          </div>
          {games.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>No games scheduled for Week {weeklyTab} yet.</div>
          ) : (
            games.map(game => {
              const myPick = myWeekPicks.find(p => p.game_id === game.id);
              const allPicksForGame = weekAllSubmitted ? weeklyPicks.filter(p => p.game_id === game.id) : [];
              return (
                <div key={game.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22 }}>
                        {game.away_team_abbr} @ {game.home_team_abbr}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                        {new Date(game.game_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {game.actual_spread !== null && <span style={{ marginLeft: 10 }}>Line: <strong>{formatSpread(game.actual_spread)}</strong></span>}
                      </div>
                    </div>
                    {game.home_score !== null && (
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>
                        {game.away_score} – {game.home_score}
                      </div>
                    )}
                  </div>
                  {myPick && (
                    <div style={{ padding: '10px 14px', background: 'rgba(192,255,0,0.05)', border: '1px solid rgba(192,255,0,0.15)', marginBottom: allPicksForGame.length > 0 ? 10 : 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 4 }}>YOUR PICK</div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                        <span>Spread: <strong>{formatSpread(myPick.predicted_spread)}</strong></span>
                        <span>Confidence: ×{myPick.confidence_points}</span>
                        {game.actual_spread !== null && (
                          <span style={{ color: Math.abs(myPick.predicted_spread - game.actual_spread) <= 1 ? 'var(--green)' : Math.abs(myPick.predicted_spread - game.actual_spread) <= 3 ? 'var(--amber)' : 'var(--red)' }}>
                            Δ{Math.abs(myPick.predicted_spread - game.actual_spread).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {weekAllSubmitted && allPicksForGame.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', marginBottom: 6 }}>
                        <Eye size={11} style={{ display: 'inline', marginRight: 4 }} />ALL PICKS REVEALED
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {allPicksForGame.filter(p => p.user_id !== user.id).map(p => (
                          <div key={p.id} style={{ padding: '6px 12px', background: 'var(--navy)', border: '1px solid var(--border)', fontSize: 13 }}>
                            <span style={{ color: 'var(--slate)', marginRight: 6 }}>{p.profiles?.username}:</span>
                            <strong>{formatSpread(p.predicted_spread)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!myPick && <div style={{ fontSize: 13, color: 'var(--slate)', fontStyle: 'italic' }}>You haven't submitted a pick for this game yet.</div>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* OFFSEASON PICKS */}
      {tab === 'offseason' && (
        <OffseasonPicksTab
          offseasonProps={offseasonProps}
          myOffseasonPicks={myOffseasonPicks}
          offseasonPicks={offseasonPicks}
          offseasonAllSubmitted={offseasonAllSubmitted}
          members={members}
          currentUserId={user.id}
        />
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {members.map((member, idx) => (
            <div key={member.id} style={{
              padding: '16px 20px', borderBottom: idx === members.length - 1 ? 'none' : '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36,
                  background: member.user_id === user.id ? 'var(--lime)' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16,
                  color: member.user_id === user.id ? 'var(--navy)' : 'var(--white)',
                }}>
                  {member.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17 }}>
                    {member.profiles?.username}
                    {member.user_id === user.id && <span style={{ fontSize: 12, color: 'var(--lime)', marginLeft: 8 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--slate)' }}>
                    Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {member.role === 'owner' && <span className="badge badge-gold">OWNER</span>}
                <div style={{ textAlign: 'right', fontSize: 13 }}>
                  <div style={{ color: 'var(--lime)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>{member.profiles?.total_points || 0} pts</div>
                  <div style={{ color: 'var(--slate)' }}>{member.profiles?.total_predictions || 0} picks</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Offseason Picks Tab ────────────────────────────────────────────────────

function OffseasonPicksTab({ offseasonProps, myOffseasonPicks, offseasonPicks, offseasonAllSubmitted, members, currentUserId }) {
  if (myOffseasonPicks.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--slate)' }}>
        You haven't made any offseason picks yet. Head to the <strong>Offseason Props</strong> page to get started!
      </div>
    );
  }

  // Build a map of all picks by prop_id → user_id → pick
  const picksByProp = {};
  if (offseasonAllSubmitted) {
    offseasonPicks.forEach(p => {
      if (!picksByProp[p.prop_id]) picksByProp[p.prop_id] = {};
      picksByProp[p.prop_id][p.user_id] = p;
    });
  }
  // Always include my picks
  myOffseasonPicks.forEach(p => {
    if (!picksByProp[p.prop_id]) picksByProp[p.prop_id] = {};
    picksByProp[p.prop_id][currentUserId] = p;
  });

  // Group props by category
  const propsWithMyPick = offseasonProps.filter(prop => myOffseasonPicks.some(p => p.prop_id === prop.id));
  const byCategory = {};
  propsWithMyPick.forEach(prop => {
    const cat = prop.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(prop);
  });

  // Member order for columns: me first, then others
  const memberOrder = [
    members.find(m => m.user_id === currentUserId),
    ...members.filter(m => m.user_id !== currentUserId),
  ].filter(Boolean);

  const diffColor = (diff) => {
    if (diff === null || diff === undefined) return 'var(--slate)';
    if (diff <= 1) return 'var(--green)';
    if (diff <= 3) return 'var(--amber)';
    return 'var(--red)';
  };

  return (
    <div>
      {!offseasonAllSubmitted && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <EyeOff size={14} /> Other members' picks are hidden until everyone has submitted at least one pick.
        </div>
      )}

      {Object.entries(byCategory).map(([category, props]) => (
        <div key={category} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: 'var(--lime)', fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>
            {category === 'win_total' ? '🏈 WIN TOTALS' : category === 'draft' ? '📋 NFL DRAFT' : category.toUpperCase()}
          </div>

          {props.map(prop => {
            const picksForProp = picksByProp[prop.id] || {};
            const myPick = picksForProp[currentUserId];
            const hasResult = prop.actual_result !== null && prop.actual_result !== undefined;
            const isLocked = prop.is_locked;

            // All picks sorted: me first
            const allPickEntries = memberOrder
              .map(m => ({ member: m, pick: picksForProp[m.user_id] }))
              .filter(({ pick }) => !!pick);

            return (
              <div key={prop.id} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
                {/* Prop header */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 18 }}>
                      {prop.team || prop.description}
                    </div>
                    {prop.team && <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{prop.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
                    {(isLocked || offseasonAllSubmitted) && (
                      <span style={{ color: 'var(--slate)' }}>
                        Vegas: <strong style={{ color: 'var(--white)' }}>{prop.line}</strong>
                      </span>
                    )}
                    {hasResult && (
                      <span style={{ color: 'var(--slate)' }}>
                        Result: <strong style={{ color: 'var(--lime)' }}>{prop.actual_result}</strong>
                      </span>
                    )}
                    {!isLocked && !offseasonAllSubmitted && (
                      <span style={{ fontSize: 11, color: 'var(--slate)', fontStyle: 'italic' }}>Vegas line hidden until all picks submitted</span>
                    )}
                  </div>
                </div>

                {/* Picks grid */}
                <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(() => {
                    // Find winner: closest to actual_result (or closest to line if no result yet)
                    const compareVal = hasResult ? prop.actual_result : (offseasonAllSubmitted ? prop.line : null);
                    let minDiff = Infinity;
                    if (compareVal !== null && compareVal !== undefined) {
                      allPickEntries.forEach(({ pick }) => {
                        const d = Math.abs(pick.predicted_value - compareVal);
                        if (d < minDiff) minDiff = d;
                      });
                    }
                    return allPickEntries.map(({ member, pick }) => {
                      const isMe = member.user_id === currentUserId;
                      const diff = hasResult ? Math.abs(pick.predicted_value - prop.actual_result) : null;
                      const vegasDiff = (offseasonAllSubmitted && prop.line !== null) ? Math.abs(pick.predicted_value - prop.line) : null;
                      const isWinner = compareVal !== null && compareVal !== undefined &&
                        Math.abs(pick.predicted_value - compareVal) === minDiff;
                      return (
                        <div key={member.user_id} style={{
                          padding: '10px 14px',
                          background: isWinner && hasResult
                            ? 'rgba(192,255,0,0.1)'
                            : isMe ? 'rgba(192,255,0,0.04)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isWinner && hasResult ? 'rgba(192,255,0,0.5)' : isMe ? 'rgba(192,255,0,0.2)' : 'var(--border)'}`,
                          minWidth: 100,
                          flex: '1 1 100px',
                          maxWidth: 160,
                          position: 'relative',
                        }}>
                          {isWinner && hasResult && (
                            <div style={{ position: 'absolute', top: -10, right: 8, fontSize: 16 }}>🏆</div>
                          )}
                          <div style={{
                            fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.08em',
                            color: isMe ? 'var(--lime)' : 'var(--slate)', marginBottom: 6, fontWeight: 700
                          }}>
                            {isMe ? 'YOU' : member.profiles?.username?.toUpperCase() || 'UNKNOWN'}
                          </div>
                          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 26, color: 'var(--white)', lineHeight: 1 }}>
                            {pick.predicted_value}
                          </div>
                          {diff !== null ? (
                            <div style={{ fontSize: 12, color: diffColor(diff), marginTop: 4, fontWeight: 600 }}>
                              Δ{diff.toFixed(1)} from result
                            </div>
                          ) : vegasDiff !== null ? (
                            <div style={{ fontSize: 12, color: diffColor(vegasDiff), marginTop: 4, fontWeight: 600 }}>
                              Δ{vegasDiff.toFixed(1)} from Vegas
                            </div>
                          ) : null}
                        </div>
                      );
                    });
                  })()}

                  {/* Hidden member slots */}
                  {!offseasonAllSubmitted && members.filter(m => m.user_id !== currentUserId && !picksForProp[m.user_id]).map(m => (
                    <div key={m.user_id} style={{
                      padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)', minWidth: 100, flex: '1 1 100px', maxWidth: 160,
                      display: 'flex', flexDirection: 'column', gap: 6
                    }}>
                      <div style={{ fontSize: 11, fontFamily: 'Barlow Condensed', color: 'var(--slate)', fontWeight: 700 }}>
                        {m.profiles?.username?.toUpperCase() || 'UNKNOWN'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <EyeOff size={12} style={{ color: 'var(--slate)' }} />
                        <span style={{ fontSize: 12, color: 'var(--slate)' }}>hidden</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Leaderboard Table ──────────────────────────────────────────────────────

function LeaderboardTable({ board, currentUserId, revealed, type }) {
  if (board.length === 0) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--slate)' }}>No data yet.</div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 80px', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
        {['#', 'PLAYER', 'PICKS', type === 'weekly' ? 'PTS' : 'PICKS', 'AVG Δ'].map((h, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      {board.map((entry, idx) => {
        const isMe = entry.user_id === currentUserId;
        const showData = revealed || isMe;
        return (
          <div key={entry.user_id} style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 80px',
            padding: '14px 20px', borderBottom: idx === board.length - 1 ? 'none' : '1px solid var(--border)',
            background: isMe ? 'rgba(192,255,0,0.04)' : 'transparent',
            outline: isMe ? '1px solid rgba(192,255,0,0.15)' : 'none',
            alignItems: 'center'
          }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 22,
              color: entry.rank === 1 ? 'var(--gold)' : entry.rank === 2 ? 'var(--silver)' : entry.rank === 3 ? 'var(--bronze)' : 'var(--slate)'
            }}>
              {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
            </div>
            <div style={{ fontWeight: 600, color: isMe ? 'var(--lime)' : 'var(--white)', fontSize: 15 }}>
              {entry.username}
              {isMe && <span style={{ fontSize: 11, color: 'var(--lime)', marginLeft: 6 }}>(you)</span>}
              {!showData && !isMe && <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 6 }}><EyeOff size={10} style={{ display: 'inline' }} /> hidden</span>}
            </div>
            <div style={{ color: 'var(--slate)', fontSize: 14, textAlign: 'right' }}>{showData ? entry.picks : '—'}</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--lime)', textAlign: 'right' }}>
              {showData ? (type === 'weekly' ? entry.points : entry.picks) : '—'}
            </div>
            <div style={{
              fontSize: 14, textAlign: 'right',
              color: showData && entry.avgDiff !== null
                ? (entry.avgDiff <= 1 ? 'var(--green)' : entry.avgDiff <= 3 ? 'var(--amber)' : 'var(--red)')
                : 'var(--slate)'
            }}>
              {showData && entry.avgDiff !== null ? `Δ${entry.avgDiff.toFixed(1)}` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Blind Picks Banner ─────────────────────────────────────────────────────

function BlindPicksBanner({ weekAllSubmitted, offseasonAllSubmitted, competeOn }) {
  const weekDone = competeOn === 'offseason' || weekAllSubmitted;
  const offseasonDone = competeOn === 'weekly' || offseasonAllSubmitted;
  if (weekDone && offseasonDone) return null;

  return (
    <div style={{ marginBottom: 20, padding: '14px 20px', background: 'rgba(192,255,0,0.05)', border: '1px solid rgba(192,255,0,0.2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <EyeOff size={16} style={{ color: 'var(--lime)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15, color: 'var(--lime)' }}>
          BLIND PICKS MODE ACTIVE
        </div>
        <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 2 }}>
          Other members' picks are hidden until everyone in this league has submitted.
        </div>
      </div>
    </div>
  );
}
