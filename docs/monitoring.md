# Error monitoring

Supabase and Vercel logs only see the server side. A React exception, a bad
render on someone's phone, a rejected promise — none of it reaches either,
because this is a static SPA with no server runtime. Browser errors are the
half that was missing.

They're captured in-house rather than sent to a third party: **there is nothing
to sign up for and no key to configure.** It works the moment it's deployed.

## Where to look

**Admin → Errors.** One row per distinct fault, newest first, with the message,
where it happened, which build, and who hit it. Click a row for the stack and
the browser. **Resolve** marks one as handled; if the same fault recurs the
reporting function clears the flag, so a premature resolve corrects itself
instead of hiding a live bug.

## What gets recorded

Anything reaching `window.onerror` or an unhandled promise rejection, plus any
React render that throws (caught by `ErrorBoundary`).

**The count is sessions affected, not times thrown.** Reporting is deduplicated
per page load, so a render loop firing ten thousand times is one broken
session — which is the number that tells you how bad something is. Occurrences
would just tell you how fast the loop spins.

Errors are grouped by a fingerprint built from the message and the top stack
frame, with digits stripped, so the "week 3" and "week 5" flavours of one fault
land on the same row instead of filling the table with near-duplicates.

Noise is dropped before sending: stale-chunk errors after a deploy (the service
worker already handles those by reloading), the benign `ResizeObserver` loop
Safari reports, plain network failures, and anything thrown from a browser
extension. None are defects and all of them repeat forever.

## Privacy and abuse

- **The user id comes from `auth.uid()` server-side**, never from the client,
  and no email is stored — the admin view resolves a username for display.
  Addresses stay in `user_contacts` behind RLS.
- **The user agent is read from the request headers**, not from anything the
  caller sends.
- **`report_client_error` is callable signed out**, on purpose: the errors most
  worth catching are the ones that stop someone signing in, and by definition
  those happen signed out.
- That makes it an open write endpoint, so it's bounded. Every field is
  truncated server-side, repeats only bump a counter, and once the table
  reaches 2,000 distinct rows new fingerprints are refused while known ones
  keep counting. The realistic abuse is unique junk, and that's what the
  ceiling caps.
- Only platform admins can read the table. Ordinary members and anonymous
  callers get nothing — verified.

A weekly `pg_cron` job deletes resolved errors that haven't recurred in 90
days.

## Testing it

On the live site, open the browser console and run:

```js
setTimeout(() => { throw new Error('monitoring test') })
```

It should appear under Admin → Errors within a few seconds. Resolve it
afterwards, or leave it — the cron job clears resolved rows eventually.

## If you outgrow this

What you don't get: alerting, release tracking, and stack traces mapped back
through minification. If the league grows or you want to be told rather than
having to look, Sentry does all three. It was wired up and removed in commit
`9c3334e`, so reinstating it is mostly a revert.
