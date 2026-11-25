import { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { DAY_NAMES } from '../../utils/openingHours';
import {
  addWeeks, availabilityDeadline, comparePeriodOrder, dateOfWeekDay, formatShortDate, formatWeekRange,
  getNextWeekStart, getWeekStart,
} from '../../utils/week';
import { blocksForWeek, planCopyFromPreviousWeek } from '../../utils/assignments';
import { DEFAULT_RULES, planAutoAssign, type ProposedAssignment } from '../../utils/autoAssign';
import WeekSwitcher from '../../components/WeekSwitcher';
import ExcelExportButton from '../../components/ExcelExportButton';
import PlanGrid from '../../components/PlanGrid';
import { plannableStaff } from '../../utils/excelExport';
import type { Notification, ShiftBlock } from '../../types';

const shortDay = (dow: number) => DAY_NAMES[dow].slice(0, 3);

export const PLAN_WEEKS_AHEAD = 6;

export default function AssignShifts() {
  const { state, dispatch } = useApp();
  const [weekStart, setWeekStart] = useState(getNextWeekStart());
  const [proposal, setProposal] = useState<ProposedAssignment[] | null>(null);
  const [proposalKind, setProposalKind] = useState<'auto' | 'copy'>('auto');
  const [toast, setToast] = useState('');

  const weekAvail = useMemo(() => state.availabilities.filter(a => a.weekStart === weekStart),
    [state.availabilities, weekStart]);
  const supervisors = useMemo(() => plannableStaff(state.users, weekAvail), [state.users, weekAvail]);

  const submittedIds = new Set(weekAvail.map(a => a.supervisorId));
  const missing = supervisors.filter(s => !submittedIds.has(s.id));

  const sortedShifts = blocksForWeek(state.shiftBlocks, state.assignments, weekStart).sort(comparePeriodOrder);
  const covered = sortedShifts.filter(s => s.claimed).length;

  const availableFor = (shiftId: string) => weekAvail.filter(a => a.shiftBlockIds.includes(shiftId));
  const loadOfSup = (supId: string) => sortedShifts.filter(s => s.supervisorId === supId).length;
  const label = (s: ShiftBlock) =>
    `${shortDay(s.dayOfWeek)} ${formatShortDate(dateOfWeekDay(weekStart, s.dayOfWeek))} ${s.startTime}–${s.endTime}`;

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 5000); };

  const applyProposal = async () => {
    if (!proposal) return;
    const todo = proposal;
    setProposal(null);
    let ok = 0;
    for (const p of todo) {
      const res = await dispatch({
        type: 'SET_ASSIGNMENT',
        payload: { shiftId: p.shiftId, weekStart, supervisorId: p.supervisorId, supervisorName: p.supervisorName },
      });
      if (res.ok) ok++;
    }
    flash(`${ok} of ${todo.length} shift${todo.length === 1 ? '' : 's'} assigned for ${formatWeekRange(weekStart)}.`);
  };

  const notifyAssigned = () => {
    let count = 0;
    supervisors.forEach((sup, i) => {
      const mine = sortedShifts.filter(s => s.supervisorId === sup.id);
      if (mine.length === 0) return;
      const notif: Notification = {
        id: `n-${Date.now()}-${i}`,
        userId: sup.id,
        message: `📅 Your shifts for ${formatWeekRange(weekStart)}: ${mine.map(label).join(', ')}`,
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
          message: availabilityDeadline(weekStart) > new Date()
            ? `⏰ Please enter your availability for ${formatWeekRange(weekStart)} by Wed ${formatShortDate(availabilityDeadline(weekStart))}`
            : `⏰ Please enter your availability for ${formatWeekRange(weekStart)} as soon as possible.`,
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
  const openIds = new Set(sortedShifts.filter(s => !s.claimed).map(s => s.id));
  const openAfterProposal = proposal ? openIds.size - proposal.filter(p => openIds.has(p.shiftId)).length : 0;

  return (
    <div className="page assign-page">
      <div className="page-header">
        <div>
          <h2>Assign Shifts</h2>
          <p className="page-subtitle">
            Plans run Friday–Thursday and are made on Thursday. Pick a name in a cell to assign it; changes apply only to the selected week.
          </p>
        </div>
      </div>

      <WeekSwitcher weekStart={weekStart} onChange={w => { setWeekStart(w); setProposal(null); }}
        minWeek={currentWeek} maxWeek={addWeeks(currentWeek, PLAN_WEEKS_AHEAD)} />

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
              const n = av ? av.shiftBlockIds.filter(id => shiftById(id)).length : 0;
              const want = av ? (av.preferredBlockIds ?? []).filter(id => shiftById(id)).length : 0;
              return (
                <div key={sup.id} className={`sup-status ${av ? 'sup-status-done' : 'sup-status-missing'}`} title={av?.note}>
                  <span className="sup-status-icon">{av ? '✓' : '…'}</span>
                  <span className="sup-status-name">{sup.name}</span>
                  <span className="sup-status-meta">
                    {av ? `${n} avail.${want ? ` (★${want})` : ''}` : 'missing'} · {loadOfSup(sup.id)} assigned
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
          <button
            className="btn-primary-sm"
            onClick={() => { setProposalKind('auto'); setProposal(planAutoAssign(sortedShifts, weekAvail)); }}
            disabled={weekAvail.length === 0}
            title={`Fills open shifts from the availabilities: max. ${DEFAULT_RULES.maxPerWeek} per person and week, max. ${DEFAULT_RULES.maxPerDay} per day, preferred shifts first`}
          >
            ✨ Auto-assign
          </button>
          <button className="btn-ghost-sm" onClick={() => { setProposalKind('copy'); setProposal(planCopyFromPreviousWeek(state.shiftBlocks, state.assignments, weekStart)
            // Skip people who said they can't do that shift this week
            .filter(p => !submittedIds.has(p.supervisorId) || availableFor(p.shiftId).some(a => a.supervisorId === p.supervisorId))); }}>
            ↻ Copy last week
          </button>
          <button className="btn-ghost-sm" onClick={notifyAssigned} disabled={covered === 0}>Notify supervisors</button>
          <ExcelExportButton weekStart={weekStart} />
        </div>
      </div>

      {proposal && (
        <div className="form-card proposal-card">
          {proposal.length === 0 ? (
            <>
              <p className="proposal-title">{proposalKind === 'auto' ? 'Nothing to auto-assign' : 'Nothing to copy'}</p>
              <p className="empty-state">{proposalKind === 'auto'
                ? `No open shift can be filled without breaking the rules (max. ${DEFAULT_RULES.maxPerWeek} per week, ${DEFAULT_RULES.maxPerDay} per day).`
                : `Last week (${formatWeekRange(addWeeks(weekStart, -1))}) has no assignments for shifts that are still open.`}</p>
              <div className="form-actions"><button className="btn-ghost" onClick={() => setProposal(null)}>Close</button></div>
            </>
          ) : (
            <>
              <p className="proposal-title">
                {proposalKind === 'auto' ? 'Auto-assign suggests' : `Copy from ${formatWeekRange(addWeeks(weekStart, -1))}:`}{' '}
                {proposal.length} assignment{proposal.length === 1 ? '' : 's'}
              </p>
              <ul className="proposal-list">
                {proposal.map(p => {
                  const s = shiftById(p.shiftId);
                  return s ? (
                    <li key={p.shiftId}>
                      <span className="proposal-time">{label(s)}</span>
                      <span>→ <strong>{p.supervisorName}</strong>{p.replacesName ? ` (replaces ${p.replacesName}, not available)` : ''}</span>
                    </li>
                  ) : null;
                })}
              </ul>
              {proposalKind === 'auto' && openAfterProposal > 0 && (
                <p className="proposal-note">{openAfterProposal} shift{openAfterProposal === 1 ? '' : 's'} stay open: nobody available can take {openAfterProposal === 1 ? 'it' : 'them'} within the rules.</p>
              )}
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setProposal(null)}>Cancel</button>
                <button className="btn-primary" onClick={applyProposal}>Apply</button>
              </div>
            </>
          )}
        </div>
      )}

      <section className="section">
        <h3 className="section-title">Plan {formatWeekRange(weekStart)}</h3>
        <PlanGrid weekStart={weekStart} />
      </section>
    </div>
  );
}
