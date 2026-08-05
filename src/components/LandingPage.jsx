import { useState } from 'react';
import { TrendingUp, Target, Trophy, Users, ChevronRight, Lock, Zap, BarChart3, ListChecks } from 'lucide-react';
import AuthModal from './AuthModal';

const SAMPLE_LEADERS = [
  { rank: 1, username: 'PickMaster99', points: 847, accuracy: '78%', weeks: 4 },
  { rank: 2, username: 'SpreadKing', points: 791, accuracy: '74%', weeks: 2 },
  { rank: 3, username: 'LineWhisperer', points: 768, accuracy: '71%', weeks: 3 },
  { rank: 4, username: 'GuessMaestro', points: 734, accuracy: '69%', weeks: 1 },
  { rank: 5, username: 'VegasBeater', points: 712, accuracy: '67%', weeks: 2 },
];

const TICKER_ITEMS = [
  'KC Chiefs -7.5 vs HOU', 'PHI Eagles -5.5 vs GB', 'BUF Bills -8.0 vs DEN',
  'Week 20 results: Eagles 40, Chiefs 22', 'Season champion: PickMaster99',
  '2026 season coming soon', '1,247 predictions made this season',
];

const FEATURES = [
  { icon: <Target size={22} />, title: 'Weekly NFL picks', desc: 'All games every week' },
  { icon: <Zap size={22} />, title: 'Real-time scoring', desc: 'Points update live' },
  { icon: <Trophy size={22} />, title: 'Season-long league', desc: '18 weeks of competition' },
  { icon: <BarChart3 size={22} />, title: 'Full stats history', desc: 'Every pick tracked' },
  { icon: <ListChecks size={22} />, title: 'Confidence system', desc: 'Bet big on sure things' },
  { icon: <Users size={22} />, title: 'Compete with friends', desc: 'Invite your crew' },
];

export default function LandingPage() {
  const [authMode, setAuthMode] = useState(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Ticker */}
      <div style={{ background: 'var(--accent)', overflow: 'hidden', height: 34, display: 'flex', alignItems: 'center' }}>
        <div className="marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{
              color: 'var(--accent-ink)',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 600, fontSize: 13, letterSpacing: '0.02em',
              paddingRight: 48, whiteSpace: 'nowrap'
            }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 26, color: 'var(--ink)', letterSpacing: '0.01em' }}>
              Under Achievers
            </span>
            <span className="label-muted" style={{ marginLeft: 12 }}>
              NFL Prediction League
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => setAuthMode('login')}>Log in</button>
            <button className="btn btn-primary" onClick={() => setAuthMode('signup')}>Join free</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '72px 24px 56px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="badge badge-lime" style={{ marginBottom: 20 }}>
            2025–26 NFL Season · Playoffs Complete
          </div>
          <h1 style={{ lineHeight: 1.05, marginBottom: 22, color: 'var(--ink)', textTransform: 'none' }}>
            <span style={{ fontSize: 'clamp(38px, 6.5vw, 78px)', display: 'block' }}>Can you beat Vegas?</span>
            <span style={{ fontSize: 'clamp(18px, 3vw, 30px)', color: 'var(--ink-soft)', fontWeight: 500, display: 'block', marginTop: 8, fontFamily: 'DM Sans' }}>
              Or are you an
            </span>
            <span className="gradient-hero-text" style={{ fontSize: 'clamp(38px, 6.5vw, 78px)', display: 'block' }}>Under Achiever?</span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--ink-soft)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.6 }}>
            Predict NFL point spreads each week and compete against friends and the community. Prove you know ball.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => setAuthMode('signup')}>
              Start picking <ChevronRight size={18} />
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => setAuthMode('login')}>
              Log in
            </button>
          </div>
          <div style={{ marginTop: 44, display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['1,247', 'Predictions made'], ['312', 'Active users'], ['18', 'Weeks competed']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 32, color: 'var(--ink)' }}>{val}</div>
                <div className="label-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '56px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, marginBottom: 40, color: 'var(--ink)', textTransform: 'none' }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: <Target size={28} />, step: '01', title: 'Make your picks', desc: 'Every week, predict the point spread for each NFL game before kickoff.' },
              { icon: <TrendingUp size={28} />, step: '02', title: 'Score points', desc: 'The closer your prediction to the actual line, the more points you earn. Add confidence for bigger rewards.' },
              { icon: <Trophy size={28} />, step: '03', title: 'Climb the ranks', desc: 'Compete on weekly and season-long leaderboards and earn bragging rights.' },
            ].map(item => (
              <div key={item.step} className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <div style={{ color: 'var(--accent)' }}>{item.icon}</div>
                  <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 40, color: 'var(--accent-soft)', lineHeight: 1 }}>{item.step}</span>
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, textTransform: 'none' }}>{item.title}</h3>
                <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, fontSize: 14.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Leaderboard */}
      <section style={{ padding: '56px 24px', background: 'var(--surface-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 30, textTransform: 'none' }}>Season leaders</h2>
            <div className="badge badge-lime">2025 Season</div>
          </div>

          {SAMPLE_LEADERS.map((user, i) => (
            <div key={user.rank} className="card fade-in-up" style={{
              padding: '14px 18px',
              marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 16,
              borderLeft: user.rank === 1 ? '3px solid var(--gold)' : user.rank === 2 ? '3px solid var(--silver)' : user.rank === 3 ? '3px solid var(--bronze)' : '3px solid transparent',
              animationDelay: `${i * 0.05}s`
            }}>
              <div style={{
                fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 24,
                width: 36, textAlign: 'center',
                color: user.rank === 1 ? 'var(--gold)' : user.rank === 2 ? 'var(--silver)' : user.rank === 3 ? 'var(--bronze)' : 'var(--ink-faint)'
              }}>
                {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17 }}>{user.username}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{user.weeks} week{user.weeks !== 1 ? 's' : ''} won</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{user.points} pts</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{user.accuracy} accuracy</div>
              </div>
            </div>
          ))}

          <div style={{ padding: '14px 4px', marginTop: 8, textAlign: 'center' }}>
            <Lock size={13} style={{ color: 'var(--ink-faint)', marginRight: 6, display: 'inline' }} />
            <span style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }} onClick={() => setAuthMode('signup')}>
                Create a free account
              </button> to see the full leaderboard
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '56px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, marginBottom: 40, textTransform: 'none' }}>
            Built for real fans
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="card" style={{ padding: 22, textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{f.icon}</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ padding: '56px 24px', background: 'var(--gradient-hero)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(30px, 5vw, 52px)', color: 'var(--accent-ink)', marginBottom: 14, textTransform: 'none' }}>
          Prove you know football
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, marginBottom: 28 }}>
          Join hundreds of fans making picks every week. Free forever.
        </p>
        <button className="btn" style={{ background: 'var(--surface)', color: 'var(--accent-dark)', fontSize: 16, padding: '14px 40px', fontWeight: 700 }} onClick={() => setAuthMode('signup')}>
          Start for free <ChevronRight size={18} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>Under Achievers</span>
          <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Inspired by Guess the Lines · For entertainment only</span>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-faint)', fontSize: 12, lineHeight: 1.6, maxWidth: 800, margin: '0 auto' }}>
            Under Achievers is an unofficial fan game not affiliated with or endorsed by the NFL, its teams, or any related entities.
            Team names and logos are the property of their respective owners.
            This site is for entertainment purposes only. No real money is wagered or can be won.
            Point spread data is sourced from public oddsmakers for entertainment use only.
          </p>
        </div>
      </footer>

      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={m => setAuthMode(m)} />}
    </div>
  );
}
