import { useState, useEffect, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Plus, EyeOff, Lock, RotateCcw, DollarSign, Check as CheckIcon, Clock, Trash2, X, AlertTriangle, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isGameLocked, computeEntryStatus, pickOutcome,
  pickableWeeks, teamConflict, teamUsage, weekHighlights,
} from '../lib/survivor';

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
  const [buybacks, setBuybacks] = useState([]);
  const [charges, setCharges] = useState([]);
  const [paidFilter, setPaidFilter] = useState('all');   // all | unpaid | paid
  // Which week each of my entries is currently picking for. Per entry, because
  // you might be filing week 6 on one and this week on another.
  const [pickWeek, setPickWeek] = useState({});
  // A pending "this clears your week N pick" question, or null.
  const [release, setRelease] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState({});

  const weekGames = allGames.filter(g => g.week === currentWeek);
  const buybacksAllowed = buybackDeadlineWeek != null && maxBuybacks != null;
  const entryCap = maxEntries != null ? maxEntries : 1;
  const seasonStarted = currentWeek > 1 || weekGames.some(g => isGameLocked(g));

  const fetchAll = useCallback(async () => {
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

      const { data: buybacksData } = await supabase
        .from('survivor_entry_buybacks')
        .select('*')
        .in('entry_id', entryIds);
      setBuybacks(buybacksData || []);

      // One row per thing owed. RLS hands the owner the whole league and
      // everyone else only their own, so this is the same query either way.
      const { data: chargesData } = await supabase
        .from('survivor_charges')
        .select('*')
        .eq('league_id', leagueId);
      setCharges(chargesData || []);
    } else {
      setPicks([]);
      setBuybacks([]);
      setCharges([]);
    }

    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .eq('season', season)
      .order('game_time');
    setAllGames(gamesData || []);

    setLoading(false);
  }, [leagueId, season]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function picksForEntry(entryId) {
    return picks.filter(p => p.entry_id === entryId);
  }

  function entryBuybacks(entryId) {
    return buybacks.filter(b => b.entry_id === entryId).sort((a, b) => a.week - b.week);
  }

  // Rules live in lib/survivor.js so they can be unit tested without React.
  function computeStatus(entry) {
    return computeEntryStatus({ entry, picks, games: allGames, currentWeek });
  }

  function myBuybackCount(userId) {
    const myEntryIds = new Set(entries.filter(e => e.user_id === userId).map(e => e.id));
    return buybacks.filter(b => myEntryIds.has(b.entry_id)).length;
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

  async function buyBackIn(entry) {
    if (!canBuyBack()) return;
    if (!confirm(`Buy back in? Entry #${entry.entry_number} will resume from Week ${currentWeek}.`)) return;
    const { error } = await supabase.rpc('buy_back_entry', { p_entry_id: entry.id, p_week: currentWeek });
    if (error) { toast.error(error.message); return; }
    toast.success(`Bought back in! Entry #${entry.entry_number} is live again.`);
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

  // Settles one charge, not one entry. An entry with a buyback against it has
  // two, and marking the buy-in paid must not silently clear the rebuy.
  async function toggleCharge(charge) {
    const { error } = await supabase.rpc('set_charge_paid', {
      p_charge_id: charge.id, p_paid: !charge.paid,
    });
    if (error) { toast.error(error.message); return; }
    fetchAll();
  }

  // Everything goes through make_survivor_pick. It owns the rules — kickoff,
  // the team you already spent, and clearing a later pick that held the team
  // you want now — and does the clear and the write in one transaction, which
  // two client calls could not.
  async function submitPick(entryId, game, teamAbbr, week, releaseHeld = false) {
    setSubmitting(s => ({ ...s, [entryId]: true }));
    const { data, error } = await supabase.rpc('make_survivor_pick', {
      p_entry_id: entryId, p_week: week, p_game_id: game.id,
      p_team: teamAbbr, p_release: releaseHeld,
    });
    setSubmitting(s => ({ ...s, [entryId]: false }));
    if (error) { toast.error(error.message); return; }
    if (data?.released_week) {
      toast.success(`${teamAbbr} taken for week ${week}. Week ${data.released_week} now has no pick.`);
    } else {
      toast.success(week === currentWeek ? 'Pick locked in!' : `Filed for week ${week}`);
    }
    fetchAll();
  }

  // Taking back a future pick, rather than being stuck naming some team for a
  // week you are not ready to decide.
  async function removePick(pick) {
    const { error } = await supabase.from('survivor_picks').delete().eq('id', pick.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Week ${pick.week} pick removed`);
    fetchAll();
  }

  if (loading) return <div className="skeleton card" style={{ height: 200 }} />;

  const myEntries = entries.filter(e => e.user_id === currentUserId);
  const withStatus = entries.map(e => ({ ...e, ...computeStatus(e) }));

  // Payment tracker. Sorted by name then entry number so a person's entries
  // sit together — at 71 entries across 37 people, a flat list ordered any
  // other way is unreadable.
  const entryById = Object.fromEntries(entries.map(e => [e.id, e]));
  const paidCount = charges.filter(c => c.paid).length;
  const unpaidCount = charges.length - paidCount;
  const owingPeople = new Set(charges.filter(c => !c.paid).map(c => c.user_id)).size;
  const visibleCharges = charges
    .filter(c => paidFilter === 'all' || (paidFilter === 'paid' ? c.paid : !c.paid))
    .map(c => ({ ...c, entry: entryById[c.entry_id] }))
    .sort((a, b) =>
      (a.entry?.profiles?.username || '').localeCompare(b.entry?.profiles?.username || '') ||
      (a.entry?.entry_number || 0) - (b.entry?.entry_number || 0) ||
      // Buy-in above the rebuys it came before.
      (a.kind === b.kind ? (a.week || 0) - (b.week || 0) : a.kind === 'buy_in' ? -1 : 1));
  // Weeks still open to pick, current one first. More than one only once the
  // schedule has games beyond this week that have not kicked off.
  const weeksOpen = pickableWeeks(allGames, currentWeek);
  const aliveCount = withStatus.filter(e => e.status === 'alive').length;

  // Every team in the season's schedule, so the board can show the ones nobody
  // has touched rather than only the ones that are gone.
  const gamesById = Object.fromEntries(allGames.map(g => [g.id, g]));
  const allTeams = [...new Set(allGames.flatMap(g => [g.home_team_abbr, g.away_team_abbr]))]
    .filter(Boolean).sort();
  const usage = teamUsage({ entries: withStatus, picks, teams: allTeams });
  const highlights = weekHighlights({ entries: withStatus, picks, gamesById, week: currentWeek });
  const usageMax = Math.max(1, ...usage.map(u => u.count));
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
    const rebought = entryBuybacks(entry.id).some(b => b.week === week);
    const rebuyMarker = rebought && (
      <RotateCcw size={10} style={{ color: 'var(--gold)', marginRight: 4 }} aria-label={`Bought back in Week ${week}`} />
    );

    const pick = picksForEntry(entry.id).find(p => p.week === week);
    if (!pick) {
      return (
        <span title={rebought ? `Bought back in this week` : undefined} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {rebuyMarker}<span style={{ color: 'var(--ink-faint)' }}>—</span>
        </span>
      );
    }

    const isMe = entry.user_id === currentUserId;
    if (!isMe && !isGameLocked(pick.games)) {
      return (
        <span title={rebought ? 'Bought back in this week' : undefined} style={{ color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {rebuyMarker}<EyeOff size={11} />
        </span>
      );
    }

    const outcome = pickOutcome(pick);
    // A tie eliminates in this pool, so it has to read as a loss too.
    const isOut = outcome === 'loss' || outcome === 'tie';

    return (
      <span title={rebought ? `Bought back in Week ${week}` : undefined} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {rebuyMarker}
        <span style={{
          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
          color: outcome === 'win' ? 'var(--success)' : isOut ? 'var(--danger)' : 'var(--ink)',
          textDecoration: isOut ? 'line-through' : 'none',
        }}>
          {pick.team_abbr}
        </span>
      </span>
    );
  }

  return (
    <div>
      {/* Asked, not announced. The person is right here having just tapped the
          team, so this is the moment to say what it costs — and the cost is a
          week left empty, which is exactly the week someone filing ahead was
          trying to protect. */}
      {release && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRelease(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ padding: 22, maxWidth: 420 }}>
            <h3 style={{ fontSize: 19, textTransform: 'none', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={17} style={{ color: 'var(--warning)' }} />
              {release.team} is your week {release.heldWeek} pick
            </h3>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 18px' }}>
              Use them in week {release.week} instead? <strong style={{ color: 'var(--ink)' }}>
              Week {release.heldWeek} will be left with no pick</strong>, and a week with no pick
              when its games kick off is an elimination.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setRelease(null)}>Keep week {release.heldWeek}</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const r = release;
                  setRelease(null);
                  submitPick(r.entryId, r.game, r.team, r.week, true);
                }}
              >
                Use {release.team} now
              </button>
            </div>
          </div>
        </div>
      )}
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
              // Team availability is decided per pick-week now, by teamConflict
              // below — a team held by an unlocked pick is offered with a
              // warning rather than simply greyed out.
              const eligible = canBuyBack();

              return (
                <div key={entry.id} className="card" style={{ padding: 20, borderLeft: `3px solid ${status === 'alive' ? 'var(--accent)' : 'var(--danger)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 17 }}>
                        {myEntries.length > 1 ? `Entry #${entry.entry_number}` : 'Your pick'}
                      </div>
                      {entryBuybacks(entry.id).map(b => (
                        <span key={b.id} title={`Bought back in Week ${b.week}`} style={{ display: 'inline-flex' }}>
                          <RotateCcw size={13} style={{ color: 'var(--gold)' }} aria-label={`Bought back in Week ${b.week}`} />
                        </span>
                      ))}
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
                        <button onClick={() => buyBackIn(entry)} className="btn btn-secondary" style={{ marginLeft: 8, padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                  ) : (
                    (() => {
                      // Once this week's pick has locked the only weeks left are
                      // ahead, so default there. Locking used to end the section
                      // outright, which shut the door on filing ahead at exactly
                      // the moment someone is most likely to want to.
                      const openAhead = weeksOpen.filter(w => w !== currentWeek);
                      const fallback = weeksOpen.includes(currentWeek) ? currentWeek : openAhead[0];
                      const wk = pickWeek[entry.id] ?? fallback;
                      const openGames = allGames.filter(g => g.week === wk && !isGameLocked(g));
                      const pickThisWeek = entryPicks.find(p => p.week === wk);
                      const clashFor = team =>
                        teamConflict({ picks, entryId: entry.id, team, week: wk });
                      const choose = (game, team) => {
                        const clash = clashFor(team);
                        // 'planned' is recoverable and needs consent; 'spent' is
                        // already disabled below and never reaches here.
                        if (clash?.kind === 'planned') {
                          setRelease({ entryId: entry.id, game, team, week: wk, heldWeek: clash.week });
                          return;
                        }
                        submitPick(entry.id, game, team, wk);
                      };
                      const laterPicks = entryPicks
                        .filter(p => p.week !== currentWeek && !isGameLocked(p.games))
                        .sort((a, b) => a.week - b.week);

                      if (wk === undefined) {
                        return (
                          <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                            No games left to pick.
                          </div>
                        );
                      }

                      return (
                        <div>
                          {thisWeekPick && locked && (
                            <div style={{ fontSize: 14, marginBottom: 14 }}>
                              <span style={{ color: 'var(--ink-soft)' }}>This week: </span>
                              <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 17 }}>{thisWeekPick.team_abbr}</strong>
                              <span className="badge badge-red" style={{ marginLeft: 10 }}><Lock size={9} style={{ marginRight: 4 }} />Locked</span>
                            </div>
                          )}

                          {/* Filed ahead. Loud on purpose — a plan you have
                              forgotten is how a week ends up empty. */}
                          {laterPicks.length > 0 && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                          background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                              <span className="label-muted">Filed ahead</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                                {laterPicks.map(p => (
                                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                                                            fontSize: 13, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                                                            background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
                                    <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 14 }}>{p.team_abbr}</strong>
                                    <span style={{ color: 'var(--ink-soft)' }}>wk {p.week}</span>
                                    <button onClick={() => removePick(p)} aria-label={`Remove week ${p.week} pick`}
                                            style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <span className="label-muted">Pick a team to win</span>
                            {weeksOpen.length > 1 && (
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {weeksOpen.map(w => (
                                  <button
                                    key={w}
                                    onClick={() => setPickWeek(prev => ({ ...prev, [entry.id]: w }))}
                                    aria-pressed={w === wk}
                                    style={{
                                      padding: '3px 9px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                                      cursor: 'pointer', whiteSpace: 'nowrap',
                                      background: w === wk ? 'var(--accent)' : 'var(--surface)',
                                      color: w === wk ? 'var(--accent-ink)' : 'var(--ink-soft)',
                                      border: `1px solid ${w === wk ? 'var(--accent)' : 'var(--border-strong)'}`,
                                    }}
                                  >
                                    {w === currentWeek ? 'This week' : `Wk ${w}`}
                                    {entryPicks.some(p => p.week === w) && ' ✓'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'grid', gap: 10 }}>
                            {openGames.map(game => (
                              <div key={game.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                                <div className="label-muted" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                  <Clock size={11} /> {formatGameTime(game.game_time)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {[game.away_team_abbr, game.home_team_abbr].map((abbr, i) => (
                                    <Fragment key={abbr}>
                                      {i === 1 && <span style={{ color: 'var(--ink-faint)', fontSize: 12, fontWeight: 600 }}>@</span>}
                                      <TeamButton
                                        abbr={abbr}
                                        name={i === 0 ? game.away_team : game.home_team}
                                        isUsed={clashFor(abbr)?.kind === 'spent'}
                                        isSelected={pickThisWeek?.team_abbr === abbr}
                                        disabled={clashFor(abbr)?.kind === 'spent' || submitting[entry.id]}
                                        onClick={() => choose(game, abbr)}
                                      />
                                    </Fragment>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          {openGames.length === 0 && (
                            <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                              Every game in week {wk} has started.
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* THE WEEK'S PICKS — only once nobody can act on them */}
      {highlights && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 20, marginBottom: 4, textTransform: 'none' }}>
            Week {currentWeek} in a nutshell
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '0 0 14px' }}>
            Shown now that every pick this week has kicked off. Across {highlights.total} live
            {highlights.total === 1 ? ' entry' : ' entries'}.
          </p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="label-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Flame size={12} style={{ color: 'var(--accent)' }} /> Hot pick
              </div>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
                {highlights.hot.team}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
                {highlights.hot.count} of {highlights.total} took them
                {' '}({Math.round(highlights.hot.share * 100)}%)
              </div>
            </div>

            {highlights.risky && (
              <div className="card" style={{ padding: 18 }}>
                <div className="label-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={12} style={{ color: 'var(--warning)' }} /> Risky pick
                </div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
                  {highlights.risky.team}
                  <span style={{ fontSize: 17, color: 'var(--ink-soft)', marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {highlights.risky.moneyline > 0 ? '+' : '−'}{Math.abs(highlights.risky.moneyline)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Longest shot backed — the market gave them {Math.round(highlights.risky.chance * 100)}%
                  {highlights.risky.count > 1 && `, and ${highlights.risky.count} entries took it`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEAM BOARD */}
      {usage.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 20, marginBottom: 4, textTransform: 'none' }}>Teams burned</h3>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '0 0 14px' }}>
            How many live entries have already used each team. Counts a pick only once its
            game has kicked off, so this never gives away what is still to come.
          </p>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'grid', gap: 6,
                          gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))' }}>
              {usage.map(({ team, count }) => (
                <div key={team} title={count === 0 ? `${team} — nobody has used them` : `${team} — used by ${count}`}
                     style={{
                       padding: '7px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center',
                       background: count === 0 ? 'var(--surface)' : 'var(--accent-soft)',
                       border: `1px solid ${count === 0 ? 'var(--border)' : 'var(--accent)'}`,
                       opacity: count === 0 ? 0.55 : 1,
                     }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
                                color: count === 0 ? 'var(--ink-soft)' : 'var(--ink)' }}>
                    {team}
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16, lineHeight: 1.1,
                                fontVariantNumeric: 'tabular-nums',
                                color: count === 0 ? 'var(--ink-faint)'
                                       : count === usageMax ? 'var(--accent-dark)' : 'var(--ink-soft)' }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                      {entryBuybacks(entry.id).map(b => (
                        <span key={b.id} title={`Bought back in Week ${b.week}`} style={{ display: 'inline-flex', marginLeft: 6 }}>
                          <RotateCcw size={11} style={{ color: 'var(--gold)' }} aria-label={`Bought back in Week ${b.week}`} />
                        </span>
                      ))}
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
          {/* The count first. A filter without one just hides the number you
              came to find — and at 71 entries "how many are outstanding" is
              the whole question. */}
          {charges.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
                <strong style={{ color: 'var(--ink)' }}>{paidCount}</strong> of {charges.length} paid
                {unpaidCount > 0 && (
                  <> · <strong style={{ color: 'var(--warning)' }}>{unpaidCount}</strong> outstanding
                    across {owingPeople} {owingPeople === 1 ? 'person' : 'people'}</>
                )}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['all', `All ${charges.length}`], ['unpaid', `Unpaid ${unpaidCount}`], ['paid', `Paid ${paidCount}`]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPaidFilter(key)}
                    aria-pressed={paidFilter === key}
                    style={{
                      padding: '5px 11px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      background: paidFilter === key ? 'var(--accent)' : 'var(--surface)',
                      color: paidFilter === key ? 'var(--accent-ink)' : 'var(--ink-soft)',
                      border: `1px solid ${paidFilter === key ? 'var(--accent)' : 'var(--border-strong)'}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {charges.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>No entries yet.</div>
            ) : visibleCharges.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
                {paidFilter === 'unpaid' ? 'Everything is settled.' : 'Nothing has been paid yet.'}
              </div>
            ) : (
              visibleCharges.map((charge, idx, arr) => (
                <div key={charge.id} style={{
                  padding: '12px 20px', borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                }}>
                  <div style={{ fontSize: 14 }}>
                    <strong>{charge.entry?.profiles?.username || '(unknown)'}</strong>
                    {entries.filter(e => e.user_id === charge.user_id).length > 1 && (
                      <span style={{ color: 'var(--ink-soft)' }}> #{charge.entry?.entry_number}</span>
                    )}
                    {charge.kind === 'buyback' && (
                      <span className="badge badge-gold" style={{ marginLeft: 8, fontSize: 10 }}>
                        Buyback wk {charge.week}
                      </span>
                    )}
                    {charge.paid && charge.paid_at && (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                        Marked paid {new Date(charge.paid_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: charge.paid ? 'var(--success)' : 'var(--ink-soft)', fontWeight: 600 }}>
                    <input type="checkbox" checked={!!charge.paid} onChange={() => toggleCharge(charge)} style={{ width: 16, height: 16 }} />
                    {charge.paid ? 'Paid' : 'Unpaid'}
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
