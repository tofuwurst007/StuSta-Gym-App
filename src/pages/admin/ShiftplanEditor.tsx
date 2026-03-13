import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { DAY_NAMES } from '../../utils/openingHours';
import type { ShiftBlock } from '../../types';

export default function ShiftplanEditor() {
  const { state, dispatch } = useApp();
  const [selectedDay, setSelectedDay] = useState(0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ startTime: '', endTime: '' });
  const [error, setError] = useState('');

  const dayShifts = state.shiftBlocks.filter(s => s.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const addShift = () => {
    setError('');
    if (!form.startTime || !form.endTime) { setError('Both times are required.'); return; }
    if (form.startTime >= form.endTime) { setError('End must be after start.'); return; }

    const overlaps = state.shiftBlocks.some(s =>
      s.dayOfWeek === selectedDay &&
      !(form.endTime <= s.startTime || form.startTime >= s.endTime)
    );
    if (overlaps) { setError('This time range overlaps an existing block.'); return; }

    const shift: ShiftBlock = {
      id: `s-${Date.now()}`,
      dayOfWeek: selectedDay,
      startTime: form.startTime,
      endTime: form.endTime,
    };
    dispatch({ type: 'ADD_SHIFT', payload: shift });
    setForm({ startTime: '', endTime: '' });
    setAdding(false);
  };

  const deleteShift = (id: string) => {
    dispatch({ type: 'DELETE_SHIFT', payload: id });
  };

  const unassign = (id: string) => {
    dispatch({ type: 'UNCLAIM_SHIFT', payload: id });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Shiftplan Editor</h2>
      </div>

      {/* Day tabs */}
      <div className="day-tabs">
        {DAY_NAMES.map((day, i) => (
          <button
            key={i}
            className={`day-tab ${selectedDay === i ? 'day-tab-active' : ''}`}
            onClick={() => setSelectedDay(i)}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      <section className="section">
        <div className="section-header">
          <h3 className="section-title">{DAY_NAMES[selectedDay]} Shifts</h3>
          <button className="btn-primary-sm" onClick={() => setAdding(!adding)}>+ Add Block</button>
        </div>

        {adding && (
          <div className="form-card">
            <div className="form-row-2col">
              <div className="form-row">
                <label className="form-label">Start</label>
                <input type="time" className="form-input" value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">End</label>
                <input type="time" className="form-input" value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button className="btn-ghost" onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
              <button className="btn-primary" onClick={addShift}>Add Block</button>
            </div>
          </div>
        )}

        {dayShifts.length === 0 ? (
          <p className="empty-state">No shift blocks defined for {DAY_NAMES[selectedDay]}.</p>
        ) : (
          dayShifts.map(s => (
            <div key={s.id} className={`shift-row ${s.supervisorId ? 'shift-claimed' : 'shift-unclaimed'}`}>
              <span className="shift-time">{s.startTime} – {s.endTime}</span>
              {s.supervisorId ? (
                <span className="shift-supervisor">{s.supervisorName}</span>
              ) : (
                <span className="shift-unclaimed-label">Unclaimed</span>
              )}
              <div className="shift-actions">
                {s.supervisorId && (
                  <button className="btn-ghost-sm" onClick={() => unassign(s.id)}>Unassign</button>
                )}
                <button className="btn-danger-sm" onClick={() => deleteShift(s.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
