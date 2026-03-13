import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import type { SpontaneousOpening, Notification } from '../../types';

export default function SpontaneousOpen() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({ date: today, startTime: '', endTime: '', note: '' });
  const [error, setError] = useState('');

  const myOpenings = state.spontaneousOpenings.filter(sp => sp.supervisorId === currentUser.id);

  const submit = () => {
    setError('');
    if (!form.startTime || !form.endTime) { setError('Start and end time are required.'); return; }
    if (form.startTime >= form.endTime) { setError('End time must be after start time.'); return; }

    const opening: SpontaneousOpening = {
      id: `sp-${Date.now()}`,
      supervisorId: currentUser.id,
      supervisorName: currentUser.name,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      note: form.note || undefined,
    };
    dispatch({ type: 'ADD_SPONTANEOUS', payload: opening });

    const notif: Notification = {
      id: `n-${Date.now()}`,
      userId: 'all',
      message: `🏋️ Extra session on ${form.date}: ${form.startTime}–${form.endTime} by ${currentUser.name}.`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
    setForm({ date: today, startTime: '', endTime: '', note: '' });
  };

  const remove = (id: string) => {
    dispatch({ type: 'DELETE_SPONTANEOUS', payload: id });
    const notif: Notification = {
      id: `n-${Date.now()}`,
      userId: 'all',
      message: `⚠️ A spontaneous opening was cancelled by ${currentUser.name}.`,
      type: 'warning',
      read: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Spontaneous Opening</h2>
      </div>

      <section className="section">
        <h3 className="section-title">Open Gym Now / Later</h3>
        <div className="form-card">
          <div className="form-row">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              min={today}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="form-row-2col">
            <div className="form-row">
              <label className="form-label">From</label>
              <input
                type="time"
                className="form-input"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Until</label>
              <input
                type="time"
                className="form-input"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Note (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Cardio session available"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" onClick={submit}>Announce Opening</button>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">My Spontaneous Openings</h3>
        {myOpenings.length === 0 ? (
          <p className="empty-state">No spontaneous openings yet.</p>
        ) : (
          myOpenings.map(sp => (
            <div key={sp.id} className="info-card info-card-row">
              <div>
                <p className="info-time">📅 {sp.date} · {sp.startTime}–{sp.endTime}</p>
                {sp.note && <p className="info-note">{sp.note}</p>}
              </div>
              <button className="btn-danger-sm" onClick={() => remove(sp.id)}>Cancel</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
