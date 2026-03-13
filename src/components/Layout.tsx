import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const { state } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!currentUser) return null;

  const unread = state.notifications.filter(
    n => !n.read && (n.userId === 'all' || n.userId === currentUser.id)
  ).length;

  const isSup  = currentUser.role === 'supervisor' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeDrawer = () => setDrawerOpen(false);

  const navLinks = (onClick?: () => void) => (
    <>
      <div className="nav-section">
        <p className="nav-label">General</p>
        <NavLink to="/" end onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          🏠 Opening Hours
        </NavLink>
        <NavLink to="/calendar" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          📆 Weekly Calendar
        </NavLink>
        <NavLink to="/card" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          🪪 My Card
        </NavLink>
        <NavLink to="/notifications" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          🔔 Notifications {unread > 0 && <span className="nav-badge">{unread}</span>}
        </NavLink>
      </div>

      {isSup && (
        <div className="nav-section">
          <p className="nav-label">Supervisor</p>
          <NavLink to="/shifts" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            📅 My Shifts
          </NavLink>
          <NavLink to="/spontaneous" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            ⚡ Spontaneous Open
          </NavLink>
        </div>
      )}

      {isAdmin && (
        <div className="nav-section">
          <p className="nav-label">Admin</p>
          <NavLink to="/admin/users" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            👥 Users
          </NavLink>
          <NavLink to="/admin/shiftplan" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            🗓 Shiftplan
          </NavLink>
          <NavLink to="/admin/attendance" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            📋 Attendance
          </NavLink>
        </div>
      )}
    </>
  );

  // Bottom nav items for mobile
  const isPath = (p: string) => location.pathname === p;

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Menu">☰</button>
          <span className="topbar-logo">🏋️ StuSta Gym</span>
        </div>
        <div className="topbar-right">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <NavLink to="/notifications" className="notif-btn">
            🔔{unread > 0 && <span className="notif-badge">{unread}</span>}
          </NavLink>
          <div className="topbar-user">
            <div className="topbar-avatar">{currentUser.avatarInitials}</div>
            <span className="topbar-name">{currentUser.name.split(' ')[0]}</span>
          </div>
          <button className="btn-ghost-sm" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="app-body">
        {/* Desktop sidebar */}
        <nav className="sidebar">
          {navLinks()}
          <div className="sidebar-bottom">
            <div className="sidebar-user-card">
              <div className="sidebar-avatar">{currentUser.avatarInitials}</div>
              <div>
                <p className="sidebar-name">{currentUser.name}</p>
                <p className={`sidebar-role role-${currentUser.role}`}>{currentUser.role}</p>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile drawer */}
        <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer}>
          <nav className={`drawer ${drawerOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>🏋️ StuSta Gym</span>
              <button className="btn-icon" onClick={closeDrawer}>✕</button>
            </div>
            {navLinks(closeDrawer)}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border2)' }}>
              <div className="sidebar-user-card">
                <div className="sidebar-avatar">{currentUser.avatarInitials}</div>
                <div>
                  <p className="sidebar-name">{currentUser.name}</p>
                  <p className={`sidebar-role role-${currentUser.role}`}>{currentUser.role}</p>
                </div>
              </div>
              <button className="btn-ghost-sm" style={{ marginTop: 10, width: '100%' }} onClick={handleLogout}>Sign out</button>
            </div>
          </nav>
        </div>

        {/* Main content */}
        <main className="main-content">
          <div className="main-content-inner">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <NavLink to="/" end className={`bottom-nav-item ${isPath('/') ? 'active' : ''}`}>
            <span className="nav-icon">🏠</span>
            Hours
          </NavLink>
          <NavLink to="/calendar" className={`bottom-nav-item ${isPath('/calendar') ? 'active' : ''}`}>
            <span className="nav-icon">📆</span>
            Calendar
          </NavLink>
          <NavLink to="/card" className={`bottom-nav-item ${isPath('/card') ? 'active' : ''}`}>
            <span className="nav-icon">🪪</span>
            Card
          </NavLink>
          <NavLink to="/notifications" className={`bottom-nav-item ${isPath('/notifications') ? 'active' : ''}`}>
            <div className="bnav-icon-wrap">
              <span className="nav-icon">🔔</span>
              {unread > 0 && <span className="bottom-nav-badge">{unread}</span>}
            </div>
            Alerts
          </NavLink>
          {isSup && (
            <NavLink to="/shifts" className={`bottom-nav-item ${isPath('/shifts') ? 'active' : ''}`}>
              <span className="nav-icon">📅</span>
              Shifts
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/users" className={`bottom-nav-item ${isPath('/admin/users') ? 'active' : ''}`}>
              <span className="nav-icon">👥</span>
              Admin
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}
