import { describe, it, expect } from 'vitest';
import { assignmentWindow, blocksForWeek, blocksOnDate, planCopyFromPreviousWeek, ASSIGNMENT_WEEKS_AHEAD, ASSIGNMENT_WEEKS_BACK } from './assignments';
import { parseDateKey } from './week';
import type { ShiftAssignment, ShiftBlock } from '../types';

// weekStarts are Fridays (periods run Fri–Thu): 13 Nov, 20 Nov, 27 Nov, 4 Dec 2026
const blocks: ShiftBlock[] = [
  { id: 'a', dayOfWeek: 0, startTime: '06:00', endTime: '08:00', claimed: false },
  { id: 'b', dayOfWeek: 5, startTime: '09:00', endTime: '11:00', claimed: false },
];
const asg: ShiftAssignment[] = [
  { shiftBlockId: 'a', weekStart: '2026-11-13', supervisorId: 'u1', supervisorName: 'Anna' },
  { shiftBlockId: 'b', weekStart: '2026-11-13', supervisorId: 'u2', supervisorName: 'Ben' },
  { shiftBlockId: 'b', weekStart: '2026-11-20', supervisorId: 'u1', supervisorName: 'Anna' },
  { shiftBlockId: 'a', weekStart: '2026-11-27' },   // member view: covered, no name
];

describe('blocksForWeek', () => {
  it('annotates each block with that period\'s assignee only', () => {
    expect(blocksForWeek(blocks, asg, '2026-11-13').map(b => [b.id, b.claimed, b.supervisorName])).toEqual([['a', true, 'Anna'], ['b', true, 'Ben']]);
    expect(blocksForWeek(blocks, asg, '2026-11-20').map(b => [b.id, b.claimed, b.supervisorName])).toEqual([['a', false, undefined], ['b', true, 'Anna']]);
    expect(blocksForWeek(blocks, asg, '2026-12-04').every(b => !b.claimed)).toBe(true);
  });

  it('marks covered blocks without names (member view)', () => {
    const w = blocksForWeek(blocks, asg, '2026-11-27');
    expect([w[0].claimed, w[0].supervisorId]).toEqual([true, undefined]);
  });

  it('ignores claimed flags baked into the block template', () => {
    const stale = [{ ...blocks[0], claimed: true, supervisorId: 'x', supervisorName: 'X' }];
    expect(blocksForWeek(stale, [], '2026-11-13')[0]).toMatchObject({ claimed: false, supervisorId: undefined });
  });
});

describe('blocksOnDate', () => {
  const tmpl: ShiftBlock[] = [
    { id: 'mon-late', dayOfWeek: 0, startTime: '17:00', endTime: '19:00', claimed: false },
    { id: 'fri', dayOfWeek: 4, startTime: '17:00', endTime: '19:00', claimed: false },
    { id: 'mon-early', dayOfWeek: 0, startTime: '06:00', endTime: '08:00', claimed: false },
    { id: 'thu', dayOfWeek: 3, startTime: '06:00', endTime: '08:00', claimed: false },
  ];
  const a: ShiftAssignment[] = [
    // period Fri 20 Nov – Thu 26 Nov
    { shiftBlockId: 'fri', weekStart: '2026-11-20', supervisorId: 'u1', supervisorName: 'Anna' },
    { shiftBlockId: 'mon-early', weekStart: '2026-11-20', supervisorId: 'u2', supervisorName: 'Ben' },
    { shiftBlockId: 'thu', weekStart: '2026-11-20', supervisorId: 'u3', supervisorName: 'Carl' },
    // period Fri 27 Nov – Thu 3 Dec
    { shiftBlockId: 'fri', weekStart: '2026-11-27', supervisorId: 'u2', supervisorName: 'Ben' },
    { shiftBlockId: 'mon-late', weekStart: '2026-11-27', supervisorId: 'u3', supervisorName: 'Carl' },
  ];
  const view = (d: Date) => blocksOnDate(tmpl, a, d).map(b => [b.id, b.supervisorName ?? null]);

  it('a Monday uses the period that started the Friday before', () => {
    // Mon 23 Nov 2026 belongs to the period of Fri 20 Nov
    expect(view(new Date(2026, 10, 23))).toEqual([['mon-early', 'Ben'], ['mon-late', null]]);
    // Mon 30 Nov 2026 belongs to the period of Fri 27 Nov
    expect(view(new Date(2026, 10, 30, 22, 0))).toEqual([['mon-early', null], ['mon-late', 'Carl']]);
  });

  it('a Friday starts a new period', () => {
    expect(view(new Date(2026, 10, 20))).toEqual([['fri', 'Anna']]);
    expect(view(new Date(2026, 10, 27))).toEqual([['fri', 'Ben']]);
    expect(view(new Date(2026, 11, 4))).toEqual([['fri', null]]);
  });

  it('a Thursday still belongs to the period that started 6 days earlier', () => {
    expect(view(new Date(2026, 10, 26, 23, 59))).toEqual([['thu', 'Carl']]);
    expect(view(new Date(2026, 11, 3))).toEqual([['thu', null]]);
  });

  it('returns only blocks of that weekday, sorted by start time, with claimed flags', () => {
    const r = blocksOnDate(tmpl, a, new Date(2026, 10, 23));
    expect(r.map(b => b.dayOfWeek)).toEqual([0, 0]);
    expect(r.map(b => b.claimed)).toEqual([true, false]);
    expect(blocksOnDate(tmpl, a, new Date(2026, 10, 24))).toEqual([]); // no Tuesday blocks
  });
});

describe('planCopyFromPreviousWeek', () => {
  it('proposes last period\'s assignees only for blocks still open', () => {
    expect(planCopyFromPreviousWeek(blocks, asg, '2026-11-20')).toEqual([{ shiftId: 'a', supervisorId: 'u1', supervisorName: 'Anna' }]);
  });

  it('proposes nothing when last period was empty', () => {
    expect(planCopyFromPreviousWeek(blocks, asg, '2026-11-13')).toEqual([]);
  });
});

describe('assignmentWindow', () => {
  it('spans 4 periods back to 8 periods ahead, on Fridays', () => {
    expect([ASSIGNMENT_WEEKS_BACK, ASSIGNMENT_WEEKS_AHEAD]).toEqual([4, 8]);
    // Thu 19 Nov 2026 is in the period of Fri 13 Nov
    expect(assignmentWindow(new Date(2026, 10, 19, 12))).toEqual({ from: '2026-10-16', to: '2027-01-08' });
    // Fri 20 Nov 2026 starts a new period
    expect(assignmentWindow(new Date(2026, 10, 20, 0, 0))).toEqual({ from: '2026-10-23', to: '2027-01-15' });
  });

  it('both ends are Fridays', () => {
    for (let i = 0; i < 14; i++) {
      const { from, to } = assignmentWindow(new Date(2026, 10, 16 + i, 12));
      expect(parseDateKey(from).getDay()).toBe(5);
      expect(parseDateKey(to).getDay()).toBe(5);
    }
  });
});
