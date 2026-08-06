import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Plus, EyeOff, Lock, RotateCcw, DollarSign, Check as CheckIcon, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function formatGameTime(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function TeamButton({ abbr, name, isUsed, isSelected, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={isUsed ? `${name} — already used` : name}
      style={{
        flex: 1,
        padding: '10px 12px',
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
}

export default function SurvivorTab({ leagueId, currentUserId, isOwner, season, currentWeek, buybackDeadlineWeek, maxBuybacks, maxEntries, maxCapacity }) {
  const [entries, setEntries] = useState([]);
  const [picks, setPicks] = useState([]);
  const [weekGames, setWeekGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState({});

  const buybacksAllowed = buybackDeadlineWeek != null && maxBuybacks != null;
  const entryCap = maxEntries != null ? maxEntries : 1;
  const seasonStarted = currentWeek > 1 || weekGames.some(isGameLocked);

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
    const entryPicks = picksForEntry(entry.id).sort((a, b) => a.week - b.week);

    for (const pick of entryPicks) {
      const g = pick.games;
      if (g?.status === 'final' && g.home_score !== null && g.away_score !== null) {
        const tie = g.home_score === g.away_score;
        const pickedHome = pick.team_abbr === g.home_team_abbr;
        const won = !tie && (pickedHome ? g.home_score > g.away_score : g.away_score > g.home_score);
        if (!won) return { status: 'eliminated', week: pick.week, reason: 'loss' };
      }
    }

    // Missed-pick check: only evaluated prospectively for the current week,
    // once every game that week has kicked off with no pick on record.
    const hasCurrentWeekPick = entryPicks.some(p => p.week === currentWeek);
    if (!hasCurrentWeekPick && weekGames.length > 0 && weekGames.every(isGameLocked)) {
      return { status: 'eliminated', week: currentWeek, reason: 'missed' };
    }

    return { status: 'alive', week: null, reason: null };
  }

  function usedTeams(entry) {
    const entryPicks = picksForEntry(entry.id);
    return new Set(
      entryPicks
        .filter(p => p.week !== currentWeek || isGameLocked(p.games))
        .map(p => p.team_abbr)
    );
  }

  function myBuybackCount(userId) {
    return entries.filter(e => e.user_id === userId && e.is_buyback).length;
  }

  function myEntryCount(userId) {
    return entries.filter(e => e.user_id === userId).length;
  }

  function leagueFull() {
    return maxCapacity != null && entries.length >= maxCapacity;
  }

  function canAddEntry() {
    if (seasonStarted) return false;
    if (leagueFull()) return false;
    return myEntryCount(currentUserId) < entryCap;
  }

  function canBuyBack() {
    if (!buybacksAllowed) return false;
    if (currentWeek > buybackDeadlineWeek) return false;
    if (leagueFull()) return false;
    return myBuybackCount(currentUserId) < maxBuybacks;
  }

  async function addEntry() {
    if (!canAddEntry()) return;
    if (!confirm('Buy an additional entry for this survivor pool?')) return;
    const mine = entries.filter(e => e.user_id === currentUserId);
    const nextNum = mine.length > 0 ? Math.max(...mine.map(e => e.entry_number)) + 1 : 1;
    const { error } = await supabase.from('survivor_entries').insert({ league_id: leagueId, user_id: currentUserId, entry_number: nextNum });
    if (error) { toast.error(error.message); return; }
    toast.success(`Entry #${nextNum} added!`);
    fetchAll();
  }

  async function buyBackIn() {
    if (!canBuyBack()) return;
    if (!confirm('Buy back in with a new entry?')) return;
    const mine = entries.filter(e => e.user_id === currentUserId);
    const nextNum = mine.length > 0 ? Math.max(...mine.map(e => e.entry_number)) + 1 : 1;
    const { error } = await supabase.from('survivor_entries').insert({ league_id: leagueId, user_id: currentUserId, entry_number: nextNum, is_buyback: true });
    if (error) { toast.error(error.message); return; }
    toast.success(`Bought back in! Entry #${nextNum} is live.`);
    fetchAll();
  }

  async function deleteMyEntry(entry) {
    if (!confirm(`Remove entry #${entry.entry_number}? This can't be undone.`)) return;
    const { error } = await supabase.from('survivor_entries').delete().eq('id', entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Entry removed');
    fetchAll();
  }

  async function ownerRemoveEntry(entry) {
    if (!confirm(`Remove ${entry.profiles?.username}'s entry #${entry.entry_number}? This can't be undone.`)) return;
    const { error } = await supabase.rpc('owner_remove_entry', { p_entry_id: entry.id });
    if (error) { toast.error(error.message); return; }
    toast.success('Entry removed');
    fetchAll();
  }

  async function togglePaid(entry) {
    const { error } = await supabase.from('survivor_entries').update({ paid: !entry.paid }).eq('id', entry.id);
    if (error) { toast.error(error.message); return; }
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, paid: !e.paid } : e));
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

  if (loading) return <div className="skeleton card" style={{ height: 200 }} />;

  const myEntries = entries.filter(e => e.user_id === currentUserId);
  const withStatus = entries.map(e => ({ ...e, ...computeStatus(e) }));
  const aliveCount = withStatus.filter(e => e.status === 'alive').length;
  const sorted = [...withStatus].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
    if (a.status === 'eliminated') return (b.week || 0) - (a.week || 0);
    return 0;
  });

  const historyEntries = [...withStatus].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'alive' ? -1 : 1;
    return (a.profiles?.username || '').localeCompare(b.profiles?.username || '') || a.entry_number - b.entry_number;
  });
  const historyWeeks = Array.from(new Set(picks.map(p => p.week))).sort((a, b) => a - b);

  function renderHistoryCell(entry, week) {
    const pick = picksForEntry(entry.id).find(p => p.week === week);
    if (!pick) return <span style={{ color: 'var(--ink-faint)' }}>—</span>;

    const isMe = entry.user_id === currentUserId;
    if (!isMe && !isGameLocked(pick.games)) {
      return <span style={{ color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><EyeOff size={11} /></span>;
    }

    const g = pick.games;
    let outcome = null;
    if (g?.status === 'final' && g.home_score !== null && g.away_score !== null) {
      const tie = g.home_score === g.away_score;
      const pickedHome = pick.team_abbr === g.home_team_abbr;
      outcome = tie ? 'tie' : (pickedHome ? g.home_score > g.away_score : g.away_score > g.home_score) ? 'win' : 'loss';
    }

    return (
      <span style={{
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
        color: outcome === 'win' ? 'var(--success)' : outcome === 'loss' ? 'var(--danger)' : 'var(--ink)',
        textDecoration: outcome === 'loss' ? 'line-through' : 'none',
      }}>
        {pick.team_abbr}
      </span>
    );
  }

  return (
    <div>
      {/* YOUR ENTRIES */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 20, textTransform: 'none' }}>Your entries</h3>
          {(myEntries.length === 0 || entryCap > 1) && (
            <button
              className="btn btn-secondary"
              onClick={addEntry}
              disabled={myEntries.length > 0 && !canAddEntry()}
              title={seasonStarted ? 'Entries closed — the season has started' : leagueFull() ? 'This league is full' : entryCap <= myEntryCount(currentUserId) ? `Max ${entryCap} entries per person` : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}
            >
              <Plus size={14} /> {myEntries.length === 0 ? 'Add entry' : 'Buy additional entry'}
            </button>
          )}
        </div>
        {myEntries.length > 0 && entryCap > 1 && (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16 }}>
            {seasonStarted
              ? 'Entries are closed — the season has started.'
              : `${myEntryCount(currentUserId)} / ${entryCap} entries used.`}
          </div>
        )}
        {myEntries.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
            No entries yet. Add one to start picking.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {myEntries.map(entry => {
              const { status, week: outWeek, reason } = computeStatus(entry);
              const entryPicks = picksForEntry(entry.id);
              const thisWeekPick = entryPicks.find(p => p.week === currentWeek);
              const locked = thisWeekPick && isGameLocked(thisWeekPick.games);
              const used = usedTeams(entry);
              const eligible = canBuyBack();

              return (
                <div key={entry.id} className="card" style={{ padding: 20, borderLeft: `3px solid ${status === 'alive' ? 'var(--accent)' : 'var(--danger)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 17 }}>
                        {myEntries.length > 1 ? `Entry #${entry.entry_number}` : 'Your pick'}
                      </div>
                      {entry.is_buyback && <span className="badge badge-gold">Buyback</span>}
                      {entry.paid
                        ? <span className="badge badge-green"><CheckIcon size={9} style={{ marginRight: 3 }} />Paid</span>
                        : <span className="badge" style={{ background: 'var(--surface-alt)', color: 'var(--ink-faint)', border: '1px solid var(--border)' }}>Unpaid</span>
                      }
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={status === 'alive' ? 'badge badge-lime' : 'badge badge-red'}>
                        {status === 'alive' ? 'Alive' : 'Eliminated'}
                      </span>
                      {entryPicks.length === 0 && (
                        <button
                          onClick={() => deleteMyEntry(entry)}
                          title="Remove this entry — added by mistake"
                          style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', display: 'flex', padding: 2 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {status === 'eliminated' ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      Out since Week {outWeek}{reason === 'missed' ? ' (missed pick)' : ''}.
                      {' '}
                      {eligible ? (
                        <button onClick={buyBackIn} className="btn btn-secondary" style={{ marginLeft: 8, padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <RotateCcw size={12} /> Buy back in
                        </button>
                      ) : buybacksAllowed ? (
                        currentWeek > buybackDeadlineWeek
                          ? `Buyback window closed after Week ${buybackDeadlineWeek}.`
                          : `You've used all ${maxBuybacks} buyback${maxBuybacks !== 1 ? 's' : ''}.`
                      ) : (
                        'Buybacks are not enabled for this league.'
                      )}
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
                      <div style={{ display: 'grid', gap: 10 }}>
                        {weekGames.filter(g => !isGameLocked(g)).map(game => (
                          <div key={game.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                            <div className="label-muted" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                              <Clock size={11} /> {formatGameTime(game.game_time)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamButton
                                abbr={game.away_team_abbr}
                                name={game.away_team}
                                isUsed={used.has(game.away_team_abbr)}
                                isSelected={thisWeekPick?.team_abbr === game.away_team_abbr}
                                disabled={used.has(game.away_team_abbr) || submitting[entry.id]}
                                onClick={() => submitPick(entry.id, game, game.away_team_abbr)}
                              />
                              <span style={{ color: 'var(--ink-faint)', fontSize: 12, fontWeight: 600 }}>@</span>
                              <TeamButton
                                abbr={game.home_team_abbr}
                                name={game.home_team}
                                isUsed={used.has(game.home_team_abbr)}
                                isSelected={thisWeekPick?.team_abbr === game.home_team_abbr}
                                disabled={used.has(game.home_team_abbr) || submitting[entry.id]}
                                onClick={() => submitPick(entry.id, game, game.home_team_abbr)}
                              />
                            </div>
                          </div>
                        ))}
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
      <div style={{ marginBottom: isOwner ? 32 : 0 }}>
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
                      {entry.is_buyback && <span style={{ color: 'var(--gold)', fontSize: 11, marginLeft: 6 }}>buyback</span>}
                      {isMe && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}
                    </div>
                    {entry.status === 'eliminated' && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Out — Week {entry.week}{entry.reason === 'missed' ? ' (missed pick)' : ''}</div>
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
                  {isOwner && (
                    <button
                      onClick={() => ownerRemoveEntry(entry)}
                      title={`Remove ${entry.profiles?.username}'s entry #${entry.entry_number}`}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', display: 'flex', padding: 2 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PICK HISTORY */}
      {picks.length > 0 && (
        <div style={{ marginBottom: isOwner ? 32 : 0 }}>
          <h3 style={{ fontSize: 20, marginBottom: 16, textTransform: 'none' }}>Pick history</h3>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>Entry</th>
                  {historyWeeks.map(week => (
                    <th key={week} style={{ textAlign: 'center', padding: '10px 16px', color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Wk {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((entry, idx) => (
                  <tr key={entry.id} style={{
                    borderBottom: idx === historyEntries.length - 1 ? 'none' : '1px solid var(--border)',
                    opacity: entry.status === 'eliminated' ? 0.6 : 1,
                  }}>
                    <td style={{
                      padding: '10px 16px', whiteSpace: 'nowrap', fontWeight: 600,
                      color: entry.user_id === currentUserId ? 'var(--accent-dark)' : 'var(--ink)',
                    }}>
                      {entry.profiles?.username}
                      {entries.filter(e => e.user_id === entry.user_id).length > 1 && (
                        <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> #{entry.entry_number}</span>
                      )}
                    </td>
                    {historyWeeks.map(week => (
                      <td key={week} style={{ textAlign: 'center', padding: '10px 16px' }}>
                        {renderHistoryCell(entry, week)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENT TRACKER (owner only) */}
      {isOwner && (
        <div>
          <h3 style={{ fontSize: 20, marginBottom: 16, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={18} style={{ color: 'var(--accent)' }} /> Payment tracker
          </h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {entries.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>No entries yet.</div>
            ) : (
              [...entries].sort((a, b) => (a.profiles?.username || '').localeCompare(b.profiles?.username || '') || a.entry_number - b.entry_number).map((entry, idx, arr) => (
                <div key={entry.id} style={{
                  padding: '12px 20px', borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                }}>
                  <div style={{ fontSize: 14 }}>
                    <strong>{entry.profiles?.username}</strong>
                    {entries.filter(e => e.user_id === entry.user_id).length > 1 && <span style={{ color: 'var(--ink-soft)' }}> #{entry.entry_number}</span>}
                    {entry.is_buyback && <span className="badge badge-gold" style={{ marginLeft: 8, fontSize: 10 }}>Buyback</span>}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: entry.paid ? 'var(--success)' : 'var(--ink-soft)', fontWeight: 600 }}>
                    <input type="checkbox" checked={!!entry.paid} onChange={() => togglePaid(entry)} style={{ width: 16, height: 16 }} />
                    {entry.paid ? 'Paid' : 'Unpaid'}
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
