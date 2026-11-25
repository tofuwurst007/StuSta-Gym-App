import type { ShiftAssignment, ShiftBlock } from '../types';
import { addWeeks, dayIndex, getWeekStart } from './week';

// Weeks loaded from the server, relative to the current week
export const ASSIGNMENT_WEEKS_BACK = 4;
export const ASSIGNMENT_WEEKS_AHEAD = 8;

export function assignmentWindow(now: Date = new Date()): { from: string; to: string } {
  const current = getWeekStart(now);
  return { from: addWeeks(current, -ASSIGNMENT_WEEKS_BACK), to: addWeeks(current, ASSIGNMENT_WEEKS_AHEAD) };
}

/** The shift blocks as they look in one week: who (if anyone) covers each block. */
export function blocksForWeek(blocks: ShiftBlock[], assignments: ShiftAssignment[], weekStart: string): ShiftBlock[] {
  const byBlock = new Map<string, ShiftAssignment>();
  for (const a of assignments) if (a.weekStart === weekStart) byBlock.set(a.shiftBlockId, a);
  return blocks.map(b => {
    const a = byBlock.get(b.id);
    return { ...b, claimed: !!a, supervisorId: a?.supervisorId, supervisorName: a?.supervisorName };
  });
}

/** The blocks of one calendar date, with the coverage of the period that date belongs to. */
export function blocksOnDate(blocks: ShiftBlock[], assignments: ShiftAssignment[], date: Date): ShiftBlock[] {
  const dow = dayIndex(date);
  return blocksForWeek(blocks.filter(b => b.dayOfWeek === dow), assignments, getWeekStart(date))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Proposals to repeat last week's plan in `weekStart`: only for blocks that are still open there. */
export function planCopyFromPreviousWeek(blocks: ShiftBlock[], assignments: ShiftAssignment[], weekStart: string) {
  const prev = blocksForWeek(blocks, assignments, addWeeks(weekStart, -1));
  const cur = new Map(blocksForWeek(blocks, assignments, weekStart).map(b => [b.id, b]));
  return prev
    .filter(p => p.supervisorId && !cur.get(p.id)?.claimed)
    .map(p => ({ shiftId: p.id, supervisorId: p.supervisorId!, supervisorName: p.supervisorName ?? '' }));
}
