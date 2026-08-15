import { Bell, BellOff, Share } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePushNotifications } from '../lib/push';

/**
 * Turns pick reminders on or off for this device.
 *
 * Per device rather than per account on purpose: a push subscription belongs to
 * one browser, so someone with a phone and a laptop genuinely has two, and
 * enabling on one shouldn't imply the other.
 */
export default function NotificationSettings({ userId }) {
  const { supported, permission, subscribed, busy, subscribe, unsubscribe, needsInstallFirst } =
    usePushNotifications(userId);

  // Checked before `supported`, and the order is the whole point: in an iOS
  // browser tab Apple exposes neither PushManager nor Notification, so feature
  // detection reports "unsupported". Testing that first told every iPhone user
  // their browser couldn't do notifications, when installing the app is
  // exactly what makes it able to.
  if (needsInstallFirst) {
    return (
      <Shell>
        <p style={{ fontSize: 14, marginTop: 0, marginBottom: 8 }}>
          To get reminders on iPhone or iPad, add Under Achievers to your home screen first.
        </p>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          Tap <Share size={14} /> Share, then <strong>Add to Home Screen</strong>, and open it from there.
        </p>
      </Shell>
    );
  }

  if (!supported) {
    return (
      <Shell>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
          This browser doesn't support notifications.
        </p>
      </Shell>
    );
  }

  if (permission === 'denied') {
    return (
      <Shell>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
          Notifications are blocked for this site. You'll need to allow them in your
          browser's site settings before reminders can be turned on.
        </p>
      </Shell>
    );
  }

  async function toggle() {
    if (subscribed) {
      await unsubscribe();
      toast.success('Reminders turned off for this device');
      return;
    }
    const { ok, reason } = await subscribe();
    if (ok) toast.success('Reminders on — we\'ll nudge you before picks lock');
    else if (reason === 'denied') toast.error('Notifications were blocked');
    else toast.error(reason || 'Could not enable notifications');
  }

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0, flex: 1, minWidth: 220 }}>
          A nudge before kickoff if you still have picks outstanding — and before a
          survivor pick would be missed, which knocks the entry out.
        </p>
        <button
          className={subscribed ? 'btn btn-secondary' : 'btn btn-primary'}
          onClick={toggle}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          {subscribed ? <BellOff size={16} /> : <Bell size={16} />}
          {busy ? 'Working…' : subscribed ? 'Turn off' : 'Turn on'}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <h3 style={{ fontSize: 19, marginBottom: 12, textTransform: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell size={17} style={{ color: 'var(--accent)' }} /> Pick reminders
      </h3>
      {children}
    </div>
  );
}
