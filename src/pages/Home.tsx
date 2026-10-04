import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { DAY_NAMES, getOpeningHoursForDay, isGymOpenNow, getTodayOpeningHours, nowHHMM } from '../utils/openingHours';
import { localISODate } from '../utils/date';

export default function Home() {
  const { state, loading, loadError } = useApp();

  // Re-render every 30 s so "Open/Closed" and "Opens today at" follow the clock
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const gymOpen = isGymOpenNow(state.shiftBlocks, state.spontaneousOpenings);
  const todaySlots = getTodayOpeningHours(state.shiftBlocks, state.spontaneousOpenings);
  const todayDow = (new Date().getDay() + 6) % 7;
  const today = localISODate();
  const nextSlot = todaySlots.find(s => s.start > nowHHMM());

  return (
    <div className="page">
      <div className="page-header">
        <h2>Opening Hours</h2>
      </div>

      {/* Live status */}
      <div className={`status-card ${gymOpen ? 'status-open' : 'status-closed'}`}>
        <div className="status-dot" />
        <div>
          <p className="status-title">
            {loading ? 'Loading…' : loadError ? 'Schedule unavailable' : gymOpen ? 'Gym is Open' : 'Gym is Closed'}
          </p>
          <p className="status-sub">
            {loading || loadError
              ? loadError ? "Couldn't load the opening hours. Please try again later." : ' '
              : gymOpen
              ? `Today's remaining slots below`
              : nextSlot
              ? `Opens today at ${nextSlot.start}`
              : todaySlots.length > 0
              ? 'No more sessions today'
              : 'No scheduled openings today'}
          </p>
        </div>
      </div>

      {/* Without data the schedule would wrongly read "Closed" every day, so hide it */}
      {!loading && !loadError && (<>

      {/* Today */}
      <section className="section">
        <h3 className="section-title">Today · {DAY_NAMES[todayDow]}</h3>
        {todaySlots.length === 0 ? (
          <p className="empty-state">No supervised sessions today.</p>
        ) : (
          <div className="slot-list">
            {todaySlots.map((slot, i) => (
              <div key={i} className={`slot-item ${slot.source === 'spontaneous' ? 'slot-spontaneous' : ''}`}>
                <span className="slot-time">{slot.start} – {slot.end}</span>
                <span className="slot-supervisor">{slot.label}</span>
                {slot.source === 'spontaneous' && <span className="slot-tag">Spontaneous</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly schedule */}
      <section className="section">
        <h3 className="section-title">Weekly Schedule</h3>
        <div className="week-grid">
          {DAY_NAMES.map((day, dow) => {
            const slots = getOpeningHoursForDay(dow, state.shiftBlocks, state.spontaneousOpenings, dow === todayDow ? today : undefined);
            const isToday = dow === todayDow;
            return (
              <div key={dow} className={`day-card ${isToday ? 'day-today' : ''}`}>
                <p className="day-name">{day}</p>
                {slots.length === 0 ? (
                  <p className="day-closed">Closed</p>
                ) : (
                  slots.map((slot, i) => (
                    <p key={i} className="day-slot">{slot.start}–{slot.end}</p>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Spontaneous openings today */}
      {state.spontaneousOpenings.filter(sp => sp.date === today).length > 0 && (
        <section className="section">
          <h3 className="section-title">Extra Sessions Today</h3>
          {state.spontaneousOpenings.filter(sp => sp.date === today).map(sp => (
            <div key={sp.id} className="info-card">
              <p className="info-time">🕐 {sp.startTime} – {sp.endTime}</p>
              <p className="info-name">{sp.supervisorName}</p>
              {sp.note && <p className="info-note">{sp.note}</p>}
            </div>
          ))}
        </section>
      )}
      </>)}
    </div>
  );
}
