import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, calculatePoints, getCurrentNFLWeek } from '../lib/scoring';
import { Users, Copy, Check, Eye, EyeOff, LogOut, Calendar, Skull } from 'lucide-react';
import toast from 'react-hot-toast';
import SurvivorTab from './SurvivorTab';

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = getCurrentNFLWeek(CURRENT_SEASON);

const TYPE_ICON = { weekly: Calendar, survivor: Skull };
const TYPE_LABEL = { weekly: 'Weekly Picks', survivor: 'Survivor Pool' };

export default function LeaguePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [tab, setTab] = useState(null);
  const [weeklyTab, setWeeklyTab] = useState(CURRENT_WEEK);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [weekAllSubmitted, setWeekAllSubmitted] = useState(false);
  const [weeklyPicks, setWeeklyPicks] = useState([]);
  const [games, setGames] = useState([]);
  const [myWeekPicks, setMyWeekPicks] = useState([]);

  const isSurvivor = league?.compete_on === 'survivor';

  useEffect(() => { fetchLeague(); }, [id, user]);

  useEffect(() => {
    if (league && members.length > 0 && !isSurvivor) checkAllSubmittedThenFetch();
  }, [league, members, weeklyTab]);

  useEffect(() => {
    if (league && tab === null) setTab(isSurvivor ? 'survivor' : 'leaderboard');
  }, [league]);

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

    const { data: membersData } = await supabase
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
    const { data: weekResult } = await supabase.rpc('league_week_all_locked', { p_league_id: id, p_week: weeklyTab, p_season: CURRENT_SEASON });
    setWeekAllSubmitted(!!weekResult);
    await fetchPicks(!!weekResult);
  }

  async function fetchPicks(weekAllDone) {
    const memberIds = members.map(m => m.user_id);

    const { data: myWeek } = await supabase
      .from('predictions')
      .select('*, games(home_team_abbr, away_team_abbr, actual_spread, home_score, away_score, status)')
      .eq('user_id', user.id).eq('week', weeklyTab).eq('season', CURRENT_SEASON);
    setMyWeekPicks(myWeek || []);

    const { data: gamesData } = await supabase
      .from('games').select('*').eq('week', weeklyTab).eq('season', CURRENT_SEASON).order('game_time');
    setGames(gamesData || []);

    if (weekAllDone && memberIds.length > 0) {
      const { data: allWeek } = await supabase
        .from('predictions')
        .select('*, profiles(username), games(home_team_abbr, away_team_abbr, actual_spread)')
        .in('user_id', memberIds).eq('week', weeklyTab).eq('season', CURRENT_SEASON);
      setWeeklyPicks(allWeek || []);
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
        const diff = Math.abs(Number(p.predicted_spread) - Number(p.games.actual_spread));
        userMap[p.user_id].diffs.push(diff);
        userMap[p.user_id].points += calculatePoints(p.predicted_spread, p.games.actual_spread, p.confidence_points || 1);
      }
    });
    return Object.values(userMap)
      .sort((a, b) => b.points - a.points || a.diffs.reduce((s,d)=>s+d,0) - b.diffs.reduce((s,d)=>s+d,0))
      .map((u, i) => ({ ...u, rank: i + 1, avgDiff: u.diffs.length ? u.diffs.reduce((a, b) => a + b, 0) / u.diffs.length : null }));
  }

  if (loading || tab === null) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div className="skeleton card" style={{ height: 200 }} />
    </div>
  );

  const isOwner = myMembership?.role === 'owner';
  const weeklyBoard = isSurvivor ? [] : buildWeeklyLeaderboard();
  const competeOn = league.compete_on;
  const TypeIcon = TYPE_ICON[competeOn] || Calendar;

  const TABS = isSurvivor
    ? [
        { key: 'survivor', label: 'Survivor pool' },
        { key: 'members', label: `Members (${members.length})` },
      ]
    : [
        { key: 'leaderboard', label: 'Leaderboard' },
        { key: 'weekly', label: 'Weekly picks' },
        { key: 'members', label: `Members (${members.length})` },
      ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* League Header */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 32, textTransform: 'none' }}>{league.name}</h1>
              {league.is_public
                ? <span className="badge badge-lime">Public</span>
                : <span className="badge" style={{ background: 'var(--surface-alt)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>Private</span>
              }
            </div>
            {league.description && <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 12 }}>{league.description}</p>}
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Users size={13} />{members.length} / {league.max_members} members</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TypeIcon size={13} />{TYPE_LABEL[competeOn] || competeOn}</span>
              <span>2026 Season</span>
              {isSurvivor && (
                <span>
                  {league.survivor_buyback_deadline_week != null
                    ? `Buybacks: up to ${league.survivor_max_buybacks} through Week ${league.survivor_buyback_deadline_week}`
                    : 'Buybacks: not allowed'}
                </span>
              )}
              {isSurvivor && (
                <span>
                  {league.survivor_max_entries != null
                    ? `Entries: up to ${league.survivor_max_entries} per person`
                    : 'Entries: 1 per person'}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={copyCode} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Barlow Condensed', letterSpacing: '0.06em' }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {league.join_code}
            </button>
            {!isOwner && (
              <button onClick={leaveLeague} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <LogOut size={14} /> Leave
              </button>
            )}
            {isOwner && (
              <button onClick={deleteLeague} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Blind Picks Banner (not applicable to survivor pools) */}
      {!isSurvivor && <BlindPicksBanner weekAllSubmitted={weekAllSubmitted} weeklyTab={weeklyTab} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', whiteSpace: 'nowrap',
            borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--ink-soft)',
            fontWeight: 700, fontSize: 14,
            padding: '10px 18px',
            cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* SURVIVOR (primary content for survivor-type leagues) */}
      {isSurvivor && tab === 'survivor' && (
        <SurvivorTab
          leagueId={id}
          currentUserId={user.id}
          isOwner={isOwner}
          season={CURRENT_SEASON}
          currentWeek={CURRENT_WEEK}
          buybackDeadlineWeek={league.survivor_buyback_deadline_week}
          maxBuybacks={league.survivor_max_buybacks}
          maxEntries={league.survivor_max_entries}
        />
      )}

      {/* LEADERBOARD */}
      {!isSurvivor && tab === 'leaderboard' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 20, textTransform: 'none' }}>Week {weeklyTab} standings</h3>
            <select value={weeklyTab} onChange={e => setWeeklyTab(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Wk {w}</option>)}
            </select>
          </div>
          {!weekAllSubmitted && (
            <div style={{ marginBottom: 12, padding: '10px 16px', background: 'var(--warning-soft)', border: '1px solid rgba(184,114,11,0.25)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <EyeOff size={14} /> Other members' picks are hidden until everyone has submitted for Week {weeklyTab}.
            </div>
          )}
          <LeaderboardTable board={weeklyBoard} currentUserId={user.id} revealed={weekAllSubmitted} />
        </div>
      )}

      {/* WEEKLY PICKS */}
      {!isSurvivor && tab === 'weekly' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 20, textTransform: 'none' }}>Week {weeklyTab} picks</h3>
            <select value={weeklyTab} onChange={e => setWeeklyTab(Number(e.target.value))} style={{ width: 80, padding: '6px 10px' }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Wk {w}</option>)}
            </select>
          </div>
          {games.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>No games scheduled for Week {weeklyTab} yet.</div>
          ) : (
            games.map(game => {
              const myPick = myWeekPicks.find(p => p.game_id === game.id);
              const allPicksForGame = weekAllSubmitted ? weeklyPicks.filter(p => p.game_id === game.id) : [];
              return (
                <div key={game.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 21 }}>
                        {game.away_team_abbr} @ {game.home_team_abbr}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {new Date(game.game_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {game.actual_spread !== null && <span style={{ marginLeft: 10 }}>Line: <strong>{formatSpread(game.actual_spread)}</strong></span>}
                      </div>
                    </div>
                    {game.home_score !== null && (
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 19 }}>
                        {game.away_score} – {game.home_score}
                      </div>
                    )}
                  </div>
                  {myPick && (
                    <div style={{ padding: '10px 14px', background: 'var(--accent-soft)', border: '1px solid rgba(15,122,77,0.18)', borderRadius: 'var(--radius-sm)', marginBottom: allPicksForGame.length > 0 ? 10 : 0 }}>
                      <div className="label-muted" style={{ marginBottom: 4 }}>Your pick</div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                        <span>Spread: <strong>{formatSpread(myPick.predicted_spread)}</strong></span>
                        <span>Confidence: ×{myPick.confidence_points}</span>
                        {game.actual_spread !== null && (
                          <span style={{ color: Math.abs(myPick.predicted_spread - game.actual_spread) <= 1 ? 'var(--success)' : Math.abs(myPick.predicted_spread - game.actual_spread) <= 3 ? 'var(--warning)' : 'var(--danger)' }}>
                            Δ{Math.abs(myPick.predicted_spread - game.actual_spread).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {weekAllSubmitted && allPicksForGame.length > 0 && (
                    <div>
                      <div className="label-muted" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={11} />All picks revealed
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {allPicksForGame.filter(p => p.user_id !== user.id).map(p => (
                          <div key={p.id} style={{ padding: '6px 12px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                            <span style={{ color: 'var(--ink-soft)', marginRight: 6 }}>{p.profiles?.username}:</span>
                            <strong>{formatSpread(p.predicted_spread)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!myPick && <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>You haven't submitted a pick for this game yet.</div>}
                </div>
              );
            })
          )}
        </div>
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
                  width: 36, height: 36, borderRadius: '50%',
                  background: member.user_id === user.id ? 'var(--accent)' : 'var(--surface-alt)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16,
                  color: member.user_id === user.id ? 'var(--accent-ink)' : 'var(--ink)',
                }}>
                  {member.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16 }}>
                    {member.profiles?.username}
                    {member.user_id === user.id && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 8 }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {member.role === 'owner' && <span className="badge badge-gold">Owner</span>}
                {!isSurvivor && (
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <div style={{ color: 'var(--accent)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17 }}>{member.profiles?.total_points || 0} pts</div>
                    <div style={{ color: 'var(--ink-soft)' }}>{member.profiles?.total_predictions || 0} picks</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard Table ──────────────────────────────────────────────────────

function LeaderboardTable({ board, currentUserId, revealed }) {
  if (board.length === 0) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>No data yet.</div>
  );

  const cols = '48px 1fr 80px 80px 80px';
  const diffColor = (d) => d <= 1 ? 'var(--success)' : d <= 3 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
        {['#', 'Player', 'Picks', 'Pts', 'Avg Δ'].map((h, i) => (
          <div key={i} className="label-muted" style={{ textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>
      {board.map((entry, idx) => {
        const isMe = entry.user_id === currentUserId;
        const showData = revealed || isMe;
        return (
          <div key={entry.user_id} style={{
            display: 'grid', gridTemplateColumns: cols,
            padding: '14px 20px', borderBottom: idx === board.length - 1 ? 'none' : '1px solid var(--border)',
            background: isMe ? 'var(--accent-soft)' : 'transparent',
            alignItems: 'center'
          }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 20,
              color: entry.rank === 1 ? 'var(--gold)' : entry.rank === 2 ? 'var(--silver)' : entry.rank === 3 ? 'var(--bronze)' : 'var(--ink-faint)'
            }}>
              {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
            </div>
            <div style={{ fontWeight: 600, color: isMe ? 'var(--accent-dark)' : 'var(--ink)', fontSize: 15 }}>
              {entry.username}
              {isMe && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}
              {!showData && !isMe && <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}><EyeOff size={10} /> hidden</span>}
            </div>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14, textAlign: 'right' }}>
              {showData ? entry.picks : '—'}
            </div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, color: 'var(--accent)', textAlign: 'right' }}>
              {showData ? entry.points : '—'}
            </div>
            <div style={{ fontSize: 14, textAlign: 'right', color: showData && entry.avgDiff !== null ? diffColor(entry.avgDiff) : 'var(--ink-faint)' }}>
              {showData && entry.avgDiff !== null ? `Δ${entry.avgDiff.toFixed(1)}` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Blind Picks Banner ─────────────────────────────────────────────────────

function BlindPicksBanner({ weekAllSubmitted, weeklyTab }) {
  if (weekAllSubmitted) return null;

  return (
    <div style={{ marginBottom: 20, padding: '14px 20px', background: 'var(--accent-soft)', border: '1px solid rgba(15,122,77,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <EyeOff size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-dark)' }}>
          Blind picks mode active
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
          Other members' picks for Week {weeklyTab} are hidden until everyone in this league has submitted.
        </div>
      </div>
    </div>
  );
}
