import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Target, Skull, Coins, ScrollText } from 'lucide-react';
import { MODES, UNIVERSAL } from '../lib/rules';

// The same icons the league pages use, so a mode looks like itself wherever
// someone meets it.
const ICON = { weekly: Target, survivor: Skull, bankroll: Coins };

/**
 * The rules, for all three games.
 *
 * Deliberately reachable signed out. The person most likely to need this is
 * someone deciding whether to join, and rules behind a login are invisible to
 * exactly them — the same reasoning as the support address in the footer.
 *
 * /rules/:mode deep-links a single game so a league owner can send the one
 * that matters instead of "scroll down a bit".
 */
export default function RulesPage() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const active = MODES.find(m => m.key === mode) || MODES[0];

  // A bad mode in the URL shows the first game rather than a 404. Rewrite the
  // address so what is on screen and what is in the bar agree.
  useEffect(() => {
    if (mode && !MODES.some(m => m.key === mode)) navigate('/rules', { replace: true });
  }, [mode, navigate]);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px 56px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ScrollText size={20} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: 34, margin: 0, textTransform: 'none' }}>How to play</h1>
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6, margin: '0 0 26px' }}>
        Three different games run here. A league plays one of them, chosen by whoever
        set it up.
      </p>

      {/* Picker */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 32 }}>
        {MODES.map(m => {
          const Icon = ICON[m.key];
          const on = m.key === active.key;
          return (
            <Link
              key={m.key}
              to={`/rules/${m.key}`}
              replace
              className="card"
              style={{
                padding: 16, textDecoration: 'none', color: 'inherit',
                borderColor: on ? 'var(--accent)' : 'var(--border)',
                background: on ? 'var(--accent-soft)' : 'var(--surface)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={16} style={{ color: on ? 'var(--accent)' : 'var(--ink-soft)' }} />
                <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 18 }}>{m.title}</strong>
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {m.blurb}
              </span>
            </Link>
          );
        })}
      </div>

      <article>
        <h2 style={{ fontSize: 27, textTransform: 'none', marginBottom: 22 }}>{active.title}</h2>
        {active.sections.map(section => (
          <section key={section.heading} style={{ marginBottom: 26 }}>
            <h3 style={{
              fontSize: 17, textTransform: 'none', marginBottom: 8,
              paddingBottom: 6, borderBottom: '1px solid var(--border)',
            }}>
              {section.heading}
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              {section.points.map(point => (
                <li key={point} style={{ color: 'var(--ink-soft)', fontSize: 14.5, lineHeight: 1.65 }}>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>

      <section className="card" style={{ padding: 20, marginTop: 34 }}>
        <h3 style={{ fontSize: 16, textTransform: 'none', marginBottom: 10 }}>{UNIVERSAL.heading}</h3>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
          {UNIVERSAL.points.map(point => (
            <li key={point} style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.65 }}>
              {point}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
