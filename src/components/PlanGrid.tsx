import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { DAY_NAMES } from '../utils/openingHours';
import { blocksForWeek } from '../utils/assignments';
import { PERIOD_DAYS, dateOfWeekDay, formatShortDate } from '../utils/week';
import { loadOf, ruleWarnings } from '../utils/autoAssign';
import { plannableStaff } from '../utils/excelExport';
import { localISODate } from '../utils/date';
import type { ShiftBlock } from '../types';

/**
 * The plan of one Friday–Thursday period as a table: one column per day, one row per
 * shift slot. Admins pick the supervisor of every shift right in the cell.
 */
export default function PlanGrid({ weekStart }: { weekStart: string }) {
  const { state, dispatch } = useApp();

  const weekAvail = useMemo(() => state.availabilities.filter(a => a.weekStart === weekStart),
    [state.availabilities, weekStart]);
  const staff = useMemo(() => plannableStaff(state.users, weekAvail), [state.users, weekAvail]);
  const blocks = blocksForWeek(state.shiftBlocks, state.assignments, weekStart);
  const load = loadOf(blocks);
  const availOf = new Map(weekAvail.map(a => [a.supervisorId, a]));
  const today = localISODate();

  const columns = PERIOD_DAYS.map(dow => ({
    dow,
    date: dateOfWeekDay(weekStart, dow),
    blocks: blocks.filter(b => b.dayOfWeek === dow).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
  const rows = Math.max(0, ...columns.map(c => c.blocks.length));

  const setAssignee = (b: ShiftBlock, supervisorId: string) => {
    if (!supervisorId) {
      dispatch({ type: 'SET_ASSIGNMENT', payload: { shiftId: b.id, weekStart, supervisorId: null } });
      return;
    }
    const sup = state.users.find(u => u.id === supervisorId);
    dispatch({
      type: 'SET_ASSIGNMENT',
      payload: { shiftId: b.id, weekStart, supervisorId, supervisorName: sup?.name ?? '' },
    });
  };

  const label = (id: string, name: string, b: ShiftBlock) => {
    const l = load.get(id);
    const mine = b.supervisorId === id;
    const total = (l?.total ?? 0) - (mine ? 1 : 0);
    const sameDay = ((l?.days.get(b.dayOfWeek) ?? 0) - (mine ? 1 : 0)) > 0;
    return `${name} (${total})${sameDay ? ' · same day!' : ''}`;
  };

  const cell = (b: ShiftBlock) => {
    const want = staff.filter(s => availOf.get(s.id)?.preferredBlockIds?.includes(b.id));
    const could = staff.filter(s => availOf.get(s.id)?.shiftBlockIds.includes(b.id) && !want.includes(s));
    const unavailable = staff.filter(s => availOf.has(s.id) && !availOf.get(s.id)!.shiftBlockIds.includes(b.id));
    const noAnswer = staff.filter(s => !availOf.has(s.id));
    const assigneeKnown = !b.supervisorId || staff.some(s => s.id === b.supervisorId);

    const assigneeAvail = b.supervisorId ? availOf.get(b.supervisorId) : undefined;
    const notAvailable = !!assigneeAvail && !assigneeAvail.shiftBlockIds.includes(b.id);
    // Week limit on every cell of that person, the day limit only on the clashing day
    const l = b.supervisorId ? load.get(b.supervisorId) : undefined;
    const warnings = ruleWarnings(l && { total: l.total, days: new Map([[b.dayOfWeek, l.days.get(b.dayOfWeek) ?? 0]]) });
    if (notAvailable) warnings.unshift('marked as not available');
    const status = !b.supervisorId ? 'open' : warnings.length ? 'warn' : 'covered';
    const past = localISODate(dateOfWeekDay(weekStart, b.dayOfWeek)) < today;

    return (
      <div className={`plan-cell plan-cell-${status} ${past ? 'plan-cell-past' : ''}`} data-testid={`plan-cell-${b.id}`}>
        <div className="plan-cell-time">
          {b.startTime}–{b.endTime}
          <span className="plan-cell-count" title="available (★ want)">
            {want.length + could.length}{want.length ? ` · ★${want.length}` : ''}
          </span>
        </div>
        <div className={`plan-cell-name ${b.supervisorId ? '' : 'plan-cell-name-open'}`} title={b.supervisorName}>
          {b.supervisorId ? b.supervisorName : 'open'}
        </div>
        <select
          className="plan-cell-select"
          value={b.supervisorId ?? ''}
          aria-label={`${DAY_NAMES[b.dayOfWeek]} ${b.startTime}–${b.endTime}`}
          onChange={e => setAssignee(b, e.target.value)}
        >
          <option value="">— open —</option>
          {!assigneeKnown && <option value={b.supervisorId}>{b.supervisorName}</option>}
          {want.length > 0 && (
            <optgroup label="★ Wants this shift">
              {want.map(s => <option key={s.id} value={s.id}>{label(s.id, s.name, b)}</option>)}
            </optgroup>
          )}
          {could.length > 0 && (
            <optgroup label="✓ Could take it">
              {could.map(s => <option key={s.id} value={s.id}>{label(s.id, s.name, b)}</option>)}
            </optgroup>
          )}
          {noAnswer.length > 0 && (
            <optgroup label="No answer yet">
              {noAnswer.map(s => <option key={s.id} value={s.id}>{label(s.id, s.name, b)}</option>)}
            </optgroup>
          )}
          {unavailable.length > 0 && (
            <optgroup label="✗ Not available">
              {unavailable.map(s => <option key={s.id} value={s.id}>{label(s.id, s.name, b)}</option>)}
            </optgroup>
          )}
        </select>
        {warnings.length > 0 && <div className="plan-cell-msg">⚠ {warnings.join(' · ')}</div>}
      </div>
    );
  };

  if (blocks.length === 0) {
    return <p className="empty-state">No shift blocks defined yet.</p>;
  }

  return (
    <div className="plan-grid-wrap">
      <table className="plan-grid">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.dow} className={localISODate(c.date) === today ? 'plan-today' : ''}>
                {DAY_NAMES[c.dow].slice(0, 2)} <span className="plan-date">{formatShortDate(c.date)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {columns.map(c => <td key={c.dow}>{c.blocks[r] ? cell(c.blocks[r]) : null}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="plan-legend">
        Number in brackets = shifts that person already has this week. Rules: max. 2 shifts per week, max. 1 per day.
      </p>
    </div>
  );
}
