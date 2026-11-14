import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import writeExcelFile from 'write-excel-file/universal';
import { buildScheduleSheets, plannableStaff, scheduleFileName } from './excelExport';
import type { Availability, ShiftBlock } from '../types';

const WEEK = '2026-11-16';
const shifts: ShiftBlock[] = [
  { id: 'b', dayOfWeek: 0, startTime: '17:00', endTime: '19:00', claimed: false },
  { id: 'a', dayOfWeek: 0, startTime: '06:00', endTime: '08:00', claimed: true, supervisorId: 'u1', supervisorName: 'Anna' },
  { id: 'c', dayOfWeek: 6, startTime: '09:00', endTime: '11:00', claimed: true, supervisorId: 'u2', supervisorName: 'Ben' },
];
const avails: Availability[] = [
  { id: 'x', supervisorId: 'u1', supervisorName: 'Anna', weekStart: WEEK, shiftBlockIds: ['a', 'b', 'deleted-block'], note: 'exam Wed', updatedAt: '2026-11-12T09:30:00Z' },
  { id: 'y', supervisorId: 'u2', supervisorName: 'Ben', weekStart: WEEK, shiftBlockIds: ['b'], updatedAt: '2026-11-13T18:00:00Z' },
];
const supervisors = [{ id: 'u1', name: 'Anna' }, { id: 'u2', name: 'Ben' }, { id: 'u3', name: 'Carl' }];
const input = { weekStart: WEEK, shiftBlocks: shifts, availabilities: avails, supervisors };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const val = (cell: any) => (cell && typeof cell === 'object' ? cell.value : cell);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowValues = (row: any[]) => row.map(val);

describe('buildScheduleSheets', () => {
  const [plan, matrix, people] = buildScheduleSheets(input);

  it('creates three named sheets', () => {
    expect([plan.sheet, matrix.sheet, people.sheet]).toEqual(['Shift plan', 'Availability', 'Supervisors']);
  });

  it('shift plan lists shifts sorted by day and time with status and available names', () => {
    const rows = plan.data.slice(2, 5).map(r => rowValues(r as unknown[]));
    expect(rows.map(r => [r[0], r[2], r[3], r[4], r[5]])).toEqual([
      ['Monday', '06:00', '08:00', 'Anna', 'Covered'],
      ['Monday', '17:00', '19:00', '—', 'Open'],
      ['Sunday', '09:00', '11:00', 'Ben', 'Covered – not available'],
    ]);
    expect(rows[1][6]).toBe('Anna, Ben');
  });

  it('writes calendar dates as UTC midnight of the right day', () => {
    const mon = val((plan.data[2] as unknown[])[1]) as Date;
    const sun = val((plan.data[4] as unknown[])[1]) as Date;
    expect(mon.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(sun.toISOString()).toBe('2026-11-22T00:00:00.000Z');
  });

  it('availability matrix marks available, assigned and assigned-but-unavailable', () => {
    expect(rowValues(matrix.data[1] as unknown[])).toEqual(['Day', 'Date', 'Time', 'Anna', 'Ben', 'Carl']);
    const body = matrix.data.slice(2, 5).map(r => rowValues(r as unknown[]).slice(2));
    expect(body).toEqual([
      ['06:00–08:00', '★', '', ''],
      ['17:00–19:00', '✓', '✓', ''],
      ['09:00–11:00', '', '★ (n/a)', ''],
    ]);
  });

  it('totals ignore ids of deleted shift blocks', () => {
    const totals = matrix.data.slice(-2).map(r => rowValues(r as unknown[]).slice(3));
    expect(totals).toEqual([[2, 1, 0], [1, 1, 0]]);
  });

  it('supervisor sheet shows submission state, counts and note', () => {
    const rows = people.data.slice(1).map(r => rowValues(r as unknown[]));
    expect(rows.map(r => [r[0], r[1], r[3], r[4], r[5]])).toEqual([
      ['Anna', 'Yes', 2, 1, 'exam Wed'],
      ['Ben', 'Yes', 1, 1, ''],
      ['Carl', 'No', 0, 0, ''],
    ]);
  });

  it('adds a column for an assignee who is not in the supervisor list', () => {
    const withAdmin = [...shifts, { id: 'd', dayOfWeek: 2, startTime: '17:00', endTime: '19:00', claimed: true, supervisorId: 'adm', supervisorName: 'Admin Ada' }];
    const [, m, p] = buildScheduleSheets({ ...input, shiftBlocks: withAdmin });
    expect(rowValues(m.data[1] as unknown[])).toEqual(['Day', 'Date', 'Time', 'Anna', 'Ben', 'Carl', 'Admin Ada']);
    expect(rowValues(m.data[m.data.length - 1] as unknown[]).slice(3)).toEqual([1, 1, 0, 1]);
    expect(rowValues(p.data[p.data.length - 1] as unknown[]).slice(0, 2)).toEqual(['Admin Ada', 'No']);
  });

  it('handles an empty week (no shifts, no supervisors)', () => {
    const sheets = buildScheduleSheets({ weekStart: WEEK, shiftBlocks: [], availabilities: [], supervisors: [] });
    expect(sheets).toHaveLength(3);
  });
});

describe('xlsx output', () => {
  it('produces a valid workbook containing the data', async () => {
    const blob = await writeExcelFile(buildScheduleSheets(input)).toBlob();
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const names = Object.keys(files);
    expect(names).toContain('xl/workbook.xml');
    const workbook = strFromU8(files['xl/workbook.xml']);
    for (const s of ['Shift plan', 'Availability', 'Supervisors']) expect(workbook).toContain(`name="${s}"`);
    const strings = names.filter(n => n.startsWith('xl/')).map(n => strFromU8(files[n])).join('\n');
    for (const t of ['Anna', 'Ben', 'Carl', 'Covered – not available', '★ (n/a)', 'exam Wed']) expect(strings).toContain(t);
  });
});

describe('helpers', () => {
  it('plannableStaff: all supervisors plus admins who submitted, sorted by name', () => {
    const users = [
      { id: '1', name: 'Zoe', role: 'supervisor' }, { id: '2', name: 'Adam', role: 'admin' },
      { id: '3', name: 'Bea', role: 'admin' }, { id: '4', name: 'Max', role: 'member' },
    ];
    const res = plannableStaff(users, [{ ...avails[0], supervisorId: '3' }]);
    expect(res.map(u => u.name)).toEqual(['Bea', 'Zoe']);
  });

  it('file name contains the week', () => {
    expect(scheduleFileName(WEEK)).toBe('StuSta-Gym_Shiftplan_2026-11-16.xlsx');
  });
});
