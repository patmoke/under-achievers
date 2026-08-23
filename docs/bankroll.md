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

## Settlement

`settle_bets()` grades every leg whose game is final, resolves every bet with
nothing ungraded left, and credits the returns. It runs on `pg_cron` at **:10
and :40** — ten minutes after each games sync, so scores have landed before
anything is graded. Admin → Games has a **Settle bets** button for when a
score arrives late and someone is waiting to be paid.

Three properties carry the weight:

**Idempotent.** Legs are graded only while their outcome is null, bets resolved
only while open, and the return written once — enforced by a unique index on
`bankroll_ledger(bet_id) where kind = 'return'`, not by remembering. A second
run over the same bets settles nothing and pays nothing.

**Graded against the price that was struck.** A leg carries the line it was
placed at and is judged by that. Reading `games.spread_line` at settlement
would grade people against a number that moved after they bet, which is the
entire reason the line is snapshotted onto the leg.

**Recorded.** Every run lands in `bankroll_settlement_runs`, and two health
checks watch it: *Bets waiting to be settled* (all games finished, still open —
someone is owed units) and *Negative bankrolls* (a stake was accepted the
balance could not cover). Both are alerts, not warnings.

### How it was proven

A league, 22 bets across every market — singles and parlays — then the games
played out and settled:

```
first run   : 32 legs graded, 22 bets settled, 317.63 paid
outcomes    : 10 won, 11 lost, 1 push
second run  : 0 legs, 0 bets, 0.00 paid
ledger      : allowance 100000 − staked 303 + returned 317.63 = 100014.63
balance()   : 100014.63   reconciles
```

Then every one of those 22 bets was re-graded independently by
`src/lib/odds.js` from the same inputs. **All 22 agree on status and payout to
the cent.** Two implementations, written separately, reaching the same verdict
is the strongest evidence available short of a real season.

The two rare cases were forced rather than waited for: a spread landing exactly
on its number, and a game ending level so the moneyline pushes.

### The bug this found

The first version named a PL/pgSQL record variable `l` and used `l` as the
table alias in the grading UPDATE. PL/pgSQL resolves a qualified name against
its own declarations first, so `l.market` bound to the unassigned record rather
than the row being updated, and the whole thing died with *"record l is not
assigned yet"* on the first settlement. Nothing would have been graded, ever.

## The playoff round

The postseason runs on different rules, and they exist to close the season
format's one real weakness: unused units bank, so a leader can protect a lead
by not betting. Sitting out the playoffs is now the most expensive thing anyone
can do.

**No new allowance.** `bankroll_credit_allowances()` caps its top-up at week 18:

```sql
v_week := least(bankroll_current_week(v_season), 18);
```

That single `least()` *is* the rule. Whatever you carry out of week 18 is what
you have for January.

**An escalating minimum stake.** Each round demands a share of the balance you
brought into it, and whatever you have not put at risk by its last kickoff is
taken:

| Week | Round       | Minimum |
|------|-------------|---------|
| 19   | Wild Card   | 10%     |
| 20   | Divisional  | 20%     |
| 21   | Conference  | 35%     |
| 22   | Super Bowl  | 60%     |

A share rather than a fixed number, so someone down to 40 units faces the same
decision as someone holding 900, and nobody is locked out or busted to exactly
zero.

The share is measured against the balance **carried into that round**, so the
rounds compound: 500 units coasted through the postseason goes 500 → 450 → 360
→ 234 → 93.6, a loss of about 81%. Betting badly can cost less than that, which
is the whole point. It also means the rounds have to be assessed in order —
`bankroll_apply_forfeits` carries an `order by g.week` for exactly that reason,
and `odds.test.js` pins the chain.

nflverse numbers the rounds 19–22 in the same `week` column as the regular
season, so nothing is remapped anywhere — `bankroll_current_week` simply runs
to 22 and `sync-games` accepts `WC`/`DIV`/`CON`/`SB` as those numbers.

### What enforces it

`bankroll_apply_forfeits()` runs at the end of `settle_bets()` — after the
round's winnings are in the ledger, so the next round's floor is measured
against a balance that is actually settled. A round is only assessed once
`max(game_time) <= now()`, and the forfeit is written as a `'forfeit'` ledger
row guarded by a partial unique index on `(league_id, user_id, season, week)
where kind = 'forfeit'`. Assessing the same round twice takes nothing twice.

The penalty is never more than the shortfall: it is the part you did not put at
risk, not a fine on top of it. Someone with a balance of zero or less is
skipped entirely.

A league whose `bankroll_settings.playoff_round` is false is skipped, and the
season simply ends at week 18.

### What the player sees

`bankroll_round_status(league_id, user_id)` returns one jsonb object — the
week, the round name, the floor, the balance carried in, what has been staked,
and the shortfall — and it is the *same arithmetic* `bankroll_apply_forfeits()`
runs. What the banner warns about is what actually gets taken.

It also answers "what week is it" for the betting game, which matters because
the weekly game and the survivor pool stop at 18. `BankrollTab` derives its
week from this call rather than from the shared `currentWeek` prop; borrowing
that one would pin the board to week 18 for all of January.

### Playoff games carry no `actual_spread`

`sync-games` skips that column for weeks 19–22 and computes its freeze points
from regular-season rows only. `actual_spread` belongs to the weekly prediction
game, which does not run in the playoffs, and it carries the opposite sign
convention to `spread_line` — writing it here would be a negation waiting to be
read by the wrong side. The betting game reads `spread_line` and nothing else.

The health check *Upcoming games without a line* is scoped to weeks 1–18 for
the same reason: an unpriced playoff game in early January is a bracket that
does not exist yet, not a broken feed.

## Standings and the house

`bankroll_standings(league_id)` is a function rather than a view, because it
credits allowances before reading balances — opening the standings is what tops
everyone up, so a view could never be the entry point. Members only.

Balance is the score and the board sorts on it. The rest is context for *why*
someone is there: a big balance off two lucky parlays reads very differently
from one off thirty disciplined singles, and the record and biggest win are
what separate them.

### What is public

Everything on the board, plus **how many bets you have placed this week and how
much is at risk — never what they are on**. That is the deliberate middle
ground: enough to see who is active and who has forgotten, without letting
anyone copy a slip. Slips themselves become public once every game on them has
kicked off.

It is also the main defence against the one weakness in the season format.
Unused units bank, so a clear leader can protect a lead by not betting — and
the board showing "nothing yet" against their name is what makes that visible.

### `bankroll_house(league_id)`

| | |
|---|---|
| **take** | Stakes in, returns out. What the house actually kept. Swings with luck. |
| **vig** | The edge built into the prices people accepted. Fixed at placement, barely moves. |
| **luck** | take − vig. |

Settled bets only on both sides, so the two are comparable. Pass `null` for the
whole platform — that path is admin-only.

Verified on a two-player league across 80 settled bets:

```
take 45.46   vig 35.02   luck 10.44
take = staked − returned : true
luck = take − vig        : true
vig as % of staked       : 4.38%
```

The vig percentage is the meaningful check, because it is deterministic — it
falls out of the prices alone, and 4.38% is where a mix of spreads, totals and
moneylines should land. **Take is not evidence of anything at this sample
size**; on 80 bets it is mostly noise, and the two converging is a claim that
needs a season behind it, not a probe.
