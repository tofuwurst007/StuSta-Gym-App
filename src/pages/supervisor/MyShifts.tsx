import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { DAY_NAMES, nowHHMM } from '../../utils/openingHours';
import { localISODate } from '../../utils/date';
import { blocksForWeek } from '../../utils/assignments';
import {
  PERIOD_DAYS, addWeeks, availabilityDeadline, comparePeriodOrder, dateOfWeekDay, defaultAvailabilityWeek, formatShortDate,
  formatWeekRange, getWeekStart,
} from '../../utils/week';
import WeekSwitcher from '../../components/WeekSwitcher';
import type { Notification, ShiftBlock } from '../../types';

export default function MyShifts() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const [weekStart, setWeekStart] = useState(getWeekStart());
  if (!currentUser) return null;

  const availWeek = defaultAvailabilityWeek();
  const hasAvailability = state.availabilities.some(
    a => a.supervisorId === currentUser.id && a.weekStart === availWeek);
  const deadline = availabilityDeadline(availWeek);

  const blocks = blocksForWeek(state.shiftBlocks, state.assignments, weekStart)
    .sort(comparePeriodOrder);
  const myShifts = blocks.filter(s => s.supervisorId === currentUser.id);
  const availableShifts = blocks.filter(s => !s.claimed);

  const today = localISODate();
  const dateOf = (s: ShiftBlock) => dateOfWeekDay(weekStart, s.dayOfWeek);
  const isPast = (s: ShiftBlock) => {
    const d = localISODate(dateOf(s));
    return d < today || (d === today && s.endTime <= nowHHMM());
  };

  const claim = (shiftId: string) => {
    dispatch({
      type: 'SET_ASSIGNMENT',
      payload: { shiftId, weekStart, supervisorId: currentUser.id, supervisorName: currentUser.name },
    });
  };

  const unclaim = async (shift: ShiftBlock) => {
    const res = await dispatch({ type: 'SET_ASSIGNMENT', payload: { shiftId: shift.id, weekStart, supervisorId: null } });
    if (!res.ok) return; // the error banner shows why

    // Notify everyone — without the supervisor's name: members must not learn who covers which shift
    const when = `${DAY_NAMES[shift.dayOfWeek]} ${formatShortDate(dateOf(shift))} ${shift.startTime}–${shift.endTime}`;
    const notif: Notification = {
      id: `n-${Date.now()}`,
      userId: 'all',
      message: `A shift was cancelled (${when}). Opening hours may have changed.`,
      type: 'alert',
      read: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
  };

  const byDay = (shifts: ShiftBlock[]) =>
    PERIOD_DAYS.map(dow => ({ day: DAY_NAMES[dow], dow, shifts: shifts.filter(s => s.dayOfWeek === dow) }))
      .filter(g => g.shifts.length > 0);

  const currentWeek = getWeekStart();

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Shifts</h2>
      </div>

      {currentUser.role === 'supervisor' && !hasAvailability && (
        <Link to="/availability" className="banner banner-warn banner-link">
          <span className="banner-icon">📅</span>
          <span>
            Enter your availability for {formatWeekRange(availWeek)}
            {deadline > new Date() ? ` by Wed ${formatShortDate(deadline)}` : ''} →
          </span>
        </Link>
      )}

      <WeekSwitcher weekStart={weekStart} onChange={setWeekStart} minWeek={currentWeek} maxWeek={addWeeks(currentWeek, 4)} />

      <section className="section">
        <h3 className="section-title">My Shifts ({myShifts.length})</h3>
        {myShifts.length === 0 ? (
          <p className="empty-state">You have no shifts this week.</p>
        ) : byDay(myShifts).map(g => (
          <div key={g.dow} className="shift-day-group">
            <p className="shift-day-label">{g.day} · {formatShortDate(dateOfWeekDay(weekStart, g.dow))}</p>
            {g.shifts.map(s => (
              <div key={s.id} className="shift-row shift-mine">
                <span className="shift-time">{s.startTime} – {s.endTime}</span>
                {isPast(s)
                  ? <span className="shift-past-label">done</span>
                  : <button className="btn-danger-sm" onClick={() => unclaim(s)}>Cancel</button>}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="section">
        <h3 className="section-title">Open Shifts ({availableShifts.filter(s => !isPast(s)).length})</h3>
        {availableShifts.filter(s => !isPast(s)).length === 0 ? (
          <p className="empty-state">All shifts this week are covered.</p>
        ) : byDay(availableShifts.filter(s => !isPast(s))).map(g => (
          <div key={g.dow} className="shift-day-group">
            <p className="shift-day-label">{g.day} · {formatShortDate(dateOfWeekDay(weekStart, g.dow))}</p>
            {g.shifts.map(s => (
              <div key={s.id} className="shift-row shift-available">
                <span className="shift-time">{s.startTime} – {s.endTime}</span>
                <button className="btn-primary-sm" onClick={() => claim(s.id)}>Claim</button>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
