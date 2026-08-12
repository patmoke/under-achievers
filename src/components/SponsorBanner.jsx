import { Home } from 'lucide-react';

/**
 * The house sponsor. Everything editable lives here, so changing the joke —
 * or dropping the banner entirely — is one file.
 *
 * Set `url` to make the name a link; left null it renders as plain text.
 */
const SPONSOR = {
  name: 'Jason of The List Realty',
  tagline: 'Undefeated in real estate. Less so in survivor.',
  // The disclosure is also the punchline, which is the only reason it's
  // allowed to be this small.
  footnote: 'Not a real sponsorship. He has never given us any money.',
  url: 'https://www.instagram.com/reel/Db6FFHPRf6n/?utm_source=ig_web_copy_link',
};

export default function SponsorBanner() {
  const name = SPONSOR.url ? (
    <a
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
      // Underlined in gold rather than left bare: without an affordance
      // nobody discovers there's anything to click.
      style={{
        ...nameStyle,
        textDecoration: 'underline',
        textDecorationColor: 'var(--gold)',
        textDecorationThickness: 1,
        textUnderlineOffset: 4,
      }}
    >
      {SPONSOR.name}
    </a>
  ) : (
    <span style={nameStyle}>{SPONSOR.name}</span>
  );

  return (
    <div style={{
      maxWidth: 460, margin: '0 auto 20px', paddingBottom: 20,
      borderBottom: '1px solid var(--border)',
    }}>
      <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 10, fontSize: 10 }}>
        Sponsored by
      </div>

      {/* Wraps to two lines on a narrow phone rather than shrinking the mark. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(184, 134, 11, 0.12)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Home size={15} style={{ color: 'var(--gold)' }} />
        </span>
        {name}
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic', margin: '6px 0 0' }}>
        {SPONSOR.tagline}
      </p>
      <p style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '4px 0 0' }}>
        {SPONSOR.footnote}
      </p>
    </div>
  );
}

const nameStyle = {
  fontFamily: 'Barlow Condensed',
  fontWeight: 700,
  fontSize: 19,
  letterSpacing: '0.01em',
  color: 'var(--ink)',
  textDecoration: 'none',
};
