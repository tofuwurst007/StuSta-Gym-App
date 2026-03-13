import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import type { AttendanceLog } from '../../types';

export default function AttendanceLogs() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const checkIn = () => {
    const log: AttendanceLog = {
      id: `a-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      checkIn: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_ATTENDANCE', payload: log });
  };

  const checkOut = (id: string) => {
    dispatch({ type: 'CHECKOUT_ATTENDANCE', payload: { id, checkOut: new Date().toISOString() } });
  };

  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const duration = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 'Active';
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
    return `${diff} min`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Attendance Logs</h2>
        <button className="btn-primary-sm" onClick={checkIn}>Check In</button>
      </div>

      {state.attendanceLogs.length === 0 ? (
        <p className="empty-state">No attendance records yet.</p>
      ) : (
        <div className="log-list">
          {state.attendanceLogs.map(log => (
            <div key={log.id} className={`log-row ${!log.checkOut ? 'log-active' : ''}`}>
              <div className="log-avatar">{log.userName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}</div>
              <div className="log-info">
                <span className="log-name">{log.userName}</span>
                <span className="log-time">In: {formatDt(log.checkIn)}</span>
                {log.checkOut && <span className="log-time">Out: {formatDt(log.checkOut)}</span>}
              </div>
              <span className={`log-duration ${!log.checkOut ? 'log-active-label' : ''}`}>
                {duration(log.checkIn, log.checkOut)}
              </span>
              {!log.checkOut && (
                <button className="btn-ghost-sm" onClick={() => checkOut(log.id)}>Check Out</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
