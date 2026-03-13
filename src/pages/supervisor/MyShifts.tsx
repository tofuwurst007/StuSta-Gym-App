import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DAY_NAMES } from '../../utils/openingHours';
import type { Notification } from '../../types';

export default function MyShifts() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const myShifts = state.shiftBlocks.filter(s => s.supervisorId === currentUser.id);
  const availableShifts = state.shiftBlocks.filter(s => !s.supervisorId);

  const claim = (shiftId: string) => {
    dispatch({
      type: 'CLAIM_SHIFT',
      payload: { shiftId, supervisorId: currentUser.id, supervisorName: currentUser.name },
    });
  };

  const unclaim = (shiftId: string) => {
    dispatch({ type: 'UNCLAIM_SHIFT', payload: shiftId });

    // Notify admins and members
    const notif: Notification = {
      id: `n-${Date.now()}`,
      userId: 'all',
      message: `⚠️ ${currentUser.name} cancelled a shift. Opening hours may have changed.`,
      type: 'alert',
      read: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
  };

  const grouped = (shifts: typeof state.shiftBlocks) =>
    DAY_NAMES.reduce((acc, _, dow) => {
      acc[dow] = shifts.filter(s => s.dayOfWeek === dow);
      return acc;
    }, {} as Record<number, typeof state.shiftBlocks>);

  const myGrouped = grouped(myShifts);
  const availGrouped = grouped(availableShifts);

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Shifts</h2>
      </div>

      {/* My claimed shifts */}
      <section className="section">
        <h3 className="section-title">My Claimed Shifts ({myShifts.length})</h3>
        {myShifts.length === 0 ? (
          <p className="empty-state">You haven't claimed any shifts yet.</p>
        ) : (
          DAY_NAMES.map((day, dow) =>
            myGrouped[dow]?.length > 0 ? (
              <div key={dow} className="shift-day-group">
                <p className="shift-day-label">{day}</p>
                {myGrouped[dow].map(s => (
                  <div key={s.id} className="shift-row shift-mine">
                    <span className="shift-time">{s.startTime} – {s.endTime}</span>
                    <button className="btn-danger-sm" onClick={() => unclaim(s.id)}>Cancel</button>
                  </div>
                ))}
              </div>
            ) : null
          )
        )}
      </section>

      {/* Available shifts */}
      <section className="section">
        <h3 className="section-title">Available Shifts ({availableShifts.length})</h3>
        {availableShifts.length === 0 ? (
          <p className="empty-state">All shifts are covered.</p>
        ) : (
          DAY_NAMES.map((day, dow) =>
            availGrouped[dow]?.length > 0 ? (
              <div key={dow} className="shift-day-group">
                <p className="shift-day-label">{day}</p>
                {availGrouped[dow].map(s => (
                  <div key={s.id} className="shift-row shift-available">
                    <span className="shift-time">{s.startTime} – {s.endTime}</span>
                    <button className="btn-primary-sm" onClick={() => claim(s.id)}>Claim</button>
                  </div>
                ))}
              </div>
            ) : null
          )
        )}
      </section>
    </div>
  );
}
