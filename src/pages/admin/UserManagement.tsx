import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import type { User, Role } from '../../types';

export default function UserManagement() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'member' });

  const saveEdit = () => {
    if (!editing) return;
    dispatch({ type: 'UPDATE_USER', payload: editing });
    setEditing(null);
  };

  const deleteUser = (id: string) => {
    if (id === currentUser?.id) return; // can't delete self
    dispatch({ type: 'DELETE_USER', payload: id });
  };

  const promote = (user: User) => {
    const nextRole: Record<Role, Role> = { member: 'supervisor', supervisor: 'admin', admin: 'admin' };
    dispatch({ type: 'UPDATE_USER', payload: { ...user, role: nextRole[user.role] } });
  };

  const demote = (user: User) => {
    const prevRole: Record<Role, Role> = { member: 'member', supervisor: 'member', admin: 'supervisor' };
    dispatch({ type: 'UPDATE_USER', payload: { ...user, role: prevRole[user.role] } });
  };

  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    const u: User = {
      id: `u-${Date.now()}`,
      name: newUser.name!,
      email: newUser.email!,
      role: newUser.role as Role ?? 'member',
      house: newUser.house ?? '',
      room: newUser.room ?? '',
      dateOfBirth: newUser.dateOfBirth ?? '',
      membershipStart: newUser.membershipStart ?? new Date().toISOString().split('T')[0],
      membershipEnd: newUser.membershipEnd ?? '',
      createdAt: new Date().toISOString(),
      avatarInitials: newUser.name!.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2),
    };
    dispatch({ type: 'ADD_USER', payload: u });
    setAdding(false);
    setNewUser({ role: 'member' });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>User Management</h2>
        <button className="btn-primary-sm" onClick={() => setAdding(true)}>+ Add User</button>
      </div>

      {/* Add user modal */}
      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Add New User</h3>
            {(['name', 'email', 'house', 'room', 'dateOfBirth', 'membershipStart', 'membershipEnd'] as const).map(field => (
              <div key={field} className="form-row">
                <label className="form-label">{field}</label>
                <input
                  type={field.includes('date') || field.includes('Date') || field.includes('Start') || field.includes('End') ? 'date' : 'text'}
                  className="form-input"
                  value={(newUser as Record<string, string>)[field] ?? ''}
                  onChange={e => setNewUser(u => ({ ...u, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="form-row">
              <label className="form-label">Role</label>
              <select className="form-input" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as Role }))}>
                <option value="member">member</option>
                <option value="supervisor">supervisor</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn-primary" onClick={addUser}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit User</h3>
            {(['name', 'email', 'house', 'room', 'dateOfBirth', 'membershipStart', 'membershipEnd'] as const).map(field => (
              <div key={field} className="form-row">
                <label className="form-label">{field}</label>
                <input
                  type={field.includes('date') || field.includes('Date') || field.includes('Start') || field.includes('End') ? 'date' : 'text'}
                  className="form-input"
                  value={(editing as unknown as Record<string, string>)[field] ?? ''}
                  onChange={e => setEditing(u => u ? { ...u, [field]: e.target.value } : u)}
                />
              </div>
            ))}
            <div className="form-row">
              <label className="form-label">Role</label>
              <select className="form-input" value={editing.role} onChange={e => setEditing(u => u ? { ...u, role: e.target.value as Role } : u)}>
                <option value="member">member</option>
                <option value="supervisor">supervisor</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="user-list">
        {state.users.map(user => (
          <div key={user.id} className="user-row">
            <div className="user-avatar-sm">{user.avatarInitials}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
              <span className="user-detail">House {user.house} · Room {user.room}</span>
            </div>
            <span className={`role-badge role-${user.role}`}>{user.role}</span>
            <div className="user-actions">
              <button className="btn-ghost-sm" onClick={() => setEditing(user)}>Edit</button>
              <button className="btn-ghost-sm" onClick={() => promote(user)} disabled={user.role === 'admin'}>↑</button>
              <button className="btn-ghost-sm" onClick={() => demote(user)} disabled={user.role === 'member'}>↓</button>
              <button
                className="btn-danger-sm"
                onClick={() => deleteUser(user.id)}
                disabled={user.id === currentUser?.id}
              >Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
