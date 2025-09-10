import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
const NYC = 'America/New_York';

export function currentSeason() {
const now = utcToZonedTime(new Date(), NYC);
const year = now.getFullYear();
return year; // simple: NFL season named by calendar year
}

export function currentWeekBySundayAnchor(date = new Date()) {
// week number: use ESPN style – we’ll persist week with data from the odds API fetcher
// placeholder: compute ISO week of season start if you want; our fetcher sets week explicitly.
return undefined;
}

export function isLockWindow(now = new Date()) {
const ny = utcToZonedTime(now, NYC);
const day = ny.getDay(); // 0=Sun
const hours = ny.getHours();
// Lock Sunday 23:30 local; fallback Monday 10:00 local
const lockSunday = day === 0 && (hours >= 23); // 23:00-23:59
const fallbackMonday = day === 1 && hours >= 10;
return lockSunday || fallbackMonday;
}
