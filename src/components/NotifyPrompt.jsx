import { useState } from 'react';
import { Bell, Share, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePushNotifications } from '../lib/push';

const DISMISSED_KEY = 'ua:notify-prompt-dismissed';

/**
 * Offers pick reminders once, wherever the user happens to be.
 *
 * Reminders otherwise live only on the profile page, and the people most
 * likely to miss a survivor pick are exactly the ones who never open their
 * settings — so the cost of not knowing this exists is losing a buy-in to a
 * toggle they never saw. That asymmetry is what justifies a bar at all.
 *
 * The discipline that keeps it from being nagware: one dismissal is
 * permanent, and it never appears to anyone who already has reminders on.
 */
export default function NotifyPrompt({ userId }) {
  const { supported, ready, permission, subscribed, busy, subscribe, needsInstallFirst } =
    usePushNotifications(userId);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing can refuse writes. Losing the preference for this
      // session is better than the dismiss button doing nothing.
    }
  }

  // `ready` rather than just `!subscribed`: until the check has run the two
  // are indistinguishable, and the bar would flash for people already on.
  if (!ready || dismissed || subscribed || !supported) return null;
  // Blocked at the browser level — a prompt here can't undo that, and the
  // profile page already explains where to change it.
  if (permission === 'denied') return null;

  async function turnOn() {
    const { ok, reason } = await subscribe();
    if (ok) toast.success('Reminders on — we\'ll nudge you before picks lock');
    else if (reason === 'denied') toast.error('Notifications were blocked');
    else toast.error(reason || 'Could not enable notifications');
  }

  return (
    <div style={{ background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Bell size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />

        <p style={{ margin: 0, fontSize: 13, flex: 1, minWidth: 200, lineHeight: 1.5 }}>
          {needsInstallFirst ? (
            // iOS refuses push from a Safari tab outright, so installing isn't
            // a nicety here — it's the only way to get reminders at all.
            <>
              Add Under Achievers to your home screen to get pick reminders — tap{' '}
              <Share size={13} style={{ verticalAlign: -2 }} /> Share, then{' '}
              <strong>Add to Home Screen</strong>, and open it from there.
            </>
          ) : (
            <>Want a reminder before picks lock? A missed survivor pick knocks the entry out.</>
          )}
        </p>

        {/* Grouped so the two wrap together. Left loose, a narrow phone drops
            the dismiss X onto a line of its own below the button. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {/* No button on iOS: there is nothing it could do until the app is
              installed, and a button that always fails is worse than none. */}
          {!needsInstallFirst && (
            <button
              className="btn btn-primary"
              onClick={turnOn}
              disabled={busy}
              style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              {busy ? 'Working…' : 'Turn on'}
            </button>
          )}

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', color: 'var(--ink-soft)',
              cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
