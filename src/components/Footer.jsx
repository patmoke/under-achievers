import { Link } from 'react-router-dom';
import SponsorBanner from './SponsorBanner';
import { SPONSOR } from '../lib/sponsor';
// Deliberately reachable signed out. The person most likely to need it is the
// one who can't get in — wrong Google account, join code not working, locked
// out — and a support link behind the login is invisible to exactly them.
import { CONTACT_EMAIL } from '../lib/contact';

/**
 * The single footer. The landing page passes `masthead` to get its own brand
 * bar on top; everything below that is shared, so the sponsor credit, the
 * contact line and the legal text are written once rather than kept in step
 * across two files.
 */
export default function Footer({ masthead = false }) {
  const jason = SPONSOR.url ? (
    <a
      href={SPONSOR.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'inherit', textDecoration: 'underline',
        textDecorationColor: 'var(--gold)', textUnderlineOffset: 3,
      }}
    >
      {SPONSOR.firstName}
    </a>
  ) : SPONSOR.firstName;

  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
      {masthead && (
        <div style={{
          padding: '28px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
            Under Achievers
          </span>
          <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            Inspired by Guess the Lines · For entertainment only
          </span>
        </div>
      )}

      <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
        <SponsorBanner />

        {/* Above the support line on purpose. Half of what reaches that inbox
            is a rule someone didn't know about, and this answers it first. */}
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 10px' }}>
          New here, or not sure how a game works?{' '}
          <Link to="/rules" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Read the rules
          </Link>
        </p>

        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 4px' }}>
          Something broken, or a result that doesn't look right?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {CONTACT_EMAIL}
          </a>
        </p>

        {/* Quieter than the line above on purpose: the real address should stay
            the one that reads as the answer. */}
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 16px' }}>
          For any complaints, please reach out to {jason}.
        </p>

        <p style={{
          color: 'var(--slate)', fontSize: 11, lineHeight: 1.7,
          maxWidth: 800, margin: '0 auto',
        }}>
          Under Achievers is an unofficial fan game not affiliated with or endorsed by the NFL, its teams, or any related entities.
          Team names and logos are the property of their respective owners.
          This site is for entertainment purposes only. No real money is wagered or can be won.
          Point spread data is sourced from public oddsmakers for entertainment use only.
        </p>
      </div>
    </footer>
  );
}
