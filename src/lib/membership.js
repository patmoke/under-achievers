// What a player is actually in, and what the app should therefore show them.
//
// Kept pure and away from React so the routing decision is testable without
// mounting anything. Everything here takes the league rows as input; nothing
// fetches.

export const CURRENT_SEASON = 2026;

/**
 * Whether this player is in a league that uses the weekly spread game.
 *
 * Three of the four nav destinations — Make Picks, Leaderboard, History — read
 * from `predictions`, which only weekly leagues score. For a survivor-only
 * player they are all empty, which is most of the roster: at the time this was
 * written 31 of 32 members were survivor-only and nobody was weekly-only.
 */
export function playsWeekly(leagues) {
  return (leagues || []).some(l => l?.compete_on === 'weekly');
}

/**
 * Where to send someone who has just signed in.
 *
 * Straight into their league when there's only one, which covers almost
 * everybody. Otherwise the league list — which is also the right answer for
 * someone in no league at all, since it's where joining and creating live.
 *
 * Never returns '/games'. Landing on the weekly picks page was the old
 * behaviour and it put most of the roster on a page belonging to a game they
 * don't play.
 */
export function landingPath(leagues) {
  const mine = leagues || [];
  if (mine.length === 1 && mine[0]?.id) return `/leagues/${mine[0].id}`;
  return '/leagues';
}

/** Every nav destination, in display order. */
export const NAV_PATHS = ['/games', '/leagues', '/leaderboard', '/history'];

const WEEKLY_ONLY_PATHS = new Set(['/games', '/leaderboard', '/history']);

/**
 * Which nav items to show.
 *
 * Hiding is deliberate rather than disabling or showing an empty state: a
 * survivor player has no use for the weekly game at all, and three dead links
 * make the app look broken rather than focused. The routes stay reachable by
 * URL either way — this only decides what gets advertised, so bookmarks and
 * old links keep working.
 *
 * Admins keep everything. Whoever runs the league needs to be able to see the
 * whole app, including the parts they personally don't play.
 */
export function visibleNavPaths({ leagues, isAdmin = false } = {}) {
  if (isAdmin || playsWeekly(leagues)) return NAV_PATHS;
  return NAV_PATHS.filter(p => !WEEKLY_ONLY_PATHS.has(p));
}
