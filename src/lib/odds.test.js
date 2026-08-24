// The betting engine, checked twice: small hand-worked cases, and then the
// whole 2025 season run through it.
//
// The season pass is the point of this file. A settlement rule that is
// backwards still looks fine against invented fixtures — you write the fixture
// to match the code. Against 285 real games with real lines, a flipped sign
// shows up immediately, because favourites stop winning.

import { describe, it, expect } from 'vitest';
import {
  toDecimal, impliedProbability, fairProbability, houseHold,
  payout, combinedDecimal, gradeLeg, oddsFor, otherSideOdds,
  settleBet, slipProblem, MAX_LEGS, forSettlement, isPriced,
  PLAYOFF_WEEKS, PLAYOFF_ROUNDS, isPlayoffWeek, weekLabel, requiredStake, shortfall,
  toAmerican, parlayOdds,
} from './odds';
import { SEASON_2025, REGULAR_2025 } from './__fixtures__/season2025';

const game = id => SEASON_2025.find(g => g.id === id);

// ─── Prices ─────────────────────────────────────────────────────────────────

describe('American odds', () => {
  it('converts to a decimal multiplier', () => {
    expect(toDecimal(-110)).toBeCloseTo(1.909091, 6);
    expect(toDecimal(+150)).toBeCloseTo(2.5, 6);
    expect(toDecimal(-225)).toBeCloseTo(1.444444, 6);
    expect(toDecimal(+100)).toBeCloseTo(2, 6);
  });

  it('reads an implied chance off a price', () => {
    expect(impliedProbability(-110)).toBeCloseTo(0.523810, 6);
    expect(impliedProbability(+100)).toBeCloseTo(0.5, 6);
    expect(impliedProbability(-300)).toBeCloseTo(0.75, 6);
  });

  it('refuses nonsense rather than returning a number', () => {
    for (const bad of [0, null, undefined, NaN, 'x']) {
      expect(toDecimal(bad)).toBeNull();
      expect(impliedProbability(bad)).toBeNull();
    }
  });

  it('strips the vig back out to a fair chance', () => {
    // A symmetric market is a coin flip once the edge is removed.
    expect(fairProbability(-110, -110)).toBeCloseTo(0.5, 9);
    // And the two sides of any market must add to exactly one.
    const a = fairProbability(-225, 185);
    const b = fairProbability(185, -225);
    expect(a + b).toBeCloseTo(1, 9);
  });
});

describe('the house edge', () => {
  it('is the familiar 4.55% on a standard single', () => {
    expect(houseHold([{ odds: -110, otherSideOdds: -110 }])).toBeCloseTo(0.045455, 6);
  });

  it('barely moves when the juice is split unevenly', () => {
    expect(houseHold([{ odds: -105, otherSideOdds: -115 }])).toBeCloseTo(0.0450, 4);
    expect(houseHold([{ odds: -115, otherSideOdds: -105 }])).toBeCloseTo(0.0450, 4);
  });

  it('compounds with every leg added', () => {
    const leg = { odds: -110, otherSideOdds: -110 };
    const holds = [1, 2, 3, 5].map(n => houseHold(Array(n).fill(leg)));
    expect(holds[0]).toBeCloseTo(0.0454545, 7);
    expect(holds[1]).toBeCloseTo(0.0888430, 7);
    expect(holds[2]).toBeCloseTo(0.1302592, 7);
    expect(holds[3]).toBeCloseTo(0.2075296, 7);
    // Strictly increasing — this is the whole reason parlays are a bad deal.
    for (let i = 1; i < holds.length; i++) expect(holds[i]).toBeGreaterThan(holds[i - 1]);
  });

  it('takes nearly three times as much on a 3-leg as on a single', () => {
    const leg = { odds: -110, otherSideOdds: -110 };
    const ratio = houseHold([leg, leg, leg]) / houseHold([leg]);
    expect(ratio).toBeGreaterThan(2.8);
    expect(ratio).toBeLessThan(2.9);
  });
});

describe('payouts', () => {
  it('pays a straight bet at its price', () => {
    expect(payout(50, [{ odds: -115 }])).toBe(93.48);
    expect(payout(100, [{ odds: +150 }])).toBe(250);
  });

  it('multiplies the legs of a parlay', () => {
    expect(combinedDecimal([{ odds: -110 }, { odds: -110 }, { odds: -110 }])).toBeCloseTo(6.9579264, 7);
    expect(payout(25, [{ odds: -110 }, { odds: -110 }, { odds: -110 }])).toBe(173.95);
  });

  it('drops a pushed leg and reprices around it', () => {
    const asTwo = payout(25, [{ odds: -110 }, { odds: -110 }]);
    const asThreeWithPush = payout(25, [
      { odds: -110 }, { odds: -110 }, { odds: -110, outcome: 'push' },
    ]);
    expect(asThreeWithPush).toBe(asTwo);
  });

  it('returns the stake when every leg pushed', () => {
    expect(payout(40, [{ odds: -110, outcome: 'push' }, { odds: -110, outcome: 'push' }])).toBe(40);
  });
});

// ─── Grading, against games we can check by hand ────────────────────────────

describe('grading real games', () => {
  it('settles a favourite that lost outright', () => {
    // BAL @ PIT, week 18: Baltimore favoured (-225), Pittsburgh +4.5 at home.
    // Final margin +2 to the home side, so Pittsburgh won and covered.
    const g = game('2025-w18-bal-pit');
    expect(g.spread_line).toBe(-4.5);
    expect(g.result).toBe(2);
    expect(gradeLeg({ market: 'spread', side: 'home' }, g)).toBe('win');
    expect(gradeLeg({ market: 'spread', side: 'away' }, g)).toBe('loss');
    expect(gradeLeg({ market: 'moneyline', side: 'home' }, g)).toBe('win');
    expect(gradeLeg({ market: 'moneyline', side: 'away' }, g)).toBe('loss');
    // 50 points against a 41.5 line.
    expect(gradeLeg({ market: 'total', side: 'over' }, g)).toBe('win');
    expect(gradeLeg({ market: 'total', side: 'under' }, g)).toBe('loss');
  });

  it('settles a home underdog that lost but covered', () => {
    // DEN @ KC, week 17: Denver a huge favourite, KC +13.5 at home, lost by 7.
    const g = game('2025-w17-den-kc');
    expect(g.spread_line).toBe(-13.5);
    expect(g.result).toBe(-7);
    expect(gradeLeg({ market: 'spread', side: 'home' }, g)).toBe('win');  // +13.5, lost by 7
    expect(gradeLeg({ market: 'moneyline', side: 'home' }, g)).toBe('loss'); // still lost
    expect(gradeLeg({ market: 'moneyline', side: 'away' }, g)).toBe('win');
  });

  it('settles a home favourite that covered, and an under', () => {
    // CAR @ JAX, week 1: Jacksonville favoured by 4.5 at home, won by 16.
    // The only case where spread_line is positive — home is the favourite —
    // so this is the direction the other fixtures do not exercise.
    const g = game('2025-w1-car-jax');
    expect(g.spread_line).toBe(4.5);
    expect(g.result).toBe(16);
    expect(gradeLeg({ market: 'spread', side: 'home' }, g)).toBe('win');
    expect(gradeLeg({ market: 'spread', side: 'away' }, g)).toBe('loss');
    expect(gradeLeg({ market: 'moneyline', side: 'home' }, g)).toBe('win');
    // 36 points against a 45.5 line.
    expect(gradeLeg({ market: 'total', side: 'under' }, g)).toBe('win');
    expect(gradeLeg({ market: 'total', side: 'over' }, g)).toBe('loss');
  });

  it('pushes a tie on the moneyline rather than calling it a loss', () => {
    const tied = SEASON_2025.filter(g => g.result === 0);
    expect(tied.length).toBeGreaterThan(0);
    for (const g of tied) {
      expect(gradeLeg({ market: 'moneyline', side: 'home' }, g)).toBe('push');
      expect(gradeLeg({ market: 'moneyline', side: 'away' }, g)).toBe('push');
    }
  });

  it('leaves an unplayed game ungraded rather than guessing', () => {
    const unplayed = { ...game('2025-w18-bal-pit'), result: null, total: null };
    for (const market of ['spread', 'total', 'moneyline']) {
      expect(gradeLeg({ market, side: 'home' }, unplayed)).toBeNull();
    }
    expect(gradeLeg({ market: 'spread', side: 'home' }, null)).toBeNull();
  });
});

// ─── The whole season ───────────────────────────────────────────────────────

describe('the 2025 season, graded end to end', () => {
  const byId = Object.fromEntries(SEASON_2025.map(g => [g.id, g]));

  const tally = (market, sides) => {
    const counts = { [sides[0]]: 0, [sides[1]]: 0, push: 0, ungraded: 0 };
    for (const g of SEASON_2025) {
      const o = gradeLeg({ market, side: sides[0] }, g);
      if (o === null) counts.ungraded++;
      else if (o === 'push') counts.push++;
      else if (o === 'win') counts[sides[0]]++;
      else counts[sides[1]]++;
    }
    return counts;
  };

  const spread = tally('spread', ['home', 'away']);
  const total = tally('total', ['over', 'under']);
  const ml = tally('moneyline', ['home', 'away']);

  it('grades every game in every market, with nothing left over', () => {
    for (const t of [spread, total, ml]) {
      expect(t.ungraded).toBe(0);
      const [a, b] = Object.keys(t).filter(k => k !== 'push' && k !== 'ungraded');
      expect(t[a] + t[b] + t.push).toBe(SEASON_2025.length);
    }
  });

  it('has spreads landing near a coin flip, which is what a spread is for', () => {
    const decided = spread.home + spread.away;
    const homeCoverRate = spread.home / decided;
    expect(homeCoverRate).toBeGreaterThan(0.40);
    expect(homeCoverRate).toBeLessThan(0.60);
  });

  it('has totals landing near a coin flip too', () => {
    const decided = total.over + total.under;
    expect(total.over / decided).toBeGreaterThan(0.40);
    expect(total.over / decided).toBeLessThan(0.60);
  });

  /**
   * The sign check that actually bites.
   *
   * A flipped spread convention would still produce a ~50% cover rate, because
   * covering is symmetric — so the cover rate above cannot catch it. Favourites
   * winning outright is not symmetric: they should take roughly two thirds of
   * games. If the orientation were wrong this lands near a third instead, which
   * is many standard errors away and impossible to miss.
   */
  it('has favourites winning about two thirds of the time', () => {
    let favWins = 0, decided = 0;
    for (const g of SEASON_2025) {
      if (g.result === 0 || g.spread_line === 0) continue;
      const homeFavoured = g.spread_line > 0;
      const homeWon = g.result > 0;
      decided++;
      if (homeFavoured === homeWon) favWins++;
    }
    const rate = favWins / decided;
    expect(rate).toBeGreaterThan(0.58);
    expect(rate).toBeLessThan(0.78);
  });

  it('agrees with the moneyline about who the favourite was', () => {
    // Two independent columns describing the same thing. If either sign is
    // misread they stop agreeing.
    let agree = 0, compared = 0;
    for (const g of SEASON_2025) {
      if (g.spread_line === 0 || g.home_moneyline === g.away_moneyline) continue;
      compared++;
      const favouredBySpread = g.spread_line > 0;          // home favoured
      const favouredByMoney = g.home_moneyline < g.away_moneyline;
      if (favouredBySpread === favouredByMoney) agree++;
    }
    expect(compared).toBeGreaterThan(250);
    expect(agree / compared).toBeGreaterThan(0.98);
  });

  it('has home teams winning slightly more than half, as they do', () => {
    const decided = SEASON_2025.filter(g => g.result !== 0);
    const homeWins = decided.filter(g => g.result > 0).length;
    const rate = homeWins / decided.length;
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.65);
  });

  /**
   * The exact identity that proves the payout maths.
   *
   * Stake both sides of a market in proportion to their fair chances and the
   * return is identical whoever wins — so the house's take is the hold, exactly,
   * every time, with no luck in it. Summed over 855 markets that is a single
   * number the engine either reproduces or doesn't.
   */
  it('hands the house exactly its edge on a perfectly balanced book', () => {
    let staked = 0, returned = 0, theoretical = 0, pushedMarkets = 0;

    for (const g of SEASON_2025) {
      for (const [market, sides] of [['spread', ['home', 'away']], ['total', ['over', 'under']], ['moneyline', ['home', 'away']]]) {
        const [a, b] = sides;
        const pa = fairProbability(oddsFor(g, market, a), oddsFor(g, market, b));
        const stakes = { [a]: pa, [b]: 1 - pa };

        let pushed = false;
        for (const side of sides) {
          const outcome = gradeLeg({ market, side }, g);
          staked += stakes[side];
          if (outcome === 'win') returned += stakes[side] * toDecimal(oddsFor(g, market, side));
          else if (outcome === 'push') { returned += stakes[side]; pushed = true; }
        }

        // A pushed market returns every stake, so the house takes nothing on
        // it — the edge only applies where the bet was actually decided.
        if (pushed) pushedMarkets++;
        else theoretical += houseHold([{ odds: oddsFor(g, market, a), otherSideOdds: oddsFor(g, market, b) }]);
      }
    }

    expect(staked).toBeCloseTo(SEASON_2025.length * 3, 6);
    expect(staked - returned).toBeCloseTo(theoretical, 6);
    // 2025 had exactly two: one spread landing on the number, and one tie.
    expect(pushedMarkets).toBe(2);
  });

  it('leaves the house up between 4 and 5 percent of everything staked', () => {
    let staked = 0, held = 0;
    for (const g of SEASON_2025) {
      for (const [market, sides] of [['spread', ['home', 'away']], ['total', ['over', 'under']], ['moneyline', ['home', 'away']]]) {
        held += houseHold([{ odds: oddsFor(g, market, sides[0]), otherSideOdds: oddsFor(g, market, sides[1]) }]);
        staked += 1;
      }
    }
    const rate = held / staked;
    expect(rate).toBeGreaterThan(0.035);
    expect(rate).toBeLessThan(0.055);
  });

  it('prices every side of every market without a gap', () => {
    for (const g of SEASON_2025) {
      for (const [market, sides] of Object.entries({ spread: ['home', 'away'], total: ['over', 'under'], moneyline: ['home', 'away'] })) {
        for (const side of sides) {
          expect(toDecimal(oddsFor(g, market, side)), `${g.id} ${market} ${side}`).toBeGreaterThan(1);
          expect(toDecimal(otherSideOdds(g, market, side))).toBeGreaterThan(1);
        }
      }
    }
  });

  it('settles a season of parlays without a bet stuck open', () => {
    // One 3-leg parlay per week, legs drawn from different games.
    const weeks = [...new Set(REGULAR_2025.map(g => g.week))];
    let won = 0, lost = 0, pushed = 0;

    for (const week of weeks) {
      const slate = REGULAR_2025.filter(g => g.week === week).slice(0, 3);
      if (slate.length < 3) continue;
      const bet = {
        stake: 10,
        legs: slate.map((g, i) => ({
          game_id: g.id,
          market: ['spread', 'total', 'moneyline'][i],
          side: ['home', 'over', 'home'][i],
          odds: oddsFor(g, ['spread', 'total', 'moneyline'][i], ['home', 'over', 'home'][i]),
        })),
      };
      expect(slipProblem(bet.legs)).toBeNull();

      const settled = settleBet(bet, byId);
      expect(settled.status).not.toBe('open');
      if (settled.status === 'won') { won++; expect(settled.returned).toBeGreaterThan(10); }
      if (settled.status === 'lost') { lost++; expect(settled.returned).toBe(0); }
      if (settled.status === 'push') pushed++;
      expect(settled.profit).toBeCloseTo(settled.returned - 10, 2);
    }

    expect(won + lost + pushed).toBe(weeks.length);
    // A 3-leg parlay hits about one time in eight; over 18 weeks, some but not many.
    expect(lost).toBeGreaterThan(won);
  });
});

// ─── What may go on one slip ────────────────────────────────────────────────

describe('slip rules', () => {
  const leg = (game_id, market, side = 'home') => ({ game_id, market, side, odds: -110 });

  it('takes an ordinary single', () => {
    expect(slipProblem([leg('g1', 'spread')])).toBeNull();
  });

  it('takes legs from different games', () => {
    expect(slipProblem([leg('g1', 'spread'), leg('g2', 'moneyline'), leg('g3', 'total')])).toBeNull();
  });

  it('allows a total alongside a spread on the same game', () => {
    expect(slipProblem([leg('g1', 'spread'), leg('g1', 'total', 'over')])).toBeNull();
  });

  it('allows a total alongside a moneyline on the same game', () => {
    expect(slipProblem([leg('g1', 'moneyline'), leg('g1', 'total', 'over')])).toBeNull();
  });

  it('refuses moneyline with spread on the same game, either order', () => {
    expect(slipProblem([leg('g1', 'spread'), leg('g1', 'moneyline')])).toMatch(/same bet/i);
    expect(slipProblem([leg('g1', 'moneyline'), leg('g1', 'spread')])).toMatch(/same bet/i);
  });

  it('refuses both sides of one market, which cannot both win', () => {
    expect(slipProblem([leg('g1', 'total', 'over'), leg('g1', 'total', 'under')])).toMatch(/has to lose/i);
  });

  it('refuses an empty slip and one that is too long', () => {
    expect(slipProblem([])).toMatch(/add a pick/i);
    const many = Array.from({ length: MAX_LEGS + 1 }, (_, i) => leg(`g${i}`, 'spread'));
    expect(slipProblem(many)).toMatch(new RegExp(`${MAX_LEGS} picks`));
  });

  it('lets the banned pairing through on separate games, where it is harmless', () => {
    expect(slipProblem([leg('g1', 'spread'), leg('g2', 'moneyline')])).toBeNull();
  });
});

// ─── Reading a database row ─────────────────────────────────────────────────

describe('mapping a games row for settlement', () => {
  const row = {
    id: 'x', home_score: 26, away_score: 24,
    spread_line: -4.5, total_line: 41.5,
    home_spread_odds: -115, away_spread_odds: -105,
    over_odds: -110, under_odds: -110,
    home_moneyline: 185, away_moneyline: -225,
  };

  it('derives the margin and the combined score from the two scores', () => {
    const g = forSettlement(row);
    expect(g.result).toBe(2);
    expect(g.total).toBe(50);
  });

  it('leaves both null while the game has no score', () => {
    const g = forSettlement({ ...row, home_score: null, away_score: null });
    expect(g.result).toBeNull();
    expect(g.total).toBeNull();
    expect(gradeLeg({ market: 'spread', side: 'home' }, g)).toBeNull();
  });

  it('grades straight off a mapped row', () => {
    const g = forSettlement(row);
    expect(gradeLeg({ market: 'spread', side: 'home' }, g)).toBe('win');
    expect(gradeLeg({ market: 'total', side: 'over' }, g)).toBe('win');
    expect(gradeLeg({ market: 'moneyline', side: 'home' }, g)).toBe('win');
  });

  it('knows a fully priced game from one the books have not posted yet', () => {
    expect(isPriced(row)).toBe(true);
    expect(isPriced({ ...row, total_line: null })).toBe(false);
    expect(isPriced({ ...row, home_moneyline: null })).toBe(false);
    expect(isPriced({ ...row, over_odds: null })).toBe(false);
  });
});

// ─── The combined price ─────────────────────────────────────────────────────

describe('toAmerican', () => {
  it('is the inverse of toDecimal for standard prices', () => {
    for (const price of [-110, -185, -250, 100, 150, 265, 1200]) {
      expect(toAmerican(toDecimal(price))).toBe(price);
    }
  });

  it('crosses over at evens', () => {
    expect(toAmerican(2)).toBe(100);
    expect(toAmerican(2.01)).toBe(101);
    expect(toAmerican(1.99)).toBe(-101);
  });

  it('refuses a multiplier that cannot be a price', () => {
    // A decimal of 1 or less would mean a bet that returns less than the
    // stake when it wins.
    expect(toAmerican(1)).toBeNull();
    expect(toAmerican(0.5)).toBeNull();
    expect(toAmerican(null)).toBeNull();
    expect(toAmerican(NaN)).toBeNull();
  });
});

describe('parlayOdds', () => {
  const leg = odds => ({ odds });

  it('prices a single at its own price', () => {
    expect(parlayOdds([leg(-110)])).toBe(-110);
    expect(parlayOdds([leg(150)])).toBe(150);
  });

  it('prices the standard two-team parlay at +264', () => {
    // 1.909091² = 3.6446, which every book in the world quotes as +264.
    expect(parlayOdds([leg(-110), leg(-110)])).toBe(264);
  });

  it('prices the standard three- and four-team parlays', () => {
    expect(parlayOdds([leg(-110), leg(-110), leg(-110)])).toBe(596);
    expect(parlayOdds([leg(-110), leg(-110), leg(-110), leg(-110)])).toBe(1228);
  });

  it('handles mixed favourites and underdogs', () => {
    // 1.5405 × 2.5 = 3.8512
    expect(parlayOdds([leg(-185), leg(150)])).toBe(285);
  });

  it('drops a pushed leg, so the slip reprices as one leg shorter', () => {
    const withPush = [leg(-110), leg(-110), { odds: -110, outcome: 'push' }];
    expect(parlayOdds(withPush)).toBe(parlayOdds([leg(-110), leg(-110)]));
  });

  it('agrees with the payout it is shown next to', () => {
    // The price is rounded for display and the payout is not, so they can
    // differ by a rounding step — but never by more than one unit per 100
    // staked, which is what makes showing the rounded number honest.
    const legs = [leg(-110), leg(-115), leg(120)];
    const shown = parlayOdds(legs);
    const impliedReturn = 100 * (shown > 0 ? 1 + shown / 100 : 1 + 100 / Math.abs(shown));
    expect(Math.abs(payout(100, legs) - impliedReturn)).toBeLessThan(1);
  });

  it('returns null when a leg has no price', () => {
    expect(parlayOdds([leg(-110), leg(null)])).toBeNull();
  });
});

// ─── The playoff round ──────────────────────────────────────────────────────

describe('playoff rounds', () => {
  it('knows the four rounds and nothing else', () => {
    expect(PLAYOFF_WEEKS).toEqual([19, 20, 21, 22]);
    for (const w of [1, 10, 18, 23]) expect(isPlayoffWeek(w)).toBe(false);
    for (const w of PLAYOFF_WEEKS) expect(isPlayoffWeek(w)).toBe(true);
  });

  it('names them, and leaves regular weeks as numbers', () => {
    expect(weekLabel(19)).toBe('Wild Card');
    expect(weekLabel(22)).toBe('Super Bowl');
    expect(weekLabel(7)).toBe('Week 7');
  });

  it('climbs the floor as the field narrows', () => {
    const floors = PLAYOFF_WEEKS.map(w => PLAYOFF_ROUNDS[w].floor);
    expect(floors).toEqual([0.10, 0.20, 0.35, 0.60]);
    for (let i = 1; i < floors.length; i++) expect(floors[i]).toBeGreaterThan(floors[i - 1]);
  });

  it('scales the minimum with whoever is holding it', () => {
    // The point of a percentage: both players face the same decision.
    expect(requiredStake(19, 1000)).toBe(100);
    expect(requiredStake(19, 40)).toBe(4);
    expect(requiredStake(22, 1000)).toBe(600);
    expect(requiredStake(22, 40)).toBe(24);
  });

  it('asks nothing of a regular week or an empty balance', () => {
    expect(requiredStake(12, 500)).toBe(0);
    expect(requiredStake(19, 0)).toBe(0);
    expect(requiredStake(19, -5)).toBe(0);
  });

  it('forfeits only the part you did not put at risk', () => {
    expect(shortfall(19, 1000, 0)).toBe(100);    // bet nothing, lose the floor
    expect(shortfall(19, 1000, 60)).toBe(40);    // bet 60 of 100, lose 40
    expect(shortfall(19, 1000, 100)).toBe(0);    // met it exactly
    expect(shortfall(19, 1000, 250)).toBe(0);    // over it, nothing owed
  });

  it('never penalises outside the playoffs', () => {
    for (const w of [1, 9, 18]) expect(shortfall(w, 1000, 0)).toBe(0);
  });

  it('cannot take a balance to zero on its own', () => {
    // Even doing nothing every round, the floor is a share of what is left, so
    // it approaches zero without reaching it — nobody is knocked out.
    let bal = 1000;
    for (const w of PLAYOFF_WEEKS) bal = coast(bal, w);
    expect(bal).toBeGreaterThan(0);
    expect(bal).toBeLessThan(1000 * 0.9 * 0.8 * 0.65 * 0.4 + 0.01);
  });

  it('compounds, because each round is a share of what you carried in', () => {
    // The rounds are assessed in order and each forfeit changes what the next
    // one asks for. bankroll_apply_forfeits does this with an ORDER BY on the
    // week; without it a batch catching two unassessed rounds at once would
    // take an amount that depended on row order.
    //
    // 500 carried out of week 18, betting nothing:
    expect(coast(500, 19)).toBe(450);        // 10% of 500
    expect(coast(450, 20)).toBe(360);        // 20% of 450, not of 500
    expect(coast(360, 21)).toBe(234);        // 35% of 360
    expect(coast(234, 22)).toBe(93.6);       // 60% of 234

    // Which is the number docs/bankroll.md quotes: coasting the whole
    // postseason costs about 81% of a balance.
    expect(1 - 93.6 / 500).toBeCloseTo(0.8128, 4);
  });

  it('takes only the part you did not risk, never a fine on top', () => {
    // Staking 40 into a round that demanded 90 forfeits 50, not 90 — matching
    // the note bankroll_apply_forfeits writes into the ledger.
    expect(shortfall(20, 450, 40)).toBe(50);
    expect(requiredStake(20, 450)).toBe(90);
  });
});

/** One round of doing nothing: what a balance is worth after the forfeit. */
const coast = (bal, week) =>
  Math.round((bal - shortfall(week, bal, 0)) * 100) / 100;
