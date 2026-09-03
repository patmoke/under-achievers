# Call the Line: what "Picks" was, and what replaced it

## The question that started this

The pre-reveal leaderboard column was labelled **Picks**, and read as a raw
count. The question it prompted was fair: is that just the total number of
picks, and if so, don't we not need it since everyone ends up with the same
number?

Not quite, but close enough to the truth that the column was worth removing.

`buildWeeklyLeaderboard()`'s pre-reveal branch computed it from `myWeekPicks` —
which, by construction, only ever holds the **current user's own** picks (the
query is `.eq('user_id', user.id)`). So the column showed *your* submitted
count for your own row and a hardcoded `0` for every other member, regardless
of how many they had actually picked. It looked like a real per-player stat.
It was really "you, and then zeroes."

## Why nothing pre-reveal can honestly compare players

Scoring here is relative — closest prediction wins the game, and "closest" has
no meaning without the whole field to be closer than. That's true of every
column, not just points: `wins`, `avgDiff` and `totalDiff` were already `null`
for everyone pre-reveal, for exactly this reason. Picks was the one column that
broke that pattern by showing a *real* number for one row and a fake one for
the rest, purely because that data happened to be sitting in local state.

The fix makes the pattern consistent instead: `wins` is `null` for everyone
pre-reveal — not just points — and the table's `Won` column withholds it the
same way `Pts`, `Total Δ` and `Avg Δ` already did. Every row genuinely reads
the same until reveal, which is what "everyone should have the same" turns out
to actually require.

## The other half: tracking who won each week

"Most points in a week wins the week" is a real rule, and it wasn't tracked
anywhere — the per-week leaderboard already sorted by points, so the winner
was visible for whichever single week you had selected, but there was no
season-wide record of *how many* weeks each player had actually won.

### `finalizedWeeks`, `weeklyWinners`, `weeksWonCounts` (`src/lib/scoring.js`)

A named winner should not un-name itself. Games lock independently at their
own kickoff — not at the week's — so a week can sit "mostly done" with one
Monday-night game still to play; crowning a winner off the other fifteen games
would move once that one resolves. `finalizedWeeks(gamesByWeek)` is the gate:
a week counts only once **every** game in it has a result.

`weeklyWinners(picks, gamesByWeek, players)` scores each finalized week with
the existing `buildStandings` and takes whoever tops it. Ties split the week —
the same rule `buildStandings` already applies one level down, for tied picks
on a single game. A week where the leader scored zero (nobody picked, nothing
graded) crowns nobody rather than a false winner.

`weeksWonCounts` rolls that into a per-player trophy count.

### The season view (`LeaguePage.jsx`)

A **Week / Season** toggle sits next to the existing week selector on the
Leaderboard tab. Season mode fetches every league member's predictions across
the whole schedule, restricts them to `finalizedWeeks`, and shows:

- **Weeks** — the `weeksWonCounts` trophy count (🏆)
- **Pts / Total Δ / Avg Δ** — `buildStandings` over every finalized week combined

Restricting to finalized weeks isn't just about fairness for the *current*
week — it's the same principle applied to the whole season total. A week with
one game still open is dropped from the aggregate entirely, not partially
counted, for the identical reason `weeklyWinners` won't name a winner off it:
a total that could still move is not a total.

**Why "all games final" rather than "everyone submitted"**: those are
different conditions. A member can simply never pick a game — it locks at
kickoff with or without them — so "everyone locked in every game" isn't
guaranteed even once a week is over. But once a week's games have all been
played, nothing about it can change regardless, so there is nothing left to
protect by withholding it.

### Verification

12 new unit tests, including a tie split, a mid-week game that must exclude
the whole week, and a decided week where nobody scored. Checked in a browser
against a stubbed league: pre-reveal shows `—` for every column on every row,
including your own; a decided week with a tie shows 🏆2 / 🏆1 and 5 / 2 points,
matching the scripted picks exactly; an in-progress week is excluded from the
season total and its player-facing count ("2 so far").
