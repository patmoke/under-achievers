import { toZonedTime } from 'date-fns-tz';

const NYC = 'America/New_York';

export function currentSeason(): number {
  // Get current date in NYC timezone
  const now = toZonedTime(new Date(), NYC);

  // NFL season starts in September, adjust if needed
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-based

  // If before September, consider previous year as current season
  return month < 9 ? year - 1 : year;
}

export function currentWeek(startDate: string, weeksIntoSeason: number): number {
  // startDate: ISO string for season start (e.g., first Thursday game)
  const seasonStart = toZonedTime(new Date(startDate), NYC);
  const now = toZonedTime(new Date(), NYC);

  const diffMs = now.getTime() - seasonStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  return diffWeeks + 1 + weeksIntoSeason; // adjust if needed
}
