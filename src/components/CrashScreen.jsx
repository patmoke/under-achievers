import { AlertTriangle } from 'lucide-react';
import { CONTACT_EMAIL } from '../lib/contact';

/**
 * Last resort when a render throws.
 *
 * ErrorBoundary has already recorded the error by the time this paints, so
 * its job isn't reporting — it's giving someone a way forward instead of the
 * white screen they'd otherwise be staring at, and telling them their picks
 * are safe, which is the only thing they'll actually be worried about.
 */
export default function CrashScreen({ resetError }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{ padding: 36, maxWidth: 460, textAlign: 'center' }}>
        <AlertTriangle size={28} style={{ color: 'var(--warning)', marginBottom: 14 }} />

        <h1 style={{ fontSize: 26, textTransform: 'none', marginBottom: 10 }}>
          Something broke
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          This one's on us, and it's already been reported. Anything you'd
          submitted is saved — only the screen fell over.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
            Back to safety
          </button>
          {/* Worth offering, but second: re-rendering the same tree can hit the
              same error, where a fresh load usually won't. */}
          <button className="btn btn-secondary" onClick={resetError}>
            Try again
          </button>
        </div>

        <p style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 22, marginBottom: 0 }}>
          Keeps happening?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--ink-soft)' }}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
