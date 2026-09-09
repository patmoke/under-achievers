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
weekly picks game grades everyone against one shared number, and the betting
game does not.

**A game's line freezes the moment `weekly_locked` flips true for it, and
never before.** `weekly_locked` is a **Call the Line-only** flag, deliberately
kept separate from `is_locked` — see "Two locks, not one" below. It flips true
from either of two places:

- **This function, at that game's own kickoff** — the same moment `is_locked`
  flips, for the same reason.
- **A database trigger on `predictions`, the instant every Call the Line
  player has a pick on every game in that week** — `weekly_all_submitted()` /
  `lock_week_when_all_submitted()`, applied statement-level so a whole-week
  batch upsert (how the app actually saves picks) is judged once, after every
  row in it has landed. This locks the *entire week's* games at once, however
  far off kickoff still is — there is no need to wait for it once everyone is
  in. "Every Call the Line player" means every distinct member across every
  `compete_on='weekly'` league, not just one league's roster, because picks
  aren't league-scoped — one set of predictions counts in every weekly league
  a player is in.

  Requires at least two such players to ever fire. A brand-new league starts
  with just its owner in it, and without this floor, the owner finishing
  their own picks would trivially satisfy "everyone's submitted" — there's
  nobody else to be waiting on. Worse, it doesn't fix itself: joining a
  league isn't a write to `predictions`, so nothing re-checks when a second
  member arrives, and by then `weekly_locked` may already be true, which
  blocks that new member's very first pick before they get a chance to
  trigger a re-check that would have counted them. Below two required
  players, this always defers to the normal kickoff backstop instead.

Either writer freezes the same way: once `weekly_locked` is true, this
function never touches that game's `actual_spread` again — with one
exception, a game we never captured a line for at all still accepts a late
one, because a late line beats no line.

The old rule froze a whole week together at a fixed clock instant (the last
Sunday game before the week, plus four hours) regardless of whether anyone had
picked. That clock-based schedule is retired — `src/lib/lines.js` and the
Edge Function's matching freeze-schedule code are both gone. The kickoff flip
remains as the backstop for a week nobody finishes early: worst case, it locks
exactly the way it always did.

### Two locks, not one

`is_locked` and `weekly_locked` look alike and both live on `games`, but they
answer different questions and must never be merged:

- **`is_locked`** — has this game's own kickoff passed? Nothing else. Survivor
  picks its own RLS policies off this exact flag (`docs/pick-integrity.md`),
  and general tooling (Admin's manual lock toggle, entering a final score)
  treats it the same way. It only ever flips at kickoff.
- **`weekly_locked`** — is Call the Line done with this game? Same as
  `is_locked` at kickoff, but can also flip early once everyone's picked.

The two were one column at first, and that was a real bug: an early Call the
Line lock flipped `is_locked` for the whole week, which also locked Survivor
out of games that hadn't actually kicked off yet, since Survivor's own picking
window depends on that same flag. `weekly_locked` exists precisely so Call the
Line's completion state can never leak into a different game mode's locking
again. Both still flip true together at kickoff — they only diverge on the
early side.

## Reading the outcome

The sync returns `{ synced, linesWritten, linesFrozen, marketsWritten,
marketsClosed, playoffGames, errors }`, and the Admin toast shows the first
few. `linesFrozen` counts games this run found already locked with a line on
file — the only visible sign the freeze is holding; a sudden zero mid-season
would mean settled numbers had started moving again.

Runs are also recorded in `sync_runs`, surfaced under Admin → Health.

## Rules that hold regardless

- `is_locked` and `weekly_locked` each only ever flip false → true. Never
  back — true of every writer of either one.
- Regular season only (`game_type = 'REG'`); the week numbering doesn't model
  playoff weeks.
- nflverse's `spread_line` is positive when the home team is favoured. Ours is
  negative when the home team is favoured, matching standard odds notation, so
  the sign is flipped on the way in.

## How this is tested

`src/lib/season.test.js` plays the whole 2026 season through the real synced
schedule — 272 games, bye weeks, Thanksgiving, Christmas, the week 18
all-at-once slate, the November clock change — and asserts the week derivation,
a survivor pool, and the standings all stay coherent at every step. The
schedule it runs on is a fixture pulled straight from the `games` table, so it
is the same data production reads.

The early-lock trigger itself (`weekly_all_submitted` /
`lock_week_when_all_submitted`) lives in Postgres, not in this repo — it was
verified directly against the live database with a throwaway week and two
real users: a valid same-total pick reallocation succeeds, a week locks the
moment the last required player's picks land, and a locked week's rows reject
further writes under RLS.
