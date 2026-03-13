import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

export default function Notifications() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const myNotifications = state.notifications.filter(
    n => n.userId === 'all' || n.userId === currentUser.id
  );

  const unread = myNotifications.filter(n => !n.read).length;

  const markAllRead = () => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: 'all' });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Notifications</h2>
        {unread > 0 && (
          <button className="btn-ghost" onClick={markAllRead}>Mark all read</button>
        )}
      </div>

      {myNotifications.length === 0 ? (
        <div className="empty-state-center">
          <p>🔔</p>
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="notif-list">
          {myNotifications.map(n => (
            <div
              key={n.id}
              className={`notif-item notif-${n.type} ${n.read ? 'notif-read' : ''}`}
              onClick={() => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id })}
            >
              <div className="notif-icon">
                {n.type === 'info' ? 'ℹ️' : n.type === 'warning' ? '⚠️' : '🚨'}
              </div>
              <div className="notif-body">
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{formatTime(n.createdAt)}</p>
              </div>
              {!n.read && <div className="notif-unread-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
