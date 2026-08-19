// When a week's spread lines stop moving.
//
// The rule: a week's lines track the market until the last Sunday game before
// that week's first kickoff is over, and are settled from then on. One moment
// for the whole week, so a Thursday game isn't graded against a line that was
// still moving days after a Sunday game's was settled.
//
// The sync-games Edge Function carries its own copy of this, because it runs
// in Deno against Supabase and can't import from the app bundle. That copy is
// the one that actually decides what gets written; this one exists so the rule
// is testable, and season.test.js pins both to the same answers. If you change
// one, change the other — the test will tell you if you didn't.
//
// See docs/games-sync.md.

// How long after a Sunday kickoff that game is comfortably over. Places the
// freeze a little after the last Sunday game rather than at its kickoff.
const GAME_LENGTH_MS = 4 * 60 * 60 * 1000;
// The usual Sunday night kickoff, Eastern. Only needed for week 1, which has
// no NFL Sunday before it to anchor to.
const SUNDAY_NIGHT_ET_HOUR = 20;
const SUNDAY_NIGHT_ET_MINUTE = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const easternFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/** The Eastern wall clock at an instant, as numbers. */
export function easternParts(ms) {
  const parts = {};
  for (const { type, value } of easternFormat.formatToParts(new Date(ms))) {
    if (type !== 'literal') parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl renders midnight as hour 24 rather than 0 in this configuration.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Day of week in Eastern time, 0 = Sunday. */
export function easternWeekday(ms) {
  return easternParts(ms).weekday;
}

/**
 * The instant at which a given Eastern wall clock reads.
 *
 * Converges by measuring the offset actually in force at the candidate instant
 * rather than assuming one, so it stays right across the November changeover
 * without a table of dates. Two passes is enough for any real offset; the only
 * input it can't answer is a wall clock inside the spring-forward gap, which
 * doesn't exist and which no kickoff falls in.
 */
export function easternToUtc(year, month, day, hour, minute) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let ms = wall;
  for (let i = 0; i < 2; i++) {
    const p = easternParts(ms);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ms = wall - (seen - ms);
  }
  return ms;
}

/**
 * The freeze instant for one week, or null if the week has no games.
 *
 * `kickoffs` is every regular-season kickoff in the season, in any order —
 * the rule looks outside the week being asked about, which is the whole point:
 * a week freezes on the *previous* week's Sunday.
 */
export function freezeAtForWeek(week, kickoffs) {
  const own = kickoffs.filter(k => k.week === week);
  if (own.length === 0) return null;
  const firstKickoff = Math.min(...own.map(k => k.at));

  const priorSundays = kickoffs.filter(k => k.at < firstKickoff && easternWeekday(k.at) === 0);
  if (priorSundays.length > 0) {
    return Math.max(...priorSundays.map(k => k.at)) + GAME_LENGTH_MS;
  }

  // Week 1 has no NFL Sunday before it, so the equivalent moment is
  // synthesised: the calendar Sunday before the opener, at the hour a Sunday
  // night game would have kicked off.
  let back = firstKickoff;
  do { back -= DAY_MS; } while (easternWeekday(back) !== 0);
  const p = easternParts(back);
  return easternToUtc(p.year, p.month, p.day, SUNDAY_NIGHT_ET_HOUR, SUNDAY_NIGHT_ET_MINUTE)
    + GAME_LENGTH_MS;
}

/**
 * Freeze instants for every week in a schedule, as `{ [week]: epochMs }`.
 *
 * `games` are `games` rows — anything with `week` and `game_time`.
 */
export function lineFreezeSchedule(games) {
  const kickoffs = (games || [])
    .filter(g => g.week >= 1 && g.week <= 18 && g.game_time)
    .map(g => ({ week: g.week, at: new Date(g.game_time).getTime() }));

  const weeks = [...new Set(kickoffs.map(k => k.week))].sort((a, b) => a - b);
  const schedule = {};
  for (const w of weeks) schedule[w] = freezeAtForWeek(w, kickoffs);
  return schedule;
}

/** Whether a week's lines are settled at `now`. */
export function linesFrozen(week, games, now = new Date()) {
  const at = lineFreezeSchedule(games)[week];
  return at != null && now.getTime() >= at;
}
