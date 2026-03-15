import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { AvatarDisplay } from '../../components/AvatarPicker';

export default function EditMemberCard() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();

  const user = state.users.find(u => u.id === userId);

  const [form, setForm] = useState({
    house:           user?.house           ?? '',
    room:            user?.room            ?? '',
    dateOfBirth:     user?.dateOfBirth     ?? '',
    membershipStart: user?.membershipStart ?? '',
    membershipEnd:   user?.membershipEnd   ?? '',
  });
  const [saved, setSaved] = useState(false);

  if (!user) {
    return (
      <div className="page">
        <p className="empty-state">User not found.</p>
      </div>
    );
  }

  const isSelf = user.id === currentUser?.id;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    dispatch({ type: 'UPDATE_USER', payload: { ...user, ...form } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        <h2>Edit Member Card</h2>
      </div>

      {/* Preview */}
      <div className="edit-card-preview">
        <AvatarDisplay avatarId={user.avatarId} initials={user.avatarInitials} size={52} />
        <div className="edit-card-preview-info">
          <div className="edit-card-preview-name">{user.name}</div>
          <div className="edit-card-preview-email">{user.email}</div>
        </div>
        <span className={`role-badge role-${user.role}`}>{user.role}</span>
      </div>

      {isSelf ? (
        <p className="empty-state">You cannot edit your own card.</p>
      ) : (
        <div className="edit-card-form">
          <div className="edit-card-row">
            <div className="form-row">
              <label className="form-label">House</label>
              <input className="form-input" value={form.house} onChange={set('house')} placeholder="e.g. 4" />
            </div>
            <div className="form-row">
              <label className="form-label">Room</label>
              <input className="form-input" value={form.room} onChange={set('room')} placeholder="e.g. 412" />
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">Date of Birth</label>
            <input type="date" className="form-input" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          </div>

          <div className="edit-card-row">
            <div className="form-row">
              <label className="form-label">Membership Start</label>
              <input type="date" className="form-input" value={form.membershipStart} onChange={set('membershipStart')} />
            </div>
            <div className="form-row">
              <label className="form-label">Valid Until</label>
              <input type="date" className="form-input" value={form.membershipEnd} onChange={set('membershipEnd')} />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          </div>

          {saved && (
            <p style={{ color: 'var(--green)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
              ✓ Changes saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
