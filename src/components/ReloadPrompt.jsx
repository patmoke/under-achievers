import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { hasUnsavedWork, subscribeUnsaved } from '../lib/unsavedWork';

// An installed app can stay open for days, and a service worker only looks for
// a new build on navigation. Without a nudge someone could sit on a stale
// bundle through a scoring change, so check periodically and whenever the app
// comes back to the foreground.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Applies a new build, silently where that's free and by asking where it isn't.
 *
 * Auto-updating everywhere would reload the picks screen out from under a
 * half-entered week. Prompting everywhere is worse in the other direction:
 * prompts get dismissed, and then the user is stale indefinitely — on this app
 * that could mean reading standings computed by rules that have since changed.
 *
 * So: reload immediately when nothing would be lost, and only surface the
 * prompt when something would. If the user finishes what they were doing, the
 * pending update applies itself without them ever seeing it.
 */
export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      const timer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      return () => clearInterval(timer);
    },
  });

  const [blocked, setBlocked] = useState(hasUnsavedWork());

  useEffect(() => subscribeUnsaved(setBlocked), []);

  useEffect(() => {
    if (needRefresh && !blocked) updateServiceWorker(true);
  }, [needRefresh, blocked, updateServiceWorker]);

  // Only ever visible when a reload would actually cost the user something.
  if (!needRefresh || !blocked) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 60,
        maxWidth: 460, margin: '0 auto',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card-hover)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ flex: 1, fontSize: 14 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Update ready</strong>
        <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
          It'll apply once you've submitted, or update now to discard unsaved picks.
        </span>
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => { setNeedRefresh(false); updateServiceWorker(true); }}
        style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
      >
        <RefreshCw size={14} /> Update now
      </button>
    </div>
  );
}
