import { describe, it, expect } from 'vitest';
import {
  toDateKey, parseDateKey, getWeekStart, addWeeks, getNextWeekStart,
  dateOfWeekDay, formatShortDate, formatWeekRange, isAvailabilityDue,
} from './week';

// Iterate local calendar days (constructed via Y/M/D, so DST never skips a day).
function* days(fromY: number, fromM: number, fromD: number, count: number) {
  for (let i = 0; i < count; i++) yield new Date(fromY, fromM, fromD + i);
}

describe('toDateKey / parseDateKey', () => {
  it('formats with zero padding', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('uses local date, not UTC (late evening does not roll over)', () => {
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(toDateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('parseDateKey returns local midnight', () => {
    const d = parseDateKey('2026-03-29');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 29, 0, 0]);
  });

  it('round-trips every day from 2024 to 2028 (incl. leap days and DST)', () => {
    for (const d of days(2024, 0, 1, 365 * 5 + 1)) {
      const key = toDateKey(d);
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
    expect(toDateKey(parseDateKey('2028-02-29'))).toBe('2028-02-29');
  });
});

describe('getWeekStart', () => {
  it('returns the same day for a Monday', () => {
    expect(getWeekStart(new Date(2026, 10, 9))).toBe('2026-11-09');
  });

  it('maps every weekday of a week to that Monday', () => {
    for (let i = 0; i < 7; i++) expect(getWeekStart(new Date(2026, 10, 9 + i))).toBe('2026-11-09');
  });

  it('maps Sunday to the PREVIOUS Monday', () => {
    expect(getWeekStart(new Date(2026, 10, 15))).toBe('2026-11-09');
    expect(getWeekStart(new Date(2026, 10, 15, 23, 59, 59))).toBe('2026-11-09');
  });

  it('handles month boundaries', () => {
    expect(getWeekStart(new Date(2026, 2, 1))).toBe('2026-02-23'); // Sun 1 Mar
    expect(getWeekStart(new Date(2026, 5, 3))).toBe('2026-06-01');
    expect(getWeekStart(new Date(2026, 6, 2))).toBe('2026-06-29'); // Thu 2 Jul
  });

  it('handles year boundaries', () => {
    expect(getWeekStart(new Date(2026, 0, 1))).toBe('2025-12-29');  // Thu
    expect(getWeekStart(new Date(2027, 0, 3))).toBe('2026-12-28');  // Sun
    expect(getWeekStart(new Date(2025, 11, 31, 23, 30))).toBe('2025-12-29');
  });

  it('handles leap years', () => {
    expect(getWeekStart(new Date(2028, 1, 29))).toBe('2028-02-28'); // Tue 29 Feb 2028
    expect(getWeekStart(new Date(2028, 2, 5))).toBe('2028-02-28');  // Sun 5 Mar 2028
  });

  it('handles DST transition Sundays (Europe/Berlin)', () => {
    // Spring forward: Sun 2026-03-29, 02:00 -> 03:00
    for (const h of [0, 1, 3, 12, 23]) expect(getWeekStart(new Date(2026, 2, 29, h, 30))).toBe('2026-03-23');
    expect(getWeekStart(new Date(2026, 2, 30, 0, 0))).toBe('2026-03-30');
    // Fall back: Sun 2026-10-25, 03:00 -> 02:00
    for (const h of [0, 1, 2, 3, 12, 23]) expect(getWeekStart(new Date(2026, 9, 25, h, 30))).toBe('2026-10-19');
    expect(getWeekStart(new Date(2026, 9, 26, 0, 0))).toBe('2026-10-26');
  });

  it('always returns a Monday at most 6 days before the date (2024–2028, several times of day)', () => {
    for (const day of days(2024, 0, 1, 365 * 5 + 1)) {
      for (const h of [0, 2, 12, 23]) {
        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 59);
        const ws = parseDateKey(getWeekStart(d));
        expect(ws.getDay()).toBe(1);
        const diffDays = Math.round((parseDateKey(toDateKey(d)).getTime() - ws.getTime()) / 86_400_000);
        expect(diffDays).toBeGreaterThanOrEqual(0);
        expect(diffDays).toBeLessThanOrEqual(6);
        expect(diffDays).toBe((d.getDay() + 6) % 7);
      }
    }
  });
});

describe('addWeeks / getNextWeekStart', () => {
  it('adds and subtracts weeks', () => {
    expect(addWeeks('2026-11-09', 1)).toBe('2026-11-16');
    expect(addWeeks('2026-11-09', -1)).toBe('2026-11-02');
    expect(addWeeks('2026-11-09', 0)).toBe('2026-11-09');
    expect(addWeeks('2026-11-09', 8)).toBe('2027-01-04');
  });

  it('crosses month/year/leap boundaries', () => {
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04');
    expect(addWeeks('2027-01-04', -1)).toBe('2026-12-28');
    expect(addWeeks('2024-02-26', 1)).toBe('2024-03-04');
    expect(addWeeks('2028-02-28', 1)).toBe('2028-03-06');
  });

  it('is not shifted by DST transitions', () => {
    expect(addWeeks('2026-03-23', 1)).toBe('2026-03-30');
    expect(addWeeks('2026-03-30', -1)).toBe('2026-03-23');
    expect(addWeeks('2026-10-19', 1)).toBe('2026-10-26');
    expect(addWeeks('2026-10-26', -1)).toBe('2026-10-19');
    expect(addWeeks('2026-01-05', 52)).toBe('2027-01-04');
  });

  it('stepping week by week through several years stays on Mondays', () => {
    let ws = '2023-12-25';
    for (let i = 0; i < 52 * 5; i++) {
      const next = addWeeks(ws, 1);
      expect(parseDateKey(next).getDay()).toBe(1);
      expect(addWeeks(next, -1)).toBe(ws);
      ws = next;
    }
  });

  it('getNextWeekStart returns next Monday, also from Sunday', () => {
    expect(getNextWeekStart(new Date(2026, 10, 9))).toBe('2026-11-16');  // Mon
    expect(getNextWeekStart(new Date(2026, 10, 12))).toBe('2026-11-16'); // Thu
    expect(getNextWeekStart(new Date(2026, 10, 15, 23))).toBe('2026-11-16'); // Sun
    expect(getNextWeekStart(new Date(2026, 2, 29, 12))).toBe('2026-03-30'); // DST Sun
    expect(getNextWeekStart(new Date(2026, 9, 25, 12))).toBe('2026-10-26'); // DST Sun
    expect(getNextWeekStart(new Date(2026, 11, 31))).toBe('2027-01-04');
  });
});

describe('dateOfWeekDay', () => {
  it('returns local midnight of the given day offset', () => {
    const d = dateOfWeekDay('2026-11-09', 6);
    expect(toDateKey(d)).toBe('2026-11-15');
    expect(d.getHours()).toBe(0);
    expect(d.getDay()).toBe(0);
  });

  it('works across DST and year boundary', () => {
    expect(toDateKey(dateOfWeekDay('2026-03-23', 6))).toBe('2026-03-29');
    expect(toDateKey(dateOfWeekDay('2026-03-23', 7))).toBe('2026-03-30');
    expect(dateOfWeekDay('2026-03-23', 6).getHours()).toBe(0);
    expect(toDateKey(dateOfWeekDay('2026-10-19', 6))).toBe('2026-10-25');
    expect(dateOfWeekDay('2026-10-19', 6).getHours()).toBe(0);
    expect(toDateKey(dateOfWeekDay('2026-12-28', 4))).toBe('2027-01-01');
  });

  it('dayOfWeek 0..6 maps to Mon..Sun', () => {
    for (let i = 0; i < 7; i++) expect((dateOfWeekDay('2026-11-09', i).getDay() + 6) % 7).toBe(i);
  });
});

describe('formatShortDate / formatWeekRange', () => {
  it('formats DD.MM.', () => {
    expect(formatShortDate(new Date(2026, 0, 5))).toBe('05.01.');
    expect(formatShortDate(new Date(2026, 11, 31, 23, 59))).toBe('31.12.');
  });

  it('formats the Monday–Sunday range', () => {
    expect(formatWeekRange('2026-11-09')).toBe('09.11. – 15.11.');
    expect(formatWeekRange('2026-12-28')).toBe('28.12. – 03.01.');
    expect(formatWeekRange('2026-03-23')).toBe('23.03. – 29.03.');
    expect(formatWeekRange('2026-10-19')).toBe('19.10. – 25.10.');
    expect(formatWeekRange('2028-02-28')).toBe('28.02. – 05.03.');
  });
});

describe('isAvailabilityDue', () => {
  it('is false Mon–Wed and true Thu–Sun', () => {
    const expected = [false, false, false, true, true, true, true]; // Mon 9 Nov .. Sun 15 Nov 2026
    expected.forEach((exp, i) => expect(isAvailabilityDue(new Date(2026, 10, 9 + i, 12))).toBe(exp));
  });

  it('switches exactly at local midnight Wed->Thu and Sun->Mon', () => {
    expect(isAvailabilityDue(new Date(2026, 10, 11, 23, 59, 59))).toBe(false);
    expect(isAvailabilityDue(new Date(2026, 10, 12, 0, 0, 0))).toBe(true);
    expect(isAvailabilityDue(new Date(2026, 10, 15, 23, 59, 59))).toBe(true);
    expect(isAvailabilityDue(new Date(2026, 10, 16, 0, 0, 0))).toBe(false);
  });

  it('is true on DST transition Sundays', () => {
    expect(isAvailabilityDue(new Date(2026, 2, 29, 3, 30))).toBe(true);
    expect(isAvailabilityDue(new Date(2026, 9, 25, 2, 30))).toBe(true);
  });
});
