import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSpread, calculatePoints } from '../lib/scoring';
import { useCurrentWeek } from '../lib/useCurrentWeek';
import { Users, Copy, Check, Eye, EyeOff, LogOut, Calendar, Skull, Settings, UserMinus, X, Share2, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import SurvivorTab from './SurvivorTab';

const CURRENT_SEASON = 2026;

const TYPE_ICON = { weekly: Calendar, survivor: Skull };
const TYPE_LABEL = { weekly: 'Weekly Picks', survivor: 'Survivor Pool' };

export default function LeaguePage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Admin-only testing aid: ?week=N lets an admin view the survivor pool as
  // if it were a different week, since currentWeek is otherwise derived
  // purely from real time — there's no way to walk through a season's
  // eliminations/buybacks without waiting for actual Sundays to pass.
  // Capped at 99 (not 18) so a scratch/QA league can seed games on
  // out-of-range week numbers (90+) that can't collide with the real
  // season's weeks 1-18 — games aren't league-scoped, so a synthetic game
  // sharing a real week number would pollute every other league's
  // "has this week fully kicked off" checks too.
  const currentWeek = useCurrentWeek(CURRENT_SEASON);
  const weekOverrideRaw = profile?.is_admin ? parseInt(searchParams.get('week'), 10) : NaN;
  const weekOverride = Number.isFinite(weekOverrideRaw) && weekOverrideRaw >= 1 && weekOverrideRaw <= 99 ? weekOverrideRaw : null;
  const effectiveWeek = weekOverride ?? currentWeek;

  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [myMembership, setMyMembership] = useState(null);
  const [tab, setTab] = useState(null);
  // null until the user picks a week, so the tab follows the derived current
  // week once it resolves instead of being frozen at the initial estimate.
  const [weeklyTabOverride, setWeeklyTabOverride] = useState(null);
  const weeklyTab = weeklyTabOverride ?? currentWeek;
  const setWeeklyTab = setWeeklyTabOverride;
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [entryCount, setEntryCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);

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
    setSettingsForm({
      name: leagueData.name,
      description: leagueData.description || '',
      is_public: leagueData.is_public,
      max_capacity: leagueData.max_capacity,
      survivor_buyback_deadline_week: leagueData.survivor_buyback_deadline_week,
      survivor_max_buybacks: leagueData.survivor_max_buybacks,
      survivor_max_entries: leagueData.survivor_max_entries,
    });

    if (leagueData.compete_on === 'survivor') {
      const { count } = await supabase
        .from('survivor_entries')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', id);
      setEntryCount(count || 0);
    }

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

  async function saveSettings() {
    if (!settingsForm.name.trim()) { toast.error('League name is required'); return; }
    setSavingSettings(true);
    try {
      const update = {
        name: settingsForm.name.trim(),
        description: settingsForm.description.trim() || null,
        is_public: settingsForm.is_public,
        max_capacity: settingsForm.max_capacity,
      };
      if (isSurvivor) {
        update.survivor_buyback_deadline_week = settingsForm.survivor_buyback_deadline_week;
        update.survivor_max_buybacks = settingsForm.survivor_max_buybacks;
        update.survivor_max_entries = settingsForm.survivor_max_entries;
      }
      const { error } = await supabase.from('leagues').update(update).eq('id', id);
      if (error) throw error;
      toast.success('Settings saved');
      setShowSettings(false);
      fetchLeague();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeMember(member) {
    if (!confirm(`Remove ${member.profiles?.username} from this league? Their entries will be deleted too.`)) return;
    setRemovingMember(member.user_id);
    try {
      const { error } = await supabase.rpc('owner_remove_member', { p_league_id: id, p_user_id: member.user_id });
      if (error) throw error;
      toast.success(`Removed ${member.profiles?.username}`);
      fetchLeague();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingMember(null);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(league.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Join code copied!');
  }

  function shareLink() {
    const url = `${window.location.origin}/join/${league.join_code}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Invite link copied!');
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={13} />
                {isSurvivor ? `${entryCount} / ${league.max_capacity} entries` : `${members.length} / ${league.max_capacity} members`}
              </span>
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
            <button onClick={shareLink} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {linkCopied ? <Check size={14} /> : <Share2 size={14} />}
              {linkCopied ? 'Link copied' : 'Share'}
            </button>
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
              <button onClick={() => setShowSettings(s => !s)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Settings size={14} /> Settings
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

      {/* Owner settings panel */}
      {isOwner && showSettings && settingsForm && (
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, textTransform: 'none' }}>League settings</h3>
            <button onClick={() => setShowSettings(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>League name *</label>
              <input value={settingsForm.name} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} maxLength={50} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Description</label>
              <input value={settingsForm.description} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} maxLength={200} />
            </div>
            <div>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>
                {isSurvivor ? 'Max entries' : 'Max members'}
              </label>
              <input type="number" min={isSurvivor ? entryCount : members.length} max={2000} value={settingsForm.max_capacity} onChange={e => setSettingsForm(f => ({ ...f, max_capacity: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label className="label-muted" style={{ display: 'block', marginBottom: 12 }}>Visibility</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ val: false, label: 'Private' }, { val: true, label: 'Public' }].map(opt => (
                  <button key={String(opt.val)} onClick={() => setSettingsForm(f => ({ ...f, is_public: opt.val }))} style={{
                    flex: 1, padding: '10px 12px', border: `1px solid ${settingsForm.is_public === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: settingsForm.is_public === opt.val ? 'var(--accent-soft)' : 'transparent',
                    color: settingsForm.is_public === opt.val ? 'var(--accent-dark)' : 'var(--ink-soft)',
                    cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>

          {isSurvivor && (
            <div style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                <div>
                  <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Max entries per person</label>
                  <input type="number" min={1} max={20} value={settingsForm.survivor_max_entries ?? 1} onChange={e => setSettingsForm(f => ({ ...f, survivor_max_entries: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Buyback deadline (week)</label>
                  <input type="number" min={1} max={18} value={settingsForm.survivor_buyback_deadline_week ?? ''} placeholder="Off" onChange={e => setSettingsForm(f => ({ ...f, survivor_buyback_deadline_week: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
                <div>
                  <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Max buybacks per person</label>
                  <input type="number" min={1} max={10} value={settingsForm.survivor_max_buybacks ?? ''} placeholder="Off" onChange={e => setSettingsForm(f => ({ ...f, survivor_max_buybacks: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
                Leave buyback fields blank to turn buybacks off.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}

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

      {weekOverride && (
        <div style={{ marginBottom: 20, padding: '10px 16px', background: 'var(--warning-soft)', border: '1px solid rgba(184,114,11,0.25)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={14} /> Admin test view — viewing this league as Week {weekOverride} (real week is {currentWeek}). Remove <code>?week=</code> from the URL to see it live.
        </div>
      )}

      {/* SURVIVOR (primary content for survivor-type leagues) */}
      {isSurvivor && tab === 'survivor' && (
        <SurvivorTab
          leagueId={id}
          currentUserId={user.id}
          isOwner={isOwner}
          season={CURRENT_SEASON}
          currentWeek={effectiveWeek}
          buybackDeadlineWeek={league.survivor_buyback_deadline_week}
          maxBuybacks={league.survivor_max_buybacks}
          maxEntries={league.survivor_max_entries}
          maxCapacity={league.max_capacity}
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
                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(member)}
                    disabled={removingMember === member.user_id}
                    title={`Remove ${member.profiles?.username}`}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <UserMinus size={13} /> Remove
                  </button>
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
