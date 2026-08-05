import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Plus, EyeOff, RotateCcw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SurvivorTab({ leagueId, currentUserId, isOwner, season, currentWeek }) {
  const [entries, setEntries] = useState([]);
  const [picks, setPicks] = useState([]);
  const [weekGames, setWeekGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState({});

  useEffect(() => { fetchAll(); }, [leagueId]);

  async function fetchAll() {
    setLoading(true);
    const { data: entriesData } = await supabase
      .from('survivor_entries')
      .select('*, profiles(username, display_name)')
      .eq('league_id', leagueId)
      .order('user_id').order('entry_number');
    const entriesList = entriesData || [];
    setEntries(entriesList);

    const entryIds = entriesList.map(e => e.id);
    if (entryIds.length > 0) {
      const { data: picksData } = await supabase
        .from('survivor_picks')
        .select('*, games(home_team_abbr, away_team_abbr, home_team, away_team, game_time, status, home_score, away_score)')
        .in('entry_id', entryIds);
      setPicks(picksData || []);
    } else {
      setPicks([]);
    }

    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .eq('week', currentWeek)
      .eq('season', season)
      .order('game_time');
    setWeekGames(gamesData || []);

    setLoading(false);
  }

  function isGameLocked(game) {
    if (!game) return true;
    return new Date() >= new Date(game.game_time);
  }

  function picksForEntry(entryId) {
    return picks.filter(p => p.entry_id === entryId);
  }

  function computeStatus(entry) {
    const entryPicks = picksForEntry(entry.id);
    const cutoff = entry.reactivated_at ? new Date(entry.reactivated_at) : null;
    const relevant = entryPicks
      .filter(p => !cutoff || (p.games?.game_time && new Date(p.games.game_time) > cutoff))
      .sort((a, b) => a.week - b.week);

    for (const pick of relevant) {
      const g = pick.games;
      if (g?.status === 'final' && g.home_score !== null && g.away_score !== null) {
        const tie = g.home_score === g.away_score;
        const pickedHome = pick.team_abbr === g.home_team_abbr;
        const won = !tie && (pickedHome ? g.home_score > g.away_score : g.away_score > g.home_score);
        if (!won) return { status: 'eliminated', week: pick.week };
      }
    }
    return { status: 'alive', week: null };
  }

  function usedTeams(entry) {
    const entryPicks = picksForEntry(entry.id);
    return new Set(
      entryPicks
        .filter(p => p.week !== currentWeek || isGameLocked(p.games))
        .map(p => p.team_abbr)
    );
  }

  async function addEntry() {
    const mine = entries.filter(e => e.user_id === currentUserId);
    const nextNum = mine.length > 0 ? Math.max(...mine.map(e => e.entry_number)) + 1 : 1;
    const { error } = await supabase.from('survivor_entries').insert({ league_id: leagueId, user_id: currentUserId, entry_number: nextNum });
    if (error) { toast.error(error.message); return; }
    toast.success(`Entry #${nextNum} added!`);
    fetchAll();
  }

  async function submitPick(entryId, game, teamAbbr) {
    setSubmitting(s => ({ ...s, [entryId]: true }));
    const { error } = await supabase.from('survivor_picks').upsert({
      entry_id: entryId, season, week: currentWeek, game_id: game.id, team_abbr: teamAbbr,
    }, { onConflict: 'entry_id,week' });
    setSubmitting(s => ({ ...s, [entryId]: false }));
    if (error) { toast.error(error.message); return; }
    toast.success('Pick locked in!');
    fetchAll();
  }

  async function reactivate(entryId) {
    if (!confirm("Reactivate this entry? It rejoins starting next week's pick.")) return;
    const { error } = await supabase.from('survivor_entries').update({ reactivated_at: new Date().toISOString() }).eq('id', entryId);
    if (error) { toast.error(error.message); return; }
    toast.success('Entry reactivated!');
    fetchAll();
  }

  if (loading) return <div className="skeleton card" style={{ height: 200 }} />;

  const myEntries = entries.filter(e => e.user_id === currentUserId);
  const withStatus = entries.map(e => ({ ...e, ...computeStatus(e) }));
  const aliveCount = withStatus.filter(e => e.status === 'alive').length;
  const sorted = [...withStatus].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
    if (a.status === 'eliminated') return (b.week || 0) - (a.week || 0);
    return 0;
  });

  return (
    <div>
      {/* YOUR ENTRIES */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, textTransform: 'none' }}>Your entries</h3>
          <button className="btn btn-secondary" onClick={addEntry} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}>
            <Plus size={14} /> Add entry
          </button>
        </div>
        {myEntries.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No entries yet. Add one to start picking.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {myEntries.map(entry => {
              const { status, week: outWeek } = computeStatus(entry);
              const entryPicks = picksForEntry(entry.id);
              const thisWeekPick = entryPicks.find(p => p.week === currentWeek);
              const locked = thisWeekPick && isGameLocked(thisWeekPick.games);
              const used = usedTeams(entry);

              return (
                <div key={entry.id} className="card" style={{ padding: 20, borderLeft: `3px solid ${status === 'alive' ? 'var(--accent)' : 'var(--danger)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 17 }}>
                      {myEntries.length > 1 ? `Entry #${entry.entry_number}` : 'Your pick'}
                    </div>
                    <span className={status === 'alive' ? 'badge badge-lime' : 'badge badge-red'}>
                      {status === 'alive' ? 'Alive' : 'Eliminated'}
                    </span>
                  </div>

                  {status === 'eliminated' ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      Out since Week {outWeek}. {isOwner ? 'You can reactivate below.' : 'Waiting on the commissioner…'}
                    </div>
                  ) : thisWeekPick && locked ? (
                    <div style={{ fontSize: 14 }}>
                      <span style={{ color: 'var(--ink-soft)' }}>This week: </span>
                      <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 17 }}>{thisWeekPick.team_abbr}</strong>
                      <span className="badge badge-red" style={{ marginLeft: 10 }}><Lock size={9} style={{ marginRight: 4 }} />Locked</span>
                    </div>
                  ) : (
                    <div>
                      <div className="label-muted" style={{ marginBottom: 10 }}>
                        Pick a team to win — Week {currentWeek}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {weekGames.filter(g => !isGameLocked(g)).flatMap(g => [
                          { abbr: g.away_team_abbr, name: g.away_team, game: g },
                          { abbr: g.home_team_abbr, name: g.home_team, game: g },
                        ]).map(({ abbr, name, game }) => {
                          const isUsed = used.has(abbr);
                          const isSelected = thisWeekPick?.team_abbr === abbr;
                          return (
                            <button
                              key={abbr}
                              disabled={isUsed || submitting[entry.id]}
                              onClick={() => submitPick(entry.id, game, abbr)}
                              title={isUsed ? `${name} — already used` : name}
                              style={{
                                padding: '10px 16px',
                                borderRadius: 'var(--radius-sm)',
                                background: isSelected ? 'var(--accent)' : isUsed ? 'var(--surface-alt)' : 'var(--surface)',
                                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-strong)'}`,
                                color: isSelected ? 'var(--accent-ink)' : isUsed ? 'var(--ink-faint)' : 'var(--ink)',
                                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 15,
                                cursor: isUsed ? 'not-allowed' : 'pointer',
                                opacity: isUsed ? 0.6 : 1,
                                textDecoration: isUsed ? 'line-through' : 'none',
                              }}
                            >
                              {abbr}
                            </button>
                          );
                        })}
                      </div>
                      {weekGames.filter(g => !isGameLocked(g)).length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>All of this week's games have started.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STANDINGS */}
      <div>
        <h3 style={{ fontSize: 20, marginBottom: 16, textTransform: 'none' }}>Standings</h3>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sorted.map((entry, idx) => {
            const isMe = entry.user_id === currentUserId;
            const entryPicks = picksForEntry(entry.id);
            const thisWeekPick = entryPicks.find(p => p.week === currentWeek);
            const canSeePick = isMe || (thisWeekPick && isGameLocked(thisWeekPick.games));
            const isChampion = entry.status === 'alive' && aliveCount === 1 && entries.length > 1;

            return (
              <div key={entry.id} style={{
                padding: '14px 20px', borderBottom: idx === sorted.length - 1 ? 'none' : '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                background: isMe ? 'var(--accent-soft)' : entry.status === 'eliminated' ? 'rgba(200,50,44,0.03)' : 'transparent',
                opacity: entry.status === 'eliminated' ? 0.75 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isChampion && <Trophy size={18} style={{ color: 'var(--gold)' }} aria-label="Champion" />}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: isMe ? 'var(--accent-dark)' : 'var(--ink)' }}>
                      {entry.profiles?.username}
                      {entries.filter(e => e.user_id === entry.user_id).length > 1 && (
                        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}> #{entry.entry_number}</span>
                      )}
                      {isMe && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}
                    </div>
                    {entry.status === 'eliminated' && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Out — Week {entry.week}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    {canSeePick && thisWeekPick ? (
                      <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 15 }}>{thisWeekPick.team_abbr}</strong>
                    ) : thisWeekPick ? (
                      <span style={{ color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 4 }}><EyeOff size={11} /> hidden</span>
                    ) : (
                      <span style={{ color: 'var(--ink-faint)' }}>—</span>
                    )}
                  </div>
                  <span className={entry.status === 'alive' ? 'badge badge-lime' : 'badge badge-red'} style={{ fontSize: 10 }}>
                    {entry.status === 'alive' ? 'Alive' : 'Out'}
                  </span>
                  {isOwner && entry.status === 'eliminated' && (
                    <button onClick={() => reactivate(entry.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RotateCcw size={12} /> Revive
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
