import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { AvatarDisplay } from '../../components/AvatarPicker';
import type { User, Role } from '../../types';

const ROLE_ORDER: Role[] = ['member', 'supervisor', 'admin'];
const ROLE_LABELS: Record<Role, string> = { member: 'Member', supervisor: 'Supervisor', admin: 'Admin' };

export default function UserManagement() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState<Role | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const filtered = state.users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const promote = (user: User) => {
    const idx = ROLE_ORDER.indexOf(user.role);
    if (idx >= ROLE_ORDER.length - 1) return;
    dispatch({ type: 'UPDATE_USER', payload: { ...user, role: ROLE_ORDER[idx + 1] } });
  };

  const demote = (user: User) => {
    const idx = ROLE_ORDER.indexOf(user.role);
    if (idx <= 0) return;
    dispatch({ type: 'UPDATE_USER', payload: { ...user, role: ROLE_ORDER[idx - 1] } });
  };

  const deleteUser = (user: User) => {
    dispatch({ type: 'DELETE_USER', payload: user.id });
    setConfirmDelete(null);
  };

  const counts = {
    all:        state.users.length,
    member:     state.users.filter(u => u.role === 'member').length,
    supervisor: state.users.filter(u => u.role === 'supervisor').length,
    admin:      state.users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p className="page-subtitle">{state.users.length} registered members</p>
        </div>
      </div>

      {/* Role filter chips */}
      <div className="admin-stats-row">
        {(['all', 'member', 'supervisor', 'admin'] as const).map(r => (
          <button
            key={r}
            className={`admin-stat-chip ${filterRole === r ? 'active' : ''}`}
            onClick={() => setFilterRole(r)}
          >
            <span className="stat-count">{counts[r]}</span>
            <span className="stat-label">{r === 'all' ? 'All' : ROLE_LABELS[r as Role] + 's'}</span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="admin-search-row">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="admin-search-input"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      {/* User cards */}
      <div className="admin-user-list">
        {filtered.length === 0 && <div className="empty-state">No users found</div>}
        {filtered.map(user => {
          const isSelf   = user.id === currentUser?.id;
          const roleIdx  = ROLE_ORDER.indexOf(user.role);

          return (
            <div key={user.id} className="admin-user-card">
              <div className="admin-user-avatar">
                <AvatarDisplay avatarId={user.avatarId} initials={user.avatarInitials} size={44} />
              </div>

              <div className="admin-user-info">
                <div className="admin-user-name">
                  {user.name}
                  {isSelf && <span className="self-badge">you</span>}
                </div>
                <div className="admin-user-email">{user.email}</div>
              </div>

              <span className={`role-badge role-${user.role}`}>{ROLE_LABELS[user.role]}</span>

              <div className="admin-user-actions">
                <button
                  className="admin-action-btn promote"
                  disabled={isSelf || roleIdx >= ROLE_ORDER.length - 1}
                  onClick={() => promote(user)}
                  title={`Promote to ${ROLE_ORDER[roleIdx + 1] ?? ''}`}
                >↑ Promote</button>
                <button
                  className="admin-action-btn demote"
                  disabled={isSelf || roleIdx <= 0}
                  onClick={() => demote(user)}
                  title={`Demote to ${ROLE_ORDER[roleIdx - 1] ?? ''}`}
                >↓ Demote</button>
                <button
                  className="admin-action-btn delete"
                  disabled={isSelf}
                  onClick={() => setConfirmDelete(user)}
                >🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete user?</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>
              Permanently delete <strong>{confirmDelete.name}</strong> ({confirmDelete.email})?
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => deleteUser(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
