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
