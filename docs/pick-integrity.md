# What stops someone cheating a pick

These rules live in Postgres, not in this repo. That's deliberate: the client
is a static bundle anyone can read, the publishable key ships inside it, and a
signed-in player's token sits in their own localStorage. Calling the REST API
directly is a `fetch` from devtools, not an exploit — so anything the UI merely
declines to offer is not enforced at all. Every rule below is a row-level
security policy or a table constraint, which the API cannot be talked out of.

Written down here because none of it is visible from the source.

## Weekly predictions

A pick may only be filed on a game that **has not kicked off**, and the row's
`week` and `season` must **agree with the game's own**.

Kickoff is guarded twice, on purpose:

- `is_locked = false` — the flag the sync maintains
- `now() < game_time` — the clock

Either alone leaves a gap. `is_locked` is written by the hourly sync, so it
lags reality by up to an hour after a game starts; `now() < game_time` is exact
and depends on nothing having run. Both are required, on INSERT and on UPDATE.

### What this closed

The INSERT policy used to check only that you were writing as yourself. The
lock check lived solely on UPDATE, so you could not *edit* a pick after
kickoff — but you could *create* one. Scoring is closest-to-actual-spread, so a
pick filed after the whistle with the real number wins that game outright.

The worst case wasn't one game. Skip a whole week, wait for Sunday to finish,
then file all sixteen with the real spreads: a perfect week. The unique key on
`(user_id, game_id)` limits it to games you hadn't already picked, so someone
who submits their full slate has nothing to backdate — which is exactly
backwards, since it rewards not playing.

Verified by probing as a real non-admin through RLS: insert onto a finished
game, update an open pick onto a finished game, a row claiming the wrong week,
and a game past kickoff that the sync hadn't yet flagged. All refused. Filing
and re-saving an ordinary pick still work, including through the `upsert` the
app actually issues.

## Survivor picks

Already enforced, and unchanged:

- The game must exist, match the row's week and season, be unlocked, and not
  have kicked off — the same rule the weekly picks now carry.
- The team must be one of the two actually playing in that game.
- The entry must belong to you.
- `UNIQUE (entry_id, team_abbr)` — a team cannot be used twice, whatever the
  client allows.
- `UNIQUE (entry_id, week)` — one pick per week.

A consequence worth knowing: **picks for future weeks are accepted.** Nothing
ties a pick to the current week, so someone could fill in weeks 7 through 18
today. It buys nothing — the team burns immediately, the pick stays editable
until that game starts, and no advantage exists in committing early — so it is
allowed rather than blocked.

## What is not enforced in the database

**Elimination.** An eliminated entry can still write picks. They are inert:
`computeEntryStatus` grades from the first loss forward and later picks cannot
resurrect anyone. Pinned by `season.test.js`.

**Admin.** `is_admin` cannot be self-granted — an update naming it runs, reports
a row changed, and leaves the column as it was. Verified directly.

## The audit trail

`pick_audit` records every insert, update and delete on both pick tables, with
a timestamp and the before/after values, readable in **Admin → Pick log**. It is
detection rather than prevention: it won't stop a bad write, but it makes one
obvious, and it's what answers "I submitted my pick and it says I missed".
