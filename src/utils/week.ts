import { localISODate } from './date';

// Shifts are planned in periods Friday–Thursday: on Thursday the admin assigns the
// period that starts the next day. Availability for it is due Wednesday evening.
// A "week" (weekStart) in this app is always such a period and starts on a Friday.

// Local-time date helpers; toISOString() would shift dates across midnight in CET.
export const toDateKey = localISODate;

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 0 = Monday … 6 = Sunday (the app's dayOfWeek) */
export const dayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const PERIOD_START_DAY = 4; // Friday (0 = Monday)
export const PLANNING_DAY = 3;     // Thursday: the day the next period is assigned

/** Position of a weekday within a Friday–Thursday period: Fri = 0 … Thu = 6 */
export const periodOffset = (dayOfWeek: number) => (dayOfWeek - PERIOD_START_DAY + 7) % 7;

/** Weekdays (0 = Monday) in the order they occur in a period: Fri, Sat, Sun, Mon, Tue, Wed, Thu */
export const PERIOD_DAYS = [0, 1, 2, 3, 4, 5, 6].map(i => (i + PERIOD_START_DAY) % 7);

/** Sort shift blocks by their position in the period, then by start time */
export function comparePeriodOrder(
  a: { dayOfWeek: number; startTime: string },
  b: { dayOfWeek: number; startTime: string },
): number {
  return periodOffset(a.dayOfWeek) - periodOffset(b.dayOfWeek) || a.startTime.localeCompare(b.startTime);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/** The Friday starting the period that contains `date` */
export function getWeekStart(date: Date = new Date()): string {
  return toDateKey(addDays(date, -periodOffset(dayIndex(date))));
}

export function addWeeks(weekStart: string, n: number): string {
  return toDateKey(addDays(parseDateKey(weekStart), n * 7));
}

export function getNextWeekStart(date: Date = new Date()): string {
  return addWeeks(getWeekStart(date), 1);
}

/** The date on which the block with `dayOfWeek` (0 = Monday) falls in the period `weekStart` */
export function dateOfWeekDay(weekStart: string, dayOfWeek: number): Date {
  return addDays(parseDateKey(weekStart), periodOffset(dayOfWeek));
}

const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

export function formatShortDate(d: Date): string {
  return fmt(d);
}

export function formatWeekRange(weekStart: string): string {
  const start = parseDateKey(weekStart);
  return `${fmt(start)} – ${fmt(addDays(start, 6))}`;
}

/** Mon–Wed: the days on which supervisors get reminded to enter the next period. */
export function isReminderWindow(now: Date = new Date()): boolean {
  return dayIndex(now) < PLANNING_DAY;
}

/** The period supervisors should be entering now: always the next one. */
export function defaultAvailabilityWeek(now: Date = new Date()): string {
  return getNextWeekStart(now);
}

/** Last moment to enter availability for `weekStart`: the Wednesday before it, 23:59:59. */
export function availabilityDeadline(weekStart: string): Date {
  const d = addDays(parseDateKey(weekStart), -2);
  d.setHours(23, 59, 59, 999);
  return d;
}
