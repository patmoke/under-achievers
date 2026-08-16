# Auth email templates

Paste these into **Supabase → Authentication → Emails → Templates**, one per
tab. Each has a subject line and a body.

## First, the honest ranking

Templates are the third-biggest lever, not the first. In rough order of effect
on whether Gmail trusts you:

1. **DMARC record.** Resend sets up SPF and DKIM; it does not usually set up
   DMARC, and a domain without one is treated with suspicion. Add a Cloudflare
   TXT record named `_dmarc` whose content is exactly the line between the
   fences below — no surrounding quotes, no backticks. A stray backtick copied
   in from formatting makes `rua` an invalid URI, and a strict parser then
   discards the whole record, leaving you with no DMARC while appearing to
   have one.

   ```
   v=DMARC1; p=none; rua=mailto:admin@mokelabs.dev
   ```

   `p=none` is monitor-only and changes nothing about delivery; it just
   declares a policy exists, which is the part that's being checked for.
2. **Sending reputation.** A brand-new domain has none. It builds as real
   people receive and open messages. Marking early messages "Not spam" helps
   directly.
3. **The message itself.** What's below.

## What these do differently from the defaults

- **Prose, not a bare link.** A single sentence wrapped around a URL is the
  shape of a phishing email, and filters score it that way.
- **They say why you received it.** The strongest long-term reputation signal
  is people *not* clicking "report spam", and the commonest reason they do is
  not recognising the sender.
- **No images at all.** No logo, no tracking pixel. Image-heavy mail scores
  worse, and images are blocked by default anyway, so it would arrive broken.
- **Inline styles and table layout.** `<style>` blocks get stripped by several
  clients including parts of Gmail.
- **No spam-trigger phrasing.** No "click here", no urgency, no capitals, no
  exclamation marks.
- **A visible fallback URL**, so the mail still works when the button doesn't
  render.

## Sender settings

In **SMTP Settings**, alongside the Resend credentials:

- Sender name: `Under Achievers`
- Sender email: `hello@mokelabs.dev` — anything but `noreply@`. A no-reply
  address is a mild negative signal, and it means someone confused by the mail
  has no way to answer it.

---

## Reset password

**Subject:** `Reset your Under Achievers password`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f1;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e3e0d5;border-radius:12px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#0f7a4d;font-weight:700;">Under Achievers</div>
            <h1 style="margin:12px 0 0 0;font-size:24px;line-height:1.3;color:#16181c;font-weight:700;">Reset your password</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4350;">
            <p style="margin:0 0 16px 0;">Someone asked to reset the password for the Under Achievers account registered to <strong>{{ .Email }}</strong>.</p>
            <p style="margin:0 0 24px 0;">If that was you, pick a new password here. The link works once and expires in an hour.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#0f7a4d" style="border-radius:8px;">
                  <a href="https://underachievers.mokelabs.dev/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery" style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Choose a new password</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#565c68;">
            <p style="margin:0 0 16px 0;">If the button doesn't work, copy this address into your browser:<br>
              <span style="color:#0f7a4d;word-break:break-all;">https://underachievers.mokelabs.dev/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery</span>
            </p>
            <p style="margin:0 0 24px 0;">Didn't ask for this? You can ignore this message — your password stays as it is.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;border-top:1px solid #e3e0d5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9296a1;">
            <p style="margin:16px 0 0 0;">Under Achievers is a private NFL prediction league among friends. You received this because this address was entered at underachievers.mokelabs.dev. Questions: <a href="mailto:admin@mokelabs.dev" style="color:#565c68;">admin@mokelabs.dev</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Confirm signup

Only used once you turn email confirmation on. Don't enable it until a test
signup lands in the inbox rather than spam — otherwise it becomes a gate
nobody can get through.

**Subject:** `Confirm your email for Under Achievers`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f1;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e3e0d5;border-radius:12px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#0f7a4d;font-weight:700;">Under Achievers</div>
            <h1 style="margin:12px 0 0 0;font-size:24px;line-height:1.3;color:#16181c;font-weight:700;">Confirm your email</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4350;">
            <p style="margin:0 0 16px 0;">Thanks for joining the league. Confirm <strong>{{ .Email }}</strong> and your account is ready.</p>
            <p style="margin:0 0 24px 0;">This matters for one practical reason: it's the address we'd use to get you back in if you ever forget your password.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#0f7a4d" style="border-radius:8px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Confirm this address</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#565c68;">
            <p style="margin:0 0 16px 0;">If the button doesn't work, copy this address into your browser:<br>
              <span style="color:#0f7a4d;word-break:break-all;">{{ .ConfirmationURL }}</span>
            </p>
            <p style="margin:0 0 24px 0;">If you didn't sign up, ignore this message and no account will be created.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;border-top:1px solid #e3e0d5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9296a1;">
            <p style="margin:16px 0 0 0;">Under Achievers is a private NFL prediction league among friends. You received this because this address was entered at underachievers.mokelabs.dev. Questions: <a href="mailto:admin@mokelabs.dev" style="color:#565c68;">admin@mokelabs.dev</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

---

## Change email address

**Subject:** `Confirm your new Under Achievers address`

Same shell as above, with this body copy:

> You asked to change the email on your Under Achievers account to
> **{{ .Email }}**. Confirm it below and we'll make the switch.
>
> If you didn't ask for this, ignore the message — nothing changes until the
> link is used.

Button label: `Confirm the change`.

---

## One upgrade worth knowing about

`{{ .ConfirmationURL }}` points at `xidvmgpicefneggeeexf.supabase.co`, not at
your own domain. A link going somewhere other than the sender's domain is a
mild negative signal, and to a person it reads as slightly off — "why is my
password reset going to supabase.co?"

It can be fixed without paying for Supabase's custom auth domain. The template
would link to your own site with the token attached:

```
https://underachievers.mokelabs.dev/reset-password?token_hash={{ .TokenHash }}&type=recovery
```

The reset page then redeems the token itself via `verifyOtp`. That's a small
change to `ResetPasswordPage`, and it puts the whole journey on
`mokelabs.dev`. Worth doing once the basics above are in place — ask and it
takes about twenty minutes.
