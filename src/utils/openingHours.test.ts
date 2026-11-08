import { describe, it, expect } from 'vitest';
import { isWeekend, getMorningShift } from './openingHours';

describe('isWeekend', () => {
  it('is false Mon–Fri (0–4) and true Sat/Sun (5, 6)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(isWeekend)).toEqual([false, false, false, false, false, true, true]);
  });
});

describe('getMorningShift', () => {
  it('weekdays are 06:00–08:00', () => {
    for (const d of [0, 1, 2, 3, 4]) expect(getMorningShift(d)).toEqual({ startTime: '06:00', endTime: '08:00' });
  });
  it('weekends are 09:00–11:00', () => {
    for (const d of [5, 6]) expect(getMorningShift(d)).toEqual({ startTime: '09:00', endTime: '11:00' });
  });
  it('returns a fresh object each call', () => {
    const a = getMorningShift(0);
    a.startTime = 'xx';
    expect(getMorningShift(0).startTime).toBe('06:00');
  });
});
