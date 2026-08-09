import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Offers a reload when a new build is available.
 *
 * A service worker keeps serving the version it cached until every tab closes,
 * which on an installed app can be days. Without this, someone could sit on a
 * stale build through a scoring change and never know. The prompt is explicit
 * rather than automatic so a refresh can't wipe half-entered picks.
 */
export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 60,
        maxWidth: 440, margin: '0 auto',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card-hover)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ flex: 1, fontSize: 14 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Update available</strong>
        <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Reload to get the latest version.</span>
      </div>
      <button
        className="btn btn-primary"
        onClick={() => updateServiceWorker(true)}
        style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <RefreshCw size={14} /> Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notice"
        style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', display: 'flex', padding: 2 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
