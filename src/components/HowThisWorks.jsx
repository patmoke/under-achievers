import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ScrollText } from 'lucide-react';
import { modeByKey } from '../lib/rules';

const storageKey = mode => `ua.rules-seen.${mode}`;

/**
 * Three lines of "what game is this", above the league's main tab.
 *
 * A rules page only reaches people who go looking, and the ones who most need
 * the rules are the ones who don't know there is anything to look up. This
 * catches them where they already are, then gets out of the way — dismissing
 * it is remembered per game type, so someone in a survivor pool and a bankroll
 * league gets told about both once, not neither and not endlessly.
 *
 * Remembered in localStorage rather than on the account on purpose: it is a
 * convenience, not a setting, and it is not worth a column or a round trip.
 * A new device showing it again is the right failure.
 */
export default function HowThisWorks({ competeOn }) {
  const mode = modeByKey(competeOn);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey(competeOn)) === '1'; } catch { return false; }
  });

  if (!mode || dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(storageKey(competeOn), '1'); } catch { /* private browsing — it just comes back */ }
    setDismissed(true);
  }

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 20, background: 'var(--surface-alt)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 17, display: 'flex', alignItems: 'center', gap: 7 }}>
          <ScrollText size={14} style={{ color: 'var(--accent)' }} />
          How {mode.title} works
        </strong>
        <button
          onClick={dismiss}
          aria-label="Hide this"
          style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
        >
          <X size={15} />
        </button>
      </div>

      <ul style={{ margin: '10px 0 0', paddingLeft: 19, display: 'grid', gap: 5 }}>
        {mode.summary.map(line => (
          <li key={line} style={{ color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.6 }}>{line}</li>
        ))}
      </ul>

      <Link
        to={`/rules/${mode.key}`}
        style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}
      >
        Full rules →
      </Link>
    </div>
  );
}
