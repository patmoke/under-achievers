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

It swipes between two boards, same locked-only rule on both: **Season** (the
count above, running total since week 1) and **Week N** (that week's count
only, via the same `teamUsage` narrowed with a `week` filter). The weekly view
answers a different question than the season one — not "who's out of teams by
now" but "who moved on whom this week" — without adding a second reveal rule
to reason about.

### The weekly board counts losers too, on purpose

The season board is alive-entries-only: the moment an entry goes out, its
picks stop counting, because the question it answers is "who is still in
range of this team". Applying that same filter to the weekly board would
make it lie by omission — a team that lost this week eliminates every entry
that picked it, so an alive-only weekly count would empty out exactly the
teams that just decided something, right as the results come in.

So the weekly board's alive set is wider: an entry counts if it is still
alive, *or* if `computeEntryStatus` says it went out **in this same week**.
An entry eliminated in an earlier week stays excluded either way — a
filed-ahead pick from someone already gone was never really "in" the week it
names. A losing team is marked the same way a losing pick reads everywhere
else in this tab: red, struck through, via `weekTeamOutcomes(picks, week)`,
which reads `pickOutcome` off whichever pick for that team got there first —
every pick on one team in one week shares a game, so they can't disagree.

**Hot pick and risky pick** appear only once *every live entry's pick for the
week has kicked off*, so neither can hand a live edge to anyone still deciding.

- **Hot** is simply the most-backed team.
- **Risky** is the longest shot backed, ranked by the market's own implied
  probability rather than the raw American number — +150 and −110 cannot be
  compared as integers, and doing so would call a heavy favourite "risky".

An entry with no pick does not hold the reveal open. They are about to be
eliminated for missing the week, and waiting on them would mean waiting forever.

**Field remaining, Eliminated and Rebuys** sit next to them in the same
nutshell, on the same reveal. None of the three actually needs the no-edge
gate — a headcount of who's gone, who bought back, or how big the pool still
is doesn't tip anyone off on a pick still being decided — but they read as
one week-in-review, so they wait on the same reveal rather than showing up
ahead of the rest of it.

- **Field remaining** is the stark cut line: how many entries were still in
  range entering the week versus how many are alive now (`fieldBefore` uses
  the same this-week test as the other two — alive now, or eliminated but
  not until this week), plus that count against every entry the league has
  ever had.
- **Eliminated** counts entries knocked out *this* week specifically
  (`entry.status === 'eliminated' && entry.week === currentWeek` — the same
  this-week test the weekly team board uses, see above) and names the
  team(s) responsible.
- **Rebuys** is a season running total, not scoped to the current week. It
  started out matching a buyback's resume week against `currentWeek`, and
  that was wrong: a buyback's resume week is always `max(currentWeek,
  eliminationWeek + 1)`, which computes to *next* week's number right up
  until `currentWeek` itself advances — and a loss only becomes visible, and
  a buyback only becomes possible, once the current week is mostly played
  out. So the moment a buyback happens, the week-scoped count could never
  show it; it would sit at zero and only catch up a week later, once the
  number it was compared against had moved to match. Caught live: three
  buybacks landed within hours of each other, all correctly recorded, and
  the tile still read zero. A running total has no such lag — it's hidden
  entirely in a league with buybacks turned off, rather than sitting there
  reading zero forever, but whenever it's shown it's simply correct.

### Timing worth knowing

The reveal waits for the *last* live pick to kick off. In practice that is
usually Sunday afternoon — but if a single entry backs a Monday night team, the
week's hot and risky picks do not appear until Monday evening. That is the
honest consequence of the no-edge rule; loosening it means publishing while
someone can still act on it.

### The section used to go blank between weeks

All four tiles were computed straight off `currentWeek`. That's the wrong
week to ask for most of the time a fresh week is open: `currentWeek` advances
the moment the *previous* week's last game kicks off, but this week's own
picks don't all lock until this week's games do — days later, typically not
until Sunday. In that gap `weekHighlights` for `currentWeek` is correctly
null (nothing to reveal yet), and the whole nutshell disappeared — right
after it had just been showing last week's recap.

Reported live: a user asked where the nutshell had gone on the Monday after
week 2 wrapped. Confirmed against the database before writing any code — week
2 fully locked (143 picks, all kicked off), week 3 just opened (17 filed, 0
locked) — so this wasn't stale state, it was exactly the gap described above.

Fixed with `recapWeek`: start at `currentWeek` and step backward one week at
a time until `weekHighlights` returns non-null (or week 1 is reached). All
four tiles, and the section's own title, now key off `recapWeek` instead of
`currentWeek`, so the section holds the last finished week's recap until the
new week has its own to replace it with — rather than a blank stretch in
between. The **team board**'s weekly pane is deliberately left on
`currentWeek` rather than `recapWeek` — it isn't gated by the reveal (it can
never leak anything unlocked) and reading sparse or empty for a week that
just opened is the honest state of that week, not a gap to paper over.


## The standings, grouped

98 entries across 55 people is 98 rows, and it stays 98 rows all season while
most of them are dead. Three changes, in order of how much work they do:

**The dead fold away.** Everyone with no live entry collapses into one row —
*"35 people out (52 entries)"*. This does nothing in week 1 and progressively
more every week after, which is the right shape: the list is worst exactly when
most of it is history. Measured on a phone at week 6 with ~80% eliminated, the
standings went from 3,334px to **1,198px**.

**A person appears once.** `groupByPerson` puts someone's entries on one row as
chips — `#1 out wk 4`, `#2 out wk 5`, `#3 👁`. Not only for length: three rows
for one person misrepresents them as three competitors when they are one person
holding three lives.

The entry stays the unit of competition — the prize is the last *entry*
standing — so every chip keeps its own pick, its own alive/out state and its own
elimination week. Grouping is presentation, and it must not blur that.

**You are pinned to the top**, because finding yourself among 55 names is a real
annoyance and a highlight colour does not solve it.

### The bug in pinning

Pinning is worth nothing if you are inside the folded half — which is precisely
where you are once your last entry dies, and the moment you are most likely to
come looking. The fold therefore opens itself for anyone who is in it, until
they close it.

Found by asserting it rather than by looking: the probe checks whether "(you)"
is on screen *without touching anything*, for both a live viewer and a dead one.
A screenshot of a live viewer would have looked perfect and proved nothing.

### Not an internal scrollbar

A vertical scroll box inside a vertically scrolling page fights itself — trapped
scroll on touch, the outer page jumping at the boundary, and no indication of how
much is hidden. The picker strips scroll *laterally*, a different axis from the
page, which is why that works and this would not.

## A buyback that resumed into its own loss

`computeEntryStatus` forgives everything before `start_week` (see the comment
on the function itself) — a buyback works by advancing that column past the
loss it is meant to undo. Nothing enforces that it actually lands *after* the
loss, though; `buyBackIn` used to send `currentWeek` verbatim as the resume
week, and `currentWeek` is the app's estimate of the current NFL week, which
reads as unchanged for as long as that week's *last* game hasn't kicked off —
including the very game that eliminated you.

Real incident: an entry lost with a Sunday-afternoon pick, Monday night's game
for that same week was still to come, and the player bought back in before it
kicked off. `currentWeek` was still reporting that same week, so `start_week`
got set right back to it. The buyback forgave nothing — `computeEntryStatus`
scans from `start_week` onward, found the same loss still sitting inside that
range, and re-eliminated the entry immediately. From the player's side: click
"Buy back in", entry still reads eliminated, no picker, nothing to show for it.

Fixed by resuming at `max(currentWeek, eliminationWeek + 1)` instead of
`currentWeek` alone — strictly after the week that ended the entry, and never
earlier than the current week either, in case the buyback happens later than
right away. The fix is client-side only; `buy_back_entry` takes whatever week
it's given and has no independent way to check it against the entry's actual
elimination without re-deriving `computeEntryStatus` in SQL, so a wrong week
sent from anywhere else would not be caught here either.

## The buyback cap was per person, not per entry

`canBuyBack()` used to sum buybacks across *every* entry a person owns in the
league and compare that against `maxBuybacks` — a shared pool, not a per-entry
allowance. The settings label was the only place that actually said so ("Max
buybacks per person"); nothing else about a multi-entry league pools across a
person's entries. Each one is otherwise fully independent — its own picks, its
own life, and per the rules page, its own separate buy-in payment.

Real incident: a player with two entries bought back the first, and the
second's buyback button disappeared — correct by the rule as written, but it
read as broken, because the entry showing "you've used all 1 buyback" had
never itself used one. Confirmed live before changing anything: found the
exact match (two entries, one buyback, league cap of 1) rather than guessing
at the cause.

Changed to per entry: `canBuyBack(entryId)` now checks `entryBuybacks(entryId)`
against `maxBuybacks`, so each entry gets its own allowance regardless of how
many others the same person is running. `buy_back_entry` itself was never the
enforcement point either way — same as the resume-week bug above, this was
entirely a client-side gate, so the fix needed no migration and no data
correction; existing `survivor_entry_buybacks` rows already key by
`entry_id`, which is all the new check needed.
