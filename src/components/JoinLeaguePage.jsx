import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Key, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthModal from './AuthModal';

export default function JoinLeaguePage() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  const [joining, setJoining] = useState(false);

  // Joining must fire exactly once. A ref rather than the `joining` state
  // because state updates are async — a re-render before the flag lands could
  // otherwise fire a second join.
  const hasAttempted = useRef(false);

  const join = useCallback(async () => {
    setJoining(true);
    const normalized = code.trim().toUpperCase();
    const { data, error } = await supabase.rpc('join_league_by_code', { p_code: normalized });

    if (!error) {
      toast.success(`Joined "${data.name}"!`);
      navigate(`/leagues/${data.id}`, { replace: true });
      return;
    }

    if (error.message.includes('already in this league')) {
      const { data: existing } = await supabase.from('leagues').select('id, name').eq('join_code', normalized).single();
      if (existing) {
        navigate(`/leagues/${existing.id}`, { replace: true });
        return;
      }
    }

    toast.error(error.message);
    navigate('/leagues', { replace: true });
  }, [code, navigate]);

  useEffect(() => {
    if (loading || !user || hasAttempted.current) return;
    hasAttempted.current = true;
    join();
  }, [loading, user, join]);

  if (loading || (user && joining)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-lime" style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>
            Under Achievers
          </div>
          <div style={{ color: 'var(--ink-soft)', marginTop: 8, fontSize: 13 }}>
            {user ? 'Joining league…' : 'Loading…'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: 24 }}>
      <div className="card" style={{ padding: 36, maxWidth: 420, textAlign: 'center' }}>
        <div className="badge badge-lime" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Key size={12} /> League invite
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 10, textTransform: 'none' }}>You've been invited to join a league</h1>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 28, fontSize: 14 }}>
          Log in or create a free account to join with code{' '}
          <strong style={{ fontFamily: 'Barlow Condensed', letterSpacing: '0.08em' }}>{code?.toUpperCase()}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setAuthMode('signup')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Create account <ChevronRight size={16} />
          </button>
          <button className="btn btn-secondary" onClick={() => setAuthMode('login')}>Log in</button>
        </div>
      </div>
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={m => setAuthMode(m)} />}
    </div>
  );
}
