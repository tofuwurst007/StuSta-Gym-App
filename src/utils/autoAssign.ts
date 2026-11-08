import type { Availability, ShiftBlock } from '../types';

export interface ProposedAssignment {
  shiftId: string;
  supervisorId: string;
  supervisorName: string;
  replacesName?: string;
}

// Fills open shifts (and shifts whose assignee explicitly marked themselves unavailable)
// hardest-first, giving each shift to the available supervisor with the fewest shifts.
export function planAutoAssign(shifts: ShiftBlock[], availabilities: Availability[]): ProposedAssignment[] {
  const availableFor = new Map<string, Availability[]>();
  for (const s of shifts) {
    availableFor.set(s.id, availabilities.filter(a => a.shiftBlockIds.includes(s.id)));
  }
  const submitted = new Set(availabilities.map(a => a.supervisorId));

  const load = new Map<string, number>();
  const needsAssignment: ShiftBlock[] = [];
  for (const s of shifts) {
    const assigneeUnavailable = !!s.supervisorId && submitted.has(s.supervisorId)
      && !availableFor.get(s.id)!.some(a => a.supervisorId === s.supervisorId);
    if (!s.supervisorId || assigneeUnavailable) needsAssignment.push(s);
    else load.set(s.supervisorId!, (load.get(s.supervisorId!) ?? 0) + 1);
  }

  needsAssignment.sort((a, b) =>
    availableFor.get(a.id)!.length - availableFor.get(b.id)!.length
    || a.dayOfWeek - b.dayOfWeek
    || a.startTime.localeCompare(b.startTime));

  const result: ProposedAssignment[] = [];
  for (const s of needsAssignment) {
    const candidates = availableFor.get(s.id)!;
    if (candidates.length === 0) continue;
    const pick = [...candidates].sort((a, b) =>
      (load.get(a.supervisorId) ?? 0) - (load.get(b.supervisorId) ?? 0)
      || a.supervisorName.localeCompare(b.supervisorName))[0];
    load.set(pick.supervisorId, (load.get(pick.supervisorId) ?? 0) + 1);
    result.push({
      shiftId: s.id,
      supervisorId: pick.supervisorId,
      supervisorName: pick.supervisorName,
      replacesName: s.supervisorName,
    });
  }
  return result;
}
