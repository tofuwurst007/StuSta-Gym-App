import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import MyCard from './pages/MyCard';
import Notifications from './pages/Notifications';
import WeeklyCalendar from './pages/WeeklyCalendar';
import MyShifts from './pages/supervisor/MyShifts';
import SpontaneousOpen from './pages/supervisor/SpontaneousOpen';
import UserManagement from './pages/admin/UserManagement';
import ShiftplanEditor from './pages/admin/ShiftplanEditor';
import AttendanceLogs from './pages/admin/AttendanceLogs';

function ProtectedRoute({ children, requireRole }: { children: React.ReactNode; requireRole?: 'supervisor' | 'admin' }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (requireRole === 'supervisor' && currentUser.role === 'member') return <Navigate to="/" replace />;
  if (requireRole === 'admin' && currentUser.role !== 'admin') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><WeeklyCalendar /></ProtectedRoute>} />
      <Route path="/card" element={<ProtectedRoute><MyCard /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/shifts" element={<ProtectedRoute requireRole="supervisor"><MyShifts /></ProtectedRoute>} />
      <Route path="/spontaneous" element={<ProtectedRoute requireRole="supervisor"><SpontaneousOpen /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><UserManagement /></ProtectedRoute>} />
      <Route path="/admin/shiftplan" element={<ProtectedRoute requireRole="admin"><ShiftplanEditor /></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute requireRole="admin"><AttendanceLogs /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
