# Error monitoring

Supabase and Vercel logs only see the server side. A React exception, a broken
render on someone's phone, a failed fetch — none of that reaches either,
because the site is a static SPA with no server runtime. Sentry fills that gap.

The code is done and inert until a DSN exists. **No DSN means monitoring is
off**, which is what keeps local dev and preview deployments out of the issue
list, and means the app runs fine for anyone cloning the repo.

## Turning it on

1. Create a Sentry account and a project, choosing **React** as the platform.
2. Copy the DSN it gives you — it looks like
   `https://<key>@<org>.ingest.sentry.io/<id>`. It's not a secret; it ships in
   the client bundle by design and only permits writing events.
3. In Vercel → project → Settings → Environment Variables, add
   `VITE_SENTRY_DSN` for Production. Leave it off Preview unless you want
   preview noise in with the real thing.
4. Redeploy. Vite inlines env vars at build time, so an existing deployment
   won't pick it up.

## Source maps (worth doing)

Without them a production stack trace points into minified nonsense —
`c.jsx:1:4821` — and Sentry is worth about half what it should be. With them it
names the file and line.

Add three more Vercel environment variables:

| Variable | Where to find it |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens, scope `project:releases` |
| `SENTRY_ORG` | your org slug, in the Sentry URL |
| `SENTRY_PROJECT` | your project slug |

The build uploads maps only when `SENTRY_AUTH_TOKEN` is present, and deletes
them afterwards so they aren't served to visitors. A build without the token
still succeeds, unchanged.

Unlike the DSN, **the auth token is a real secret.** It goes in Vercel's
environment variables and nowhere near the repo.

## What is and isn't sent

Configured in `src/lib/monitoring.js`.

- **User id and username, never the email.** Addresses live in `user_contacts`
  behind RLS; shipping them to a third party would quietly undo that. A
  username is enough to follow up with someone.
- **`sendDefaultPii: false`** — no IP addresses, no request headers.
- **Errors only.** Tracing and session replay are off. They bill against the
  same monthly allowance and would spend it on performance data nobody is going
  to read for a league of twelve.
- **Noise filtered:** stale-chunk errors after a deploy (the service worker
  already handles those by reloading), the benign `ResizeObserver` loop Safari
  reports, plain network failures, and anything thrown from a browser
  extension.

## The crash screen

`CrashScreen.jsx` renders when a React render throws, instead of the white
screen someone would otherwise get. Sentry has already recorded the error by
then, so the screen's only job is a way forward and the reassurance that
submitted picks are safe — which is the thing anyone would actually worry
about.

To see it, throw at the top of any component and load the page.
