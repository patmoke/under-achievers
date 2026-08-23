# Bankroll: the schema

The betting league's tables, functions and access rules. They live in Postgres,
so this is the only place they are visible from the repo. The game's rules —
what the units do, what wins, how the playoffs run — are in the design
document; this covers how it is built and what stops it being abused.

`src/lib/odds.js` is the matching client-side engine, proven against the whole
2025 season in `odds.test.js`.

## Tables

| Table | One row per | Notable |
|---|---|---|
| `bankroll_settings` | League | `weekly_allowance`, `min_stake`, `max_legs`, `late_season_minimum`, `playoff_round` |
| `bets` | Slip placed | `stake`, `status`, `fair_probability`, `expected_hold`, `returned` |
| `bet_legs` | Selection on a slip | `market`, `side`, `line`, `odds`, `other_side_odds`, `outcome` |
| `bankroll_ledger` | Movement of units | `kind` (allowance / stake / return / adjustment), signed `amount` |

A straight bet is a bet with one leg. A parlay is the same shape with more.
That keeps settlement to a single code path rather than two that drift apart.

### Balance is never stored

It is `sum(amount)` over the ledger. That makes "how did I get to 340 units"
answerable to the unit, and at roughly three thousand rows a season there is no
performance argument for a mutable column something has to remember to update.

### Allowances are credited lazily

There is no scheduled job. `bankroll_credit_allowances()` tops everyone up to
the current week, and a partial unique index on
`(league_id, user_id, season, week) where kind = 'allowance'` makes a double
credit impossible even if two people open the standings in the same second.
Nothing to schedule and nothing that can quietly stop running.

## Placing a bet

`place_bet(league_id, stake, legs)` is the only way a bet comes into existence.
Direct writes are closed — **there is no INSERT, UPDATE or DELETE policy on any
of these tables**, for anyone.

Four things have to happen together, and none can be trusted to a browser:

1. Read the price out of the `games` row. **The legs payload carries no odds.**
   A client that could name its own price would name a good one.
2. Check every leg's game is open — `is_locked` *and* `now() < game_time`,
   because the flag comes from an hourly sync and lags reality by up to an hour.
3. Check the stake against what the ledger actually shows.
4. Write the legs and debit the stake atomically.

The week comes from `bankroll_current_week()`, derived from the schedule, not
from the request. A client that can name the week can name last week.

### What it refuses

Probed through RLS as an ordinary member. All refused:

- a stake above the balance, below the minimum, or negative
- a game that has already kicked off
- moneyline and spread on the same game
- both sides of one market — the `unique (bet_id, game_id, market)` constraint
- more legs than the league allows
- a direct `INSERT` into `bets` or `bankroll_ledger`
- an `UPDATE` of your own bet — bets are immutable once struck
- betting in a league you are not a member of

And a leg sent with `"odds": 100000` stored the real `-185` off the games row.

## Who can see a bet

Your own always. Everyone else's once **every** game on the slip has kicked
off — so a parlay stays hidden while a single leg is still live, which is the
case that matters: revealing early would leak a pick that can still be copied.

### The recursion this caused

The first version had `bets` check `bet_legs` for whether the games had
started, and `bet_legs` check `bets` for its parent. Postgres evaluates the
policies of every table a policy touches, so the two called each other until it
gave up:

```
ERROR: infinite recursion detected in policy for relation "bet_legs"
```

Both directions now go through `SECURITY DEFINER` helpers — `bet_is_revealed()`
and `can_see_bet()` — which read the other table with their own rights, so no
policy is evaluated inside them and the cycle cannot form. If you add a policy
here that references the sibling table directly, this comes straight back.

## The vig, fixed at placement

`fair_probability` and `expected_hold` are computed from both sides of every
market when the bet is struck, so the house's expected take is known
immediately and never has to be rebuilt from prices that have since moved.

The SQL and `src/lib/odds.js` agree exactly — a moneyline at −185/+154 gives
`fair 0.62246655, hold 0.04106504` from both. Worth re-checking if either side
is edited, because nothing automatically compares them.
