import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import Navigation from './components/Navigation';
import GamesPage from './components/GamesPage';
import LeaderboardPage from './components/LeaderboardPage';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import './styles/globals.css';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)' }} className="bg-grid">
      <Navigation />
      {children}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="pulse-lime" style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 28, color: 'var(--lime)', letterSpacing: '0.05em' }}>
          UNDER ACHIEVERS
        </div>
        <div style={{ color: 'var(--slate)', marginTop: 8, fontSize: 13 }}>Loading...</div>
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
              background: '#1a2744',
              color: '#ffffff',
              border: '1px solid #2d3748',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
            },
            success: { iconTheme: { primary: '#c0ff00', secondary: '#0a1128' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
