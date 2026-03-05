import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in-up" style={{ width: '100%', maxWidth: 420, padding: 40, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 14, color: 'var(--lime)', letterSpacing: '0.1em', marginBottom: 8 }}>
            UNDER ACHIEVERS
          </div>
          <h2 style={{ fontSize: 36 }}>
            {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE LEAGUE'}
          </h2>
          <p style={{ color: 'var(--slate)', marginTop: 8, fontSize: 14 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', color: 'var(--slate)', marginBottom: 6 }}>USERNAME</label>
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
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', color: 'var(--slate)', marginBottom: 6 }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={{ marginBottom: 28, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', color: 'var(--slate)', marginBottom: 6 }}>PASSWORD</label>
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
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer'
              }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px' }} disabled={loading}>
            {loading ? 'Loading...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--slate)', fontSize: 14 }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', fontWeight: 600 }} onClick={() => onSwitch('signup')}>
                Sign up free
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', fontWeight: 600 }} onClick={() => onSwitch('login')}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
