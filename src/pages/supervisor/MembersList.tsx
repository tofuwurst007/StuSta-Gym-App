import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { AvatarDisplay } from '../../components/AvatarPicker';

export default function MembersList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const members = state.users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Members</h2>
          <p className="page-subtitle">{state.users.length} registered members</p>
        </div>
      </div>

      {/* Search */}
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

      <div className="members-list">
        {members.length === 0 && <div className="empty-state">No members found</div>}
        {members.map(user => {
          const isSelf = user.id === currentUser?.id;
          return (
            <div key={user.id} className="member-list-card">
              <AvatarDisplay avatarId={user.avatarId} initials={user.avatarInitials} size={40} />
              <div className="member-list-info">
                <div className="member-list-name">
                  {user.name}
                  {isSelf && <span className="self-badge" style={{ marginLeft: 6 }}>you</span>}
                </div>
                <div className="member-list-email">{user.email}</div>
              </div>
              <span className={`role-badge role-${user.role}`}>{user.role}</span>
              {!isSelf && (
                <button
                  className="admin-action-btn edit"
                  onClick={() => navigate(`/members/${user.id}`)}
                  title="Edit member card"
                >✎ Edit</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
