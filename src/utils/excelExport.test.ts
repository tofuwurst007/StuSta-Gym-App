import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import writeExcelFile from 'write-excel-file/universal';
import { buildScheduleSheets, plannableStaff, scheduleFileName } from './excelExport';
import type { Availability, ShiftBlock } from '../types';

// Period Fri 20 Nov – Thu 26 Nov 2026. dayOfWeek 0 = Monday, so Monday blocks fall on 23 Nov.
const WEEK = '2026-11-20';
const shifts: ShiftBlock[] = [
  { id: 'b', dayOfWeek: 0, startTime: '17:00', endTime: '19:00', claimed: false },                                        // Mon, open
  { id: 'a', dayOfWeek: 0, startTime: '06:00', endTime: '08:00', claimed: true, supervisorId: 'u1', supervisorName: 'Anna' }, // Mon, Anna wants it
  { id: 'c', dayOfWeek: 6, startTime: '09:00', endTime: '11:00', claimed: true, supervisorId: 'u2', supervisorName: 'Ben' },  // Sun, Ben n/a
  { id: 'd', dayOfWeek: 5, startTime: '10:00', endTime: '12:00', claimed: true, supervisorId: 'u1', supervisorName: 'Anna' }, // Sat, Anna could
  { id: 'f', dayOfWeek: 4, startTime: '18:00', endTime: '20:00', claimed: true, supervisorId: 'u3', supervisorName: 'Carl' }, // Fri, Carl no answer
];
const avails: Availability[] = [
  { id: 'x', supervisorId: 'u1', supervisorName: 'Anna', weekStart: WEEK, shiftBlockIds: ['a', 'b', 'd', 'deleted-block'], preferredBlockIds: ['a'], note: 'exam Wed', updatedAt: '2026-11-18T09:30:00Z' },
  // Ben "prefers" c without being available for it: that must not count as a want
  { id: 'y', supervisorId: 'u2', supervisorName: 'Ben', weekStart: WEEK, shiftBlockIds: ['b'], preferredBlockIds: ['b', 'c'], updatedAt: '2026-11-19T18:00:00Z' },
];
const supervisors = [{ id: 'u1', name: 'Anna' }, { id: 'u2', name: 'Ben' }, { id: 'u3', name: 'Carl' }];
const input = { weekStart: WEEK, shiftBlocks: shifts, availabilities: avails, supervisors };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const val = (cell: any) => (cell && typeof cell === 'object' && !(cell instanceof Date) ? cell.value : cell);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowValues = (row: any[]) => row.map(val);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cellAt = (data: unknown[], r: number, c: number): any => (data[r] as unknown[])[c];

const ASSIGNED_BG = '#00C896';
const AVAILABLE_BG = '#D5F5EA';
const WARN_BG = '#F9D2A0';
const OPEN_BG = '#FDEBD0';

describe('buildScheduleSheets', () => {
  const [grid, list, matrix, people] = buildScheduleSheets(input);

  it('creates four named sheets', () => {
    expect([grid.sheet, list.sheet, matrix.sheet, people.sheet]).toEqual(['Plan', 'Shift list', 'Availability', 'Supervisors']);
    expect(buildScheduleSheets(input)).toHaveLength(4);
  });

  describe("sheet 'Plan' (grid Fri..Thu)", () => {
    it('has a title with the Fri–Thu range', () => {
      const title = val(cellAt(grid.data, 0, 0)) as string;
      expect(title).toContain('20.11. – 26.11.');
      expect(title).toContain('Fri–Thu');
    });

    it('has 7 day columns in period order with the right dates', () => {
      expect(rowValues(grid.data[1] as unknown[])).toEqual([
        'Friday 20.11.', 'Saturday 21.11.', 'Sunday 22.11.', 'Monday 23.11.', 'Tuesday 24.11.', 'Wednesday 25.11.', 'Thursday 26.11.',
      ]);
      expect(grid.columns).toHaveLength(7);
    });

    it('one row per slot index, cells "HH:mm–HH:mm\\nName" or "— open —", sorted by time', () => {
      expect(rowValues(grid.data[2] as unknown[])).toEqual([
        '18:00–20:00\nCarl', '10:00–12:00\nAnna', '09:00–11:00\nBen', '06:00–08:00\nAnna', '', '', '',
      ]);
      expect(rowValues(grid.data[3] as unknown[])).toEqual(['', '', '', '17:00–19:00\n— open —', '', '', '']);
    });

    it('highlights open cells and ends with the coverage summary', () => {
      expect(cellAt(grid.data, 3, 3).backgroundColor).toBe(OPEN_BG);
      expect(cellAt(grid.data, 2, 3).backgroundColor).toBeUndefined();
      expect(grid.data[4]).toEqual([]);
      expect(val(cellAt(grid.data, 5, 0))).toBe('4 of 5 shifts covered');
      expect(grid.data).toHaveLength(6);
    });

    it('shows "Covered" for a claimed shift without a name (member view)', () => {
      const anon: ShiftBlock[] = [{ id: 'z', dayOfWeek: 3, startTime: '06:00', endTime: '08:00', claimed: true }];
      const [g] = buildScheduleSheets({ ...input, shiftBlocks: anon });
      expect(rowValues(g.data[2] as unknown[])).toEqual(['', '', '', '', '', '', '06:00–08:00\nCovered']);
    });
  });

  describe("sheet 'Shift list'", () => {
    it('has the expected header', () => {
      expect(rowValues(list.data[1] as unknown[])).toEqual(['Day', 'Date', 'Start', 'End', 'Supervisor', 'Status', 'Available']);
    });

    it('lists shifts in period order with status and available count', () => {
      const rows = list.data.slice(2, 7).map(r => rowValues(r as unknown[]));
      expect(rows.map(r => [r[0], r[2], r[3], r[4], r[5], r[6]])).toEqual([
        ['Friday', '18:00', '20:00', 'Carl', 'Covered', 0],
        ['Saturday', '10:00', '12:00', 'Anna', 'Covered', 1],
        ['Sunday', '09:00', '11:00', 'Ben', 'Covered – not available', 0],
        ['Monday', '06:00', '08:00', 'Anna', 'Covered', 1],
        ['Monday', '17:00', '19:00', '—', 'Open', 2],
      ]);
      expect(rows.every(r => typeof r[6] === 'number')).toBe(true);
    });

    it('writes calendar dates as UTC midnight of the right day within the Friday period', () => {
      const dates = list.data.slice(2, 7).map(r => (val((r as unknown[])[1]) as Date).toISOString());
      expect(dates).toEqual([
        '2026-11-20T00:00:00.000Z', '2026-11-21T00:00:00.000Z', '2026-11-22T00:00:00.000Z',
        '2026-11-23T00:00:00.000Z', '2026-11-23T00:00:00.000Z',
      ]);
    });

    it('colours open and covered-but-unavailable rows, and totals the coverage', () => {
      expect(cellAt(list.data, 6, 0).backgroundColor).toBe(OPEN_BG);
      expect(cellAt(list.data, 4, 5).backgroundColor).toBe(WARN_BG);
      expect(cellAt(list.data, 5, 0).backgroundColor).toBeUndefined();
      expect(rowValues(list.data[list.data.length - 1] as unknown[])).toEqual(['Covered', 4, 'of 5 shifts']);
    });
  });

  describe("sheet 'Availability' (one row per supervisor)", () => {
    it('has fixed columns plus one column per shift, in period order', () => {
      expect(rowValues(matrix.data[1] as unknown[])).toEqual([
        'Supervisor', 'Available', '★ Wants', 'Assigned',
        'Fr 20.11.\n18–20', 'Sa 21.11.\n10–12', 'Su 22.11.\n09–11', 'Mo 23.11.\n06–08', 'Mo 23.11.\n17–19',
      ]);
      expect(matrix.columns).toHaveLength(4 + shifts.length);
    });

    it('marks ★ want / ✓ could, keeps the mark when assigned, ✗ (n/a) and ■ otherwise', () => {
      const body = matrix.data.slice(2, 5).map(r => rowValues(r as unknown[]));
      expect(body).toEqual([
        //                          Fri  Sat  Sun        Mon06 Mon17
        ['Anna', 3, 1, 2,           '',  '✓', '',        '★',  '✓'],
        ['Ben', 1, 1, 1,            '',  '',  '✗ (n/a)', '',   '★'],
        ['Carl', 'no answer', 0, 1, '■', '',  '',        '',   ''],
      ]);
    });

    it('colours assigned, assigned-but-unavailable and available cells', () => {
      expect(cellAt(matrix.data, 2, 5).backgroundColor).toBe(ASSIGNED_BG); // Anna Sat, assigned & could
      expect(cellAt(matrix.data, 2, 7).backgroundColor).toBe(ASSIGNED_BG); // Anna Mon06, assigned & wants
      expect(cellAt(matrix.data, 3, 6).backgroundColor).toBe(WARN_BG);     // Ben Sun, n/a
      expect(cellAt(matrix.data, 4, 4).backgroundColor).toBe(ASSIGNED_BG); // Carl Fri, no answer
      expect(cellAt(matrix.data, 2, 8).backgroundColor).toBe(AVAILABLE_BG); // Anna Mon17, only available
      expect(cellAt(matrix.data, 2, 4).backgroundColor).toBeUndefined();   // Anna Fri, nothing
      expect(cellAt(matrix.data, 4, 1).backgroundColor).toBe(OPEN_BG);     // "no answer"
    });

    it('ends with the available-per-shift counts (ignoring ids of deleted blocks)', () => {
      const last = rowValues(matrix.data[matrix.data.length - 1] as unknown[]);
      expect(last[0]).toBe('Available per shift');
      expect(last.slice(4)).toEqual([0, 1, 0, 1, 2]);
      expect(matrix.data).toHaveLength(2 + supervisors.length + 1);
    });
  });

  describe("sheet 'Supervisors'", () => {
    it('has the expected header', () => {
      expect(rowValues(people.data[0] as unknown[])).toEqual(
        ['Supervisor', 'Submitted', 'Last updated', 'Shifts available', '★ Wants', 'Shifts assigned', 'Note']);
    });

    it('shows submission state, counts and note per supervisor', () => {
      const rows = people.data.slice(1).map(r => rowValues(r as unknown[]));
      expect(rows.map(r => [r[0], r[1], r[3], r[4], r[5], r[6]])).toEqual([
        ['Anna', 'Yes', 3, 1, 2, 'exam Wed'],
        ['Ben', 'Yes', 1, 1, 1, ''],
        ['Carl', 'No', 0, 0, 1, ''],
      ]);
    });

    it('writes "last updated" as local wall-clock time, empty when not submitted', () => {
      const d = new Date('2026-11-18T09:30:00Z');
      const expected = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
      expect((val(cellAt(people.data, 1, 2)) as Date).toISOString()).toBe(expected.toISOString());
      expect(val(cellAt(people.data, 3, 2))).toBe('');
    });
  });

  it('adds a row for an assignee who is not in the supervisor list', () => {
    const withAdmin = [...shifts, { id: 'e', dayOfWeek: 2, startTime: '17:00', endTime: '19:00', claimed: true, supervisorId: 'adm', supervisorName: 'Admin Ada' }];
    const [g, , m, p] = buildScheduleSheets({ ...input, shiftBlocks: withAdmin });
    expect(rowValues(g.data[2] as unknown[])[5]).toBe('17:00–19:00\nAdmin Ada'); // Wednesday column
    const adaRow = rowValues(m.data[m.data.length - 2] as unknown[]);
    expect(adaRow.slice(0, 4)).toEqual(['Admin Ada', 'no answer', 0, 1]);
    expect(adaRow[adaRow.length - 1]).toBe('■'); // Wed is last in period order here
    expect(rowValues(m.data[m.data.length - 1] as unknown[]).slice(4)).toEqual([0, 1, 0, 1, 2, 0]);
    expect(rowValues(p.data[p.data.length - 1] as unknown[]).slice(0, 2)).toEqual(['Admin Ada', 'No']);
  });

  it('handles an empty week (no shifts, no supervisors)', () => {
    const sheets = buildScheduleSheets({ weekStart: WEEK, shiftBlocks: [], availabilities: [], supervisors: [] });
    expect(sheets.map(s => s.sheet)).toEqual(['Plan', 'Shift list', 'Availability', 'Supervisors']);
    const [g, , m, p] = sheets;
    expect(rowValues(g.data[1] as unknown[])[0]).toBe('Friday 20.11.');
    expect(val(cellAt(g.data, g.data.length - 1, 0))).toBe('0 of 0 shifts covered');
    expect(rowValues(m.data[1] as unknown[])).toEqual(['Supervisor', 'Available', '★ Wants', 'Assigned']);
    expect(p.data).toHaveLength(1);
  });

  it('uses the dates of the given period for a period at the end of the year', () => {
    const [g] = buildScheduleSheets({ weekStart: '2026-12-25', shiftBlocks: [], availabilities: [], supervisors: [] });
    expect(rowValues(g.data[1] as unknown[])).toEqual([
      'Friday 25.12.', 'Saturday 26.12.', 'Sunday 27.12.', 'Monday 28.12.', 'Tuesday 29.12.', 'Wednesday 30.12.', 'Thursday 31.12.',
    ]);
  });
});

describe('xlsx output', () => {
  it('produces a valid workbook containing names and marks', async () => {
    const blob = await writeExcelFile(buildScheduleSheets(input)).toBlob();
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const names = Object.keys(files);
    expect(names).toContain('xl/workbook.xml');
    const workbook = strFromU8(files['xl/workbook.xml']);
    for (const s of ['Plan', 'Shift list', 'Availability', 'Supervisors']) expect(workbook).toContain(`name="${s}"`);
    expect(names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))).toHaveLength(4);
    const strings = names.filter(n => n.startsWith('xl/')).map(n => strFromU8(files[n])).join('\n');
    for (const t of [
      'Anna', 'Ben', 'Carl', 'Friday 20.11.', 'Thursday 26.11.', '— open —', 'Covered – not available',
      '★', '✓', '✗ (n/a)', '■', 'no answer', 'Available per shift', 'exam Wed',
    ]) expect(strings).toContain(t);
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

  it('file name contains the period start (Friday)', () => {
    expect(scheduleFileName(WEEK)).toBe('StuSta-Gym_Shiftplan_2026-11-20.xlsx');
  });
});
