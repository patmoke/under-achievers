# Survivor picks: filing ahead, and what the pool can see

## Advance picks were already legal

The INSERT policy on `survivor_picks` only ever asked two things: that you own
the entry, and that the game has not kicked off. **Nothing tied a pick to the
current week.** A week-6 pick could be filed through the API at any point; the
only thing stopping it was the UI, which rendered `currentWeek` and nothing else.

So this was mostly a front-end change on a model that already allowed it. The
part that needed real work was the collision advance picks make routine.

## The collision

There is a unique index on `(entry_id, team_abbr)` — one team per entry per
season, enforced by storage rather than by convention.

That means filing KC for week 6 and then taking KC in week 2 does not merely
need a policy decision. Left alone it **fails on a constraint violation**. The
near-term pick has to win and the later one has to go, and both have to happen
together or the entry ends up with two picks on one team, or none.

`make_survivor_pick(entry_id, week, game_id, team, release)` owns that. It:

1. checks you own the entry, and that the game matches the week and season
2. checks kickoff twice — `is_locked` and the clock, since the flag is written
   by an hourly sync and lags reality
3. **refuses** if the team sits on a pick that has already locked. That team is
   spent for the season; this is the rule that makes survivor survivor and
   nothing below softens it
4. if the team sits on a pick that has *not* locked, clears it — but only when
   `release` is true
5. writes the new pick

All in one transaction, which two client calls could not manage.

### Why `release` exists

`release` is the user's answer to *"your week 6 pick will be cleared"*. The
client asks before calling, and the function refuses without it, so the
destructive step cannot happen from a stray call or a retry.

It is a **confirmation, not a notification**, and the difference matters. The
person is right there — they just tapped the team. Telling them afterwards makes
it something that happened to them; asking makes it something they chose. The
dialog names the consequence rather than the action: *week 6 will be left with
no pick*, and a week with no pick when its games kick off is an elimination.

That is the sharp edge of this whole feature. Advance picks exist to protect
someone who knows they will be unavailable, and this rule can quietly
**un-protect exactly that person** — file week 6 because of a trip, take that
team in week 2 without thinking, and week 6 is now empty during the week they
cannot log in. Hence the wording, and hence the "Filed ahead" strip, which keeps
what you have planned in front of you rather than out of sight.

Picks can also now be withdrawn outright, via a DELETE policy scoped to unlocked
games — otherwise filing ahead would commit you to naming *some* team for a week
you are not ready to decide.

### Locking no longer ends the section

The pick UI used to stop rendering once your current-week pick locked. That shut
the door on filing ahead at precisely the moment someone is most likely to want
to — pick made, week under way, now let me sort out next week. The locked pick
is now stated as a line above a picker that still offers every open week.

Caught by a browser probe, not by reading the code.

## What the pool can see

Two displays were added, and both are constrained by the same rule that governs
the pick history: **nothing is visible until its game has kicked off.**

**Teams burned** counts, for each of the 32 teams, how many still-alive entries
have used it. It counts locked picks only. Counting unlocked ones would publish
through the back door exactly what the pick history is careful to hide — thirty
entries on one team is not a hard sum. Teams nobody has used are listed at zero,
because the useful question is usually "who is left" rather than "who is gone".

**Hot pick and risky pick** appear only once *every live entry's pick for the
week has kicked off*, so neither can hand a live edge to anyone still deciding.

- **Hot** is simply the most-backed team.
- **Risky** is the longest shot backed, ranked by the market's own implied
  probability rather than the raw American number — +150 and −110 cannot be
  compared as integers, and doing so would call a heavy favourite "risky".

An entry with no pick does not hold the reveal open. They are about to be
eliminated for missing the week, and waiting on them would mean waiting forever.

### Timing worth knowing

The reveal waits for the *last* live pick to kick off. In practice that is
usually Sunday afternoon — but if a single entry backs a Monday night team, the
week's hot and risky picks do not appear until Monday evening. That is the
honest consequence of the no-edge rule; loosening it means publishing while
someone can still act on it.
