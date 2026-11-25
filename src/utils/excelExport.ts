import type { Sheet, SheetData, Row, CellObject } from 'write-excel-file/universal';
import type { Availability, ShiftBlock } from '../types';
import { DAY_NAMES } from './openingHours';
import { PERIOD_DAYS, comparePeriodOrder, dateOfWeekDay, formatShortDate, formatWeekRange } from './week';

export interface ExportSupervisor { id: string; name: string }

// Everyone who can be planned for a week: all supervisors, plus admins who entered availability
export function plannableStaff<U extends ExportSupervisor & { role: string }>(users: U[], weekAvailabilities: Availability[]): U[] {
  const submitted = new Set(weekAvailabilities.map(a => a.supervisorId));
  return users
    .filter(u => u.role === 'supervisor' || submitted.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ScheduleExportInput {
  weekStart: string;
  shiftBlocks: ShiftBlock[];
  availabilities: Availability[];   // only this week's
  supervisors: ExportSupervisor[];
}

const C = {
  headerBg: '#0A1628', headerText: '#FFFFFF',
  available: '#D5F5EA', assigned: '#00C896', open: '#FDEBD0', warn: '#F9D2A0',
  border: '#C9D3E3', muted: '#7A8BA8',
};

const header = (value: string): CellObject => ({
  value, fontWeight: 'bold', backgroundColor: C.headerBg, textColor: C.headerText,
  alignVertical: 'center', borderColor: C.border,
});
const text = (value: string, style: Partial<CellObject> = {}): CellObject =>
  ({ type: String, value, borderColor: C.border, ...style } as CellObject);
const num = (value: number, style: Partial<CellObject> = {}): CellObject =>
  ({ type: Number, value, borderColor: C.border, ...style } as CellObject);

// write-excel-file converts Dates via getTime() (UTC), so calendar dates must be UTC midnight
const utcDate = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const utcWallClock = (d: Date) => new Date(Date.UTC(
  d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
const dateCell = (d: Date): CellObject =>
  ({ type: Date, value: utcDate(d), format: 'dd.mm.yyyy', borderColor: C.border } as CellObject);

const sortShifts = (shifts: ShiftBlock[]) => [...shifts].sort(comparePeriodOrder);
const dayShort = (dow: number) => DAY_NAMES[dow].slice(0, 2);
const hhmm = (t: string) => t.replace(/:00$/, '');

export function buildScheduleSheets(input: ScheduleExportInput): Sheet<Blob>[] {
  const { weekStart, availabilities } = input;
  const shifts = sortShifts(input.shiftBlocks);
  // Anyone holding a shift gets a row too (e.g. an admin who entered no availability)
  const supervisors = [...input.supervisors];
  for (const s of shifts) {
    if (s.supervisorId && !supervisors.some(sup => sup.id === s.supervisorId)) {
      supervisors.push({ id: s.supervisorId, name: s.supervisorName ?? 'Unknown' });
    }
  }
  const availOf = (supId: string) => availabilities.find(a => a.supervisorId === supId);
  const isAvailable = (supId: string, shiftId: string) => !!availOf(supId)?.shiftBlockIds.includes(shiftId);
  const wants = (supId: string, shiftId: string) =>
    isAvailable(supId, shiftId) && !!availOf(supId)?.preferredBlockIds?.includes(shiftId);
  const shiftIds = new Set(shifts.map(s => s.id));
  const countAvail = (supId: string) => (availOf(supId)?.shiftBlockIds ?? []).filter(id => shiftIds.has(id)).length;
  const countWant = (supId: string) => shifts.filter(s => wants(supId, s.id)).length;
  const countAssigned = (supId: string) => shifts.filter(s => s.supervisorId === supId).length;
  const title = `StuSta Gym · week ${formatWeekRange(weekStart)} (Fri–Thu)`;

  // ── Sheet 1: the plan as a table, one column per day ──────────────────────
  const columns = PERIOD_DAYS.map(dow => shifts.filter(s => s.dayOfWeek === dow));
  const slots = Math.max(0, ...columns.map(c => c.length));
  const grid: SheetData = [
    [text(title, { fontWeight: 'bold', fontSize: 13, columnSpan: 7, borderColor: undefined }), null, null, null, null, null, null],
    PERIOD_DAYS.map(dow => ({ ...header(`${DAY_NAMES[dow]} ${formatShortDate(dateOfWeekDay(weekStart, dow))}`), align: 'center' as const })),
  ];
  for (let r = 0; r < slots; r++) {
    grid.push(columns.map(col => {
      const s = col[r];
      if (!s) return text('');
      return text(`${s.startTime}–${s.endTime}\n${s.supervisorName ?? (s.claimed ? 'Covered' : '— open —')}`, {
        wrap: true, align: 'center', alignVertical: 'center',
        backgroundColor: s.claimed ? undefined : C.open,
        fontWeight: s.claimed ? 'bold' : undefined,
        textColor: s.claimed ? undefined : C.muted,
      });
    }));
  }
  const covered = shifts.filter(s => s.claimed).length;
  grid.push([]);
  grid.push([text(`${covered} of ${shifts.length} shifts covered`, { fontWeight: 'bold', columnSpan: 3, borderColor: undefined }), null, null]);

  // ── Sheet 2: shift list ───────────────────────────────────────────────────
  const plan: SheetData = [
    [text(title, { fontWeight: 'bold', fontSize: 13, columnSpan: 7, borderColor: undefined }), null, null, null, null, null, null],
    ['Day', 'Date', 'Start', 'End', 'Supervisor', 'Status', 'Available'].map(header),
  ];
  for (const s of shifts) {
    const assigneeSubmitted = !!s.supervisorId && !!availOf(s.supervisorId);
    const assigneeUnavailable = assigneeSubmitted && !isAvailable(s.supervisorId!, s.id);
    const status = !s.claimed ? 'Open' : assigneeUnavailable ? 'Covered – not available' : 'Covered';
    const bg = !s.claimed ? C.open : assigneeUnavailable ? C.warn : undefined;
    const style = bg ? { backgroundColor: bg } : {};
    plan.push([
      text(DAY_NAMES[s.dayOfWeek], style),
      { ...dateCell(dateOfWeekDay(weekStart, s.dayOfWeek)), ...style },
      text(s.startTime, { ...style, format: '@' }),
      text(s.endTime, { ...style, format: '@' }),
      text(s.supervisorName ?? (s.claimed ? 'Covered' : '—'), { ...style, fontWeight: s.claimed ? 'bold' : undefined }),
      text(status, style),
      num(supervisors.filter(sup => isAvailable(sup.id, s.id)).length, style),
    ]);
  }
  plan.push([]);
  plan.push([text('Covered', { fontWeight: 'bold' }), num(covered), text(`of ${shifts.length} shifts`, { textColor: C.muted })]);

  // ── Sheet 3: availability, one row per supervisor, one column per shift ───
  const fixed = 4; // name, available, want, assigned
  const matrix: SheetData = [
    [text(`${title} · ★ wants · ✓ could · coloured = assigned`, { fontWeight: 'bold', fontSize: 13, columnSpan: fixed + shifts.length, borderColor: undefined }),
      ...Array(fixed - 1 + shifts.length).fill(null)],
    [header('Supervisor'), header('Available'), header('★ Wants'), header('Assigned'),
      ...shifts.map(s => ({ ...header(`${dayShort(s.dayOfWeek)} ${formatShortDate(dateOfWeekDay(weekStart, s.dayOfWeek))}\n${hhmm(s.startTime)}–${hhmm(s.endTime)}`), wrap: true, align: 'center' as const }))],
  ];
  for (const sup of supervisors) {
    const submitted = !!availOf(sup.id);
    const row: Row = [
      text(sup.name, { fontWeight: 'bold' }),
      submitted ? num(countAvail(sup.id), { align: 'center' }) : text('no answer', { backgroundColor: C.open, textColor: C.muted }),
      num(countWant(sup.id), { align: 'center' }),
      num(countAssigned(sup.id), { align: 'center', fontWeight: 'bold' }),
    ];
    for (const s of shifts) {
      const avail = isAvailable(sup.id, s.id);
      const assigned = s.supervisorId === sup.id;
      const mark = wants(sup.id, s.id) ? '★' : avail ? '✓' : '';
      row.push(text(
        assigned ? (avail || !submitted ? mark || '■' : '✗ (n/a)') : mark,
        {
          align: 'center',
          backgroundColor: assigned ? (avail || !submitted ? C.assigned : C.warn) : avail ? C.available : undefined,
          textColor: assigned && (avail || !submitted) ? '#FFFFFF' : undefined,
          fontWeight: assigned || mark === '★' ? 'bold' : undefined,
        },
      ));
    }
    matrix.push(row);
  }
  matrix.push([
    text('Available per shift', { fontWeight: 'bold', columnSpan: fixed }), null, null, null,
    ...shifts.map(s => num(supervisors.filter(sup => isAvailable(sup.id, s.id)).length, { fontWeight: 'bold', align: 'center' })),
  ]);

  // ── Sheet 4: supervisors overview ─────────────────────────────────────────
  const people: SheetData = [
    ['Supervisor', 'Submitted', 'Last updated', 'Shifts available', '★ Wants', 'Shifts assigned', 'Note'].map(header),
  ];
  for (const sup of supervisors) {
    const av = availOf(sup.id);
    people.push([
      text(sup.name, { fontWeight: 'bold' }),
      text(av ? 'Yes' : 'No', { backgroundColor: av ? C.available : C.open }),
      av?.updatedAt
        ? ({ type: Date, value: utcWallClock(new Date(av.updatedAt)), format: 'dd.mm.yyyy hh:mm', borderColor: C.border } as CellObject)
        : text(''),
      num(av ? countAvail(sup.id) : 0),
      num(countWant(sup.id)),
      num(countAssigned(sup.id)),
      text(av?.note ?? '', { wrap: true }),
    ]);
  }

  return [
    { sheet: 'Plan', data: grid, stickyRowsCount: 2,
      columns: PERIOD_DAYS.map(() => ({ width: 18 })) },
    { sheet: 'Shift list', data: plan, stickyRowsCount: 2,
      columns: [{ width: 12 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 24 }, { width: 22 }, { width: 10 }] },
    { sheet: 'Availability', data: matrix, stickyRowsCount: 2, stickyColumnsCount: 1,
      columns: [{ width: 24 }, { width: 10 }, { width: 9 }, { width: 9 }, ...shifts.map(() => ({ width: 9 }))] },
    { sheet: 'Supervisors', data: people, stickyRowsCount: 1,
      columns: [{ width: 24 }, { width: 11 }, { width: 17 }, { width: 15 }, { width: 9 }, { width: 15 }, { width: 50 }] },
  ];
}

export function scheduleFileName(weekStart: string): string {
  return `StuSta-Gym_Shiftplan_${weekStart}.xlsx`;
}

export async function downloadScheduleWorkbook(input: ScheduleExportInput): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const blob = await writeExcelFile(buildScheduleSheets(input)).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = scheduleFileName(input.weekStart);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
