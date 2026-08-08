import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart2, User, History, Menu, X, LogOut, ChevronDown, Shield, Calendar, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navigation() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { path: '/games', label: 'Make Picks', icon: <Calendar size={16} /> },
    { path: '/leagues', label: 'Leagues', icon: <Trophy size={16} /> },
    { path: '/leaderboard', label: 'Leaderboard', icon: <BarChart2 size={16} /> },
    { path: '/history', label: 'History', icon: <History size={16} /> },
  ];

  async function handleSignOut() {
    await signOut();
    toast.success('See you next week!');
    navigate('/');
  }

  return (
    <>
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 16px',
          height: 60, display: 'flex', alignItems: 'center', gap: 8
        }}>

          {/* Logo */}
          <button onClick={() => navigate('/games')} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <span className="gradient-hero-text" style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 20, letterSpacing: '0.02em' }}>
              UNDER ACHIEVERS
            </span>
          </button>

          {/* Desktop Nav — hidden on mobile */}
          <div className="desktop-nav" style={{ display: 'flex', gap: 2, flex: 1 }}>
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-current={location.pathname === item.path ? 'page' : undefined}
                style={{
                  background: location.pathname === item.path ? 'var(--accent-soft)' : 'none',
                  border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                  color: location.pathname === item.path ? 'var(--accent)' : 'var(--ink-soft)',
                  fontWeight: 600, fontSize: 13.5,
                  padding: '8px 12px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
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
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              aria-label="Account menu"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999,
                color: 'var(--ink)', cursor: 'pointer', padding: '6px 12px 6px 6px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'DM Sans', fontSize: 14
              }}
            >
              <div style={{
                width: 26, height: 26, background: 'var(--accent)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 13, color: 'var(--accent-ink)',
                flexShrink: 0,
              }}>
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.username || 'User'}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--ink-faint)' }} />
            </button>

            {dropdownOpen && (
              <div role="menu" style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                minWidth: 190, zIndex: 200, overflow: 'hidden', boxShadow: 'var(--shadow-card-hover)'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.display_name || profile?.username}</div>
                </div>
                {profile?.is_admin && (
                  <button role="menuitem" onClick={() => { navigate('/admin'); setDropdownOpen(false); }} style={{
                    width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                    color: 'var(--accent)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <Shield size={14} /> Admin dashboard
                  </button>
                )}
                <button role="menuitem" onClick={() => { navigate('/profile'); setDropdownOpen(false); }} style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  color: 'var(--ink)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <User size={14} /> My profile
                </button>
                <button role="menuitem" onClick={handleSignOut} style={{
                  width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                  color: 'var(--danger)', cursor: 'pointer', textAlign: 'left', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderTop: '1px solid var(--border)'
                }}>
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger — only visible on mobile, always rightmost */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            style={{
              background: 'none', border: 'none', color: 'var(--ink)',
              cursor: 'pointer', padding: 8, display: 'none',
              flexShrink: 0, marginLeft: 'auto',
            }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* User info header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, background: 'var(--accent)', flexShrink: 0, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, color: 'var(--accent-ink)'
              }}>
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.display_name || profile?.username}</div>
              </div>
            </div>

            {/* Nav links */}
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                aria-current={location.pathname === item.path ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  background: location.pathname === item.path ? 'var(--accent-soft)' : 'none',
                  border: 'none',
                  borderLeft: location.pathname === item.path ? '3px solid var(--accent)' : '3px solid transparent',
                  color: location.pathname === item.path ? 'var(--accent)' : 'var(--ink)',
                  fontWeight: 600, fontSize: 15,
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
                color: 'var(--accent)', fontWeight: 600,
                fontSize: 15, padding: '14px 20px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}>
                <Shield size={16} /> Admin
              </button>
            )}

            {/* My profile + sign out */}
            <button onClick={() => { navigate('/profile'); setMobileOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              background: 'none', border: 'none', borderLeft: '3px solid transparent',
              color: 'var(--ink)', fontWeight: 600,
              fontSize: 15, padding: '14px 20px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
            }}>
              <User size={16} /> My profile
            </button>
            <button onClick={() => { handleSignOut(); setMobileOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              background: 'none', border: 'none', borderLeft: '3px solid transparent',
              color: 'var(--danger)', fontWeight: 600,
              fontSize: 15, padding: '14px 20px', cursor: 'pointer',
            }}>
              <LogOut size={16} /> Sign out
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
