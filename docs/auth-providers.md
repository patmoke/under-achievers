# Google sign-in

The app code is done. What's left is dashboard configuration, which can't be
done from the repo. Supabase's own
[social login guide](https://supabase.com/docs/guides/auth/social-login) is the
authority if any of these screens have moved.

Two constants used below:

- Supabase callback URL: `https://xidvmgpicefneggeeexf.supabase.co/auth/v1/callback`
- Site: `https://underachievers.mokelabs.dev`

`under-achievers.vercel.app` still resolves — Vercel assigns that name to every
project and it can't be removed — so keep its entries alongside the new ones
until nothing is pointing at it. Anywhere below that takes a list, add both.

Apple is deliberately not offered: Sign in with Apple on the web requires
Apple Developer Program membership at $99/year, and nothing else in this stack
costs money.

## First, for any provider

**Supabase → Authentication → URL Configuration**

- Site URL: `https://underachievers.mokelabs.dev`
- Redirect URLs: add `https://underachievers.mokelabs.dev/**` and
  `https://under-achievers.vercel.app/**`

The wildcard matters. Sign-in returns you to the page you started from rather
than dumping you on the landing page, and every one of those paths has to be
allowed. Without it Supabase falls back to the Site URL — it still works, you
just always land at `/`. Add `http://localhost:5173/**` too if you ever run the
app locally.

## Google — free, ~15 minutes

1. [Google Cloud Console](https://console.cloud.google.com) → create or pick a
   project.
2. **APIs & Services → OAuth consent screen** → External. Fill in app name,
   support email, developer email. The default scopes (`email`, `profile`,
   `openid`) are all this app needs, and they're non-sensitive — so no Google
   verification review.
3. **Publish the consent screen.** The publishing status is on the same page —
   **Google Auth Platform → Audience** in the newer console layout, **APIs &
   Services → OAuth consent screen** in the older one. It starts in *Testing*;
   press **Publish app** and confirm. It takes effect immediately.
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorised JavaScript origins: `https://underachievers.mokelabs.dev` and
     `https://under-achievers.vercel.app`
   - Authorised redirect URI: the Supabase callback URL above. This one does
     not change with the domain — it points at Supabase, not at the site.
5. **Supabase → Authentication → Providers → Google**: enable, paste the client
   ID and client secret.

### Why publish rather than stay in Testing

| Status | What people get |
| --- | --- |
| Testing | Only Gmail addresses on the test-user list can sign in, 100 max. Everyone else is blocked outright. |
| In production | Anyone signs in, no limit. |

Testing is defensible as an allow-list if you want to hand-approve every
member. The reason not to: every new person has to wait for you to add them
before they can get in at all.

### The "OAuth user cap" panel is not a limit on you

That panel shows 100 on every project, and it reads like a ceiling. It isn't
one here — it caps users only for apps requesting **unapproved sensitive or
restricted scopes**. `email`, `profile` and `openid` are non-sensitive, so
there is nothing unapproved in the request and the cap never engages. Don't
confuse it with the test-user list above, which is a real limit but only
applies while the app is unpublished.

### Publishing does not mean a review

Verification is triggered by sensitive or restricted scopes — Gmail, Drive,
Calendar, contacts. This app asks for `email`, `profile` and `openid`, all
non-sensitive, so publishing is a status flip with nothing to submit.

The exception worth knowing: **uploading an app logo triggers brand
verification**, which is a genuine multi-day review, and it applies even with
non-sensitive scopes. If the console starts showing "verification required" or
a pending review, a logo on the Branding page is the likely cause — remove it
and the requirement goes away. Leaving it empty just means people see the app
name on a plain consent screen.

## Turning the button on

`VITE_AUTH_PROVIDERS` in Vercel controls which buttons render:

| Value | Result |
| --- | --- |
| unset | Google (the default) |
| `google` | Google |
| `` (empty) | none — email and password only |

It exists so a button never sits there returning "provider is not enabled".
Enable the provider in Supabase first, then flip the env var — changing it is a
Vercel redeploy, no code change. Adding a second provider later means one entry
in the `PROVIDERS` list in `src/components/ProviderButtons.jsx` and its name in
this variable.

## Usernames

Google doesn't send a username, and `profiles.username` is UNIQUE. The
`handle_new_user` trigger derives one — from the Google display name, falling
back to the email local part — and appends a number if it's taken, so two
people called Pat both get in. Anyone who dislikes what they were given can
change it on their profile page.

## When someone is locked out

Most lockouts are a forgotten password, not a broken account — signing up
signs you in automatically, so a password gets chosen once and then never
typed until a session lapses days later.

**Normally:** they use **Forgot your password?** on the sign-in form.

**While email is unreliable** — the built-in Supabase SMTP allowance is two
messages an hour — there's a manual path that sends no email at all:

**Admin → Users → Reset link.** It mints a one-time recovery link server-side
and copies it to your clipboard; you send it to them however you like. It
expires in an hour, and it signs them in as themselves, so it's exactly as
private as the phone it lands on. Only send it to someone you can identify.

Once custom SMTP is configured, prefer the self-serve route and keep this for
the cases where someone can't receive mail at all.

Worth checking first: if the account was created with Google it has no
password, and Supabase reports that identically to a wrong one. Check
`auth.identities` for the address — if the only provider is `google`, the
answer is the Google button, not a reset.
