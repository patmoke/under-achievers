import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import Navigation from './components/Navigation';
import GamesPage from './components/GamesPage';
import LeaderboardPage from './components/LeaderboardPage';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import AdminPage from './components/AdminPage';
import LeaguesPage from './components/LeaguesPage';
import LeaguePage from './components/LeaguePage';
import JoinLeaguePage from './components/JoinLeaguePage';
import UserProfilePage from './components/UserProfilePage';
import Footer from './components/Footer';
import './styles/globals.css';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <Navigation />
      {children}
      <Footer />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="pulse-lime" style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, color: 'var(--ink)', letterSpacing: '0.01em' }}>
          Under Achievers
        </div>
        <div style={{ color: 'var(--ink-soft)', marginTop: 8, fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/games" replace /> : <LandingPage />} />
      <Route path="/games" element={<ProtectedLayout><GamesPage /></ProtectedLayout>} />
      <Route path="/leaderboard" element={<ProtectedLayout><LeaderboardPage /></ProtectedLayout>} />
      <Route path="/profile" element={<ProtectedLayout><ProfilePage /></ProtectedLayout>} />
      <Route path="/history" element={<ProtectedLayout><HistoryPage /></ProtectedLayout>} />
      <Route path="/admin" element={<ProtectedLayout><AdminPage /></ProtectedLayout>} />
      <Route path="/leagues" element={<ProtectedLayout><LeaguesPage /></ProtectedLayout>} />
      <Route path="/leagues/:id" element={<ProtectedLayout><LeaguePage /></ProtectedLayout>} />
      <Route path="/join/:code" element={<JoinLeaguePage />} />
      <Route path="/users/:id" element={<ProtectedLayout><UserProfilePage /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#16181c',
              color: '#ffffff',
              border: '1px solid #2d3038',
              borderRadius: 8,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              boxShadow: '0 4px 20px rgba(22,24,28,0.25)',
            },
            success: { iconTheme: { primary: '#3ddc91', secondary: '#16181c' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
