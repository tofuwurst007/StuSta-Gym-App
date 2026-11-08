import { localISODate } from './date';

// Local-time date helpers; toISOString() would shift dates across midnight in CET.
export const toDateKey = localISODate;

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateKey(d);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = parseDateKey(weekStart);
  d.setDate(d.getDate() + n * 7);
  return toDateKey(d);
}

export function getNextWeekStart(date: Date = new Date()): string {
  return addWeeks(getWeekStart(date), 1);
}

export function dateOfWeekDay(weekStart: string, dayOfWeek: number): Date {
  const d = parseDateKey(weekStart);
  d.setDate(d.getDate() + dayOfWeek);
  return d;
}

const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

export function formatShortDate(d: Date): string {
  return fmt(d);
}

export function formatWeekRange(weekStart: string): string {
  return `${fmt(dateOfWeekDay(weekStart, 0))} – ${fmt(dateOfWeekDay(weekStart, 6))}`;
}

// From Thursday on, supervisors should have submitted next week's availability.
export function isAvailabilityDue(date: Date = new Date()): boolean {
  return (date.getDay() + 6) % 7 >= 3;
}
