// The betting engine: pricing, payouts, the house edge, and what wins.
//
// Pure and free of React and Supabase on purpose. Everything that moves units
// is decided here, so it can be tested against a finished season before any of
// it is wired to a button. See docs/bankroll.md for the rules these implement.
//
// Two conventions run through the whole file, and getting either backwards
// produces bets that settle almost right:
//
//   result      home score minus away score. Positive means the home team won.
//   spread_line the HOME team's line, positive when the home team is favoured.
//               This is the feed's own convention, kept unchanged. The existing
//               games sync negates it into `actual_spread`; nothing here reads
//               that column.

export const MARKETS = ['spread', 'total', 'moneyline'];
export const SIDES = { spread: ['home', 'away'], total: ['over', 'under'], moneyline: ['home', 'away'] };

/** Most legs anyone may stack on one slip. */
export const MAX_LEGS = 6;

// ─── Prices ─────────────────────────────────────────────────────────────────

/**
 * American odds as a decimal multiplier, including the stake.
 *
 * −110 becomes 1.909: risk 1 to get 1.909 back. +150 becomes 2.5.
 */
export function toDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

/** The market's own estimate of a side's chance, vig included. */
export function impliedProbability(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
}

/**
 * The chance with the vig stripped out.
 *
 * Both sides of a market imply more than 100% between them — that surplus is
 * the house's edge. Dividing through by the total removes it, which is what
 * makes a fair comparison possible.
 */
export function fairProbability(american, otherSide) {
  const mine = impliedProbability(american);
  const theirs = impliedProbability(otherSide);
  if (mine === null || theirs === null) return null;
  return mine / (mine + theirs);
}

/**
 * The house's expected share of a stake, as a fraction.
 *
 * A standard −110 both ways comes to 4.55%. Legs multiply it: the edge is
 * taken on each one, which is why a three-leg parlay holds nearly triple a
 * single bet and a five-leg holds a fifth of the stake.
 *
 * `legs` is `[{ odds, otherSideOdds }, ...]`.
 */
export function houseHold(legs) {
  let fair = 1;
  let dec = 1;
  for (const leg of legs) {
    const f = fairProbability(leg.odds, leg.otherSideOdds);
    const d = toDecimal(leg.odds);
    if (f === null || d === null) return null;
    fair *= f;
    dec *= d;
  }
  return 1 - fair * dec;
}

/** What a slip returns if every leg lands. Stake included. */
export function payout(stake, legs) {
  const dec = combinedDecimal(legs);
  return dec === null ? null : round2(stake * dec);
}

/** The multiplier for a slip. Legs multiply; a pushed leg counts as 1. */
export function combinedDecimal(legs) {
  let dec = 1;
  for (const leg of legs) {
    if (leg.outcome === 'push') continue;
    const d = toDecimal(leg.odds);
    if (d === null) return null;
    dec *= d;
  }
  return dec;
}

// Units are money-shaped, so they round like money. Doing this once, here,
// keeps a hundred small floats from drifting a balance off by a penny.
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── What wins ──────────────────────────────────────────────────────────────

/**
 * Grades one leg against a finished game.
 *
 * Returns 'win' | 'loss' | 'push', or null while the game has no result yet.
 * A game that was never played voids, which settles the same way as a push.
 */
export function gradeLeg(leg, game) {
  if (!game) return null;
  const { result, total } = game;

  if (leg.market === 'spread') {
    if (result === null || result === undefined || game.spread_line === null) return null;
    if (result === game.spread_line) return 'push';
    const homeCovered = result > game.spread_line;
    return (leg.side === 'home') === homeCovered ? 'win' : 'loss';
  }

  if (leg.market === 'total') {
    if (total === null || total === undefined || game.total_line === null) return null;
    if (total === game.total_line) return 'push';
    const wentOver = total > game.total_line;
    return (leg.side === 'over') === wentOver ? 'win' : 'loss';
  }

  if (leg.market === 'moneyline') {
    if (result === null || result === undefined) return null;
    // A tie returns the stake. The survivor pool counts a tie as a loss; this
    // is a different game and must not inherit that.
    if (result === 0) return 'push';
    const homeWon = result > 0;
    return (leg.side === 'home') === homeWon ? 'win' : 'loss';
  }

  return null;
}

/** The price on offer for one side of one market. */
export function oddsFor(game, market, side) {
  if (market === 'spread') return side === 'home' ? game.home_spread_odds : game.away_spread_odds;
  if (market === 'total') return side === 'over' ? game.over_odds : game.under_odds;
  if (market === 'moneyline') return side === 'home' ? game.home_moneyline : game.away_moneyline;
  return null;
}

/** The price on the other side of the same market — what the vig is measured against. */
export function otherSideOdds(game, market, side) {
  const [a, b] = SIDES[market] || [];
  return oddsFor(game, market, side === a ? b : a);
}

/** The number a leg is graded against: the spread, the total, or nothing. */
export function lineFor(game, market) {
  if (market === 'spread') return game.spread_line;
  if (market === 'total') return game.total_line;
  return null;
}

// ─── Settling a slip ────────────────────────────────────────────────────────

/**
 * Settles a whole bet once its games are final.
 *
 * A single losing leg sinks the slip. A pushed leg is dropped and the slip
 * reprices without it, so a three-leg parlay with one push pays as a two-leg —
 * and a slip where everything pushed simply returns the stake.
 *
 * Returns `{ status, returned, profit }`, or a status of 'open' while any leg
 * is still ungraded.
 */
export function settleBet(bet, gamesById) {
  const graded = bet.legs.map(leg => ({
    ...leg,
    outcome: gradeLeg(leg, gamesById[leg.game_id]),
  }));

  if (graded.some(l => l.outcome === null)) {
    return { status: 'open', returned: null, profit: null, legs: graded };
  }
  if (graded.some(l => l.outcome === 'loss')) {
    return { status: 'lost', returned: 0, profit: round2(-bet.stake), legs: graded };
  }

  const returned = payout(bet.stake, graded);
  const allPushed = graded.every(l => l.outcome === 'push');
  return {
    status: allPushed ? 'push' : 'won',
    returned,
    profit: round2(returned - bet.stake),
    legs: graded,
  };
}

/**
 * Whether a set of legs may sit on one slip together.
 *
 * Same-game legs are fine when they measure different things and not when one
 * all but guarantees the other. Covering a spread already means winning the
 * game, so pairing that with the moneyline pays a near-certainty at long odds:
 * a 7-point favourite parlayed with its own moneyline returns about 27% to the
 * bettor on a bet that should return −4.5%.
 *
 * Returns `null` when the slip is legal, or a sentence explaining why not.
 */
export function slipProblem(legs) {
  if (!legs || legs.length === 0) return 'Add a pick first.';
  if (legs.length > MAX_LEGS) return `A slip can hold at most ${MAX_LEGS} picks.`;

  const seen = new Map();
  for (const leg of legs) {
    const markets = seen.get(leg.game_id) || [];
    if (markets.includes(leg.market)) {
      return 'You have both sides of the same bet — one of them has to lose.';
    }
    if ((markets.includes('spread') && leg.market === 'moneyline') ||
        (markets.includes('moneyline') && leg.market === 'spread')) {
      return 'Moneyline and spread on the same game are near enough the same bet.';
    }
    markets.push(leg.market);
    seen.set(leg.game_id, markets);
  }
  return null;
}
