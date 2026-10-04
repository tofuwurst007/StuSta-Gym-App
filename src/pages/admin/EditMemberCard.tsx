import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { AvatarDisplay } from '../../components/AvatarPicker';

export default function EditMemberCard() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { state, dispatch, loading } = useApp();
  const { currentUser } = useAuth();

  const user = state.users.find(u => u.id === userId);

  const [form, setForm] = useState({ house: '', room: '', dateOfBirth: '', membershipStart: '', membershipEnd: '' });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Fill the form once the user is loaded (on a direct link/reload the list arrives after mount;
  // saving an empty form would wipe the stored values)
  useEffect(() => {
    if (!user) return;
    setForm({
      house:           user.house,
      room:            user.room,
      dateOfBirth:     user.dateOfBirth,
      membershipStart: user.membershipStart,
      membershipEnd:   user.membershipEnd,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="page">
        <p className="empty-state">{loading ? 'Loading…' : 'User not found.'}</p>
      </div>
    );
  }

  const isSelf = user.id === currentUser?.id;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaveError('');
    const res = await dispatch({ type: 'UPDATE_USER', payload: { ...user, ...form } });
    if (!res.ok) { setSaveError(res.error ?? 'Could not save the changes.'); return; }
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
      ) : user.role === 'admin' && currentUser?.role !== 'admin' ? (
        <p className="empty-state">Only admins can edit admin profiles.</p>
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
          {saveError && <p className="form-error" style={{ textAlign: 'center' }}>{saveError}</p>}
        </div>
      )}
    </div>
  );
}
