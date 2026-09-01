import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Plus, EyeOff, Lock, RotateCcw, DollarSign, Check as CheckIcon, Clock, Trash2, X, AlertTriangle, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isGameLocked, computeEntryStatus, pickOutcome,
  pickableWeeks, teamConflict, teamUsage, weekHighlights, groupByPerson,
} from '../lib/survivor';

// One scale for both tables. A username was 15px in the standings and 13px in
// the pick history — the same fact about the same person, rendered two ways on
// one screen. Rows differed in horizontal padding too.
const ROW_PAD_X = 20;
const NAME_SIZE = 14.5;
const SUB_SIZE = 12.5;

/** Games per column in the picker. Four is about a phone screen. */
const GAMES_PER_COLUMN = 4;

const chunk = (xs, n) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function formatGameTime(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * A horizontally scrolling strip with arrows.
 *
 * Native scrolling carries the touch case, which is the one that matters; the
 * arrows exist for a mouse, where there is no swipe. Both drive the same
 * element, so there is no window index to drift out of step with the scroll
 * position.
 */
function Strip({ children, by = 240, label, caption, arrows = 'flank' }) {
  const ref = useRef(null);
  const nudge = dir => ref.current?.scrollBy({ left: dir * by, behavior: 'smooth' });
  const arrow = (dir, icon) => (
    <button
      onClick={() => nudge(dir)}
      aria-label={`${dir < 0 ? 'Previous' : 'Next'} ${label}`}
      style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink-soft)',
      }}
    >
      {icon}
    </button>
  );

  const scroller = (
    <div
      ref={ref}
      className="hide-scrollbar"
      style={{
        display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory',
        flex: 1, minWidth: 0, paddingBottom: 2,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}
    >
      {children}
    </div>
  );

  // Flanking arrows suit a single short row. Over tall content they end up
  // floating beside the middle card and, worse, eat about 64px of width on a
  // phone — width the cards need more than the arrows do.
  if (arrows === 'above') {
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{caption}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {arrow(-1, <ChevronLeft size={13} />)}
            {arrow(1, <ChevronRight size={13} />)}
          </div>
        </div>
        {scroller}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {arrow(-1, <ChevronLeft size={13} />)}
      {scroller}
      {arrow(1, <ChevronRight size={13} />)}
    </div>
  );
}

/**
 * A titled, collapsible block.
 *
 * Every section on this tab is one of these, which is the point: the header
 * spacing used to be set per section by hand and had already drifted — three
 * sections put 4px under the title and let a caption carry the gap, two put 16px
 * and had no caption at all. Making the shell shared means it cannot drift
 * again.
 *
 * Collapse state is remembered per section in localStorage. It is a
 * convenience, not a setting, so a new device simply starts from the defaults.
 */
function Section({ id, title, caption, action, defaultOpen = true, children }) {
  const key = `ua.section.${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? defaultOpen : saved === '1';
    } catch { return defaultOpen; }
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* private browsing */ }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={toggle}
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: 0,
            background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
          }}
        >
          <ChevronRight
            size={17}
            style={{
              color: 'var(--ink-faint)', flexShrink: 0,
              transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s',
            }}
          />
          <h3 style={{ fontSize: 20, textTransform: 'none', margin: 0 }}>{title}</h3>
        </button>
        {action}
      </div>

      {open && (
        <>
          {caption && (
            <p style={{ fontSize: SUB_SIZE, color: 'var(--ink-faint)', margin: '6px 0 14px', lineHeight: 1.55 }}>
              {caption}
            </p>
          )}
          <div style={{ marginTop: caption ? 0 : 14 }}>{children}</div>
        </>
      )}
    </div>
  );
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
  // null means "nobody has said", so the default below can depend on data
  // that has not loaded when this state is created.
  const [showOutChoice, setShowOutChoice] = useState(null);
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

  const people = groupByPerson(withStatus, currentUserId);
  const livePeople = people.filter(p => p.alive > 0);
  const outPeople = people.filter(p => p.alive === 0);
  // Pinning yourself to the top is worth nothing if you are inside the folded
  // half — which is exactly where you are once your last entry dies, and the
  // moment you are most likely to come looking. So the fold opens itself for
  // anyone who is in it, until they close it.
  const showOut = showOutChoice ?? outPeople.some(p => p.isMe);
  const rowProps = {
    currentUserId, currentWeek, isOwner,
    picksForEntry, entryBuybacks, ownerRemoveEntry,
    isChampionEntry: e => e.status === 'alive' && aliveCount === 1 && entries.length > 1,
  };
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
      <Section
        id="entries"
        title="Your entries"
        action={(myEntries.length === 0 || entryCap > 1) && (
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
      >
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
                // minWidth: 0 is load-bearing. This card is a grid item, and a
                // grid item defaults to min-width:auto — it refuses to shrink
                // below its content's intrinsic width. With a horizontal strip
                // inside, that made the card 1268px wide on a 390px phone and
                // scrolled the whole page sideways rather than the strip.
                <div key={entry.id} className="card" style={{ padding: 20, minWidth: 0, borderLeft: `3px solid ${status === 'alive' ? 'var(--accent)' : 'var(--danger)'}` }}>
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

                          <div className="label-muted" style={{ marginBottom: 8 }}>Pick a team to win</div>
                          {/* Eighteen chips in a wrapped row pushed the games
                              off the screen before anyone had picked anything.
                              A strip keeps the row one line deep however far
                              ahead the schedule runs. */}
                          {weeksOpen.length > 1 && (
                            <div style={{ marginBottom: 12 }}>
                              <Strip by={200} label="weeks">
                                {weeksOpen.map(w => (
                                  <button
                                    key={w}
                                    onClick={() => setPickWeek(prev => ({ ...prev, [entry.id]: w }))}
                                    aria-pressed={w === wk}
                                    style={{
                                      flexShrink: 0, scrollSnapAlign: 'start',
                                      padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
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
                              </Strip>
                            </div>
                          )}

                          {/* Sixteen games stacked was most of a phone screen
                              of scrolling before you reached the standings.
                              Four per column, columns scrolling sideways, keeps
                              the whole week about one screen tall — the same
                              trade the pick history table already makes. */}
                          <Strip
                            by={280}
                            label="games"
                            arrows="above"
                            caption={`${openGames.length} game${openGames.length === 1 ? '' : 's'} — swipe for more`}
                          >
                            {chunk(openGames, GAMES_PER_COLUMN).map((column, ci) => (
                              <div key={ci} style={{
                                flexShrink: 0, scrollSnapAlign: 'start',
                                width: 'min(300px, 78vw)',
                                display: 'grid', gap: 10, alignContent: 'start',
                              }}>
                                {column.map(game => (
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
                            ))}
                          </Strip>
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
      </Section>

      {/* THE WEEK'S PICKS — only once nobody can act on them */}
      {highlights && (
        <Section
          id="nutshell"
          title={`Week ${currentWeek} in a nutshell`}
          caption={`Shown now that every pick this week has kicked off. Across ${highlights.total} live ${highlights.total === 1 ? 'entry' : 'entries'}.`}
        >
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
        </Section>
      )}

      {/* TEAM BOARD */}
      {usage.length > 0 && (
        <Section
          id="burned"
          title="Teams burned"
          caption="How many live entries have already used each team. Counts a pick only once its game has kicked off, so this never gives away what is still to come."
        >
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
        </Section>
      )}

      {/* STANDINGS */}
      <Section
        id="standings"
        title="Standings"
        caption={`${aliveCount} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} still alive. Each entry plays on its own — the last one standing wins.`}
      >

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {livePeople.map((person, idx) => (
            <PersonRow
              key={person.user_id}
              person={person}
              last={idx === livePeople.length - 1 && outPeople.length === 0}
              {...rowProps}
            />
          ))}

          {/* The dead pile. Nothing in week one, most of the league by week
              eight — folding it is the only change here that gets more useful
              as the season runs. */}
          {outPeople.length > 0 && (
            <>
              <button
                onClick={() => setShowOutChoice(!showOut)}
                aria-expanded={showOut}
                style={{
                  width: '100%', padding: '12px 20px', cursor: 'pointer', textAlign: 'left',
                  background: 'var(--surface-alt)', border: 'none',
                  borderTop: livePeople.length ? '1px solid var(--border)' : 'none',
                  borderBottom: showOut ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)',
                }}
              >
                <span>
                  {outPeople.length} {outPeople.length === 1 ? 'person' : 'people'} out
                  <span style={{ fontWeight: 400 }}>
                    {' '}({outPeople.reduce((n, p) => n + p.total, 0)}{' '}
                    {outPeople.reduce((n, p) => n + p.total, 0) === 1 ? 'entry' : 'entries'})
                  </span>
                </span>
                <ChevronRight
                  size={15}
                  style={{ transform: showOut ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
                />
              </button>
              {showOut && outPeople.map((person, idx) => (
                <PersonRow
                  key={person.user_id}
                  person={person}
                  last={idx === outPeople.length - 1}
                  {...rowProps}
                />
              ))}
            </>
          )}
        </div>
      </Section>

      {/* PICK HISTORY */}
      {picks.length > 0 && (
        <Section
          id="history"
          title="Pick history"
          caption="Every pick so far. Someone else's is hidden until its game kicks off."
        >
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: `10px ${ROW_PAD_X}px`, color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>Entry</th>
                  {historyWeeks.map(week => (
                    <th key={week} style={{ textAlign: 'center', padding: `10px ${ROW_PAD_X}px`, color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
                      padding: `10px ${ROW_PAD_X}px`, whiteSpace: 'nowrap', fontWeight: 600,
                      fontSize: NAME_SIZE,
                      color: entry.user_id === currentUserId ? 'var(--accent-dark)' : 'var(--ink)',
                    }}>
                      {entry.profiles?.username}
                      {entries.filter(e => e.user_id === entry.user_id).length > 1 && (
                        <span style={{ fontWeight: 400, fontSize: SUB_SIZE, color: 'var(--ink-faint)' }}> #{entry.entry_number}</span>
                      )}
                    </td>
                    {historyWeeks.map(week => (
                      <td key={week} style={{ textAlign: 'center', padding: `10px ${ROW_PAD_X}px` }}>
                        {renderHistoryCell(entry, week)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* PAYMENT TRACKER (owner only) */}
      {isOwner && (
        <Section id="payments" title="Payment tracker">
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
                  padding: `12px ${ROW_PAD_X}px`, borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                }}>
                  <div style={{ fontSize: NAME_SIZE }}>
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
        </Section>
      )}
    </div>
  );
}

/**
 * One person, however many entries they hold.
 *
 * The entries stay individually legible — each keeps its own pick, its own
 * alive/out state and its own elimination week — because the entry is what
 * actually competes. Grouping is only about not printing someone's name three
 * times in a row.
 */
function PersonRow({ person, last, currentUserId, currentWeek, isOwner,
                     picksForEntry, entryBuybacks, ownerRemoveEntry, isChampionEntry }) {
  const isMe = person.user_id === currentUserId;
  const champion = person.entries.some(isChampionEntry);
  const allOut = person.alive === 0;

  return (
    <div style={{
      padding: `13px ${ROW_PAD_X}px`, borderBottom: last ? 'none' : '1px solid var(--border)',
      // nowrap on purpose. With wrap, flexbox takes the free option — it drops
      // the chips to their own line rather than shrinking the name, so the
      // ellipsis never fires and one long username makes a row half again as
      // tall. Removing the escape route is what makes the name give way.
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'nowrap',
      background: isMe ? 'var(--accent-soft)' : allOut ? 'rgba(200,50,44,0.03)' : 'transparent',
      opacity: allOut ? 0.75 : 1,
    }}>
      {/* minWidth: 0 on both the row item and the name is what lets the name
          shrink. Without it a long username refuses to give ground, shoves the
          chips onto their own line and left-aligns them there — one ragged row
          in a list where every other one is a tidy pair. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: '1 1 auto' }}>
        {champion && <Trophy size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} aria-label="Champion" />}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <span
              title={person.username}
              style={{
                fontWeight: 600, fontSize: NAME_SIZE, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: isMe ? 'var(--accent-dark)' : 'var(--ink)',
              }}
            >
              {person.username}
            </span>
            {/* Outside the truncating span, so the one label you always want to
                see is the one thing that cannot be cut off. */}
            {isMe && <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>(you)</span>}
          </div>
          {person.total > 1 && (
            <div style={{ fontSize: SUB_SIZE, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
              {allOut ? `All ${person.total} out` : `${person.alive} of ${person.total} alive`}
            </div>
          )}
        </div>
      </div>

      {/* marginLeft:auto keeps the chips hard right even in the rare case they
          do wrap — a four-entry row on a very narrow screen. */}
      {/* flexShrink: 0 so the chips keep their line and the name yields
          instead. Letting them shrink put two chips up and one orphaned
          underneath, which reads worse than a shortened name — the entries are
          a set and want to be seen as one. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto', flexShrink: 0 }}>
        {person.entries.map(entry => (
          <EntryChip
            key={entry.id}
            entry={entry}
            showNumber={person.total > 1}
            isMine={isMe}
            currentWeek={currentWeek}
            picks={picksForEntry(entry.id)}
            buybacks={entryBuybacks(entry.id)}
            onRemove={isOwner ? () => ownerRemoveEntry(entry) : null}
          />
        ))}
      </div>
    </div>
  );
}

/** One entry: its number, this week's pick if it may be shown, and its fate. */
function EntryChip({ entry, showNumber, isMine, currentWeek, picks, buybacks, onRemove }) {
  const pick = picks.find(p => p.week === currentWeek);
  const visible = isMine || (pick && isGameLocked(pick.games));
  const out = entry.status !== 'alive';

  return (
    <span
      title={out ? `Out in week ${entry.week}${entry.reason === 'missed' ? ' — missed pick' : ''}` : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12.5,
        background: out ? 'transparent' : 'var(--surface-alt)',
        border: `1px solid ${out ? 'var(--border)' : 'var(--border-strong)'}`,
        color: out ? 'var(--ink-faint)' : 'var(--ink)',
      }}
    >
      {showNumber && <span style={{ color: 'var(--ink-faint)' }}>#{entry.entry_number}</span>}

      {buybacks.map(b => (
        <RotateCcw key={b.id} size={10} style={{ color: 'var(--gold)' }} aria-label={`Bought back in week ${b.week}`} />
      ))}

      {out ? (
        <span style={{ whiteSpace: 'nowrap' }}>
          out wk {entry.week}{entry.reason === 'missed' ? '*' : ''}
        </span>
      ) : visible && pick ? (
        <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 14 }}>{pick.team_abbr}</strong>
      ) : pick ? (
        <EyeOff size={11} style={{ color: 'var(--ink-faint)' }} aria-label="Hidden until kickoff" />
      ) : (
        <span style={{ color: 'var(--ink-faint)' }}>—</span>
      )}

      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove entry #${entry.entry_number}`}
                style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <Trash2 size={11} />
        </button>
      )}
    </span>
  );
}
