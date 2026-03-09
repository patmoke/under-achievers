import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart2, User, History, Menu, X, LogOut, ChevronDown, Shield, Calendar, Umbrella, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navigation() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { path: '/games', label: 'THIS WEEK', icon: <Calendar size={16} /> },
    { path: '/offseason', label: 'OFFSEASON', icon: <Umbrella size={16} /> },
    { path: '/leagues', label: 'LEAGUES', icon: <Trophy size={16} /> },
    { path: '/leaderboard', label: 'LEADERBOARD', icon: <BarChart2 size={16} /> },
    { path: '/profile', label: 'MY PROFILE', icon: <User size={16} /> },
    { path: '/history', label: 'HISTORY', icon: <History size={16} /> },
  ];

  async function handleSignOut() {
    await signOut();
    toast.success('See you next week!');
    navigate('/');
  }

  return (
    <nav style={{ 
      background: 'var(--navy-light)', 
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Logo */}
        <button onClick={() => navigate('/games')} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <span className="gradient-hero-text" style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 22, letterSpacing: '0.05em' }}>
            UNDER ACHIEVERS
          </span>
        </button>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', gap: 4, flex: 1, '@media (max-width: 768px)': { display: 'none' } }} className="desktop-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: location.pathname === item.path ? 'var(--lime-dim)' : 'none',
                border: 'none', cursor: 'pointer',
                color: location.pathname === item.path ? 'var(--lime)' : 'var(--slate)',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14,
                letterSpacing: '0.08em', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
                borderBottom: location.pathname === item.path ? '2px solid var(--lime)' : '2px solid transparent',
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* User Menu */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ 
              background: 'rgba(26,39,68,0.8)', border: '1px solid var(--border)',
              color: 'var(--white)', cursor: 'pointer', padding: '8px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'DM Sans', fontSize: 14
            }}
          >
            <div style={{ 
              width: 28, height: 28, background: 'var(--lime)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--navy)'
            }}>
              {profile?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.username || 'User'}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--slate)' }} />
          </button>

          {dropdownOpen && (
            <div style={{ 
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: 'var(--navy-card)', border: '1px solid var(--border)',
              minWidth: 180, zIndex: 200
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.display_name || profile?.username}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{profile?.total_points || 0} total points</div>
              </div>
              {profile?.is_admin && (
                <button onClick={() => { navigate('/admin'); setDropdownOpen(false); }} style={{
                  width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                  color: 'var(--lime)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid var(--border)'
                }}>
                  <Shield size={14} /> Admin Dashboard
                </button>
              )}
              <button onClick={() => { navigate('/profile'); setDropdownOpen(false); }} style={{
                width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                color: 'var(--white)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <User size={14} /> My Profile
              </button>
              <button onClick={handleSignOut} style={{
                width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                color: 'var(--red)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 10,
                borderTop: '1px solid var(--border)'
              }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ 
          background: 'none', border: 'none', color: 'var(--white)', cursor: 'pointer',
          display: 'none'
        }} className="mobile-menu-btn">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          {navItems.map(item => (
            <button key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              background: 'none', border: 'none', color: location.pathname === item.path ? 'var(--lime)' : 'var(--slate)',
              fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, letterSpacing: '0.08em',
              padding: '12px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)'
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
