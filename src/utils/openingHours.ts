import type { ShiftBlock, SpontaneousOpening } from '../types';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function getOpeningHoursForDay(
  dayOfWeek: number,
  shiftBlocks: ShiftBlock[],
  spontaneousOpenings: SpontaneousOpening[],
  date?: string,
): { start: string; end: string; source: 'shift' | 'spontaneous'; label: string }[] {
  const slots: { start: string; end: string; source: 'shift' | 'spontaneous'; label: string }[] = [];

  // Claimed shifts for this day
  shiftBlocks
    .filter(s => s.dayOfWeek === dayOfWeek && s.supervisorId)
    .forEach(s => {
      slots.push({ start: s.startTime, end: s.endTime, source: 'shift', label: s.supervisorName ?? '' });
    });

  // Spontaneous openings for a specific date
  if (date) {
    spontaneousOpenings
      .filter(sp => sp.date === date)
      .forEach(sp => {
        slots.push({ start: sp.startTime, end: sp.endTime, source: 'spontaneous', label: sp.supervisorName });
      });
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

export function isGymOpenNow(shiftBlocks: ShiftBlock[], spontaneousOpenings: SpontaneousOpening[]): boolean {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // convert Sun=0 to Mon=0
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toISOString().split('T')[0];

  const slots = getOpeningHoursForDay(dayOfWeek, shiftBlocks, spontaneousOpenings, today);
  return slots.some(s => s.start <= timeStr && timeStr < s.end);
}

export function getTodayOpeningHours(shiftBlocks: ShiftBlock[], spontaneousOpenings: SpontaneousOpening[]) {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const today = now.toISOString().split('T')[0];
  return getOpeningHoursForDay(dayOfWeek, shiftBlocks, spontaneousOpenings, today);
}
