// src/lib/nfl.ts
import { toZonedTime } from 'date-fns-tz';

const NYC = 'America/New_York';

export function currentSeason(): number {
  const now = toZonedTime(new Date(), NYC);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month < 9 ? year - 1 : year;
}

/**
 * Calculate week number based on seasonStart ISO.
 * Returns 1-based week number.
 */
export function weekFromSeasonStart(seasonStartIso: string): number {
  const seasonStart = toZonedTime(new Date(seasonStartIso), NYC);
  const now = toZonedTime(new Date(), NYC);
  const diffMs = now.getTime() - seasonStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}
