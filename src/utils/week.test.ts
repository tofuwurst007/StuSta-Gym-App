import { describe, it, expect } from 'vitest';
import {
  toDateKey, parseDateKey, getWeekStart, addWeeks, getNextWeekStart, dayIndex, periodOffset,
  PERIOD_DAYS, PERIOD_START_DAY, comparePeriodOrder,
  dateOfWeekDay, formatShortDate, formatWeekRange, isReminderWindow, defaultAvailabilityWeek, availabilityDeadline,
} from './week';

// Periods run Friday–Thursday; a weekStart is always the Friday a period starts on.
// dayOfWeek of a shift block stays 0 = Monday … 6 = Sunday.

// Iterate local calendar days (constructed via Y/M/D, so DST never skips a day).
function* days(fromY: number, fromM: number, fromD: number, count: number) {
  for (let i = 0; i < count; i++) yield new Date(fromY, fromM, fromD + i);
}
const ALL_DAYS_2024_2028 = () => days(2024, 0, 1, 365 * 5 + 2); // 2024-01-01 .. 2028-12-31
const FRIDAY = 5; // Date.getDay()
const dayDiff = (later: Date, earlier: Date) =>
  Math.round((parseDateKey(toDateKey(later)).getTime() - parseDateKey(toDateKey(earlier)).getTime()) / 86_400_000);

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
    for (const d of ALL_DAYS_2024_2028()) {
      const key = toDateKey(d);
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
    expect(toDateKey(parseDateKey('2028-02-29'))).toBe('2028-02-29');
  });
});

describe('period constants', () => {
  it('periods start on Friday (0 = Monday)', () => {
    expect(PERIOD_START_DAY).toBe(4);
  });

  it('PERIOD_DAYS lists the weekdays in period order Fri, Sat, Sun, Mon, Tue, Wed, Thu', () => {
    expect(PERIOD_DAYS).toEqual([4, 5, 6, 0, 1, 2, 3]);
  });

  it('periodOffset is the position within the period (Fri = 0 … Thu = 6)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(periodOffset)).toEqual([3, 4, 5, 6, 0, 1, 2]);
    PERIOD_DAYS.forEach((dow, i) => expect(periodOffset(dow)).toBe(i));
  });

  it('dayIndex maps Date to 0 = Monday … 6 = Sunday', () => {
    // Mon 23 Nov 2026 .. Sun 29 Nov 2026
    for (let i = 0; i < 7; i++) expect(dayIndex(new Date(2026, 10, 23 + i))).toBe(i);
  });
});

describe('comparePeriodOrder', () => {
  const b = (dayOfWeek: number, startTime: string) => ({ dayOfWeek, startTime });

  it('orders Friday first and Thursday last', () => {
    expect(comparePeriodOrder(b(4, '23:00'), b(3, '06:00'))).toBeLessThan(0); // Fri before Thu
    expect(comparePeriodOrder(b(0, '06:00'), b(6, '22:00'))).toBeGreaterThan(0); // Mon after Sun
    expect(comparePeriodOrder(b(6, '06:00'), b(5, '06:00'))).toBeGreaterThan(0); // Sun after Sat
  });

  it('orders by start time within a day and returns 0 for equal slots', () => {
    expect(comparePeriodOrder(b(1, '06:00'), b(1, '17:00'))).toBeLessThan(0);
    expect(comparePeriodOrder(b(1, '17:00'), b(1, '06:00'))).toBeGreaterThan(0);
    expect(comparePeriodOrder(b(1, '06:00'), b(1, '06:00'))).toBe(0);
  });

  it('sorts a whole week template into period order', () => {
    const blocks = [b(0, '17:00'), b(3, '06:00'), b(4, '17:00'), b(6, '09:00'), b(0, '06:00'), b(4, '06:00'), b(5, '12:00'), b(2, '06:00'), b(1, '06:00')];
    expect([...blocks].sort(comparePeriodOrder).map(x => `${x.dayOfWeek}@${x.startTime}`)).toEqual([
      '4@06:00', '4@17:00', '5@12:00', '6@09:00', '0@06:00', '0@17:00', '1@06:00', '2@06:00', '3@06:00',
    ]);
  });
});

describe('getWeekStart (Friday on/before the date)', () => {
  it('anchors: Wed 25 Nov / Thu 26 Nov 2026 -> Fri 20 Nov, Fri 27 Nov -> itself', () => {
    expect(getWeekStart(new Date(2026, 10, 25))).toBe('2026-11-20');
    expect(getWeekStart(new Date(2026, 10, 26))).toBe('2026-11-20');
    expect(getWeekStart(new Date(2026, 10, 26, 23, 59, 59, 999))).toBe('2026-11-20');
    expect(getWeekStart(new Date(2026, 10, 27))).toBe('2026-11-27');
    expect(getWeekStart(new Date(2026, 10, 27, 0, 0, 0, 0))).toBe('2026-11-27');
  });

  it('maps every day Fri..Thu of a period to that Friday', () => {
    for (let i = 0; i < 7; i++) expect(getWeekStart(new Date(2026, 10, 20 + i, 12))).toBe('2026-11-20');
    expect(getWeekStart(new Date(2026, 10, 19, 12))).toBe('2026-11-13'); // Thu before
    expect(getWeekStart(new Date(2026, 10, 27, 12))).toBe('2026-11-27'); // Fri after
  });

  it('maps Monday–Thursday to the PREVIOUS Friday (not the Monday-based week)', () => {
    expect(getWeekStart(new Date(2026, 10, 23))).toBe('2026-11-20'); // Mon
    expect(getWeekStart(new Date(2026, 10, 24))).toBe('2026-11-20'); // Tue
  });

  it('handles month boundaries', () => {
    expect(getWeekStart(new Date(2026, 2, 1))).toBe('2026-02-27');  // Sun 1 Mar
    expect(getWeekStart(new Date(2026, 6, 2))).toBe('2026-06-26');  // Thu 2 Jul
    expect(getWeekStart(new Date(2026, 9, 30))).toBe('2026-10-30'); // Fri 30 Oct
  });

  it('handles year boundaries', () => {
    expect(getWeekStart(new Date(2026, 0, 1))).toBe('2025-12-26');  // Thu 1 Jan 2026
    expect(getWeekStart(new Date(2025, 11, 31, 23, 30))).toBe('2025-12-26');
    expect(getWeekStart(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-25'); // Thu 31 Dec 2026
    expect(getWeekStart(new Date(2027, 0, 1))).toBe('2027-01-01');  // Fri 1 Jan 2027
    expect(getWeekStart(new Date(2027, 0, 3))).toBe('2027-01-01');  // Sun
  });

  it('handles leap years', () => {
    expect(getWeekStart(new Date(2028, 1, 29))).toBe('2028-02-25'); // Tue 29 Feb 2028
    expect(getWeekStart(new Date(2028, 2, 2))).toBe('2028-02-25');  // Thu 2 Mar 2028
    expect(getWeekStart(new Date(2028, 2, 3))).toBe('2028-03-03');  // Fri 3 Mar 2028
    expect(getWeekStart(new Date(2024, 1, 29))).toBe('2024-02-23'); // Thu 29 Feb 2024
    expect(getWeekStart(new Date(2024, 2, 1))).toBe('2024-03-01');  // Fri 1 Mar 2024
  });

  it('handles DST transition Sundays (Europe/Berlin)', () => {
    // Spring forward: Sun 2026-03-29, 02:00 -> 03:00
    for (const h of [0, 1, 3, 12, 23]) expect(getWeekStart(new Date(2026, 2, 29, h, 30))).toBe('2026-03-27');
    expect(getWeekStart(new Date(2026, 3, 2, 23, 59))).toBe('2026-03-27'); // Thu after
    expect(getWeekStart(new Date(2026, 3, 3, 0, 0))).toBe('2026-04-03');
    // Fall back: Sun 2026-10-25, 03:00 -> 02:00
    for (const h of [0, 1, 2, 3, 12, 23]) expect(getWeekStart(new Date(2026, 9, 25, h, 30))).toBe('2026-10-23');
    expect(getWeekStart(new Date(2026, 9, 29, 23, 59))).toBe('2026-10-23');
    expect(getWeekStart(new Date(2026, 9, 30, 0, 0))).toBe('2026-10-30');
  });

  it('always returns a Friday at most 6 days before the date (2024–2028, several times of day)', () => {
    for (const day of ALL_DAYS_2024_2028()) {
      for (const h of [0, 2, 12, 23]) {
        const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 59);
        const ws = parseDateKey(getWeekStart(d));
        expect(ws.getDay()).toBe(FRIDAY);
        const diff = dayDiff(d, ws);
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(6);
        expect(diff).toBe((d.getDay() + 2) % 7); // Fri 0, Sat 1, …, Thu 6
      }
    }
  });
});

describe('addWeeks / getNextWeekStart', () => {
  it('adds and subtracts periods', () => {
    expect(addWeeks('2026-11-20', 1)).toBe('2026-11-27');
    expect(addWeeks('2026-11-20', -1)).toBe('2026-11-13');
    expect(addWeeks('2026-11-20', 0)).toBe('2026-11-20');
    expect(addWeeks('2026-11-20', 8)).toBe('2027-01-15');
  });

  it('crosses month/year/leap boundaries', () => {
    expect(addWeeks('2026-12-25', 1)).toBe('2027-01-01');
    expect(addWeeks('2027-01-01', -1)).toBe('2026-12-25');
    expect(addWeeks('2024-02-23', 1)).toBe('2024-03-01');
    expect(addWeeks('2028-02-25', 1)).toBe('2028-03-03');
  });

  it('is not shifted by DST transitions', () => {
    expect(addWeeks('2026-03-27', 1)).toBe('2026-04-03');
    expect(addWeeks('2026-04-03', -1)).toBe('2026-03-27');
    expect(addWeeks('2026-10-23', 1)).toBe('2026-10-30');
    expect(addWeeks('2026-10-30', -1)).toBe('2026-10-23');
    expect(addWeeks('2026-01-02', 52)).toBe('2027-01-01');
  });

  it('stepping period by period through several years stays on Fridays', () => {
    let ws = '2023-12-29';
    for (let i = 0; i < 52 * 5; i++) {
      const next = addWeeks(ws, 1);
      expect(parseDateKey(next).getDay()).toBe(FRIDAY);
      expect(addWeeks(next, -1)).toBe(ws);
      ws = next;
    }
  });

  it('getNextWeekStart anchors: Wed 25 / Thu 26 / Fri 27 Nov 2026', () => {
    expect(getNextWeekStart(new Date(2026, 10, 25))).toBe('2026-11-27');
    expect(getNextWeekStart(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-27');
    expect(getNextWeekStart(new Date(2026, 10, 27))).toBe('2026-12-04');
  });

  it('getNextWeekStart across DST and year boundary', () => {
    expect(getNextWeekStart(new Date(2026, 2, 29, 12))).toBe('2026-04-03'); // DST Sun
    expect(getNextWeekStart(new Date(2026, 9, 25, 2, 30))).toBe('2026-10-30'); // DST Sun
    expect(getNextWeekStart(new Date(2026, 11, 31))).toBe('2027-01-01');    // Thu
    expect(getNextWeekStart(new Date(2027, 0, 1))).toBe('2027-01-08');      // Fri
  });

  it('getNextWeekStart is always the Friday 1..7 days after the date (2024–2028)', () => {
    for (const d of ALL_DAYS_2024_2028()) {
      const next = parseDateKey(getNextWeekStart(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)));
      expect(next.getDay()).toBe(FRIDAY);
      const diff = dayDiff(next, d);
      expect(diff).toBeGreaterThanOrEqual(1);
      expect(diff).toBeLessThanOrEqual(7);
    }
  });
});

describe('dateOfWeekDay', () => {
  it('maps dayOfWeek (0 = Monday) to the right date within the period of Fri 20 Nov 2026', () => {
    const expected: Record<number, string> = {
      4: '2026-11-20', 5: '2026-11-21', 6: '2026-11-22',
      0: '2026-11-23', 1: '2026-11-24', 2: '2026-11-25', 3: '2026-11-26',
    };
    for (const [dow, key] of Object.entries(expected)) expect(toDateKey(dateOfWeekDay('2026-11-20', Number(dow)))).toBe(key);
  });

  it('returns local midnight with the matching weekday', () => {
    const d = dateOfWeekDay('2026-11-20', 0);
    expect(toDateKey(d)).toBe('2026-11-23');
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
    expect(d.getDay()).toBe(1); // Monday
    for (let i = 0; i < 7; i++) expect(dayIndex(dateOfWeekDay('2026-11-20', i))).toBe(i);
  });

  it('works across DST, month, year and leap boundaries', () => {
    expect(toDateKey(dateOfWeekDay('2026-03-27', 6))).toBe('2026-03-29'); // DST Sunday
    expect(toDateKey(dateOfWeekDay('2026-03-27', 0))).toBe('2026-03-30');
    expect(dateOfWeekDay('2026-03-27', 0).getHours()).toBe(0);
    expect(toDateKey(dateOfWeekDay('2026-10-23', 6))).toBe('2026-10-25');
    expect(dateOfWeekDay('2026-10-23', 3).getHours()).toBe(0);
    expect(toDateKey(dateOfWeekDay('2026-12-25', 3))).toBe('2026-12-31');
    expect(toDateKey(dateOfWeekDay('2025-12-26', 3))).toBe('2026-01-01');
    expect(toDateKey(dateOfWeekDay('2028-02-25', 1))).toBe('2028-02-29');
    expect(toDateKey(dateOfWeekDay('2028-02-25', 3))).toBe('2028-03-02');
  });

  it('every block date lies inside its period and maps back to the same weekStart (2024–2028)', () => {
    let ws = '2023-12-29';
    for (let i = 0; i < 52 * 5 + 2; i++) {
      for (let dow = 0; dow < 7; dow++) {
        const d = dateOfWeekDay(ws, dow);
        expect(dayIndex(d)).toBe(dow);
        expect(dayDiff(d, parseDateKey(ws))).toBe(periodOffset(dow));
        expect(getWeekStart(d)).toBe(ws);
        expect(d.getHours()).toBe(0);
      }
      ws = addWeeks(ws, 1);
    }
  });
});

describe('formatShortDate / formatWeekRange', () => {
  it('formats DD.MM.', () => {
    expect(formatShortDate(new Date(2026, 0, 5))).toBe('05.01.');
    expect(formatShortDate(new Date(2026, 11, 31, 23, 59))).toBe('31.12.');
  });

  it('formats the Friday–Thursday range', () => {
    expect(formatWeekRange('2026-11-20')).toBe('20.11. – 26.11.');
    expect(formatWeekRange('2026-11-27')).toBe('27.11. – 03.12.');
    expect(formatWeekRange('2025-12-26')).toBe('26.12. – 01.01.');
    expect(formatWeekRange('2026-03-27')).toBe('27.03. – 02.04.');
    expect(formatWeekRange('2026-10-23')).toBe('23.10. – 29.10.');
    expect(formatWeekRange('2028-02-25')).toBe('25.02. – 02.03.');
    expect(formatWeekRange('2024-02-23')).toBe('23.02. – 29.02.');
  });

  it('range end is always the Thursday 6 days later (2024–2028)', () => {
    let ws = '2023-12-29';
    for (let i = 0; i < 52 * 5 + 2; i++) {
      expect(formatWeekRange(ws)).toBe(`${formatShortDate(parseDateKey(ws))} – ${formatShortDate(dateOfWeekDay(ws, 3))}`);
      ws = addWeeks(ws, 1);
    }
  });
});

describe('isReminderWindow (planning on Thursday)', () => {
  it('is true Mon–Wed and false Thu–Sun', () => {
    const expected = [true, true, true, false, false, false, false]; // Mon 16 Nov .. Sun 22 Nov 2026
    expected.forEach((exp, i) => expect(isReminderWindow(new Date(2026, 10, 16 + i, 12))).toBe(exp));
  });

  it('switches exactly at local midnight Wed->Thu and Sun->Mon', () => {
    expect(isReminderWindow(new Date(2026, 10, 18, 23, 59, 59))).toBe(true);
    expect(isReminderWindow(new Date(2026, 10, 19, 0, 0, 0))).toBe(false);
    expect(isReminderWindow(new Date(2026, 10, 22, 23, 59, 59))).toBe(false);
    expect(isReminderWindow(new Date(2026, 10, 23, 0, 0, 0))).toBe(true);
  });
});

describe('defaultAvailabilityWeek (always the next period)', () => {
  it('is the next Friday-period for every day of the period of 20 Nov 2026', () => {
    for (let i = 0; i < 7; i++) expect(defaultAvailabilityWeek(new Date(2026, 10, 20 + i, 12))).toBe('2026-11-27');
    expect(defaultAvailabilityWeek(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-27'); // planning Thursday
    expect(defaultAvailabilityWeek(new Date(2026, 10, 27, 0, 0))).toBe('2026-12-04');   // new period started
  });

  it('handles the DST Sundays and the year boundary', () => {
    expect(defaultAvailabilityWeek(new Date(2026, 2, 29, 2, 30))).toBe('2026-04-03');
    expect(defaultAvailabilityWeek(new Date(2026, 9, 25, 2, 30))).toBe('2026-10-30');
    expect(defaultAvailabilityWeek(new Date(2026, 11, 31, 12))).toBe('2027-01-01');
  });

  it('equals getNextWeekStart for every day 2024–2028', () => {
    for (const d of ALL_DAYS_2024_2028()) expect(defaultAvailabilityWeek(d)).toBe(getNextWeekStart(d));
  });
});

describe('availabilityDeadline (Wednesday 23:59:59.999 before the period)', () => {
  const parts = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];

  it('anchor: period Fri 27 Nov 2026 -> Wed 25 Nov 2026 23:59:59.999 local', () => {
    const d = availabilityDeadline('2026-11-27');
    expect(parts(d)).toEqual([2026, 10, 25, 23, 59, 59, 999]);
    expect(d.getDay()).toBe(3); // Wednesday
  });

  it('works across month, year and leap boundaries', () => {
    expect(parts(availabilityDeadline('2027-01-01'))).toEqual([2026, 11, 30, 23, 59, 59, 999]);
    expect(parts(availabilityDeadline('2026-01-02'))).toEqual([2025, 11, 31, 23, 59, 59, 999]);
    expect(parts(availabilityDeadline('2028-03-03'))).toEqual([2028, 2, 1, 23, 59, 59, 999]);
    expect(parts(availabilityDeadline('2024-03-01'))).toEqual([2024, 1, 28, 23, 59, 59, 999]);
  });

  it('is local wall-clock time around DST periods', () => {
    expect(parts(availabilityDeadline('2026-04-03'))).toEqual([2026, 3, 1, 23, 59, 59, 999]);
    expect(parts(availabilityDeadline('2026-10-30'))).toEqual([2026, 9, 28, 23, 59, 59, 999]);
  });

  it('is always 1 ms before the planning Thursday (2024–2028)', () => {
    let ws = '2023-12-29';
    for (let i = 0; i < 52 * 5 + 2; i++) {
      const d = availabilityDeadline(ws);
      const planningThursday = parseDateKey(ws); // the Friday …
      planningThursday.setDate(planningThursday.getDate() - 1); // … minus one day, local midnight
      expect(planningThursday.getDay()).toBe(4);
      expect(planningThursday.getTime() - d.getTime()).toBe(1);
      expect(d.getDay()).toBe(3);
      ws = addWeeks(ws, 1);
    }
  });

  it('the default period can still be entered Fri–Wed, but not on the planning Thursday', () => {
    for (const day of days(2026, 0, 1, 365)) {
      const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
      const open = noon.getTime() <= availabilityDeadline(defaultAvailabilityWeek(noon)).getTime();
      expect(open).toBe(noon.getDay() !== 4);
    }
    // Wed 25 Nov 2026 just before / Thu 26 Nov just after the deadline of 27 Nov
    expect(new Date(2026, 10, 25, 23, 59, 59, 999) <= availabilityDeadline('2026-11-27')).toBe(true);
    expect(new Date(2026, 10, 26, 0, 0, 0, 0) <= availabilityDeadline('2026-11-27')).toBe(false);
  });
});
