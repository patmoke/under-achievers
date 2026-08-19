// NFL season anchor dates per season year
const NFL_SEASON_START_DATES = {
  2025: new Date('2025-09-04T00:00:00'), // actual 2025 kickoff
  2026: new Date('2026-09-10T00:00:00'), // estimated 2026 kickoff
};

// Returns the current NFL week number (1–18), or 1 if in offseason
export function getCurrentNFLWeek(season = 2026) {
  const seasonStart = NFL_SEASON_START_DATES[season];
  if (!seasonStart) return 1;

  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekFloat = (now - seasonStart) / msPerWeek;

  if (weekFloat < 0) return 1;          // Before season starts → Week 1
  const week = Math.floor(weekFloat) + 1;
  return Math.min(Math.max(week, 1), 18); // Clamp between 1 and 18
}

/**
 * Derives the current week from the real schedule instead of counting weeks
 * off a hardcoded kickoff date.
 *
 * The current week is the one containing the next game that hasn't started —
 * during a Sunday slate the already-kicked-off games are still "this week".
 *
 * The rollover is therefore the moment the week's last game *kicks off*, not
 * the moment it ends: for the three hours Monday Night Football is being
 * played, this already reads as next week. Nothing is graded or locked off
 * this, so it's a display question rather than a correctness one — but it is
 * the behaviour, and season.test.js pins it so a change has to be deliberate.
 *
 * Falls back to null when there's no schedule to read, so callers can use the
 * date-based estimate instead.
 *
 * Pass only regular-season games for the season in question; playoff and
 * scratch/QA rows carry week numbers outside 1-18 and are ignored.
 */
export function deriveCurrentWeek(games, now = new Date()) {
  const regular = (games || []).filter(g => g.week >= 1 && g.week <= 18 && g.game_time);
  if (regular.length === 0) return null;

  const upcoming = regular
    .filter(g => new Date(g.game_time) > now)
    .sort((a, b) => new Date(a.game_time) - new Date(b.game_time));

  if (upcoming.length > 0) return upcoming[0].week;
  return Math.max(...regular.map(g => g.week)); // season finished
}

// Returns true if we're currently in the NFL regular season
export function isNFLSeason(season = 2026) {
  const seasonStart = NFL_SEASON_START_DATES[season];
  if (!seasonStart) return false;
  const seasonEnd = new Date(seasonStart.getTime() + 18 * 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return now >= seasonStart && now <= seasonEnd;
}

// ─── Confidence budget ──────────────────────────────────────────────────────
//
// Confidence multiplies the points a pick earns, and base points are always
// positive, so an unlimited multiplier makes "max everything" strictly
// optimal — no decision, and a hidden edge for whoever notices. Instead each
// week hands out a fixed pool of stars to spread across that week's games.
//
// Two stars per game means you could put x2 on everything, or bank x1s to
// afford a few x5s. Picking fewer games doesn't concentrate the pool, because
// each game is still capped at CONFIDENCE_MAX.

export const CONFIDENCE_MIN = 1;
export const CONFIDENCE_MAX = 5;

export function confidenceBudget(gameCount) {
  return gameCount * 2;
}

/** Stars committed so far. Only games with an actual pick cost anything. */
export function confidenceSpent(confidenceByGame, pickedGameIds) {
  return pickedGameIds.reduce(
    (sum, id) => sum + (confidenceByGame[id] || CONFIDENCE_MIN),
    0
  );
}

/**
 * Stars free to spend above the compulsory minimums.
 *
 * Every game has to be picked, and a pick costs at least one star, so the
 * games still outstanding have a claim on the budget before anything else
 * does. Without holding that back, someone could pour the whole budget into
 * the first few games and then be unable to afford the games they're still
 * required to pick.
 */
export function starsAvailable({ budget, spent, unpickedCount }) {
  return budget - spent - unpickedCount * CONFIDENCE_MIN;
}

/**
 * Plain-language reading of a spread.
 *
 * Spreads are stored from the home team's perspective in standard odds
 * notation: negative means the home team is favoured. That convention is
 * invisible in a bare number field, so the UI echoes this back as the user
 * types rather than leaving them to guess the sign.
 */
export function describeSpread(spread, homeAbbr, awayAbbr) {
  const n = typeof spread === 'string' ? parseFloat(spread) : spread;
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  if (n === 0) return 'Even — no favourite';
  return n < 0
    ? `${homeAbbr} wins by ${Math.abs(n)}`
    : `${awayAbbr} wins by ${n}`;
}

/**
 * A player's own pick record, counted from their picks rather than read from a
 * cached column.
 *
 * The profile columns these replace (total_predictions, season_rank,
 * weekly_wins) were precomputed and never reconciled: total_predictions was
 * incremented by the submit handler, so re-submitting a week counted it again,
 * and profiles ended up claiming dozens of picks against a handful of real
 * rows. Counting from `predictions` cannot drift.
 *
 * Deliberately limited to what a player's own picks can answer. Rank and weeks
 * won depend on the whole field under competitive scoring, so they belong to
 * the leaderboard, which already loads the field.
 */
export function summarisePicks(picks = []) {
  const graded = picks.filter(p => {
    const actual = p?.games?.actual_spread;
    return actual !== null && actual !== undefined && !Number.isNaN(Number(p.predicted_spread));
  });

  const avgDiff = graded.length
    ? graded.reduce((sum, p) => sum + Math.abs(Number(p.predicted_spread) - Number(p.games.actual_spread)), 0) / graded.length
    : null;

  return { picks: picks.length, graded: graded.length, avgDiff };
}

// ─── Competitive scoring ────────────────────────────────────────────────────
//
// Scoring is relative, not absolute: for each graded game, whoever in the
// field lands closest to the actual spread wins that game and banks the stars
// they put on it. Ties all win. Everyone else scores nothing for that game.
//
// Two things follow from this that are worth being explicit about:
//
//   1. A pick has no point value on its own — it depends who you're up
//      against. The same pick can win in one league and lose in another, so
//      points belong to (pick, field) rather than to the pick. Personal views
//      therefore show accuracy, not points.
//   2. Stars now carry real risk. Five stars on a game you don't win scores
//      nothing, and those stars are spent. A player's weekly ceiling is their
//      whole star budget, reached only by winning every game they starred.

// Spreads move in half-point steps, so exact comparison would do; the epsilon
// just keeps float noise from silently dropping a legitimate tie.
const TIE_EPSILON = 1e-9;

function gradedDiff(pick) {
  const actual = pick?.games?.actual_spread;
  if (actual === null || actual === undefined) return null;
  const predicted = Number(pick.predicted_spread);
  if (Number.isNaN(predicted)) return null;
  return Math.abs(predicted - Number(actual));
}

/**
 * Ranks a field of players against each other.
 *
 * `picks` is every pick from the field being scored — a league's members, or
 * every user for the global board. `players` seeds the table so members who
 * picked nothing still appear.
 */
export function buildStandings(picks, players = []) {
  const table = {};
  const seed = id => {
    if (!table[id]) {
      table[id] = { user_id: id, username: null, picks: 0, points: 0, wins: 0, graded: 0, diffs: [] };
    }
    return table[id];
  };

  players.forEach(p => { seed(p.user_id).username = p.username ?? null; });

  const byGame = {};
  picks.forEach(p => {
    const row = seed(p.user_id);
    row.picks++;
    if (row.username == null && p.profiles?.username) row.username = p.profiles.username;
    (byGame[p.game_id] ||= []).push(p);
  });

  Object.values(byGame).forEach(gamePicks => {
    const scored = gamePicks
      .map(p => ({ pick: p, diff: gradedDiff(p) }))
      .filter(x => x.diff !== null);
    if (scored.length === 0) return;

    const best = Math.min(...scored.map(x => x.diff));

    scored.forEach(({ pick, diff }) => {
      const row = seed(pick.user_id);
      row.graded++;
      row.diffs.push(diff);
      if (diff <= best + TIE_EPSILON) {
        row.wins++;
        row.points += pick.confidence_points || CONFIDENCE_MIN;
      }
    });
  });

  return Object.values(table)
    .map(r => ({
      ...r,
      avgDiff: r.diffs.length ? r.diffs.reduce((a, b) => a + b, 0) / r.diffs.length : null,
    }))
    .sort((a, b) =>
      b.points - a.points ||
      (a.avgDiff ?? Infinity) - (b.avgDiff ?? Infinity) ||
      (a.username || '').localeCompare(b.username || '')
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * @deprecated Absolute accuracy scoring, replaced by buildStandings. Kept only
 * so the meaning of historic points_earned values stays documented.
 */
export function calculatePoints(userPick, actualSpread, confidence = 1) {
  const difference = Math.abs(userPick - actualSpread);
  let basePoints = 0;
  if (difference === 0) basePoints = 10;
  else if (difference <= 0.5) basePoints = 8;
  else if (difference <= 1) basePoints = 6;
  else if (difference <= 2) basePoints = 4;
  else if (difference <= 3) basePoints = 2;
  else basePoints = 1;
  return basePoints * confidence;
}

export function getAccuracyColor(difference) {
  if (difference <= 1) return '#0f7a4d';
  if (difference <= 3) return '#b8720b';
  return '#c8322c';
}

export function formatSpread(spread) {
  if (spread === null || spread === undefined) return 'N/A';
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function formatRecord(predictions) {
  const wins = predictions.filter(p => p.accuracy_score >= 6).length;
  const losses = predictions.length - wins;
  return `${wins}-${losses}`;
}
