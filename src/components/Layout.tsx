import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const { state } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!currentUser) return null;

  const unread = state.notifications.filter(
    n => !n.read && (n.userId === 'all' || n.userId === currentUser.id)
  ).length;

  const isSup  = currentUser.role === 'supervisor' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeDrawer  = () => setDrawerOpen(false);

  const navContent = (onClick?: () => void) => (
    <>
      <div className="nav-section">
        <p className="nav-label">General</p>
        <NavLink to="/" end onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon-em">⌂</span> Opening Hours
        </NavLink>
        <NavLink to="/calendar" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon-em">◫</span> Weekly Calendar
        </NavLink>
        <NavLink to="/card" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon-em">▣</span> My Card
        </NavLink>
        <NavLink to="/notifications" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon-em">◉</span> Notifications
          {unread > 0 && <span className="nav-badge">{unread}</span>}
        </NavLink>
      </div>

      {isSup && (
        <div className="nav-section">
          <p className="nav-label">Supervisor</p>
          <NavLink to="/shifts" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon-em">◈</span> My Shifts
          </NavLink>
          <NavLink to="/spontaneous" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon-em">◎</span> Spontaneous Open
          </NavLink>
        </div>
      )}

      {isAdmin && (
        <div className="nav-section">
          <p className="nav-label">Admin</p>
          <NavLink to="/admin/users" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon-em">◫</span> Users
          </NavLink>
          <NavLink to="/admin/shiftplan" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon-em">▦</span> Shiftplan
          </NavLink>
          <NavLink to="/admin/attendance" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon-em">≡</span> Attendance
          </NavLink>
        </div>
      )}
    </>
  );

  const sidebarFooter = (onClick?: () => void) => (
    <div className="sidebar-bottom">
      <button className="theme-toggle-row" onClick={toggleTheme} aria-label="Toggle theme">
        <span className="theme-toggle-icon">{theme === 'dark' ? '☀' : '☽'}</span>
        <span className="theme-toggle-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>
      <div className="sidebar-user-card">
        <div className="sidebar-avatar">{currentUser.avatarInitials}</div>
        <div className="sidebar-user-info">
          <p className="sidebar-name">{currentUser.name}</p>
          <p className={`sidebar-role-tag role-${currentUser.role}`}>{currentUser.role}</p>
        </div>
        <button className="btn-icon-sm" onClick={onClick ?? handleLogout} title="Sign out">↪</button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <span className="menu-btn-bar" /><span className="menu-btn-bar" /><span className="menu-btn-bar" />
          </button>
          <span className="topbar-logo">
            <span className="topbar-logo-icon">🏋️</span>
            <span className="topbar-logo-text">StuSta Gym</span>
          </span>
        </div>
        <div className="topbar-right">
          <NavLink to="/notifications" className="notif-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </NavLink>
          <div className="topbar-avatar-wrap">
            <div className="topbar-avatar">{currentUser.avatarInitials}</div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Desktop sidebar */}
        <nav className="sidebar">
          <div className="sidebar-scroll">
            {navContent()}
          </div>
          {sidebarFooter()}
        </nav>

        {/* Mobile drawer overlay */}
        <div
          className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
          onClick={closeDrawer}
          aria-hidden={!drawerOpen}
        >
          <nav
            className={`drawer ${drawerOpen ? 'open' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-header">
              <span className="topbar-logo">
                <span className="topbar-logo-icon">🏋️</span>
                <span className="topbar-logo-text">StuSta Gym</span>
              </span>
              <button className="btn-icon-sm" onClick={closeDrawer} aria-label="Close menu">✕</button>
            </div>
            <div className="sidebar-scroll">
              {navContent(closeDrawer)}
            </div>
            {sidebarFooter(closeDrawer)}
          </nav>
        </div>

        {/* Main */}
        <main className="main-content">
          <div className="main-content-inner page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
