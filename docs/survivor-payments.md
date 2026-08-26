# Survivor payments

## The bug this replaced

Payment used to be a single boolean, `survivor_entries.paid`. That column can
only ever mean one thing — *the buy-in was paid* — and a buyback is a **second
charge against the same entry**. `survivor_entry_buybacks` had four columns and
none of them was `paid`.

So the moment anyone bought back, the tracker showed them as **Paid** while they
owed money for the rebuy. Not blank, not unknown: confidently wrong, in the one
screen an owner uses to decide who to chase.

Nobody had bought back yet when this was found, so no money was actually lost.
The buyback window is weeks 1–4, so it had roughly three weeks left to run.

## One row per thing owed

`survivor_charges` is the same shape as `bankroll_ledger`, for the same reason:
make the charge the row, and *"what does this person owe"* becomes a group-by
rather than something the owner works out in their head.

| Column | |
|---|---|
| `kind` | `buy_in` or `buyback` |
| `entry_id` | the entry it is against |
| `buyback_id` | set for buybacks, null for buy-ins |
| `week` | which round the rebuy was for |
| `amount` | null for now — see below |
| `paid`, `paid_at`, `paid_by` | who recorded it, and when |

A check constraint keeps `kind` and `buyback_id` in step, so a buyback charge
cannot exist without the buyback it is for.

`amount` is null everywhere, because no buy-in amount is stored anywhere in the
app yet. It is in the table so that *"Joe owes $40"* is a later UI change rather
than a later migration.

## Charges appear with the thing that causes them

Two triggers: one on `survivor_entries` for the buy-in, one on
`survivor_entry_buybacks` for the rebuy. Not client calls — that is the lesson
from the bankroll settings bug, where a write the client was trusted to make
was refused by a missing RLS policy on every single attempt, in silence, for
the life of the feature.

Double-charging is prevented by index rather than by remembering: a partial
unique index gives one `buy_in` per entry and one charge per `buyback_id`.

## `survivor_entries.paid` still exists, and changed meaning

It is no longer the source of truth. A trigger maintains it as **"this entry
owes nothing"** — true only when every charge against the entry is paid. The
badge on a player's own entry card keeps working and now says something more
useful: buy back, and it flips to Unpaid until the rebuy is settled.

There is still exactly one write path. The old UPDATE policy that let any owner
flip the flag directly is gone, replaced by one whose `with check` refuses any
value the charges disagree with.

## Recording a payment

`set_charge_paid(charge_id, paid)`. Owner-only, and it stamps `paid_at` and
`paid_by`. The previous tracker wrote the boolean directly and kept no trace of
who did it — money disputes are exactly where *"I marked that paid on the 14th"*
is the whole argument.

`survivor_charges` has SELECT policies only: you see your own charges, the owner
sees the league's. There is no INSERT, UPDATE or DELETE policy, so nothing can
invent a charge or quietly settle its own.

## What it was tested against

The backfill ran over live data: 77 entries produced 77 buy-in charges, the 52
that were marked paid stayed paid, and zero entries disagreed with their
charges.

Then a probe on a real paid entry, cleaned up after itself:

| | |
|---|---|
| after a buyback | entry reads **unpaid**, two charges, the rebuy outstanding |
| after settling the rebuy | entry reads **paid** again |
| inserting the same buyback twice | refused by the unique index |
| deleting the buyback | its charge cascades, entry back to one charge |

The first line is the whole point. Under the old model that entry would still
have been showing **Paid**.

## Still open

A buyback is instant and free at the point of use — nothing stops someone
rebuying and never paying. That is currently a deliberate extension of credit
rather than an oversight, but it is a choice worth revisiting if it is abused.
