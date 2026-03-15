import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import AvatarPicker, { AvatarDisplay } from './AvatarPicker';

// ── Inline SVG icon set ───────────────────────────────────────────────────────
const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20M6 15h4"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  shifts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  shiftplan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  cookie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>
      <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01"/>
    </svg>
  ),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout, updateCurrentUser } = useAuth();
  const { state } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const isGuest = !currentUser;
  const unread  = isGuest ? 0 : state.notifications.filter(
    n => !n.read && (n.userId === 'all' || n.userId === currentUser!.id)
  ).length;

  const isSup   = !isGuest && (currentUser!.role === 'supervisor' || currentUser!.role === 'admin');
  const isAdmin = !isGuest && currentUser!.role === 'admin';

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeDrawer  = () => setDrawerOpen(false);
  const drawerLogout = () => { closeDrawer(); handleLogout(); };

  // ── Nav links ───────────────────────────────────────────────────────────────
  const navContent = (onClick?: () => void) => (
    <>
      <div className="nav-section">
        <p className="nav-label">General</p>

        <NavLink to="/" end onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon">{Icon.home}</span>
          <span className="nav-text">Opening Hours</span>
        </NavLink>

        <NavLink to="/calendar" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-icon">{Icon.calendar}</span>
          <span className="nav-text">Weekly Calendar</span>
        </NavLink>

        {/* Auth-gated items — shown as locked when guest */}
        {isGuest ? (
          <>
            <div className="nav-link nav-link-locked" title="Sign in to access">
              <span className="nav-icon">{Icon.card}</span>
              <span className="nav-text">My Card</span>
              <span className="nav-lock">{Icon.lock}</span>
            </div>
            <div className="nav-link nav-link-locked" title="Sign in to access">
              <span className="nav-icon">{Icon.bell}</span>
              <span className="nav-text">Notifications</span>
              <span className="nav-lock">{Icon.lock}</span>
            </div>
          </>
        ) : (
          <>
            <NavLink to="/card" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <span className="nav-icon">{Icon.card}</span>
              <span className="nav-text">My Card</span>
            </NavLink>
            <NavLink to="/notifications" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <span className={`nav-icon ${unread > 0 ? 'nav-icon-ring' : ''}`}>{Icon.bell}</span>
              <span className="nav-text">Notifications</span>
              {unread > 0 && <span className="nav-badge">{unread}</span>}
            </NavLink>
          </>
        )}
      </div>

      {isSup && (
        <div className="nav-section">
          <p className="nav-label">Supervisor</p>
          <NavLink to="/shifts" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.shifts}</span>
            <span className="nav-text">My Shifts</span>
          </NavLink>
          <NavLink to="/spontaneous" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.bolt}</span>
            <span className="nav-text">Spontaneous Open</span>
          </NavLink>
          <NavLink to="/members" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.users}</span>
            <span className="nav-text">Members</span>
          </NavLink>
        </div>
      )}

      {isAdmin && (
        <div className="nav-section">
          <p className="nav-label">Admin</p>
          <NavLink to="/admin/users" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.users}</span>
            <span className="nav-text">Users</span>
          </NavLink>
          <NavLink to="/admin/shiftplan" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.shiftplan}</span>
            <span className="nav-text">Shiftplan</span>
          </NavLink>
          <NavLink to="/admin/attendance" onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="nav-icon">{Icon.attendance}</span>
            <span className="nav-text">Attendance</span>
          </NavLink>
        </div>
      )}
    </>
  );

  // ── Sidebar / drawer footer ─────────────────────────────────────────────────
  const sidebarFooter = (onLogout?: () => void) => (
    <div className="sidebar-bottom">
      <button className="theme-toggle-row" onClick={toggleTheme} aria-label="Toggle theme">
        <span className="nav-icon nav-icon-sm">{theme === 'dark' ? Icon.sun : Icon.moon}</span>
        <span className="theme-toggle-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>

      {/* User card / guest CTA */}
      {isGuest ? (
        <div className="sidebar-guest-card">
          <p className="sidebar-guest-text">You're browsing as a guest</p>
          <button className="btn btn-primary sidebar-signin-btn" onClick={() => navigate('/login')}>
            Sign in
          </button>
        </div>
      ) : (
        <div className="sidebar-user-card">
          {/* Clickable avatar → opens picker */}
          <button
            className="sidebar-avatar sidebar-avatar-btn"
            onClick={() => setShowAvatarPicker(true)}
            title="Change avatar"
            aria-label="Change avatar"
          >
            <AvatarDisplay avatarId={currentUser!.avatarId} initials={currentUser!.avatarInitials} size={34} />
          </button>
          <div className="sidebar-user-info">
            <p className="sidebar-name">{currentUser!.name}</p>
            <p className={`sidebar-role-tag role-${currentUser!.role}`}>{currentUser!.role}</p>
          </div>
          <button className="btn-icon-sm" onClick={onLogout ?? handleLogout} title="Sign out">
            <span style={{ width: 14, height: 14, display: 'flex' }}>{Icon.logout}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      {/* Avatar picker modal */}
      {showAvatarPicker && currentUser && (
        <AvatarPicker
          current={currentUser.avatarId}
          onSelect={id => updateCurrentUser({ avatarId: id })}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

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
          {/* Notification bell — hidden for guests */}
          {!isGuest && (
            <NavLink to="/notifications" className="notif-btn" aria-label="Notifications">
              {Icon.bell}
              {unread > 0 && <span className="notif-badge">{unread}</span>}
            </NavLink>
          )}

          {/* Avatar / sign-in CTA in topbar */}
          {isGuest ? (
            <button className="btn btn-primary topbar-signin-btn" onClick={() => navigate('/login')}>
              Sign in
            </button>
          ) : (
            <button
              className="topbar-avatar-wrap topbar-avatar-btn"
              onClick={() => setShowAvatarPicker(true)}
              aria-label="Change avatar"
              title="Change avatar"
            >
              <div className="topbar-avatar">
                <AvatarDisplay avatarId={currentUser!.avatarId} initials={currentUser!.avatarInitials} size={30} />
              </div>
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar">
          <div className="sidebar-scroll">{navContent()}</div>
          {sidebarFooter()}
        </nav>

        <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer}>
          <nav className={`drawer ${drawerOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="topbar-logo">
                <span className="topbar-logo-icon">🏋️</span>
                <span className="topbar-logo-text">StuSta Gym</span>
              </span>
              <button className="btn-icon-sm" onClick={closeDrawer} aria-label="Close">✕</button>
            </div>
            <div className="sidebar-scroll">{navContent(closeDrawer)}</div>
            {sidebarFooter(drawerLogout)}
          </nav>
        </div>

        <main className="main-content">
          <div className="main-content-inner page-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
