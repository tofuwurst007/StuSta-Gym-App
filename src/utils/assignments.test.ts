import { describe, it, expect } from 'vitest';
import { assignmentWindow, blocksForWeek, planCopyFromPreviousWeek } from './assignments';
import type { ShiftAssignment, ShiftBlock } from '../types';

const blocks: ShiftBlock[] = [
  { id: 'a', dayOfWeek: 0, startTime: '06:00', endTime: '08:00', claimed: false },
  { id: 'b', dayOfWeek: 5, startTime: '09:00', endTime: '11:00', claimed: false },
];
const asg: ShiftAssignment[] = [
  { shiftBlockId: 'a', weekStart: '2026-11-16', supervisorId: 'u1', supervisorName: 'Anna' },
  { shiftBlockId: 'b', weekStart: '2026-11-16', supervisorId: 'u2', supervisorName: 'Ben' },
  { shiftBlockId: 'b', weekStart: '2026-11-23', supervisorId: 'u1', supervisorName: 'Anna' },
  { shiftBlockId: 'a', weekStart: '2026-11-30' },   // member view: covered, no name
];

describe('blocksForWeek', () => {
  it('annotates each block with that week\'s assignee only', () => {
    expect(blocksForWeek(blocks, asg, '2026-11-16').map(b => [b.id, b.claimed, b.supervisorName])).toEqual([['a', true, 'Anna'], ['b', true, 'Ben']]);
    expect(blocksForWeek(blocks, asg, '2026-11-23').map(b => [b.id, b.claimed, b.supervisorName])).toEqual([['a', false, undefined], ['b', true, 'Anna']]);
    expect(blocksForWeek(blocks, asg, '2026-12-07').every(b => !b.claimed)).toBe(true);
  });

  it('marks covered blocks without names (member view)', () => {
    const w = blocksForWeek(blocks, asg, '2026-11-30');
    expect([w[0].claimed, w[0].supervisorId]).toEqual([true, undefined]);
  });

  it('ignores claimed flags baked into the block template', () => {
    const stale = [{ ...blocks[0], claimed: true, supervisorId: 'x', supervisorName: 'X' }];
    expect(blocksForWeek(stale, [], '2026-11-16')[0]).toMatchObject({ claimed: false, supervisorId: undefined });
  });
});

describe('planCopyFromPreviousWeek', () => {
  it('proposes last week\'s assignees only for blocks still open', () => {
    expect(planCopyFromPreviousWeek(blocks, asg, '2026-11-23')).toEqual([{ shiftId: 'a', supervisorId: 'u1', supervisorName: 'Anna' }]);
  });

  it('proposes nothing when last week was empty', () => {
    expect(planCopyFromPreviousWeek(blocks, asg, '2026-11-16')).toEqual([]);
  });
});

describe('assignmentWindow', () => {
  it('spans 4 weeks back to 8 weeks ahead, Mondays', () => {
    expect(assignmentWindow(new Date(2026, 10, 19, 12))).toEqual({ from: '2026-10-19', to: '2027-01-11' });
  });
});
