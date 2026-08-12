import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/**
 * Sign in with Google.
 *
 * Which buttons appear is driven by VITE_AUTH_PROVIDERS rather than hardcoded,
 * because a provider has to be switched on in the Supabase dashboard before it
 * works. A button that only ever produces "provider is not enabled" is worse
 * than no button, so turning one off is an env var in Vercel, not a code
 * change — which is also what makes adding a second provider later a small
 * change rather than a rewrite.
 */
const ENABLED = (import.meta.env.VITE_AUTH_PROVIDERS ?? 'google')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export default function ProviderButtons({ mode }) {
  const { signInWithProvider } = useAuth();
  const [pending, setPending] = useState(null);

  const providers = PROVIDERS.filter(p => ENABLED.includes(p.id));
  if (providers.length === 0) return null;

  async function go(provider) {
    setPending(provider);
    try {
      await signInWithProvider(provider);
      // Nothing after this runs: the browser is on its way to the provider.
    } catch (err) {
      setPending(null);
      const label = PROVIDERS.find(p => p.id === provider)?.label ?? provider;
      toast.error(
        /not enabled|unsupported provider/i.test(err.message || '')
          ? `${label} sign-in isn't switched on yet`
          : err.message || 'Could not start sign-in'
      );
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {providers.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(p.id)}
            disabled={pending !== null}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16,
              letterSpacing: '0.02em', cursor: pending ? 'default' : 'pointer',
              opacity: pending && pending !== p.id ? 0.5 : 1,
              ...p.style,
            }}
          >
            {p.mark}
            {pending === p.id ? 'Redirecting…' : `${mode === 'signup' ? 'Sign up' : 'Sign in'} with ${p.label}`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="label-muted" style={{ fontSize: 12 }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
    </>
  );
}

// Drawn inline rather than pulled from an icon set: Google requires its own
// artwork, and lucide only ships generic shapes.
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// Colours follow Google's branding rules: its mark on white, with a visible
// border so the button still reads as a button.
const PROVIDERS = [
  {
    id: 'google',
    label: 'Google',
    mark: <GoogleMark />,
    style: { background: '#fff', color: '#1f1f1f', border: '1px solid var(--border-strong)' },
  },
];
