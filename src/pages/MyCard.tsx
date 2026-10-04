import { useAuth } from '../contexts/AuthContext';

export default function MyCard() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Member Card</h2>
      </div>

      <div className="member-card-wrapper">
        <div className="member-card member-card-blurred">
          <div className="card-header-row">
            <div className="card-logo">🏋️ StuSta Gym</div>
            <span className={`role-badge role-${currentUser.role}`}>{currentUser.role}</span>
          </div>

          <div className="card-avatar-row">
            <div className="card-avatar">{currentUser.avatarInitials}</div>
            <div className="card-name-block">
              <h3 className="card-name">{currentUser.name}</h3>
              <p className="card-email">{currentUser.email}</p>
            </div>
          </div>

          <div className="card-divider" />

          <div className="card-fields">
            <div className="card-field">
              <span className="field-label">House / Room</span>
              <span className="field-value">House — · Room —</span>
            </div>
            <div className="card-field">
              <span className="field-label">Date of Birth</span>
              <span className="field-value">——.——.————</span>
            </div>
            <div className="card-field">
              <span className="field-label">Member Since</span>
              <span className="field-value">——.——.————</span>
            </div>
            <div className="card-field">
              <span className="field-label">Valid Until</span>
              <span className="field-value">——.——.————</span>
            </div>
          </div>

          <div className="card-footer">
            <span className="membership-status status-active">✓ Active</span>
            <span className="card-id">ID: ————————</span>
          </div>
        </div>

        <div className="coming-soon-overlay">
          <div className="coming-soon-badge">Coming Soon</div>
          <p className="coming-soon-text">
            Digital member cards are being prepared and will be available shortly.
          </p>
        </div>
      </div>
    </div>
  );
}
