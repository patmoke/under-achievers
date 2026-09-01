import { impliedProbability } from './odds';

// Pure survivor-pool rules, kept free of React and Supabase so they can be
// unit tested directly. SurvivorTab renders these results; it doesn't decide
// them.
//
// Every function takes `now` explicitly rather than calling Date.now(), so
// tests can place themselves at any point in a season.

/**
 * A game is locked once kickoff has passed. A missing game is treated as
 * locked — we can't prove it's still open, and the safe default is to stop
 * accepting picks for it.
 */
export function isGameLocked(game, now = new Date()) {
  if (!game) return true;
  // Guard against being passed straight to .some()/.every()/.filter(), where
  // the array index would arrive as `now` and silently make every game read as
  // unlocked. Only a real Date is honoured.
  const at = now instanceof Date ? now : new Date();
  return at >= new Date(game.game_time);
}

/**
 * The teams an entry may no longer pick. A team is burned once the pick that
 * used it has locked; a pick for the current week that hasn't kicked off yet
 * is still changeable, so it doesn't burn the team.
 */
export function usedTeams({ entry, picks, currentWeek, now = new Date() }) {
  return new Set(
    picksForEntry(picks, entry.id)
      .filter(p => p.week !== currentWeek || isGameLocked(p.games, now))
      .map(p => p.team_abbr)
  );
}

function picksForEntry(picks, entryId) {
  return picks.filter(p => p.entry_id === entryId);
}

/**
 * Grades a single pick against its game. Returns 'win' | 'loss' | 'tie' | null
 * (null = not final yet). A tie counts as a loss in this pool, which is the
 * league setting chosen for this app.
 */
export function pickOutcome(pick) {
  const g = pick?.games;
  if (!g || g.status !== 'final' || g.home_score === null || g.away_score === null) return null;
  if (g.home_score === g.away_score) return 'tie';
  const pickedHome = pick.team_abbr === g.home_team_abbr;
  const won = pickedHome ? g.home_score > g.away_score : g.away_score > g.home_score;
  return won ? 'win' : 'loss';
}

/**
 * Whether an entry is still alive, and if not, when and why it went out.
 *
 * Two ways to go out, checked in chronological order:
 *   1. a pick that lost (or tied) once that game is final
 *   2. a week that fully kicked off with no pick on record
 *
 * Both scans start at the entry's `start_week` rather than week 1. A buyback
 * advances start_week, which is what forgives the life that ended before it —
 * without that, a rebought entry would be re-eliminated forever by the loss
 * it already paid to undo, and would also read as having "missed" every week
 * before it re-entered.
 *
 * `games` must cover the whole season, not just the current week: the missed
 * check needs to know whether older weeks have fully kicked off.
 */
export function computeEntryStatus({ entry, picks, games, currentWeek, now = new Date() }) {
  const startWeek = entry.start_week || 1;
  const entryPicks = picksForEntry(picks, entry.id)
    .filter(p => p.week >= startWeek)
    .sort((a, b) => a.week - b.week);

  for (const pick of entryPicks) {
    const outcome = pickOutcome(pick);
    if (outcome === 'loss' || outcome === 'tie') {
      return { status: 'eliminated', week: pick.week, reason: 'loss' };
    }
  }

  const pickedWeeks = new Set(entryPicks.map(p => p.week));
  for (let w = startWeek; w <= currentWeek; w++) {
    if (pickedWeeks.has(w)) continue;
    const gamesForWeek = games.filter(g => g.week === w);
    if (gamesForWeek.length > 0 && gamesForWeek.every(g => isGameLocked(g, now))) {
      return { status: 'eliminated', week: w, reason: 'missed' };
    }
  }

  return { status: 'alive', week: null, reason: null };
}

// ─── Advance picks ──────────────────────────────────────────────────────────
//
// A pick can be filed for any week whose game has not kicked off, not just the
// week in front of you — for the person who knows they will be away. The rules
// below are the ones that only start to matter once that is possible.

/**
 * The weeks you can file a pick for right now.
 *
 * Any week from the current one up to the last that still has an unstarted
 * game. A week whose games have all kicked off is not offered, because there is
 * nothing left in it to pick.
 */
export function pickableWeeks(games, currentWeek, now = new Date()) {
  const weeks = new Set();
  for (const game of games) {
    if (game.week >= currentWeek && !isGameLocked(game, now)) weeks.add(game.week);
  }
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Whether a team is already claimed by one of this entry's other picks.
 *
 * Two very different answers, and collapsing them would be a bug:
 *
 *   'spent'   the pick using that team has locked. Gone for the season — this
 *             is the rule that makes survivor survivor, and nothing softens it.
 *   'planned' the pick using that team has not kicked off. Still recoverable:
 *             the week in front of you wins and the later plan is cleared.
 *
 * There is a unique index on (entry_id, team_abbr) behind all this, so a
 * 'planned' clash is not merely untidy — left alone it fails on a constraint.
 */
export function teamConflict({ picks, entryId, team, week, now = new Date() }) {
  const clash = picks.find(p =>
    p.entry_id === entryId && p.team_abbr === team && p.week !== week);
  if (!clash) return null;
  return {
    kind: isGameLocked(clash.games, now) ? 'spent' : 'planned',
    week: clash.week,
  };
}

// ─── What the field is doing ────────────────────────────────────────────────

/** Alive entries only. Everything below is about who is still playing. */
const aliveIds = (entries, statusOf) =>
  new Set(entries.filter(e => (statusOf ? statusOf(e) : e.status) === 'alive').map(e => e.id));

/**
 * How many still-alive entries have burned each team.
 *
 * Counts locked picks only. An unlocked pick is nobody else's business yet, and
 * counting it here would leak through the back door what the pick history is
 * careful to hide — thirty entries on one team is not hard to read.
 *
 * Teams nobody has used are included with a count of zero, because the useful
 * question is usually "who is left" rather than "who is gone".
 */
export function teamUsage({ entries, picks, teams, statusOf, now = new Date() }) {
  const alive = aliveIds(entries, statusOf);
  const counts = new Map((teams || []).map(t => [t, 0]));
  for (const pick of picks) {
    if (!alive.has(pick.entry_id)) continue;
    if (!isGameLocked(pick.games, now)) continue;
    counts.set(pick.team_abbr, (counts.get(pick.team_abbr) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
}

/**
 * Whether every alive entry's pick for a week has kicked off.
 *
 * The gate for showing the week's hot and risky picks. Until it is true,
 * publishing either one would hand a live edge to anyone still deciding.
 *
 * An entry with no pick at all does not hold this open: they are about to be
 * eliminated for missing the week, and waiting on them would mean waiting
 * forever.
 */
export function weekLockedIn({ entries, picks, week, statusOf, now = new Date() }) {
  const alive = aliveIds(entries, statusOf);
  const forWeek = picks.filter(p => p.week === week && alive.has(p.entry_id));
  if (forWeek.length === 0) return false;
  return forWeek.every(p => isGameLocked(p.games, now));
}

/** The moneyline on the team a pick backs, or null when the game is unpriced. */
function moneylineFor(pick, game) {
  if (!game) return null;
  if (pick.team_abbr === game.home_team_abbr) return game.home_moneyline ?? null;
  if (pick.team_abbr === game.away_team_abbr) return game.away_moneyline ?? null;
  return null;
}

/**
 * The week's most-backed team, and its longest shot.
 *
 * Returns null until every alive entry's pick has kicked off — see
 * weekLockedIn. Risk is measured by the market's own implied probability
 * rather than the raw American number, because +150 and −110 cannot be
 * compared as integers.
 */
export function weekHighlights({ entries, picks, gamesById, week, statusOf, now = new Date() }) {
  if (!weekLockedIn({ entries, picks, week, statusOf, now })) return null;

  const alive = aliveIds(entries, statusOf);
  const forWeek = picks.filter(p => p.week === week && alive.has(p.entry_id));
  if (forWeek.length === 0) return null;

  const counts = new Map();
  for (const p of forWeek) counts.set(p.team_abbr, (counts.get(p.team_abbr) || 0) + 1);

  const [hotTeam, hotCount] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  let risky = null;
  for (const [team] of counts) {
    const pick = forWeek.find(p => p.team_abbr === team);
    const line = moneylineFor(pick, gamesById[pick.game_id]);
    const chance = impliedProbability(line);
    if (chance === null) continue;
    if (!risky || chance < risky.chance) {
      risky = { team, moneyline: line, chance, count: counts.get(team) };
    }
  }

  return {
    hot: { team: hotTeam, count: hotCount, share: hotCount / forWeek.length },
    risky,
    total: forWeek.length,
  };
}

/**
 * The standings, one row per person rather than one per entry.
 *
 * The entry stays the unit of competition — the prize is the last entry
 * standing, not the last person — so this is a display grouping and the
 * per-entry status has to survive it. What it fixes is that three rows for one
 * person misrepresents them: they are one competitor holding three lives.
 *
 * Sorted so the answer to "where am I" is the top row, then by who has the most
 * lives left, then by whose last entry died most recently — which keeps the
 * fresh casualties above the week-one dead.
 */
export function groupByPerson(entries, currentUserId) {
  const byUser = new Map();
  for (const entry of entries) {
    if (!byUser.has(entry.user_id)) {
      byUser.set(entry.user_id, {
        user_id: entry.user_id,
        username: entry.profiles?.username || '(unnamed)',
        isMe: entry.user_id === currentUserId,
        entries: [],
      });
    }
    byUser.get(entry.user_id).entries.push(entry);
  }

  return [...byUser.values()]
    .map(person => {
      const sorted = [...person.entries].sort((a, b) => a.entry_number - b.entry_number);
      const out = sorted.filter(e => e.status !== 'alive');
      return {
        ...person,
        entries: sorted,
        alive: sorted.length - out.length,
        total: sorted.length,
        lastOut: out.length ? Math.max(...out.map(e => e.week || 0)) : 0,
      };
    })
    .sort((a, b) =>
      (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0) ||
      b.alive - a.alive ||
      b.lastOut - a.lastOut ||
      a.username.localeCompare(b.username));
}
