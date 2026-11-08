import { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { DAY_NAMES } from '../../utils/openingHours';
import { addWeeks, dateOfWeekDay, formatShortDate, formatWeekRange, getNextWeekStart, getWeekStart } from '../../utils/week';
import { planAutoAssign, type ProposedAssignment } from '../../utils/autoAssign';
import WeekSwitcher from '../../components/WeekSwitcher';
import type { Notification, ShiftBlock } from '../../types';

const shortDay = (dow: number) => DAY_NAMES[dow].slice(0, 3);

export default function AssignShifts() {
  const { state, dispatch } = useApp();
  const [weekStart, setWeekStart] = useState(getNextWeekStart());
  const [proposal, setProposal] = useState<ProposedAssignment[] | null>(null);
  const [toast, setToast] = useState('');

  const weekAvail = state.availabilities.filter(a => a.weekStart === weekStart);

  const supervisors = useMemo(() => {
    const ids = new Set(weekAvail.map(a => a.supervisorId));
    return state.users
      .filter(u => u.role === 'supervisor' || ids.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.users, weekAvail]);

  const submittedIds = new Set(weekAvail.map(a => a.supervisorId));
  const missing = supervisors.filter(s => !submittedIds.has(s.id));

  const sortedShifts = [...state.shiftBlocks].sort((a, b) =>
    a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  const covered = sortedShifts.filter(s => s.claimed).length;

  const availableFor = (shiftId: string) => weekAvail.filter(a => a.shiftBlockIds.includes(shiftId));
  const loadOf = (supId: string) => state.shiftBlocks.filter(s => s.supervisorId === supId).length;

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const assign = (shift: ShiftBlock, supervisorId: string, supervisorName: string) => {
    if (shift.supervisorId === supervisorId) {
      dispatch({ type: 'UNCLAIM_SHIFT', payload: shift.id });
    } else {
      dispatch({ type: 'ASSIGN_SHIFT', payload: { shiftId: shift.id, supervisorId, supervisorName } });
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    const todo = proposal;
    setProposal(null);
    let ok = 0;
    for (const p of todo) {
      const res = await dispatch({
        type: 'ASSIGN_SHIFT',
        payload: { shiftId: p.shiftId, supervisorId: p.supervisorId, supervisorName: p.supervisorName },
      });
      if (res.ok) ok++;
    }
    flash(`${ok} of ${todo.length} shift${todo.length === 1 ? '' : 's'} assigned.`);
  };

  const notifyAssigned = () => {
    let count = 0;
    supervisors.forEach((sup, i) => {
      const mine = sortedShifts.filter(s => s.supervisorId === sup.id);
      if (mine.length === 0) return;
      const list = mine.map(s => `${shortDay(s.dayOfWeek)} ${s.startTime}–${s.endTime}`).join(', ');
      const notif: Notification = {
        id: `n-${Date.now()}-${i}`,
        userId: sup.id,
        message: `📅 Your shifts for ${formatWeekRange(weekStart)}: ${list}`,
        type: 'info',
        read: false,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
      count++;
    });
    flash(count ? `Shift plan sent to ${count} supervisor${count === 1 ? '' : 's'}.` : 'No supervisor has shifts yet.');
  };

  const remindMissing = () => {
    missing.forEach((sup, i) => {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `n-${Date.now()}-r${i}`,
          userId: sup.id,
          message: `⏰ Please enter your availability for ${formatWeekRange(weekStart)}.`,
          type: 'warning',
          read: false,
          createdAt: new Date().toISOString(),
        },
      });
    });
    flash(`Reminder sent to ${missing.length} supervisor${missing.length === 1 ? '' : 's'}.`);
  };

  const shiftById = (id: string) => state.shiftBlocks.find(s => s.id === id);
  const currentWeek = getWeekStart();

  return (
    <div className="page assign-page">
      <div className="page-header">
        <div>
          <h2>Assign Shifts</h2>
          <p className="page-subtitle">Tap a name to assign the shift. Tap again to remove. Changes go live in the shift plan immediately.</p>
        </div>
      </div>

      <WeekSwitcher weekStart={weekStart} onChange={w => { setWeekStart(w); setProposal(null); }} minWeek={currentWeek} maxWeek={addWeeks(currentWeek, 4)} />

      {toast && <div className="banner banner-ok" role="status">{toast}</div>}

      {/* Submission overview */}
      <section className="section">
        <div className="section-header">
          <h3 className="section-title">Submissions ({submittedIds.size}/{supervisors.length})</h3>
          {missing.length > 0 && (
            <button className="btn-ghost-sm" onClick={remindMissing}>Remind {missing.length} missing</button>
          )}
        </div>
        {supervisors.length === 0 ? (
          <p className="empty-state">No supervisors yet.</p>
        ) : (
          <div className="sup-status-list">
            {supervisors.map(sup => {
              const av = weekAvail.find(a => a.supervisorId === sup.id);
              return (
                <div key={sup.id} className={`sup-status ${av ? 'sup-status-done' : 'sup-status-missing'}`} title={av?.note}>
                  <span className="sup-status-icon">{av ? '✓' : '…'}</span>
                  <span className="sup-status-name">{sup.name}</span>
                  <span className="sup-status-meta">
                    {av ? `${av.shiftBlockIds.filter(id => shiftById(id)).length} avail.` : 'missing'} · {loadOf(sup.id)} assigned
                  </span>
                  {av?.note && <span className="sup-status-note">“{av.note}”</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="assign-toolbar">
        <div className="coverage">
          <div className="coverage-bar"><div className="coverage-fill" style={{ width: `${sortedShifts.length ? (covered / sortedShifts.length) * 100 : 0}%` }} /></div>
          <span className="coverage-text"><strong>{covered}</strong> / {sortedShifts.length} shifts covered</span>
        </div>
        <div className="assign-toolbar-actions">
          <button className="btn-primary-sm" onClick={() => setProposal(planAutoAssign(state.shiftBlocks, weekAvail))} disabled={weekAvail.length === 0}>
            ✨ Auto-assign
          </button>
          <button className="btn-ghost-sm" onClick={notifyAssigned} disabled={covered === 0}>Notify supervisors</button>
        </div>
      </div>

      {proposal && (
        <div className="form-card proposal-card">
          {proposal.length === 0 ? (
            <>
              <p className="proposal-title">Nothing to auto-assign</p>
              <p className="empty-state">All shifts with available supervisors are already covered.</p>
              <div className="form-actions"><button className="btn-ghost" onClick={() => setProposal(null)}>Close</button></div>
            </>
          ) : (
            <>
              <p className="proposal-title">Auto-assign suggests {proposal.length} assignment{proposal.length === 1 ? '' : 's'}:</p>
              <ul className="proposal-list">
                {proposal.map(p => {
                  const s = shiftById(p.shiftId);
                  return s ? (
                    <li key={p.shiftId}>
                      <span className="proposal-time">{shortDay(s.dayOfWeek)} {s.startTime}–{s.endTime}</span>
                      <span>→ <strong>{p.supervisorName}</strong>{p.replacesName ? ` (replaces ${p.replacesName}, not available)` : ''}</span>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setProposal(null)}>Cancel</button>
                <button className="btn-primary" onClick={applyProposal}>Apply</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Shifts by day */}
      {sortedShifts.length === 0 ? (
        <p className="empty-state">No shift blocks defined. Create them in the Shiftplan editor first.</p>
      ) : DAY_NAMES.map((day, dow) => {
        const dayShifts = sortedShifts.filter(s => s.dayOfWeek === dow);
        if (dayShifts.length === 0) return null;
        return (
          <section key={dow} className="section">
            <h3 className="section-title">{day} · {formatShortDate(dateOfWeekDay(weekStart, dow))}</h3>
            {dayShifts.map(s => {
              const avail = availableFor(s.id);
              const assigneeAvailable = !s.supervisorId || avail.some(a => a.supervisorId === s.supervisorId);
              const assigneeSubmitted = !!s.supervisorId && submittedIds.has(s.supervisorId);
              const others = supervisors.filter(sup =>
                sup.id !== s.supervisorId && !avail.some(a => a.supervisorId === sup.id));
              return (
                <div key={s.id} className={`assign-row ${s.supervisorId ? 'assign-row-covered' : 'assign-row-open'}`} data-testid={`assign-row-${s.id}`}>
                  <div className="assign-row-head">
                    <span className="shift-time">{s.startTime} – {s.endTime}</span>
                    {s.supervisorId ? (
                      <span className="shift-supervisor">
                        {s.supervisorName}
                        {!assigneeAvailable && assigneeSubmitted && <span className="assign-warn" title="Marked as not available this week"> ⚠ not available</span>}
                      </span>
                    ) : (
                      <span className="shift-unclaimed-label">Open</span>
                    )}
                  </div>
                  <div className="assign-candidates">
                    {avail.length === 0 && <span className="assign-none">Nobody available</span>}
                    {avail.map(a => (
                      <button
                        key={a.supervisorId}
                        className={`sup-chip ${s.supervisorId === a.supervisorId ? 'sup-chip-assigned' : ''}`}
                        onClick={() => assign(s, a.supervisorId, a.supervisorName)}
                        aria-pressed={s.supervisorId === a.supervisorId}
                      >
                        {s.supervisorId === a.supervisorId ? '✓ ' : ''}{a.supervisorName}
                        <span className="sup-chip-load">{loadOf(a.supervisorId)}</span>
                      </button>
                    ))}
                    {others.length > 0 && (
                      <select
                        className="assign-other"
                        value=""
                        aria-label="Assign someone else"
                        onChange={e => {
                          const sup = supervisors.find(u => u.id === e.target.value);
                          if (sup) assign(s, sup.id, sup.name);
                        }}
                      >
                        <option value="">Other…</option>
                        {others.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.name}{submittedIds.has(o.id) ? ' (not available)' : ' (no answer)'}
                          </option>
                        ))}
                      </select>
                    )}
                    {s.supervisorId && (
                      <button className="btn-ghost-sm assign-clear" onClick={() => dispatch({ type: 'UNCLAIM_SHIFT', payload: s.id })}>Unassign</button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
