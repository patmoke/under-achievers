import * as Sentry from '@sentry/react';

// Unset means off. That keeps local dev quiet, keeps preview deployments from
// filling the issue list with noise, and means the app runs perfectly well
// before anyone has created a Sentry project.
const DSN = import.meta.env.VITE_SENTRY_DSN;

export const monitoringEnabled = Boolean(DSN);

export function initMonitoring() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,

    // Errors only. Tracing and session replay bill against the same free
    // allowance, and would spend it collecting performance data nobody is
    // going to read for a league of twelve.
    tracesSampleRate: 0,

    // No IP addresses, no request headers. "Who hit this" is answered by
    // identify() below with an id and a username, which is enough to follow
    // up with someone without putting addresses in a third-party service.
    sendDefaultPii: false,

    ignoreErrors: [
      // A deploy replaced the bundle mid-session and an old chunk 404s. The
      // service worker already resolves this by reloading; there is nothing
      // to fix and nothing to learn from seeing it a hundred times.
      /Loading chunk \d+ failed/,
      'Failed to fetch dynamically imported module',
      // A benign layout loop Safari and several in-app browsers report.
      'ResizeObserver loop completed with undelivered notifications',
      // Someone's train went into a tunnel. Not a defect.
      'NetworkError when attempting to fetch resource',
      'Load failed',
    ],

    beforeSend(event) {
      // Browser extensions throw inside our page and arrive looking like our
      // bugs. On a phone-first app these are mostly desktop noise, and none of
      // them are actionable.
      const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
      const fromExtension = frames.some(f => /^(chrome|moz|safari-web)-extension:/.test(f.filename ?? ''));
      return fromExtension ? null : event;
    },
  });
}

/**
 * Attaches a player to their errors, without sending an address.
 *
 * A username is what makes a report actionable — "this broke for MarcShifres
 * in week 3" is something you can act on, where an anonymous stack trace
 * isn't. The email deliberately stays out of it; emails live in user_contacts
 * behind RLS, and shipping them to a third party would undo that.
 */
export function identify(user, profile) {
  if (!DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, username: profile?.username ?? undefined });
}
