import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import GdprConsent from './components/GdprConsent';
import Layout from './components/Layout';
import Login from './pages/Login';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
import MyCard from './pages/MyCard';
import Notifications from './pages/Notifications';
import WeeklyCalendar from './pages/WeeklyCalendar';
import MyShifts from './pages/supervisor/MyShifts';
import SpontaneousOpen from './pages/supervisor/SpontaneousOpen';
import UserManagement from './pages/admin/UserManagement';
import ShiftplanEditor from './pages/admin/ShiftplanEditor';
import AttendanceLogs from './pages/admin/AttendanceLogs';
import EditMemberCard from './pages/admin/EditMemberCard';
import MembersList from './pages/supervisor/MembersList';

// ─── Route guard ──────────────────────────────────────────────────────────────
// requireAuth:  redirect guests to /login (preserving the intended destination)
// requireRole:  redirect insufficiently-privileged users to /
function ProtectedRoute({
  children,
  requireAuth = true,
  requireRole,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: 'supervisor' | 'admin';
}) {
  const { currentUser, ready } = useAuth();

  // Wait for the initial session check before making auth decisions
  if (!ready) return null;

  if (requireAuth && !currentUser)
    return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace />;

  if (requireRole === 'supervisor' && currentUser?.role === 'member')
    return <Navigate to="/" replace />;

  if (requireRole === 'admin' && currentUser?.role !== 'admin')
    return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { currentUser, ready } = useAuth();

  // Block rendering until the initial session check is done to avoid
  // flashing the login page or "Sign in" button for returning users
  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <span style={{ fontSize: 32 }}>🏋️</span>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public — no auth required */}
      <Route path="/login"   element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      {/* Auth callback — handles email verification redirect from Supabase */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Guest-accessible pages (visible to everyone, read-only for guests) */}
      <Route path="/"        element={<ProtectedRoute requireAuth={false}><Home /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute requireAuth={false}><WeeklyCalendar /></ProtectedRoute>} />

      {/* Auth-required pages */}
      <Route path="/card"          element={<ProtectedRoute><MyCard /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

      {/* Supervisor + Admin */}
      <Route path="/shifts"      element={<ProtectedRoute requireRole="supervisor"><MyShifts /></ProtectedRoute>} />
      <Route path="/spontaneous" element={<ProtectedRoute requireRole="supervisor"><SpontaneousOpen /></ProtectedRoute>} />
      <Route path="/members"     element={<ProtectedRoute requireRole="supervisor"><MembersList /></ProtectedRoute>} />
      <Route path="/members/:userId" element={<ProtectedRoute requireRole="supervisor"><EditMemberCard /></ProtectedRoute>} />

      {/* Admin only */}
      <Route path="/admin/users"      element={<ProtectedRoute requireRole="admin"><UserManagement /></ProtectedRoute>} />
      <Route path="/admin/shiftplan"  element={<ProtectedRoute requireRole="admin"><ShiftplanEditor /></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute requireRole="admin"><AttendanceLogs /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* GDPR consent banner — mounted before all providers so it fires on first paint */}
      <GdprConsent />
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
