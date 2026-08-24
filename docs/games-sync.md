# The games sync

One Edge Function, `sync-games`, keeps the `games` table in step with the real
schedule: kickoff times, Vegas lines, and final scores. It is the only thing
that writes those columns.

Its source lives in Supabase (Edge Functions → sync-games), not in this repo —
it is deployed through the dashboard rather than from a checkout. This page is
the record of what it does and why, so the rules survive independently of the
one copy of the code.

## Where the data comes from

nflverse's public `games.csv`, not a live odds feed.

ESPN's scoreboard API was the obvious choice and it does not work: their edge
network hard-blocks cloud and serverless IP ranges, Supabase's included —
confirmed by a live 403 from inside the function. `raw.githubusercontent.com`
is not blocked.

The trade-off is that this is a periodically-published file, so scores land as
final shortly after a game ends rather than ticking during it.

## When it runs

A `pg_cron` job fires it hourly. Admin → Games also has a **Sync games** button
that runs the same function on demand.

Nothing about the schedule needs a weekly nudge: the function always pulls the
whole season, so next week's games are already in the table long before anyone
needs them.

## What "the current week" means

The app does not compute the week from a hardcoded season-start date. It reads
the next unplayed game out of `games` and takes its week — so the rollover
happens exactly when the last game of a week kicks off, and it cannot drift out
of step with a schedule change.

`useCurrentWeek` re-derives on a fifteen-minute timer and whenever the app
returns to the foreground. That matters for the installed app specifically: a
PWA left open across a Sunday night used to hold the old week indefinitely,
which meant picking into a week that had already closed.

## What a row carries

The feed publishes a full three-market picture per game, and all of it is now
kept:

| Column | Is |
|---|---|
| `actual_spread` | The weekly picks game's number. **Negated** — negative means home favoured. |
| `spread_line` | The betting game's number. The feed's own convention — **positive** means home favoured. |
| `home_spread_odds` · `away_spread_odds` | Prices on each side of the spread |
| `total_line` · `over_odds` · `under_odds` | The over/under and its prices |
| `home_moneyline` · `away_moneyline` | Straight-winner prices |

There is no stored result or points total. `home_score` and `away_score` are
already there and both are derivable, so a second copy could only ever disagree
with the first — `forSettlement()` in `src/lib/odds.js` derives them on read.

### The two spreads carry opposite signs, on purpose

`actual_spread` is `spread_line` negated. Both sit on the same row. Read the
one belonging to the game you are working on and never the other — mixing them
produces bets that settle backwards and look nearly right, which is the worst
kind of bug to find in week 9.

A sync run asserts they stay exact mirrors; a check in Admin → Health would
catch a drift, and the migration that added these columns verified all 112
priced games agreed.

## When lines freeze

This applies to **`actual_spread` only**. The betting markets do not freeze —
they track right up to kickoff and stop there, so what is left on a played game
is the closing line. A bet stores the price it was struck at, so a line moving
underneath it changes nothing already placed; the freeze exists because the
weekly game grades everyone against one shared number, and the betting game
does not.

**A week's lines stop moving after the last Sunday game before that week's
first kickoff** — in practice, Sunday night's game plus four hours, so a little
past midnight Eastern on Monday.

The whole week freezes at a single moment rather than each game freezing on its
own clock. Everyone is then picking against the same set of numbers, and a
Thursday game isn't graded against a line that was still moving days after a
Sunday game's was settled.

Week 1 has no NFL Sunday before it, so its freeze point is synthesised: the
calendar Sunday before the opener, at the hour a Sunday night game would have
kicked off, plus the same four hours.

Before the freeze the number tracks the market on every run. After it the
number is settled and never rewritten — with one exception: a game we never
captured a line for at all still accepts a late one, because a late line beats
no line.

The previous rule was "write a line only if the column is empty", which sounds
equivalent and isn't. nflverse publishes lookahead lines months ahead, so a
January game was being graded against a number captured in August.

## Reading the outcome

The sync returns `{ synced, linesWritten, linesFrozen, freezePoints, errors }`,
and the Admin toast shows the first three. `freezePoints` is the computed
freeze instant for every week — useful for confirming the rule at a glance,
since every week should land on Monday at 00:20 Eastern.

Runs are also recorded in `sync_runs`, surfaced under Admin → Health.

## Rules that hold regardless

- `is_locked` only ever flips false → true, at kickoff. Never back.
- Regular season only (`game_type = 'REG'`); the week numbering doesn't model
  playoff weeks.
- nflverse's `spread_line` is positive when the home team is favoured. Ours is
  negative when the home team is favoured, matching standard odds notation, so
  the sign is flipped on the way in.

## How this is tested

`src/lib/season.test.js` plays the whole 2026 season through the real synced
schedule — 272 games, bye weeks, Thanksgiving, Christmas, the week 18
all-at-once slate, the November clock change — and asserts the week derivation,
the freeze schedule, a survivor pool, the confidence budget, and the standings
all stay coherent at every step. The schedule it runs on is a fixture pulled
straight from the `games` table, so it is the same data production reads.

The freeze rule lives in two places: `src/lib/lines.js` in the app, and a copy
inside the Edge Function. They are independent implementations — the app's uses
`Intl` for Eastern time, the function's a hand-rolled offset table — and the
test pins both to the freeze points a live sync actually returned. If either
drifts, that test fails and names the week.
