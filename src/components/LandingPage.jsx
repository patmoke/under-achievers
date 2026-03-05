import { useState } from 'react';
import { TrendingUp, Target, Trophy, Zap, Users, ChevronRight, Lock } from 'lucide-react';
import AuthModal from './AuthModal';

const SAMPLE_LEADERS = [
  { rank: 1, username: 'PickMaster99', points: 847, accuracy: '78%', weeks: 4 },
  { rank: 2, username: 'SpreadKing', points: 791, accuracy: '74%', weeks: 2 },
  { rank: 3, username: 'LineWhisperer', points: 768, accuracy: '71%', weeks: 3 },
  { rank: 4, username: 'GuessMaestro', points: 734, accuracy: '69%', weeks: 1 },
  { rank: 5, username: 'VegasBeater', points: 712, accuracy: '67%', weeks: 2 },
];

const TICKER_ITEMS = [
  '🏈 KC Chiefs -7.5 vs HOU', '🏈 PHI Eagles -5.5 vs GB', '🏈 BUF Bills -8.0 vs DEN',
  '⚡ Week 20 Results: Eagles 40, Chiefs 22', '🏆 Season Champion: PickMaster99',
  '🏈 2026 Season Coming Soon', '⭐ 1,247 predictions made this season',
];

export default function LandingPage() {
  const [authMode, setAuthMode] = useState(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)' }} className="bg-grid">
      {/* Ticker */}
      <div style={{ background: 'var(--lime)', overflow: 'hidden', height: 36, display: 'flex', alignItems: 'center' }}>
        <div className="marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{ 
              color: 'var(--navy)', 
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
              paddingRight: 48, whiteSpace: 'nowrap' 
            }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--lime)', letterSpacing: '0.05em' }}>
              UNDER ACHIEVERS
            </span>
            <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 12, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              NFL Prediction League
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => setAuthMode('login')}>LOG IN</button>
            <button className="btn btn-primary" onClick={() => setAuthMode('signup')}>JOIN FREE</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 24px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(192,255,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        
        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
          <div className="badge badge-lime" style={{ marginBottom: 20 }}>
            🏈 2025-26 NFL Season · Playoffs Complete
          </div>
          <h1 style={{ lineHeight: 0.9, marginBottom: 24, color: 'var(--white)' }}>
            <span style={{ fontSize: 'clamp(42px, 7vw, 96px)', whiteSpace: 'nowrap', display: 'block' }}>CAN YOU BEAT VEGAS?</span>
            <span style={{ fontSize: 'clamp(20px, 3.5vw, 42px)', color: 'var(--slate)', fontWeight: 500, display: 'block', marginTop: 12 }}>or are you an</span>
            <span className="gradient-hero-text" style={{ fontSize: 'clamp(42px, 7vw, 96px)', display: 'block' }}>UNDER ACHIEVER?</span>
          </h1>
          <p style={{ fontSize: 19, color: 'var(--slate)', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.6 }}>
            Predict NFL point spreads each week, compete against friends and the entire community. Prove you know ball. Are you an Over/Under Achiever?
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 18, padding: '16px 40px' }} onClick={() => setAuthMode('signup')}>
              START PICKING <ChevronRight size={20} />
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 18, padding: '16px 40px' }} onClick={() => setAuthMode('login')}>
              LOG IN
            </button>
          </div>
          <div style={{ marginTop: 40, display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['1,247', 'Predictions Made'], ['312', 'Active Users'], ['18', 'Weeks Competed']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 36, color: 'var(--lime)' }}>{val}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: '64px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 42, marginBottom: 48, color: 'var(--white)' }}>
            HOW IT <span style={{ color: 'var(--lime)' }}>WORKS</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { icon: <Target size={32} />, step: '01', title: 'MAKE YOUR PICKS', desc: 'Every week, predict the point spread for each NFL game before kickoff. Use your football knowledge to outsmart the oddsmakers.' },
              { icon: <TrendingUp size={32} />, step: '02', title: 'SCORE POINTS', desc: 'The closer your prediction to the actual line, the more points you earn. Perfect picks get 10x multipliers. Add confidence for bigger rewards.' },
              { icon: <Trophy size={32} />, step: '03', title: 'CLIMB THE RANKS', desc: "Compete on weekly and season-long leaderboards. Win your week, dominate the season, and earn bragging rights over everyone you know." },
            ].map(item => (
              <div key={item.step} className="card" style={{ padding: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{ color: 'var(--lime)' }}>{item.icon}</div>
                  <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 48, color: 'rgba(192,255,0,0.15)', lineHeight: 1 }}>{item.step}</span>
                </div>
                <h3 style={{ fontSize: 22, marginBottom: 12 }}>{item.title}</h3>
                <p style={{ color: 'var(--slate)', lineHeight: 1.6, fontSize: 15 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Leaderboard */}
      <section style={{ padding: '64px 24px', background: 'rgba(21, 31, 61, 0.5)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 36 }}>SEASON <span style={{ color: 'var(--lime)' }}>LEADERS</span></h2>
            <div className="badge badge-lime">2025 Season</div>
          </div>
          
          {SAMPLE_LEADERS.map((user, i) => (
            <div key={user.rank} className="card" style={{ 
              padding: '16px 20px', 
              marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 16,
              borderLeft: user.rank === 1 ? '3px solid var(--gold)' : user.rank === 2 ? '3px solid var(--silver)' : user.rank === 3 ? '3px solid var(--bronze)' : '3px solid transparent',
              animationDelay: `${i * 0.05}s`
            }} className="card fade-in-up">
              <div style={{ 
                fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, 
                width: 40, textAlign: 'center',
                color: user.rank === 1 ? 'var(--gold)' : user.rank === 2 ? 'var(--silver)' : user.rank === 3 ? 'var(--bronze)' : 'var(--slate)'
              }}>
                {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 18 }}>{user.username}</div>
                <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{user.weeks} week{user.weeks !== 1 ? 's' : ''} won</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gradient-hero-text" style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20 }}>{user.points} pts</div>
                <div style={{ fontSize: 12, color: 'var(--slate)' }}>{user.accuracy} accuracy</div>
              </div>
            </div>
          ))}

          <div className="card" style={{ padding: 20, marginTop: 16, textAlign: 'center', borderStyle: 'dashed' }}>
            <Lock size={16} style={{ color: 'var(--slate)', marginRight: 8, display: 'inline' }} />
            <span style={{ color: 'var(--slate)', fontSize: 14 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--lime)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAuthMode('signup')}>
                Create a free account
              </button> to see the full leaderboard
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 42, marginBottom: 48 }}>
            BUILT FOR <span style={{ color: 'var(--lime)' }}>REAL FANS</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '🏈', title: 'Weekly NFL Picks', desc: 'All games every week' },
              { icon: '⚡', title: 'Real-Time Scoring', desc: 'Points update live' },
              { icon: '🏆', title: 'Season-Long League', desc: '18 weeks of competition' },
              { icon: '📊', title: 'Full Stats History', desc: 'Every pick tracked' },
              { icon: '🎯', title: 'Confidence System', desc: 'Bet big on sure things' },
              { icon: '🤝', title: 'Compete With Friends', desc: 'Invite your crew' },
            ].map(f => (
              <div key={f.title} className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--slate)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ padding: '64px 24px', background: 'var(--gradient-hero)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(36px, 6vw, 64px)', color: 'var(--navy)', marginBottom: 16 }}>
          PROVE YOU KNOW FOOTBALL
        </h2>
        <p style={{ color: 'rgba(10,17,40,0.7)', fontSize: 18, marginBottom: 32 }}>
          Join hundreds of fans making picks every week. Free forever.
        </p>
        <button className="btn" style={{ background: 'var(--navy)', color: 'var(--lime)', fontSize: 18, padding: '16px 48px' }} onClick={() => setAuthMode('signup')}>
          START FOR FREE <ChevronRight size={20} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 20, color: 'var(--lime)' }}>UNDER ACHIEVERS</span>
          <span style={{ color: 'var(--slate)', fontSize: 13 }}>Inspired by Guess the Lines · For entertainment only</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setAuthMode('signup')}>Sign Up</button>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setAuthMode('login')}>Log In</button>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--slate)', fontSize: 12, lineHeight: 1.6, maxWidth: 800, margin: '0 auto' }}>
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
