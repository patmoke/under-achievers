import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart2, User, History, Menu, X, LogOut, ChevronDown, Shield, Calendar, Umbrella, Trophy, Rss } from 'lucide-react';
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
    { path: '/feed', label: 'FEED', icon: <Rss size={16} /> },
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
    <>
      <nav style={{
        background: 'var(--navy-light)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 16px',
          height: 60, display: 'flex', alignItems: 'center', gap: 8
        }}>

          {/* Logo */}
          <button onClick={() => navigate('/games')} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <span className="gradient-hero-text" style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 20, letterSpacing: '0.05em' }}>
              UNDER ACHIEVERS
            </span>
          </button>

          {/* Desktop Nav — hidden on mobile */}
          <div className="desktop-nav" style={{ display: 'flex', gap: 2, flex: 1 }}>
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  background: location.pathname === item.path ? 'var(--lime-dim)' : 'none',
                  border: 'none', cursor: 'pointer',
                  color: location.pathname === item.path ? 'var(--lime)' : 'var(--slate)',
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13,
                  letterSpacing: '0.06em', padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                  borderBottom: location.pathname === item.path ? '2px solid var(--lime)' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          {/* Desktop User Menu — hidden on mobile */}
          <div className="desktop-user" style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                background: 'rgba(26,39,68,0.8)', border: '1px solid var(--border)',
                color: 'var(--white)', cursor: 'pointer', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'DM Sans', fontSize: 14
              }}
            >
              <div style={{
                width: 28, height: 28, background: 'var(--lime)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, color: 'var(--navy)',
                flexShrink: 0,
              }}>
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

          {/* Mobile hamburger — only visible on mobile, always rightmost */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: 'none', border: 'none', color: 'var(--white)',
              cursor: 'pointer', padding: 8, display: 'none',
              flexShrink: 0, marginLeft: 'auto',
            }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--navy-light)' }}>
            {/* User info header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, background: 'var(--lime)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--navy)'
              }}>
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.display_name || profile?.username}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)' }}>{profile?.total_points || 0} pts</div>
              </div>
            </div>

            {/* Nav links */}
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  background: location.pathname === item.path ? 'rgba(192,255,0,0.06)' : 'none',
                  border: 'none',
                  borderLeft: location.pathname === item.path ? '3px solid var(--lime)' : '3px solid transparent',
                  color: location.pathname === item.path ? 'var(--lime)' : 'var(--white)',
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, letterSpacing: '0.08em',
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {item.icon} {item.label}
              </button>
            ))}

            {/* Admin link */}
            {profile?.is_admin && (
              <button onClick={() => { navigate('/admin'); setMobileOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                background: 'none', border: 'none', borderLeft: '3px solid transparent',
                color: 'var(--lime)', fontFamily: 'Barlow Condensed', fontWeight: 700,
                fontSize: 17, letterSpacing: '0.08em', padding: '14px 20px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}>
                <Shield size={16} /> ADMIN
              </button>
            )}

            {/* Sign out */}
            <button onClick={() => { handleSignOut(); setMobileOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              background: 'none', border: 'none', borderLeft: '3px solid transparent',
              color: 'var(--red)', fontFamily: 'Barlow Condensed', fontWeight: 700,
              fontSize: 17, letterSpacing: '0.08em', padding: '14px 20px', cursor: 'pointer',
            }}>
              <LogOut size={16} /> SIGN OUT
            </button>
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-user { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
