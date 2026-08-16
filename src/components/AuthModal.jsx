import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProviderButtons from './ProviderButtons';
import toast from 'react-hot-toast';

export default function AuthModal({ mode, onClose, onSwitch }) {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  // Shown only after a sign-in actually fails. Offering a way out before
  // anything has gone wrong is clutter; offering it afterwards is the whole
  // point — someone stuck on a wrong password has nowhere else to go.
  const [signInFailed, setSignInFailed] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        toast.success('Welcome back!');
        onClose();
      } else {
        if (!username || username.length < 3) {
          toast.error('Username must be at least 3 characters');
          setLoading(false);
          return;
        }
        await signUp(email, password, username);
        toast.success('Account created! Check your email to confirm.');
        onClose();
      }
    } catch (err) {
      const message = err.message || 'Something went wrong';

      // Supabase answers a repeat signup with "User already registered", which
      // on its own leaves someone bouncing between two forms that both refuse
      // them. Put them on the right one with the reset offer already showing.
      if (/already registered/i.test(message)) {
        toast('You already have an account — try signing in.', { icon: '👋' });
        setSignInFailed(true);
        onSwitch('login');
      } else if (mode === 'login' && /invalid login credentials/i.test(message)) {
        setSignInFailed(true);
        toast.error('That email and password don\'t match');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendReset() {
    if (!email.trim()) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      toast.error(err.message || 'Could not send the reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(22,24,28,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in-up" style={{ width: '100%', maxWidth: 420, padding: 40, position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Under Achievers</div>
          <h2 style={{ fontSize: 30, textTransform: 'none' }}>
            {mode === 'login' ? 'Welcome back' : 'Join the league'}
          </h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 6, fontSize: 14 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        <ProviderButtons mode={mode} />

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. PickMaster99"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={{ marginBottom: 24, position: 'relative' }}>
            <label className="label-muted" style={{ display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={{ paddingRight: 48 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide password' : 'Show password'} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer'
              }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px' }} disabled={loading}>
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          resetSent ? (
            <div style={{
              marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-soft)', fontSize: 13, lineHeight: 1.55,
            }}>
              If an account exists for <strong>{email}</strong>, a reset link is on its
              way. It can take a few minutes — check spam too.
            </div>
          ) : (
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, lineHeight: 1.6 }}>
              <button
                type="button"
                onClick={sendReset}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Forgot your password?
              </button>
              {/* Supabase can't distinguish "wrong password" from "this account
                  has no password because it was made with Google" — both come
                  back as invalid credentials. Rather than build an oracle that
                  reveals which, say both out loud once a sign-in has failed. */}
              {signInFailed && (
                <p style={{ color: 'var(--ink-soft)', fontSize: 12.5, margin: '8px 0 0' }}>
                  If you signed up with Google, use the Google button above —
                  those accounts don't have a password.
                </p>
              )}
            </div>
          )
        )}

        <div style={{ marginTop: 22, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => onSwitch('signup')}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => onSwitch('login')}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
