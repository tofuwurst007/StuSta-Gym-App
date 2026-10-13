import type { ShiftBlock, SpontaneousOpening } from '../types';
import { localISODate } from './date';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type OpeningSlot = { start: string; end: string; source: 'shift' | 'spontaneous'; label: string };

export function getOpeningHoursForDay(
  dayOfWeek: number,
  shiftBlocks: ShiftBlock[],
  spontaneousOpenings: SpontaneousOpening[],
  date?: string,
): OpeningSlot[] {
  const slots: OpeningSlot[] = [];

  // Claimed shifts for this day (label = supervisor name, only known to staff)
  shiftBlocks
    .filter(s => s.dayOfWeek === dayOfWeek && s.claimed)
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

/** Current local time as HH:mm */
export function nowHHMM(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function getTodayOpeningHours(shiftBlocks: ShiftBlock[], spontaneousOpenings: SpontaneousOpening[]) {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // convert Sun=0 to Mon=0
  return getOpeningHoursForDay(dayOfWeek, shiftBlocks, spontaneousOpenings, localISODate(now));
}

export function isGymOpenNow(shiftBlocks: ShiftBlock[], spontaneousOpenings: SpontaneousOpening[]): boolean {
  const timeStr = nowHHMM();
  return getTodayOpeningHours(shiftBlocks, spontaneousOpenings).some(s => s.start <= timeStr && timeStr < s.end);
}
