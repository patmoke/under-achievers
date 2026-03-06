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
  if (difference <= 1) return '#10b981';
  if (difference <= 3) return '#f59e0b';
  return '#ef4444';
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
