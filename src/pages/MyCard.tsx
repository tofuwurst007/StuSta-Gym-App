import { useAuth } from '../contexts/AuthContext';

export default function MyCard() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const isActive = new Date(currentUser.membershipEnd) >= new Date();

  return (
    <div className="page">
      <div className="page-header">
        <h2>Member Card</h2>
      </div>

      <div className="member-card">
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
            <span className="field-value">House {currentUser.house} · Room {currentUser.room}</span>
          </div>
          <div className="card-field">
            <span className="field-label">Date of Birth</span>
            <span className="field-value">{formatDate(currentUser.dateOfBirth)}</span>
          </div>
          <div className="card-field">
            <span className="field-label">Member Since</span>
            <span className="field-value">{formatDate(currentUser.membershipStart)}</span>
          </div>
          <div className="card-field">
            <span className="field-label">Valid Until</span>
            <span className={`field-value ${!isActive ? 'text-danger' : ''}`}>
              {formatDate(currentUser.membershipEnd)}
              {!isActive && ' · Expired'}
            </span>
          </div>
        </div>

        <div className="card-footer">
          <span className={`membership-status ${isActive ? 'status-active' : 'status-expired'}`}>
            {isActive ? '✓ Active' : '✗ Expired'}
          </span>
          <span className="card-id">ID: {currentUser.id.toUpperCase()}</span>
        </div>
      </div>

      <p className="card-note">This card is for identification at the gym entrance only.</p>
    </div>
  );
}
