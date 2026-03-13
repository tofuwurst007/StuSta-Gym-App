import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

export default function Login() {
  const { state } = useApp();
  const { login } = useAuth();

  const handleLogin = (user: User) => {
    login(user);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🏋️</div>
          <h1>StuSta Gym</h1>
          <p className="login-subtitle">Studentenstadt München</p>
        </div>

        <div className="login-section">
          <p className="login-hint">Sign in with your StuSta Google account</p>

          <div className="demo-accounts">
            <p className="demo-label">Demo – select your account:</p>
            {state.users.map(user => (
              <button
                key={user.id}
                className="account-btn"
                onClick={() => handleLogin(user)}
              >
                <div className="account-avatar">{user.avatarInitials}</div>
                <div className="account-info">
                  <span className="account-name">{user.name}</span>
                  <span className="account-email">{user.email}</span>
                </div>
                <span className={`role-badge role-${user.role}`}>{user.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
