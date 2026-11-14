import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { DAY_NAMES, getMorningShift } from '../../utils/openingHours';
import type { ShiftBlock, Notification } from '../../types';
import ExcelExportButton from '../../components/ExcelExportButton';
import { getNextWeekStart } from '../../utils/week';

export default function ShiftplanEditor() {
  const { state, dispatch } = useApp();
  const [selectedDay, setSelectedDay] = useState(0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ startTime: '', endTime: '' });
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ startTime: '', endTime: '' });
  const [editError, setEditError] = useState('');

  const dayShifts = state.shiftBlocks.filter(s => s.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const validate = (f: { startTime: string; endTime: string }, ignoreId?: string): string => {
    if (!f.startTime || !f.endTime) return 'Both times are required.';
    if (f.startTime >= f.endTime) return 'End must be after start.';
    const overlaps = state.shiftBlocks.some(s =>
      s.id !== ignoreId && s.dayOfWeek === selectedDay &&
      !(f.endTime <= s.startTime || f.startTime >= s.endTime)
    );
    return overlaps ? 'This time range overlaps an existing block.' : '';
  };

  const startEdit = (s: ShiftBlock) => {
    setEditingId(s.id);
    setEditForm({ startTime: s.startTime, endTime: s.endTime });
    setEditError('');
  };

  const saveEdit = async (s: ShiftBlock) => {
    const err = validate(editForm, s.id);
    if (err) { setEditError(err); return; }
    const res = await dispatch({ type: 'UPDATE_SHIFT', payload: { ...s, ...editForm } });
    if (res.ok) setEditingId(null);
  };

  const addShift = () => {
    const err = validate(form);
    setError(err);
    if (err) return;

    const shift: ShiftBlock = {
      id: `s-${Date.now()}`,
      dayOfWeek: selectedDay,
      startTime: form.startTime,
      endTime: form.endTime,
      claimed: false,
    };
    dispatch({ type: 'ADD_SHIFT', payload: shift });
    setForm({ startTime: '', endTime: '' });
    setAdding(false);
  };

  const deleteShift = (id: string) => {
    dispatch({ type: 'DELETE_SHIFT', payload: id });
  };

  const unassign = async (id: string) => {
    const shift = state.shiftBlocks.find(s => s.id === id);
    const res = await dispatch({ type: 'UNCLAIM_SHIFT', payload: id });
    if (!res.ok || !shift) return; // the error banner shows why

    // Same notice as when a supervisor cancels the shift themselves
    const notif: Notification = {
      id: `n-${Date.now()}`,
      userId: 'all',
      // No supervisor name: members must not learn who covered which shift
      message: `The shift ${DAY_NAMES[shift.dayOfWeek]} ${shift.startTime}–${shift.endTime} ` +
        'is no longer covered. Opening hours may have changed.',
      type: 'alert',
      read: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Shiftplan Editor</h2>
        <ExcelExportButton weekStart={getNextWeekStart()} label="⬇ Excel (next week)" />
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
          <div className="shift-actions">
            <button
              className="btn-ghost-sm"
              title={`${getMorningShift(selectedDay).startTime}–${getMorningShift(selectedDay).endTime}`}
              onClick={() => { setForm(getMorningShift(selectedDay)); setAdding(true); setError(''); }}
            >
              🌅 Morning shift
            </button>
            <button className="btn-primary-sm" onClick={() => setAdding(!adding)}>+ Add Block</button>
          </div>
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
          dayShifts.map(s => editingId === s.id ? (
            <div key={s.id} className="form-card">
              <div className="form-row-2col">
                <div className="form-row">
                  <label className="form-label">Start</label>
                  <input type="time" className="form-input" value={editForm.startTime}
                    onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label className="form-label">End</label>
                  <input type="time" className="form-input" value={editForm.endTime}
                    onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              {editError && <p className="form-error">{editError}</p>}
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                <button className="btn-primary" onClick={() => saveEdit(s)}>Save</button>
              </div>
            </div>
          ) : (
            <div key={s.id} className={`shift-row ${s.claimed ? 'shift-claimed' : 'shift-unclaimed'}`}>
              <span className="shift-time">{s.startTime} – {s.endTime}</span>
              {s.claimed ? (
                <span className="shift-supervisor">{s.supervisorName || 'Claimed'}</span>
              ) : (
                <span className="shift-unclaimed-label">Unclaimed</span>
              )}
              <div className="shift-actions">
                {s.claimed && (
                  <button className="btn-ghost-sm" onClick={() => unassign(s.id)}>Unassign</button>
                )}
                <button className="btn-ghost-sm" onClick={() => startEdit(s)}>Edit</button>
                <button className="btn-danger-sm" onClick={() => deleteShift(s.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
