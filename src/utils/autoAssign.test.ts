import { describe, it, expect } from 'vitest';
import { planAutoAssign, type ProposedAssignment } from './autoAssign';
import type { Availability, ShiftBlock } from '../types';

const WEEK = '2026-11-16';

const shift = (id: string, dayOfWeek: number, startTime: string, endTime: string, sup?: [string, string]): ShiftBlock => ({
  id, dayOfWeek, startTime, endTime, claimed: !!sup,
  ...(sup ? { supervisorId: sup[0], supervisorName: sup[1] } : {}),
});

const avail = (supervisorId: string, supervisorName: string, shiftBlockIds: string[]): Availability => ({
  id: `av-${supervisorId}`, supervisorId, supervisorName, weekStart: WEEK, shiftBlockIds, updatedAt: '2026-11-12T10:00:00Z',
});

const ANNA: [string, string] = ['u-anna', 'Anna'];
const BEN: [string, string] = ['u-ben', 'Ben'];
const CARL: [string, string] = ['u-carl', 'Carl'];

const byShift = (r: ProposedAssignment[]) => Object.fromEntries(r.map(p => [p.shiftId, p.supervisorId]));

function loads(shifts: ShiftBlock[], proposals: ProposedAssignment[]) {
  const final = new Map(shifts.map(s => [s.id, s.supervisorId]));
  for (const p of proposals) final.set(p.shiftId, p.supervisorId);
  const l = new Map<string, number>();
  for (const v of final.values()) if (v) l.set(v, (l.get(v) ?? 0) + 1);
  return l;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('planAutoAssign', () => {
  it('returns nothing for empty input', () => {
    expect(planAutoAssign([], [])).toEqual([]);
    expect(planAutoAssign([shift('s1', 0, '06:00', '08:00')], [])).toEqual([]);
  });

  it('assigns an unassigned shift to an available supervisor', () => {
    const r = planAutoAssign([shift('s1', 0, '06:00', '08:00')], [avail(...ANNA, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-anna', supervisorName: 'Anna', replacesName: undefined }]);
  });

  it('skips shifts with no available candidate', () => {
    const r = planAutoAssign(
      [shift('s1', 0, '06:00', '08:00'), shift('s2', 0, '09:00', '12:00')],
      [avail(...ANNA, ['s1'])],
    );
    expect(r.map(p => p.shiftId)).toEqual(['s1']);
  });

  it('makes no proposal for shifts already assigned to an available supervisor', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA), shift('s2', 1, '06:00', '08:00', BEN)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(r).toEqual([]);
  });

  it('replaces an assignee who submitted availability but did not select that shift', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA)];
    const r = planAutoAssign(shifts, [avail(...ANNA, []), avail(...BEN, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-ben', supervisorName: 'Ben', replacesName: 'Anna' }]);
  });

  it('leaves an unavailable assignee in place when nobody else is available (no proposal)', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA)];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s2'])])).toEqual([]);
  });

  it('never replaces an assignee who did not submit availability at all', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', CARL), shift('s2', 0, '09:00', '12:00', CARL)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(r).toEqual([]);
  });

  it('counts existing assignments of non-submitters towards their load (they never get proposals anyway)', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', CARL), shift('s2', 0, '09:00', '12:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s2'])]);
    expect(byShift(r)).toEqual({ s2: 'u-anna' });
  });

  it('fills hardest shifts (fewest candidates) first', () => {
    // sEasy is earlier in the week; without hardest-first Anna (name tie-break) would take it
    // and then also sHard, leaving Ben with nothing.
    const shifts = [shift('sEasy', 0, '06:00', '08:00'), shift('sHard', 6, '09:00', '11:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['sEasy', 'sHard']), avail(...BEN, ['sEasy'])]);
    // Hardest (sHard, 1 candidate) is listed and assigned first.
    expect(r.map(p => p.shiftId)).toEqual(['sHard', 'sEasy']);
    expect(byShift(r)).toEqual({ sHard: 'u-anna', sEasy: 'u-ben' });
  });

  it('gives the shift to the candidate with the lowest load, including existing assignments', () => {
    const shifts = [
      shift('s1', 0, '06:00', '08:00', ANNA),
      shift('s2', 1, '06:00', '08:00', ANNA),
      shift('s3', 2, '06:00', '08:00'),
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2', 's3']), avail(...BEN, ['s3'])]);
    expect(byShift(r)).toEqual({ s3: 'u-ben' });
  });

  it('breaks load ties by name, independent of input order', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00')];
    expect(byShift(planAutoAssign(shifts, [avail(...BEN, ['s1']), avail(...ANNA, ['s1'])]))).toEqual({ s1: 'u-anna' });
    expect(byShift(planAutoAssign(shifts, [avail(...ANNA, ['s1']), avail(...BEN, ['s1'])]))).toEqual({ s1: 'u-anna' });
  });

  it('does not count a replaced assignee\'s lost shift towards their load', () => {
    // Anna is assigned s1 but only available for s2. Ben is available for both.
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA), shift('s2', 1, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s1', 's2'])]);
    expect(byShift(r)).toEqual({ s1: 'u-ben', s2: 'u-anna' });
    expect(r.find(p => p.shiftId === 's1')!.replacesName).toBe('Anna');
  });

  it('never proposes the current assignee for a shift they are being replaced on', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA), shift('s2', 0, '09:00', '12:00', ANNA)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-ben', supervisorName: 'Ben', replacesName: 'Anna' }]);
  });

  it('balances load evenly when everyone is available for everything', () => {
    const shifts = Array.from({ length: 6 }, (_, i) => shift(`s${i}`, i, '06:00', '08:00'));
    const all = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, all), avail(...BEN, all), avail(...CARL, all)]);
    expect(r).toHaveLength(6);
    expect([...loads(shifts, r).values()]).toEqual([2, 2, 2]);
  });

  it('keeps loads within 1 of each other for an uneven count, accounting for existing load', () => {
    const shifts = [
      ...Array.from({ length: 7 }, (_, i) => shift(`s${i}`, i, '06:00', '08:00')),
      shift('pre1', 0, '18:00', '21:00', CARL),
      shift('pre2', 1, '18:00', '21:00', CARL),
    ];
    const all = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, all), avail(...BEN, all), avail(...CARL, all)]);
    expect(r).toHaveLength(7);
    const l = [...loads(shifts, r).values()];
    expect(l.reduce((a, b) => a + b, 0)).toBe(9);
    expect(Math.max(...l) - Math.min(...l)).toBe(0);
  });

  it('proposes each shift at most once and only for open / unavailable-assignee shifts', () => {
    const shifts = [
      shift('s1', 0, '06:00', '08:00'),
      shift('s2', 0, '09:00', '12:00', ANNA),   // Anna available -> keep
      shift('s3', 1, '06:00', '08:00', BEN),    // Ben not available -> replace
      shift('s4', 1, '09:00', '12:00', CARL),   // Carl did not submit -> keep
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2', 's3', 's4']), avail(...BEN, ['s1', 's4'])]);
    const ids = r.map(p => p.shiftId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['s1', 's3']);
  });

  it('is deterministic regardless of input order', () => {
    const shifts: ShiftBlock[] = [];
    for (let d = 0; d < 7; d++) for (const [st, en] of [['06:00', '08:00'], ['09:00', '12:00'], ['12:00', '15:00']]) {
      shifts.push(shift(`d${d}-${st}`, d, st, en));
    }
    shifts[0] = { ...shifts[0], supervisorId: 'u-ben', supervisorName: 'Ben' };
    const ids = shifts.map(s => s.id);
    const avs = [
      avail(...ANNA, ids.filter((_, i) => i % 2 === 0)),
      avail(...BEN, ids.filter((_, i) => i % 3 !== 0)),
      avail(...CARL, ids.filter((_, i) => i % 5 < 3)),
      avail('u-dora', 'Dora', ids.slice(0, 8)),
    ];
    const baseline = byShift(planAutoAssign(shifts, avs));
    expect(Object.keys(baseline).length).toBeGreaterThan(0);
    for (let seed = 1; seed <= 20; seed++) {
      expect(byShift(planAutoAssign(shuffle(shifts, seed), shuffle(avs, seed * 7)))).toEqual(baseline);
    }
    // Same input twice -> identical output, including order.
    expect(planAutoAssign(shifts, avs)).toEqual(planAutoAssign(shifts, avs));
  });

  it('does not mutate its inputs', () => {
    const shifts = [shift('s1', 0, '06:00', '08:00', ANNA), shift('s2', 1, '06:00', '08:00')];
    const avs = [avail(...ANNA, ['s2']), avail(...BEN, ['s1', 's2'])];
    const snapshot = JSON.stringify([shifts, avs]);
    planAutoAssign(shifts, avs);
    expect(JSON.stringify([shifts, avs])).toBe(snapshot);
  });
});
