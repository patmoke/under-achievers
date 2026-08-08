import { describe, it, expect, vi } from 'vitest';
import { computeEntryStatus, usedTeams, pickOutcome, isGameLocked } from './survivor';
import {
  deriveCurrentWeek, confidenceBudget, confidenceSpent, describeSpread, buildStandings, starsAvailable,
  CONFIDENCE_MIN, CONFIDENCE_MAX,
} from './scoring';

// A fixed "now" so these tests never depend on the real clock.
const NOW = new Date('2026-10-15T00:00:00Z');

// Weeks 1-4 are in the past relative to NOW; weeks 5-6 are still upcoming.
const PAST = w => `2026-09-${String(2 + w * 7).padStart(2, '0')}T17:00:00Z`;
const FUTURE = w => `2026-11-${String(w).padStart(2, '0')}T17:00:00Z`;

function game(week, { home, away, homeScore = null, awayScore = null, future = false } = {}) {
  return {
    id: `w${week}-${away}-${home}`,
    week,
    season: 2026,
    home_team_abbr: home,
    away_team_abbr: away,
    home_score: homeScore,
    away_score: awayScore,
    status: homeScore !== null && awayScore !== null ? 'final' : 'scheduled',
    game_time: future ? FUTURE(week) : PAST(week),
  };
}

// Weeks 1-4 all played and final. Home team wins every game except where noted.
const GAMES = [
  game(1, { home: 'KC', away: 'DAL', homeScore: 24, awayScore: 17 }),
  game(2, { home: 'SF', away: 'SEA', homeScore: 27, awayScore: 20 }),
  game(3, { home: 'BUF', away: 'MIA', homeScore: 14, awayScore: 21 }), // away wins
  game(4, { home: 'GB', away: 'CHI', homeScore: 30, awayScore: 10 }),
  game(5, { home: 'DEN', away: 'LV', future: true }),                  // not kicked off
];

const entry = (over = {}) => ({ id: 'e1', start_week: 1, ...over });
const pick = (week, team, gameRef) => ({
  entry_id: 'e1', week, team_abbr: team, games: gameRef,
});

const g = w => GAMES.find(x => x.week === w);

function status(picks, over = {}, currentWeek = 4) {
  return computeEntryStatus({
    entry: entry(over), picks, games: GAMES, currentWeek, now: NOW,
  });
}

describe('pickOutcome', () => {
  it('grades a home-team win', () => {
    expect(pickOutcome(pick(1, 'KC', g(1)))).toBe('win');
  });

  it('grades a home-team loss', () => {
    expect(pickOutcome(pick(1, 'DAL', g(1)))).toBe('loss');
  });

  it('grades an away-team win', () => {
    expect(pickOutcome(pick(3, 'MIA', g(3)))).toBe('win');
  });

  it('treats a tie as its own outcome', () => {
    const tied = game(1, { home: 'KC', away: 'DAL', homeScore: 20, awayScore: 20 });
    expect(pickOutcome(pick(1, 'KC', tied))).toBe('tie');
  });

  it('returns null while the game is not final', () => {
    expect(pickOutcome(pick(5, 'DEN', g(5)))).toBeNull();
  });
});

describe('isGameLocked', () => {
  it('locks once kickoff has passed', () => {
    expect(isGameLocked(g(1), NOW)).toBe(true);
  });

  it('stays open before kickoff', () => {
    expect(isGameLocked(g(5), NOW)).toBe(false);
  });

  it('treats a missing game as locked', () => {
    expect(isGameLocked(undefined, NOW)).toBe(true);
  });

  // Passed straight to .some()/.every(), the array index lands in `now`.
  // Left unguarded that made every game read as unlocked, which silently
  // turned off the "season has started" check. The clock is frozen here
  // because this path deliberately falls back to the real current time.
  it('ignores a non-Date "now" so callback use stays correct', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      expect([g(1)].some(isGameLocked)).toBe(true);   // week 1 already kicked off
      expect([g(5)].every(isGameLocked)).toBe(false); // week 5 has not
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('computeEntryStatus — elimination', () => {
  it('keeps an entry alive while every pick won', () => {
    const picks = [pick(1, 'KC', g(1)), pick(2, 'SF', g(2)), pick(3, 'MIA', g(3)), pick(4, 'GB', g(4))];
    expect(status(picks)).toEqual({ status: 'alive', week: null, reason: null });
  });

  it('eliminates on a losing pick, reporting that week', () => {
    const picks = [pick(1, 'KC', g(1)), pick(2, 'SF', g(2)), pick(3, 'BUF', g(3))];
    expect(status(picks)).toEqual({ status: 'eliminated', week: 3, reason: 'loss' });
  });

  it('eliminates on a tie, since a tie is a loss in this pool', () => {
    const tied = game(2, { home: 'SF', away: 'SEA', homeScore: 20, awayScore: 20 });
    const games = GAMES.map(x => (x.week === 2 ? tied : x));
    const result = computeEntryStatus({
      entry: entry(),
      picks: [pick(1, 'KC', g(1)), pick(2, 'SF', tied)],
      games,
      currentWeek: 4,
      now: NOW,
    });
    expect(result).toEqual({ status: 'eliminated', week: 2, reason: 'loss' });
  });

  it('reports the earliest loss when several picks lost', () => {
    const picks = [pick(3, 'BUF', g(3)), pick(1, 'DAL', g(1))];
    expect(status(picks).week).toBe(1);
  });
});

describe('computeEntryStatus — missed picks', () => {
  // This is the regression that shipped once: the missed week was reported as
  // whatever week was being *viewed*, not the week actually missed.
  it('reports the week actually missed, not the week being viewed', () => {
    const picks = [pick(1, 'KC', g(1))]; // nothing for weeks 2-4
    expect(status(picks, {}, 4)).toEqual({ status: 'eliminated', week: 2, reason: 'missed' });
  });

  it('gives the same answer regardless of how far the season has advanced', () => {
    const picks = [pick(1, 'KC', g(1))];
    expect(status(picks, {}, 2).week).toBe(2);
    expect(status(picks, {}, 3).week).toBe(2);
    expect(status(picks, {}, 4).week).toBe(2);
  });

  it('does not eliminate for a week that has not fully kicked off', () => {
    const picks = [pick(1, 'KC', g(1)), pick(2, 'SF', g(2)), pick(3, 'MIA', g(3)), pick(4, 'GB', g(4))];
    // Week 5 has no pick, but its game is still upcoming.
    expect(status(picks, {}, 5).status).toBe('alive');
  });

  it('does not eliminate for a week with no scheduled games', () => {
    const picks = [pick(1, 'KC', g(1))];
    const result = computeEntryStatus({
      entry: entry(), picks, games: [g(1)], currentWeek: 4, now: NOW,
    });
    expect(result.status).toBe('alive');
  });
});

describe('computeEntryStatus — buybacks', () => {
  // The second regression: scanning from week 1 marked a fresh buyback entry
  // as having missed every week before it re-entered.
  it('ignores weeks before the entry bought back in', () => {
    const picks = [pick(4, 'GB', g(4))];
    expect(status(picks, { start_week: 4 }, 4)).toEqual({ status: 'alive', week: null, reason: null });
  });

  it('forgives the loss that came before the buyback', () => {
    const picks = [pick(3, 'BUF', g(3)), pick(4, 'GB', g(4))]; // week 3 lost, rebought at 4
    expect(status(picks, { start_week: 4 }, 4).status).toBe('alive');
  });

  it('still eliminates on a loss after the buyback', () => {
    const picks = [pick(3, 'MIA', g(3)), pick(4, 'CHI', g(4))]; // week 4 pick lost
    expect(status(picks, { start_week: 4 }, 4)).toEqual({ status: 'eliminated', week: 4, reason: 'loss' });
  });

  it('still eliminates on a missed week after the buyback', () => {
    const picks = [pick(2, 'SF', g(2))]; // rebought at 3, then never picked again
    expect(status(picks, { start_week: 3 }, 4)).toEqual({ status: 'eliminated', week: 3, reason: 'missed' });
  });
});

describe('usedTeams', () => {
  it('burns teams from locked picks', () => {
    const picks = [pick(1, 'KC', g(1)), pick(2, 'SF', g(2))];
    expect(usedTeams({ entry: entry(), picks, currentWeek: 4, now: NOW })).toEqual(new Set(['KC', 'SF']));
  });

  it('does not burn the current week pick while its game is still open', () => {
    const picks = [pick(1, 'KC', g(1)), pick(5, 'DEN', g(5))];
    const used = usedTeams({ entry: entry(), picks, currentWeek: 5, now: NOW });
    expect(used.has('DEN')).toBe(false); // still changeable
    expect(used.has('KC')).toBe(true);
  });

  it('burns the current week pick once its game has kicked off', () => {
    const picks = [pick(4, 'GB', g(4))];
    const used = usedTeams({ entry: entry(), picks, currentWeek: 4, now: NOW });
    expect(used.has('GB')).toBe(true);
  });
});

describe('deriveCurrentWeek', () => {
  it('returns the week of the next game that has not started', () => {
    expect(deriveCurrentWeek(GAMES, NOW)).toBe(5);
  });

  it('keeps the current week during a partially played slate', () => {
    const slate = [
      game(6, { home: 'KC', away: 'DAL', homeScore: 21, awayScore: 7 }), // played
      { ...game(6, { home: 'SF', away: 'SEA' }), id: 'w6-late', game_time: FUTURE(6) },
    ];
    expect(deriveCurrentWeek(slate, NOW)).toBe(6);
  });

  it('returns the last week once the season is over', () => {
    const finished = GAMES.filter(x => x.week <= 4);
    expect(deriveCurrentWeek(finished, NOW)).toBe(4);
  });

  it('ignores out-of-range weeks used by playoff and scratch rows', () => {
    const withScratch = [...GAMES, { id: 'qa', week: 94, game_time: FUTURE(1) }];
    expect(deriveCurrentWeek(withScratch, NOW)).toBe(5);
  });

  it('returns null with no schedule so callers can fall back', () => {
    expect(deriveCurrentWeek([], NOW)).toBeNull();
    expect(deriveCurrentWeek(undefined, NOW)).toBeNull();
  });
});

describe('confidence budget', () => {
  it('grants two stars per scheduled game', () => {
    expect(confidenceBudget(16)).toBe(32);
    expect(confidenceBudget(0)).toBe(0);
  });

  it('charges only for games actually picked', () => {
    const conf = { a: 5, b: 3, c: 4 };
    expect(confidenceSpent(conf, ['a', 'b'])).toBe(8); // c not picked
  });

  it('charges the minimum for a pick with no explicit confidence', () => {
    expect(confidenceSpent({}, ['a', 'b'])).toBe(2 * CONFIDENCE_MIN);
  });

  // The whole point: maxing every game must not fit inside the budget.
  it('cannot afford max confidence on every game', () => {
    const games = Array.from({ length: 16 }, (_, i) => `g${i}`);
    const allMax = Object.fromEntries(games.map(g => [g, CONFIDENCE_MAX]));
    expect(confidenceSpent(allMax, games)).toBeGreaterThan(confidenceBudget(games.length));
  });

  it('exactly affords the middle confidence on every game', () => {
    const games = Array.from({ length: 16 }, (_, i) => `g${i}`);
    const allTwo = Object.fromEntries(games.map(g => [g, 2]));
    expect(confidenceSpent(allTwo, games)).toBe(confidenceBudget(games.length));
  });
});

describe('describeSpread', () => {
  it('reads a negative spread as the home team favoured', () => {
    expect(describeSpread(-11.5, 'LAC', 'ARI')).toBe('LAC wins by 11.5');
  });

  it('reads a positive spread as the away team favoured', () => {
    expect(describeSpread(3, 'LAC', 'ARI')).toBe('ARI wins by 3');
  });

  it('handles a pick-em', () => {
    expect(describeSpread(0, 'LAC', 'ARI')).toBe('Even — no favourite');
  });

  it('accepts the string the number input produces', () => {
    expect(describeSpread('-7', 'DET', 'NO')).toBe('DET wins by 7');
  });

  it('returns null when there is nothing to read', () => {
    expect(describeSpread('', 'LAC', 'ARI')).toBeNull();
    expect(describeSpread(null, 'LAC', 'ARI')).toBeNull();
    expect(describeSpread(undefined, 'LAC', 'ARI')).toBeNull();
  });
});

describe('buildStandings — competitive scoring', () => {
  // Actual line is -7. Closest wins the game and banks their stars.
  const g1 = { actual_spread: -7 };
  const g2 = { actual_spread: -3 };

  const p = (user, game, spread, conf, actual) => ({
    user_id: user, game_id: game, predicted_spread: spread,
    confidence_points: conf, games: actual,
  });

  it('awards the closest player their stars, and others nothing', () => {
    const rows = buildStandings([
      p('a', 'g1', -7.5, 3, g1),  // 0.5 off  -> wins, +3
      p('b', 'g1', -10, 5, g1),   // 3 off
      p('c', 'g1', -1, 5, g1),    // 6 off
    ]);
    const by = Object.fromEntries(rows.map(r => [r.user_id, r]));
    expect(by.a.points).toBe(3);
    expect(by.b.points).toBe(0);
    expect(by.c.points).toBe(0);
  });

  it('gives every tied player the point, each times their own stars', () => {
    const rows = buildStandings([
      p('a', 'g1', -6, 2, g1),  // 1 off
      p('b', 'g1', -8, 4, g1),  // 1 off — tie
      p('c', 'g1', -9, 5, g1),  // 2 off
    ]);
    const by = Object.fromEntries(rows.map(r => [r.user_id, r]));
    expect(by.a.points).toBe(2);
    expect(by.b.points).toBe(4);
    expect(by.c.points).toBe(0);
  });

  it('scores an exact hit as a win, not as extra points', () => {
    const rows = buildStandings([p('a', 'g1', -7, 1, g1), p('b', 'g1', -7.5, 5, g1)]);
    const by = Object.fromEntries(rows.map(r => [r.user_id, r]));
    expect(by.a.points).toBe(1); // exact, but only 1 star
    expect(by.b.points).toBe(0); // more stars, still lost
  });

  it('makes wasted stars cost the player', () => {
    // Same accuracy across two games, opposite star placement.
    const picks = [
      p('saver', 'g1', -7, 1, g1), p('saver', 'g2', -20, 5, g2),
      p('waster', 'g1', -20, 5, g1), p('waster', 'g2', -3, 1, g2),
    ];
    const by = Object.fromEntries(buildStandings(picks).map(r => [r.user_id, r]));
    expect(by.saver.points).toBe(1);  // won g1 with 1 star, lost g2
    expect(by.waster.points).toBe(1); // lost g1 despite 5 stars, won g2 with 1
  });

  it('ignores games that are not graded yet', () => {
    const rows = buildStandings([p('a', 'gX', -7, 5, { actual_spread: null })]);
    expect(rows[0].points).toBe(0);
    expect(rows[0].graded).toBe(0);
    expect(rows[0].picks).toBe(1);
  });

  it('awards the point when only one player picked the game', () => {
    const rows = buildStandings([p('a', 'g1', -20, 2, g1)]);
    expect(rows[0].points).toBe(2);
  });

  it('includes players who never picked, at zero', () => {
    const rows = buildStandings([p('a', 'g1', -7, 1, g1)], [
      { user_id: 'a', username: 'ana' }, { user_id: 'z', username: 'zed' },
    ]);
    const by = Object.fromEntries(rows.map(r => [r.user_id, r]));
    expect(by.z.points).toBe(0);
    expect(by.z.picks).toBe(0);
  });

  it('ranks on points, breaking ties on average accuracy', () => {
    const rows = buildStandings([
      p('a', 'g1', -7, 1, g1), p('a', 'g2', -3.5, 1, g2),
      p('b', 'g1', -9, 1, g1), p('b', 'g2', -3, 1, g2),
    ]);
    // a wins g1, b wins g2 -> 1 point each; a's average diff is smaller.
    expect(rows[0].points).toBe(rows[1].points);
    expect(rows[0].user_id).toBe('a');
    expect(rows.map(r => r.rank)).toEqual([1, 2]);
  });

  it("caps a player's week at their star budget", () => {
    const games = Array.from({ length: 16 }, (_, i) => `g${i}`);
    const picks = games.map(id => p('a', id, -7, 2, g1)); // wins all 16 at x2
    const total = buildStandings(picks)[0].points;
    expect(total).toBe(confidenceBudget(16));
  });
});

describe('starsAvailable — compulsory minimums', () => {
  const budget = confidenceBudget(16); // 32

  it('holds back one star for each game still to be picked', () => {
    // Nothing picked yet: 16 games each owe a star, so half the budget is spoken for.
    expect(starsAvailable({ budget, spent: 0, unpickedCount: 16 })).toBe(16);
  });

  it('frees up the reserve as games get picked', () => {
    // 8 picked at the minimum, 8 outstanding.
    expect(starsAvailable({ budget, spent: 8, unpickedCount: 8 })).toBe(16);
  });

  it('leaves nothing spare once every star is committed', () => {
    expect(starsAvailable({ budget, spent: 32, unpickedCount: 0 })).toBe(0);
  });

  // The dead end this exists to prevent: without the reserve, spending big
  // early leaves you unable to afford games you are still required to pick.
  it('stops an early spending spree from stranding later games', () => {
    // 6 games at x5 = 30 spent, 10 games still to pick.
    const free = starsAvailable({ budget, spent: 30, unpickedCount: 10 });
    expect(free).toBeLessThan(0); // flagged as over budget rather than silently stranding
    // The naive check would have said 2 stars were still spendable.
    expect(budget - 30).toBe(2);
  });

  it('reports the overspend when a player is over budget', () => {
    expect(starsAvailable({ budget, spent: 40, unpickedCount: 0 })).toBe(-8);
  });
});
