# Google and Apple sign-in

The app code is done. What's left is dashboard configuration, which can't be
done from the repo. Supabase's own
[social login guide](https://supabase.com/docs/guides/auth/social-login) is the
authority if any of these screens have moved.

Two constants used below:

- Supabase callback URL: `https://xidvmgpicefneggeeexf.supabase.co/auth/v1/callback`
- Site: `https://under-achievers.vercel.app`

## Before either provider

**Supabase → Authentication → URL Configuration**

- Site URL: `https://under-achievers.vercel.app`
- Redirect URLs: add `https://under-achievers.vercel.app/**`

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
3. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorised JavaScript origins: `https://under-achievers.vercel.app`
   - Authorised redirect URI: the Supabase callback URL above
4. **Supabase → Authentication → Providers → Google**: enable, paste the client
   ID and client secret.

One thing to decide: leaving the consent screen in **Testing** means only
addresses you add as test users can sign in, capped at 100. For a friends
league that's a feature, not a limit — it's an allow-list. Hit **Publish** if
you'd rather anyone with the join link could sign up.

## Apple — needs a paid developer account

Sign in with Apple on the web requires **Apple Developer Program membership,
$99/year**. Nothing else here costs money, so this is the one call worth making
deliberately. If you skip it, set `VITE_AUTH_PROVIDERS=google` (below) and the
Apple button disappears.

Worth knowing: Apple's rule that an app offering other social logins must also
offer Apple applies to App Store submissions. This is an installable web app,
not a native one, so it isn't subject to that.

1. [developer.apple.com](https://developer.apple.com/account) → Certificates,
   Identifiers & Profiles.
2. **Identifiers → App IDs** → new App ID with the **Sign in with Apple**
   capability. Web-only still needs this; it's the primary the Services ID
   points at.
3. **Identifiers → Services IDs** → new Services ID. This is your client ID.
   Enable Sign in with Apple → Configure:
   - Primary App ID: the one from step 2
   - Domains: `under-achievers.vercel.app`
   - Return URL: the Supabase callback URL above
4. **Keys** → new key with Sign in with Apple enabled. Download the `.p8` —
   **Apple only lets you download it once.** Note the Key ID and your Team ID.
5. **Supabase → Authentication → Providers → Apple**: enable, then supply the
   Services ID, the `.p8` contents, the Key ID and the Team ID. Supabase mints
   and rotates the client secret JWT from these; Apple caps that token at six
   months, which is why it wants the key rather than a secret you generate.

Apple accounts often arrive with **Hide My Email** on, so the address lands as
`something@privaterelay.appleid.com`. It forwards to their real inbox, so
password resets and the league owner's mailto links still work — it just looks
odd in the members list.

## Turning the buttons on

`VITE_AUTH_PROVIDERS` in Vercel controls which buttons render:

| Value | Result |
| --- | --- |
| unset | both buttons (the default) |
| `google` | Google only |
| `google,apple` | both |
| `` (empty) | neither — email and password only |

It exists so a button never sits there returning "provider is not enabled".
Enable the provider in Supabase first, then flip the env var — changing it is a
Vercel redeploy, no code change.

## Usernames

Neither provider sends a username, and `profiles.username` is UNIQUE. The
`handle_new_user` trigger derives one — from the Google/Apple display name,
falling back to the email local part — and appends a number if it's taken, so
two people called Pat both get in. Anyone who dislikes what they were given can
change it on their profile page.
