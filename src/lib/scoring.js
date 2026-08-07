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
 * during a Sunday slate the already-kicked-off games are still "this week",
 * and once the last game of a week ends the next week takes over. Falls back
 * to null when there's no schedule to read, so callers can use the date-based
 * estimate instead.
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
