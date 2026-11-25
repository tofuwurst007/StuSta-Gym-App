import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { DAY_NAMES, getMorningShift } from '../../utils/openingHours';
import type { ShiftBlock } from '../../types';
import ExcelExportButton from '../../components/ExcelExportButton';
import PlanGrid from '../../components/PlanGrid';
import WeekSwitcher from '../../components/WeekSwitcher';
import { PERIOD_DAYS, addWeeks, formatWeekRange, getNextWeekStart, getWeekStart } from '../../utils/week';
import { PLAN_WEEKS_AHEAD } from './AssignShifts';

export default function ShiftplanEditor() {
  const { state, dispatch } = useApp();
  const [weekStart, setWeekStart] = useState(getNextWeekStart());
  const [selectedDay, setSelectedDay] = useState(PERIOD_DAYS[0]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ startTime: '', endTime: '' });
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ startTime: '', endTime: '' });
  const [editError, setEditError] = useState('');

  const dayShifts = state.shiftBlocks
    .filter(s => s.dayOfWeek === selectedDay)
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
    if (!window.confirm('Delete this shift block? It disappears from every week, including all assignments of it.')) return;
    dispatch({ type: 'DELETE_SHIFT', payload: id });
  };

  const currentWeek = getWeekStart();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Shiftplan</h2>
          <p className="page-subtitle">Weeks run Friday–Thursday. Pick a name in a cell to assign that shift in the selected week.</p>
        </div>
        <ExcelExportButton weekStart={weekStart} />
      </div>

      <WeekSwitcher weekStart={weekStart} onChange={setWeekStart}
        minWeek={addWeeks(currentWeek, -1)} maxWeek={addWeeks(currentWeek, PLAN_WEEKS_AHEAD)} />

      <section className="section">
        <h3 className="section-title">Plan {formatWeekRange(weekStart)}</h3>
        <PlanGrid weekStart={weekStart} />
      </section>

      <section className="section">
        <h3 className="section-title">Shift blocks (same every week)</h3>
        {/* Day tabs */}
        <div className="day-tabs">
          {PERIOD_DAYS.map(i => (
            <button
              key={i}
              className={`day-tab ${selectedDay === i ? 'day-tab-active' : ''}`}
              onClick={() => setSelectedDay(i)}
            >
              {DAY_NAMES[i].slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="section-header">
          <h3 className="section-title">{DAY_NAMES[selectedDay]}</h3>
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
            <div key={s.id} className="shift-row">
              <span className="shift-time">{s.startTime} – {s.endTime}</span>
              <div className="shift-actions">
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
