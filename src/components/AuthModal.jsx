import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProviderButtons from './ProviderButtons';
import toast from 'react-hot-toast';

export default function AuthModal({ mode, onClose, onSwitch }) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

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
      toast.error(err.message || 'Something went wrong');
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
