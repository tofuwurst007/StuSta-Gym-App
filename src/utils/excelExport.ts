import type { Sheet, SheetData, Row, CellObject } from 'write-excel-file/universal';
import type { Availability, ShiftBlock } from '../types';
import { DAY_NAMES } from './openingHours';
import { dateOfWeekDay, formatWeekRange } from './week';

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

const sortShifts = (shifts: ShiftBlock[]) => [...shifts].sort((a, b) =>
  a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

export function buildScheduleSheets(input: ScheduleExportInput): Sheet<Blob>[] {
  const { weekStart, availabilities } = input;
  const shifts = sortShifts(input.shiftBlocks);
  // Anyone holding a shift gets a column too (e.g. an admin who entered no availability)
  const supervisors = [...input.supervisors];
  for (const s of shifts) {
    if (s.supervisorId && !supervisors.some(sup => sup.id === s.supervisorId)) {
      supervisors.push({ id: s.supervisorId, name: s.supervisorName ?? 'Unknown' });
    }
  }
  const availOf = (supId: string) => availabilities.find(a => a.supervisorId === supId);
  const isAvailable = (supId: string, shiftId: string) => !!availOf(supId)?.shiftBlockIds.includes(shiftId);
  const shiftIds = new Set(shifts.map(s => s.id));
  const title = `StuSta Gym · week ${formatWeekRange(weekStart)}`;

  // ── Sheet 1: shift plan ───────────────────────────────────────────────────
  const plan: SheetData = [
    [text(title, { fontWeight: 'bold', fontSize: 13, columnSpan: 7, borderColor: undefined }), null, null, null, null, null, null],
    ['Day', 'Date', 'Start', 'End', 'Supervisor', 'Status', 'Available'].map(header),
  ];
  for (const s of shifts) {
    const available = supervisors.filter(sup => isAvailable(sup.id, s.id)).map(sup => sup.name);
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
      text(available.join(', '), { ...style, wrap: true }),
    ]);
  }
  const covered = shifts.filter(s => s.claimed).length;
  plan.push([]);
  plan.push([text('Covered', { fontWeight: 'bold' }), num(covered), text(`of ${shifts.length} shifts`, { textColor: C.muted })]);

  // ── Sheet 2: availability matrix (shift × supervisor) ─────────────────────
  const matrix: SheetData = [
    [text(`${title} · ✓ available, ★ assigned`, { fontWeight: 'bold', fontSize: 13, columnSpan: 3 + supervisors.length, borderColor: undefined }),
      ...Array(2 + supervisors.length).fill(null)],
    [header('Day'), header('Date'), header('Time'), ...supervisors.map(sup => ({ ...header(sup.name), wrap: true, align: 'center' as const }))],
  ];
  for (const s of shifts) {
    const row: Row = [
      text(DAY_NAMES[s.dayOfWeek]),
      dateCell(dateOfWeekDay(weekStart, s.dayOfWeek)),
      text(`${s.startTime}–${s.endTime}`, { format: '@' }),
    ];
    for (const sup of supervisors) {
      const avail = isAvailable(sup.id, s.id);
      const assigned = s.supervisorId === sup.id;
      row.push(text(
        assigned ? (avail ? '★' : '★ (n/a)') : avail ? '✓' : '',
        {
          align: 'center',
          backgroundColor: assigned ? (avail ? C.assigned : C.warn) : avail ? C.available : undefined,
          textColor: assigned && avail ? '#FFFFFF' : undefined,
          fontWeight: assigned ? 'bold' : undefined,
        },
      ));
    }
    matrix.push(row);
  }
  matrix.push([
    text('Available', { fontWeight: 'bold' }), text(''), text('total', { textColor: C.muted }),
    ...supervisors.map(sup => num(
      (availOf(sup.id)?.shiftBlockIds ?? []).filter(id => shiftIds.has(id)).length,
      { fontWeight: 'bold', align: 'center' })),
  ]);
  matrix.push([
    text('Assigned', { fontWeight: 'bold' }), text(''), text('total', { textColor: C.muted }),
    ...supervisors.map(sup => num(shifts.filter(s => s.supervisorId === sup.id).length, { fontWeight: 'bold', align: 'center' })),
  ]);

  // ── Sheet 3: supervisors overview ─────────────────────────────────────────
  const people: SheetData = [
    ['Supervisor', 'Submitted', 'Last updated', 'Shifts available', 'Shifts assigned', 'Note'].map(header),
  ];
  for (const sup of supervisors) {
    const av = availOf(sup.id);
    people.push([
      text(sup.name, { fontWeight: 'bold' }),
      text(av ? 'Yes' : 'No', { backgroundColor: av ? C.available : C.open }),
      av?.updatedAt
        ? ({ type: Date, value: utcWallClock(new Date(av.updatedAt)), format: 'dd.mm.yyyy hh:mm', borderColor: C.border } as CellObject)
        : text(''),
      num(av ? av.shiftBlockIds.filter(id => shiftIds.has(id)).length : 0),
      num(shifts.filter(s => s.supervisorId === sup.id).length),
      text(av?.note ?? '', { wrap: true }),
    ]);
  }

  return [
    { sheet: 'Shift plan', data: plan, stickyRowsCount: 2,
      columns: [{ width: 12 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 24 }, { width: 22 }, { width: 40 }] },
    { sheet: 'Availability', data: matrix, stickyRowsCount: 2, stickyColumnsCount: 3,
      columns: [{ width: 12 }, { width: 12 }, { width: 13 }, ...supervisors.map(() => ({ width: 14 }))] },
    { sheet: 'Supervisors', data: people, stickyRowsCount: 1,
      columns: [{ width: 24 }, { width: 11 }, { width: 17 }, { width: 15 }, { width: 15 }, { width: 50 }] },
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
