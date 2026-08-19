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

## When lines freeze

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
