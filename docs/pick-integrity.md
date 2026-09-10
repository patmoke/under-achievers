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

- `weekly_locked = false` — the flag the sync (and the trigger below) maintain
- `now() < game_time` — the clock

Either alone leaves a gap. `weekly_locked` lags reality by up to an hour after
a game starts if only the hourly sync were writing it; `now() < game_time` is
exact and depends on nothing having run. Both are required, on INSERT and on
UPDATE.

`weekly_locked` is Call the Line's **own** column, not `is_locked` — that
distinction is load-bearing. It has two writers: the sync, at a game's own
kickoff, and `weekly_all_submitted()` / `lock_week_when_all_submitted()`, a
statement-level trigger on `predictions` that locks a whole week's games
early, the moment every Call the Line player has a pick on every game in it —
see `docs/games-sync.md`. A save that happens to be the one completing the
week is still accepted — the trigger fires after the statement, in the same
transaction — but no further save is, by anyone, until the next
kickoff-eligible game rolls around next week.

It used to be `is_locked`, and that was a real bug: `is_locked` is also what
Survivor's own RLS depends on (below), so an early Call the Line lock was
locking Survivor out of games days before they'd actually kicked off. Split
into its own column so Call the Line finishing early can never again reach
into a different game mode's locking.

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

- The game must exist, match the row's week and season, be unlocked
  (`is_locked = false`, Survivor's own column — see the note above), and not
  have kicked off. Same shape of rule as the weekly picks, deliberately on a
  separate flag.
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

### The real write path is a function, not the table — and that's where the gap was

The app writes survivor picks through `make_survivor_pick()`, a
`SECURITY DEFINER` RPC, not a raw `upsert` against `survivor_picks`. That
matters: a `SECURITY DEFINER` function runs as its owner and **bypasses RLS
entirely** — the "unlocked and not kicked off" rule above only holds for a
pick made through it because the function re-implements that check by hand.
Nothing about RLS protects a path that goes around it.

It re-implemented the check for the game being picked *into*, but never
checked the entry's *existing* pick for that week — so a pick for a game that
had already kicked off could be freely switched to a different, still-open
game and team, with no error. This was real, not theoretical: on 2026-09-10,
an entry's week-1 pick (SEA, in a game that had already finished — SEA won)
was switched to TB @ CIN, a game more than ten hours from kicking off. SEA
had actually won, so this specific instance didn't dodge an elimination, but
it did something just as wrong: the team-burn check only looks at *other*
weeks, so switching away also silently un-burned SEA for that entry, freeing
it to be picked again later in the season — undermining "a team is used once"
regardless of whether the original pick had won or lost.

Fixed by checking the entry's current pick for `p_week` first, before
touching anything: if one exists and its game is already locked or past
kickoff, the whole call is refused, full stop, regardless of what's being
swapped in. Verified by reproducing the exact exploit (same entry, same
switch) against the live database and confirming it's now refused, then
confirming a normal not-yet-locked swap still works.

Found by searching `pick_audit` for every `survivor_picks` update where the
*old* row's game had already kicked off by the time of the edit — the query
worth keeping if this class of bug is ever suspected again:

```sql
select pa.*, g.game_time as old_game_kickoff
from pick_audit pa
join games g on g.id = (pa.old_value->>'game_id')
where pa.source_table = 'survivor_picks'
  and pa.action = 'update'
  and pa.at >= g.game_time;
```

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
