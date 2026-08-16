import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Where the emailed reset link lands.
 *
 * The link carries a code that supabase-js exchanges for a short-lived
 * session on load, which is what authorises the password change — so this
 * page's real job is waiting for that exchange before deciding whether the
 * link is good. Rendering the form immediately would flash "expired" at
 * everyone for the split second before the session arrives.
 */
export default function ResetPasswordPage() {
  const { setPassword } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('checking'); // checking | ready | expired
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');

    // Current links point straight here and carry the token, so the journey
    // never visibly leaves our own domain — a reset that sends people to a
    // random supabase.co address is indistinguishable from phishing, and mail
    // filters mark down a link whose domain doesn't match the sender's.
    if (tokenHash) {
      (async () => {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: params.get('type') || 'recovery',
        });
        if (cancelled) return;
        setStatus(error ? 'expired' : 'ready');
        // Drop the token from the address bar once spent: it would otherwise
        // sit in history and ride along in any referrer we send.
        window.history.replaceState({}, '', window.location.pathname);
      })();
      return () => { cancelled = true; };
    }

    // Older links hand off through Supabase and arrive with a code or a hash
    // fragment for supabase-js to exchange. Kept working because links already
    // sent are already in people's inboxes.
    let settled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { settled = true; setStatus('ready'); }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { settled = true; setStatus('ready'); return; }
      // The exchange is asynchronous and may not have finished yet. Give it a
      // moment before calling the link dead.
      setTimeout(() => { if (!settled && !cancelled) setStatus('expired'); }, 2500);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirm) { toast.error('Passwords don\'t match'); return; }

    setSaving(true);
    try {
      await setPassword(password);
      toast.success('Password updated — you\'re signed in');
      navigate('/leagues');
    } catch (err) {
      toast.error(err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Under Achievers</div>
        <h1 style={{ fontSize: 28, textTransform: 'none', marginBottom: 8 }}>Choose a new password</h1>

        {status === 'checking' && (
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Checking your link…</p>
        )}

        {status === 'expired' && (
          <>
            <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              This link has expired or has already been used. Reset links are
              good for one use — request a fresh one and it'll work.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: '100%', justifyContent: 'center' }}>
              Back to sign in
            </button>
          </>
        )}

        {status === 'ready' && (
          <form onSubmit={submit}>
            <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
              Pick something you'll remember. You'll be signed in straight after.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPasswordValue(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Confirm password</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: 14 }}>
              {saving ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
