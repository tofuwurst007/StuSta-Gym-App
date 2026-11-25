import { describe, it, expect } from 'vitest';
import { planAutoAssign, loadOf, ruleWarnings, DEFAULT_RULES, type ProposedAssignment, type AutoAssignRules } from './autoAssign';
import type { Availability, ShiftBlock } from '../types';

const WEEK = '2026-11-20'; // Friday; period Fri 20 Nov – Thu 26 Nov 2026

// dayOfWeek: 0 = Monday … 6 = Sunday
const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;

const shift = (id: string, dayOfWeek: number, startTime: string, endTime: string, sup?: [string, string]): ShiftBlock => ({
  id, dayOfWeek, startTime, endTime, claimed: !!sup,
  ...(sup ? { supervisorId: sup[0], supervisorName: sup[1] } : {}),
});

const avail = (supervisorId: string, supervisorName: string, shiftBlockIds: string[], preferredBlockIds?: string[]): Availability => ({
  id: `av-${supervisorId}`, supervisorId, supervisorName, weekStart: WEEK, shiftBlockIds, updatedAt: '2026-11-18T10:00:00Z',
  ...(preferredBlockIds ? { preferredBlockIds } : {}),
});

const ANNA: [string, string] = ['u-anna', 'Anna'];
const BEN: [string, string] = ['u-ben', 'Ben'];
const CARL: [string, string] = ['u-carl', 'Carl'];
const DORA: [string, string] = ['u-dora', 'Dora'];

const byShift = (r: ProposedAssignment[]) => Object.fromEntries(r.map(p => [p.shiftId, p.supervisorId]));

/** Final plan after applying the proposals: shift id -> supervisor id (or undefined = open). */
function finalPlan(shifts: ShiftBlock[], proposals: ProposedAssignment[]) {
  const final = new Map(shifts.map(s => [s.id, s.supervisorId]));
  for (const p of proposals) final.set(p.shiftId, p.supervisorId);
  return final;
}

function loads(shifts: ShiftBlock[], proposals: ProposedAssignment[]) {
  const l = new Map<string, number>();
  for (const v of finalPlan(shifts, proposals).values()) if (v) l.set(v, (l.get(v) ?? 0) + 1);
  return l;
}

function expectRulesHold(shifts: ShiftBlock[], proposals: ProposedAssignment[], rules: AutoAssignRules = DEFAULT_RULES) {
  const plan = finalPlan(shifts, proposals);
  const total = new Map<string, number>();
  const perDay = new Map<string, number>();
  for (const s of shifts) {
    const sup = plan.get(s.id);
    if (!sup) continue;
    total.set(sup, (total.get(sup) ?? 0) + 1);
    const k = `${sup}@${s.dayOfWeek}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  for (const n of total.values()) expect(n).toBeLessThanOrEqual(rules.maxPerWeek);
  for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(rules.maxPerDay);
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

describe('planAutoAssign — basics', () => {
  it('returns nothing for empty input', () => {
    expect(planAutoAssign([], [])).toEqual([]);
    expect(planAutoAssign([shift('s1', MON, '06:00', '08:00')], [])).toEqual([]);
  });

  it('assigns an unassigned shift to an available supervisor', () => {
    const r = planAutoAssign([shift('s1', MON, '06:00', '08:00')], [avail(...ANNA, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-anna', supervisorName: 'Anna', replacesName: undefined }]);
  });

  it('skips shifts with no available candidate', () => {
    const r = planAutoAssign(
      [shift('s1', MON, '06:00', '08:00'), shift('s2', TUE, '09:00', '12:00')],
      [avail(...ANNA, ['s1'])],
    );
    expect(r.map(p => p.shiftId)).toEqual(['s1']);
  });

  it('ignores preferred ids that are not in the available set', () => {
    const r = planAutoAssign([shift('s1', MON, '06:00', '08:00')], [avail(...ANNA, [], ['s1'])]);
    expect(r).toEqual([]);
  });

  it('makes no proposal for shifts already assigned to an available supervisor', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA), shift('s2', TUE, '06:00', '08:00', BEN)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(r).toEqual([]);
  });

  it('never replaces an assignee who did not submit availability at all', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', CARL), shift('s2', TUE, '09:00', '12:00', CARL)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(r).toEqual([]);
  });

  it('lists proposals in period order (Friday first, Thursday last)', () => {
    const shifts = [
      shift('thu', THU, '06:00', '08:00'), shift('mon', MON, '06:00', '08:00'),
      shift('fri', FRI, '17:00', '19:00'), shift('sun', SUN, '09:00', '11:00'),
    ];
    const ids = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, ids), avail(...BEN, ids)]);
    expect(r.map(p => p.shiftId)).toEqual(['fri', 'sun', 'mon', 'thu']);
  });

  it('breaks ties by name, independent of input order', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00')];
    expect(byShift(planAutoAssign(shifts, [avail(...BEN, ['s1']), avail(...ANNA, ['s1'])]))).toEqual({ s1: 'u-anna' });
    expect(byShift(planAutoAssign(shifts, [avail(...ANNA, ['s1']), avail(...BEN, ['s1'])]))).toEqual({ s1: 'u-anna' });
  });
});

describe('planAutoAssign — max 2 shifts per supervisor per period', () => {
  it('gives one supervisor at most 2 shifts even if available for more; the rest stay open', () => {
    const shifts = [FRI, SAT, SUN, MON, TUE].map((d, i) => shift(`s${i}`, d, '06:00', '08:00'));
    const r = planAutoAssign(shifts, [avail(...ANNA, shifts.map(s => s.id))]);
    expect(r).toHaveLength(2);
    expect(r.every(p => p.supervisorId === 'u-anna')).toBe(true);
    expectRulesHold(shifts, r);
  });

  it('counts kept assignments: 1 kept -> only 1 more', () => {
    const shifts = [
      shift('kept', FRI, '06:00', '08:00', ANNA),
      shift('s1', SAT, '06:00', '08:00'), shift('s2', SUN, '06:00', '08:00'), shift('s3', MON, '06:00', '08:00'),
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['kept', 's1', 's2', 's3'])]);
    expect(r).toHaveLength(1);
    expect(loads(shifts, r).get('u-anna')).toBe(2);
  });

  it('counts kept assignments: 2 kept -> nothing more, the open shift stays open', () => {
    const shifts = [
      shift('k1', FRI, '06:00', '08:00', ANNA), shift('k2', SAT, '06:00', '08:00', ANNA),
      shift('s1', MON, '06:00', '08:00'),
    ];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['k1', 'k2', 's1'])])).toEqual([]);
  });

  it('with 7 open shifts and Carl already holding 2, only Anna and Ben are used: 4 filled, 3 open', () => {
    const shifts = [
      ...[FRI, SAT, SUN, MON, TUE, WED, THU].map((d, i) => shift(`s${i}`, d, '06:00', '08:00')),
      shift('pre1', MON, '18:00', '21:00', CARL),
      shift('pre2', TUE, '18:00', '21:00', CARL),
    ];
    const all = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, all), avail(...BEN, all), avail(...CARL, all)]);
    expect(r).toHaveLength(4);
    expect(r.some(p => p.supervisorId === 'u-carl')).toBe(false);
    expect(Object.fromEntries(loads(shifts, r))).toEqual({ 'u-anna': 2, 'u-ben': 2, 'u-carl': 2 });
    expectRulesHold(shifts, r);
  });

  it('kept shifts of a non-submitter count for nothing else (they get no proposals anyway)', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', CARL), shift('s2', TUE, '09:00', '12:00')];
    expect(byShift(planAutoAssign(shifts, [avail(...ANNA, ['s2'])]))).toEqual({ s2: 'u-anna' });
  });

  it('a supervisor already over the limit gets nothing', () => {
    const shifts = [
      shift('k1', FRI, '06:00', '08:00', ANNA), shift('k2', SAT, '06:00', '08:00', ANNA), shift('k3', SUN, '06:00', '08:00', ANNA),
      shift('s1', MON, '06:00', '08:00'),
    ];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['k1', 'k2', 'k3', 's1'])])).toEqual([]);
  });

  it('honours custom rules', () => {
    const shifts = [FRI, SAT, SUN, MON].map((d, i) => shift(`s${i}`, d, '06:00', '08:00'));
    const ids = shifts.map(s => s.id);
    expect(planAutoAssign(shifts, [avail(...ANNA, ids)], { maxPerWeek: 3, maxPerDay: 1 })).toHaveLength(3);
    expect(planAutoAssign(shifts, [avail(...ANNA, ids)], { maxPerWeek: 1, maxPerDay: 1 })).toHaveLength(1);
    const sameDay = [shift('a', MON, '06:00', '08:00'), shift('b', MON, '17:00', '19:00')];
    expect(planAutoAssign(sameDay, [avail(...ANNA, ['a', 'b'])], { maxPerWeek: 2, maxPerDay: 2 })).toHaveLength(2);
  });
});

describe('planAutoAssign — max 1 shift per supervisor per day', () => {
  it('never gives one supervisor two shifts on the same day', () => {
    const shifts = [shift('m1', MON, '06:00', '08:00'), shift('m2', MON, '12:00', '14:00'), shift('m3', MON, '17:00', '19:00')];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['m1', 'm2', 'm3'])])).toHaveLength(1);
  });

  it('counts kept assignments on that day', () => {
    const shifts = [
      shift('kept', MON, '06:00', '08:00', ANNA),
      shift('monEve', MON, '17:00', '19:00'),
      shift('tue', TUE, '17:00', '19:00'),
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['kept', 'monEve', 'tue'])]);
    expect(byShift(r)).toEqual({ tue: 'u-anna' });
  });

  it('splits two same-day shifts between two supervisors', () => {
    const shifts = [shift('m1', MON, '06:00', '08:00'), shift('m2', MON, '17:00', '19:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['m1', 'm2']), avail(...BEN, ['m1', 'm2'])]);
    expect(r).toHaveLength(2);
    expect(new Set(r.map(p => p.supervisorId))).toEqual(new Set(['u-anna', 'u-ben']));
  });
});

describe('planAutoAssign — shifts stay open when only rule-breaking assignments are possible', () => {
  it('leaves the shift open rather than breaking the day rule', () => {
    const shifts = [shift('k', SAT, '09:00', '11:00', ANNA), shift('s', SAT, '17:00', '19:00')];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['k', 's'])])).toEqual([]);
  });

  it('leaves the shift open rather than breaking the period rule', () => {
    const shifts = [shift('k1', FRI, '09:00', '11:00', BEN), shift('k2', SUN, '09:00', '11:00', BEN), shift('s', WED, '17:00', '19:00')];
    expect(planAutoAssign(shifts, [avail(...BEN, ['k1', 'k2', 's'])])).toEqual([]);
  });

  it('fills what it can and leaves exactly the impossible ones open', () => {
    // Anna is the only candidate for 4 shifts on 2 days: she can take one per day.
    const shifts = [
      shift('f1', FRI, '06:00', '08:00'), shift('f2', FRI, '17:00', '19:00'),
      shift('t1', TUE, '06:00', '08:00'), shift('t2', TUE, '17:00', '19:00'),
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, shifts.map(s => s.id))]);
    expect(r).toHaveLength(2);
    expect(new Set(r.map(p => shifts.find(s => s.id === p.shiftId)!.dayOfWeek))).toEqual(new Set([FRI, TUE]));
  });
});

describe('planAutoAssign — maximum coverage', () => {
  /** Reference: a hardest-first greedy (fewest candidates first, then lowest load, then name). */
  function greedyHardestFirst(shifts: ShiftBlock[], avs: Availability[], rules = DEFAULT_RULES) {
    const total = new Map<string, number>();
    const day = new Map<string, number>();
    const cands = (s: ShiftBlock) => avs.filter(a => a.shiftBlockIds.includes(s.id));
    const order = shifts.filter(s => !s.supervisorId)
      .sort((a, b) => cands(a).length - cands(b).length || a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
    let filled = 0;
    for (const s of order) {
      const ok = cands(s)
        .filter(a => (total.get(a.supervisorId) ?? 0) < rules.maxPerWeek && (day.get(`${a.supervisorId}@${s.dayOfWeek}`) ?? 0) < rules.maxPerDay)
        .sort((a, b) => (total.get(a.supervisorId) ?? 0) - (total.get(b.supervisorId) ?? 0) || a.supervisorName.localeCompare(b.supervisorName));
      if (!ok.length) continue;
      const k = `${ok[0].supervisorId}@${s.dayOfWeek}`;
      total.set(ok[0].supervisorId, (total.get(ok[0].supervisorId) ?? 0) + 1);
      day.set(k, (day.get(k) ?? 0) + 1);
      filled++;
    }
    return filled;
  }

  it('fills all shifts where hardest-first greedy would leave one open', () => {
    // Carl is the only one for Sat and Sun -> greedy gives him those first (then he is full).
    // fri06 {Anna, Ben} and fri17 {Anna, Carl} tie at 2 candidates; greedy gives fri06 to Anna (name),
    // then nobody can take fri17 (Anna already works Friday, Carl is full).
    // The optimum: fri06 -> Ben, fri17 -> Anna.
    const shifts = [
      shift('fri06', FRI, '06:00', '08:00'), shift('fri17', FRI, '17:00', '19:00'),
      shift('sat', SAT, '09:00', '11:00'), shift('sun', SUN, '09:00', '11:00'),
    ];
    const avs = [avail(...ANNA, ['fri06', 'fri17']), avail(...BEN, ['fri06']), avail(...CARL, ['fri17', 'sat', 'sun'])];
    expect(greedyHardestFirst(shifts, avs)).toBe(3);
    const r = planAutoAssign(shifts, avs);
    expect(r).toHaveLength(4);
    expect(byShift(r)).toEqual({ fri06: 'u-ben', fri17: 'u-anna', sat: 'u-carl', sun: 'u-carl' });
    expectRulesHold(shifts, r);
  });

  it('fills both shifts when one candidate is shared', () => {
    const shifts = [shift('sEasy', MON, '06:00', '08:00'), shift('sHard', SUN, '09:00', '11:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['sEasy', 'sHard']), avail(...BEN, ['sEasy'])]);
    expect(byShift(r)).toEqual({ sHard: 'u-anna', sEasy: 'u-ben' });
  });

  it('coverage beats preferences: a preferred shift is given up to fill another one', () => {
    const shifts = [shift('fri06', FRI, '06:00', '08:00'), shift('fri17', FRI, '17:00', '19:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['fri06', 'fri17'], ['fri06']), avail(...BEN, ['fri06'])]);
    expect(byShift(r)).toEqual({ fri06: 'u-ben', fri17: 'u-anna' });
  });

  it('coverage beats spreading: someone takes a 2nd shift if otherwise it stays open', () => {
    const shifts = [shift('s1', FRI, '06:00', '08:00'), shift('s2', SAT, '06:00', '08:00'), shift('s3', SUN, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s3'])]);
    expect(byShift(r)).toEqual({ s1: 'u-anna', s2: 'u-anna', s3: 'u-ben' });
  });
});

describe('planAutoAssign — spreading and preferences (equal coverage)', () => {
  it('spreads two shifts over two people instead of giving both to one', () => {
    const shifts = [shift('s1', FRI, '06:00', '08:00'), shift('s2', SAT, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(Object.fromEntries(loads(shifts, r))).toEqual({ 'u-anna': 1, 'u-ben': 1 });
  });

  it('balances load evenly when everyone is available for everything', () => {
    const shifts = [FRI, SAT, SUN, MON, TUE, WED].map((d, i) => shift(`s${i}`, d, '06:00', '08:00'));
    const all = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, all), avail(...BEN, all), avail(...CARL, all)]);
    expect(r).toHaveLength(6);
    expect([...loads(shifts, r).values()]).toEqual([2, 2, 2]);
  });

  it('gives everyone one shift before anyone gets a second', () => {
    const shifts = [FRI, SAT, SUN, MON].map((d, i) => shift(`s${i}`, d, '06:00', '08:00'));
    const all = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, all), avail(...BEN, all), avail(...CARL, all), avail(...DORA, all)]);
    expect([...loads(shifts, r).values()]).toEqual([1, 1, 1, 1]);
  });

  it('prefers a supervisor without existing shifts over one who already has one', () => {
    const shifts = [shift('k', FRI, '06:00', '08:00', ANNA), shift('s', SAT, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['k', 's']), avail(...BEN, ['s'])]);
    expect(byShift(r)).toEqual({ s: 'u-ben' });
  });

  it('gives each supervisor their preferred shift', () => {
    const shifts = [shift('s1', FRI, '06:00', '08:00'), shift('s2', SAT, '06:00', '08:00')];
    // Without preferences the name tie-break would give Anna s1.
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2'], ['s2']), avail(...BEN, ['s1', 's2'], ['s1'])]);
    expect(byShift(r)).toEqual({ s1: 'u-ben', s2: 'u-anna' });
  });

  it('a preferring candidate wins over a "could" candidate', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1']), avail(...BEN, ['s1'], ['s1'])]);
    expect(byShift(r)).toEqual({ s1: 'u-ben' });
  });

  it('picks the preferred one of two same-day shifts when only one can be taken', () => {
    const shifts = [shift('m1', MON, '06:00', '08:00'), shift('m2', MON, '17:00', '19:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['m1', 'm2'], ['m2'])]);
    expect(byShift(r)).toEqual({ m2: 'u-anna' });
  });

  it('spreading beats preferences: two preferred shifts are still split if someone else could', () => {
    const shifts = [shift('s1', FRI, '06:00', '08:00'), shift('s2', SAT, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2'], ['s1', 's2']), avail(...BEN, ['s1', 's2'])]);
    expect(Object.fromEntries(loads(shifts, r))).toEqual({ 'u-anna': 1, 'u-ben': 1 });
  });
});

describe('planAutoAssign — replacing assignees who marked themselves unavailable', () => {
  it('replaces an assignee who submitted availability but did not select that shift', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA)];
    const r = planAutoAssign(shifts, [avail(...ANNA, []), avail(...BEN, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-ben', supervisorName: 'Ben', replacesName: 'Anna' }]);
  });

  it('leaves an unavailable assignee in place when nobody else is available (no proposal)', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA)];
    expect(planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s2'])])).toEqual([]);
  });

  it('does not count a replaced assignee\'s lost shift towards their load', () => {
    // Anna is assigned s1 but only available for s2. Ben is available for both.
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA), shift('s2', TUE, '06:00', '08:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s1', 's2'])]);
    expect(byShift(r)).toEqual({ s1: 'u-ben', s2: 'u-anna' });
    expect(r.find(p => p.shiftId === 's1')!.replacesName).toBe('Anna');
  });

  it('the lost shift does not block its day either', () => {
    const shifts = [shift('m1', MON, '06:00', '08:00', ANNA), shift('m2', MON, '17:00', '19:00')];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['m2']), avail(...BEN, ['m1'])]);
    expect(byShift(r)).toEqual({ m1: 'u-ben', m2: 'u-anna' });
  });

  it('never proposes the current assignee for a shift they are being replaced on', () => {
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA), shift('s2', MON, '09:00', '12:00', ANNA)];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s2']), avail(...BEN, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-ben', supervisorName: 'Ben', replacesName: 'Anna' }]);
  });

  it('the replacement respects the rules too (a full candidate is skipped)', () => {
    const shifts = [
      shift('s1', MON, '06:00', '08:00', ANNA),
      shift('b1', FRI, '06:00', '08:00', BEN), shift('b2', SAT, '06:00', '08:00', BEN),
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, []), avail(...BEN, ['s1', 'b1', 'b2']), avail(...CARL, ['s1'])]);
    expect(r).toEqual([{ shiftId: 's1', supervisorId: 'u-carl', supervisorName: 'Carl', replacesName: 'Anna' }]);
  });

  it('proposes each shift at most once and only for open / unavailable-assignee shifts', () => {
    const shifts = [
      shift('s1', MON, '06:00', '08:00'),
      shift('s2', MON, '09:00', '12:00', ANNA),   // Anna available -> keep
      shift('s3', TUE, '06:00', '08:00', BEN),    // Ben not available -> replace
      shift('s4', TUE, '09:00', '12:00', CARL),   // Carl did not submit -> keep
    ];
    const r = planAutoAssign(shifts, [avail(...ANNA, ['s1', 's2', 's3', 's4']), avail(...BEN, ['s1', 's4'])]);
    const ids = r.map(p => p.shiftId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(['s1', 's3']);
    expect(byShift(r)).toEqual({ s1: 'u-ben', s3: 'u-anna' }); // Anna already works Monday (s2)
  });
});

describe('planAutoAssign — determinism', () => {
  it('is deterministic regardless of input order', () => {
    const shifts: ShiftBlock[] = [];
    for (let d = 0; d < 7; d++) for (const [st, en] of [['06:00', '08:00'], ['09:00', '12:00'], ['12:00', '15:00']]) {
      shifts.push(shift(`d${d}-${st}`, d, st, en));
    }
    shifts[0] = { ...shifts[0], supervisorId: 'u-ben', supervisorName: 'Ben' };
    const ids = shifts.map(s => s.id);
    const avs = [
      avail(...ANNA, ids.filter((_, i) => i % 2 === 0), ids.filter((_, i) => i % 4 === 0)),
      avail(...BEN, ids.filter((_, i) => i % 3 !== 0)),
      avail(...CARL, ids.filter((_, i) => i % 5 < 3), ids.filter((_, i) => i % 5 === 1)),
      avail(...DORA, ids.slice(0, 8)),
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
    const shifts = [shift('s1', MON, '06:00', '08:00', ANNA), shift('s2', TUE, '06:00', '08:00')];
    const avs = [avail(...ANNA, ['s2'], ['s2']), avail(...BEN, ['s1', 's2'])];
    const snapshot = JSON.stringify([shifts, avs]);
    planAutoAssign(shifts, avs);
    expect(JSON.stringify([shifts, avs])).toBe(snapshot);
  });
});

describe('planAutoAssign — randomized property test (seeded)', () => {
  // mulberry32: small deterministic PRNG
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PEOPLE: [string, string][] = [ANNA, BEN, CARL, DORA, ['u-emil', 'Emil']];
  const TIMES = [['06:00', '08:00'], ['12:00', '14:00'], ['17:00', '19:00']];

  function randomCase(seed: number) {
    const r = rng(seed);
    const days = shuffle([0, 1, 2, 3, 4, 5, 6], seed).slice(0, 2 + Math.floor(r() * 3)); // 2–4 days
    const nShifts = 3 + Math.floor(r() * 5); // 3–7 shifts
    const slots = days.flatMap(d => TIMES.map(t => [d, t] as const));
    const shifts: ShiftBlock[] = shuffle(slots, seed * 3 + 1).slice(0, nShifts)
      .map(([d, [st, en]], i) => shift(`s${i}`, d, st, en));
    const people = PEOPLE.slice(0, 2 + Math.floor(r() * 4)); // 2–5 people
    // Some people hold shifts without having submitted availability
    const submitters = people.filter(() => r() < 0.8);
    for (let i = 0; i < shifts.length; i++) {
      if (r() < 0.3) {
        const p = people[Math.floor(r() * people.length)];
        shifts[i] = { ...shifts[i], claimed: true, supervisorId: p[0], supervisorName: p[1] };
      }
    }
    const avs = submitters.map(([id, name]) => {
      const ids = shifts.filter(() => r() < 0.55).map(s => s.id);
      return avail(id, name, ids, ids.filter(() => r() < 0.4));
    });
    return { shifts, avs };
  }

  /** Brute force: maximum number of shifts fillable within the rules, plus kept loads. */
  function bruteForce(shifts: ShiftBlock[], avs: Availability[], rules = DEFAULT_RULES) {
    const availOf = new Map(avs.map(a => [a.supervisorId, a]));
    const isTodo = (s: ShiftBlock) => !s.supervisorId
      || (availOf.has(s.supervisorId) && !availOf.get(s.supervisorId)!.shiftBlockIds.includes(s.id));
    const total = new Map<string, number>();
    const day = new Map<string, number>();
    for (const s of shifts) {
      if (isTodo(s) || !s.supervisorId) continue;
      total.set(s.supervisorId, (total.get(s.supervisorId) ?? 0) + 1);
      const k = `${s.supervisorId}@${s.dayOfWeek}`;
      day.set(k, (day.get(k) ?? 0) + 1);
    }
    const keptTotal = new Map(total);
    const keptDay = new Map(day);
    const todo = shifts.filter(isTodo);
    let best = 0;
    // Enumerate every choice (someone available, or nobody). A replacement-needing shift
    // nobody takes stays with its assignee and counts towards their limits; the plan is
    // valid if everyone who gets NEW shifts stays within the rules including those.
    const pick: (string | null)[] = new Array(todo.length).fill(null);
    const valid = () => {
      const t = new Map(total);
      const d = new Map(day);
      const fresh = new Set<string>();
      todo.forEach((s, i) => {
        const who = pick[i] ?? s.supervisorId;
        if (!who) return;
        if (pick[i]) fresh.add(who);
        t.set(who, (t.get(who) ?? 0) + 1);
        const k = `${who}@${s.dayOfWeek}`;
        d.set(k, (d.get(k) ?? 0) + 1);
      });
      for (const who of fresh) {
        if ((t.get(who) ?? 0) > rules.maxPerWeek) return false;
        for (const [k, n] of d) if (k.startsWith(`${who}@`) && n > rules.maxPerDay) return false;
      }
      return true;
    };
    const go = (i: number, filled: number) => {
      if (filled + (todo.length - i) <= best) return;
      if (i === todo.length) { if (valid()) best = filled; return; }
      const s = todo[i];
      for (const a of avs) {
        if (!a.shiftBlockIds.includes(s.id) || a.supervisorId === s.supervisorId) continue;
        pick[i] = a.supervisorId;
        go(i + 1, filled + 1);
      }
      pick[i] = null;
      go(i + 1, filled);
    };
    go(0, 0);
    return { best, todo, keptTotal, keptDay };
  }

  it('respects the rules and fills the brute-force maximum on 400 random small instances', () => {
    let nonTrivial = 0;
    let withOpenLeft = 0;
    let withReplacement = 0;
    const shortBy: number[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const { shifts, avs } = randomCase(seed);
      const r = planAutoAssign(shifts, avs);
      const { best, todo, keptTotal, keptDay } = bruteForce(shifts, avs);
      const ctx = `seed ${seed}`;

      // Number of filled shifts: at most the maximum, and the iterative planner may only
      // fall short when an unreplaceable unavailable assignee blocks capacity
      expect(r.length, ctx).toBeLessThanOrEqual(best);
      if (r.length < best) shortBy.push(seed);
      if (best > 0) nonTrivial++;
      if (best < todo.length) withOpenLeft++;

      // Proposals are valid
      const todoIds = new Set(todo.map(s => s.id));
      expect(new Set(r.map(p => p.shiftId)).size, ctx).toBe(r.length);
      for (const p of r) {
        const s = shifts.find(x => x.id === p.shiftId)!;
        if (s.supervisorId) withReplacement++;
        expect(todoIds.has(p.shiftId), ctx).toBe(true);
        expect(avs.find(a => a.supervisorId === p.supervisorId)!.shiftBlockIds, ctx).toContain(p.shiftId);
        expect(p.supervisorId, ctx).not.toBe(s.supervisorId);
        expect(p.replacesName, ctx).toBe(s.supervisorName);
      }

      // Rules hold for everyone who gets new shifts, kept assignments included
      const newTotal = new Map<string, number>();
      const newDay = new Map<string, number>();
      for (const p of r) {
        const s = shifts.find(x => x.id === p.shiftId)!;
        newTotal.set(p.supervisorId, (newTotal.get(p.supervisorId) ?? 0) + 1);
        const k = `${p.supervisorId}@${s.dayOfWeek}`;
        newDay.set(k, (newDay.get(k) ?? 0) + 1);
      }
      // A replacement-needing shift nobody took stays with its assignee and counts too
      const proposed = new Set(r.map(p => p.shiftId));
      const stuckTotal = new Map<string, number>();
      const stuckDay = new Map<string, number>();
      for (const s of todo) {
        if (!s.supervisorId || proposed.has(s.id)) continue;
        stuckTotal.set(s.supervisorId, (stuckTotal.get(s.supervisorId) ?? 0) + 1);
        const k = `${s.supervisorId}@${s.dayOfWeek}`;
        stuckDay.set(k, (stuckDay.get(k) ?? 0) + 1);
      }
      for (const [sup, n] of newTotal) expect((keptTotal.get(sup) ?? 0) + (stuckTotal.get(sup) ?? 0) + n, ctx).toBeLessThanOrEqual(DEFAULT_RULES.maxPerWeek);
      for (const [k, n] of newDay) expect((keptDay.get(k) ?? 0) + (stuckDay.get(k) ?? 0) + n, ctx).toBeLessThanOrEqual(DEFAULT_RULES.maxPerDay);

      // Input order does not matter
      expect(byShift(planAutoAssign(shuffle(shifts, seed + 11), shuffle(avs, seed + 13))), ctx).toEqual(byShift(r));
    }
    // The generator really exercises the interesting cases
    expect(nonTrivial).toBeGreaterThan(300);
    expect(withOpenLeft).toBeGreaterThan(50);
    expect(withReplacement).toBeGreaterThan(10);
    console.log(`[property] planner below brute-force maximum in ${shortBy.length}/400 cases: ${shortBy.join(",")}`);
    expect(shortBy.length).toBeLessThanOrEqual(8);
  });
});

describe('loadOf / ruleWarnings', () => {
  it('loadOf counts shifts per supervisor and per day, ignoring open shifts', () => {
    const l = loadOf([
      shift('a', MON, '06:00', '08:00', ANNA), shift('b', MON, '17:00', '19:00', ANNA),
      shift('c', FRI, '06:00', '08:00', ANNA), shift('d', FRI, '06:00', '08:00', BEN),
      shift('e', SAT, '06:00', '08:00'),
    ]);
    expect([...l.keys()].sort()).toEqual(['u-anna', 'u-ben']);
    expect(l.get('u-anna')!.total).toBe(3);
    expect(Object.fromEntries(l.get('u-anna')!.days)).toEqual({ [MON]: 2, [FRI]: 1 });
    expect(l.get('u-ben')!.total).toBe(1);
  });

  it('ruleWarnings flags too many shifts and two shifts on one day', () => {
    expect(ruleWarnings(undefined)).toEqual([]);
    expect(ruleWarnings({ total: 2, days: new Map([[MON, 1], [TUE, 1]]) })).toEqual([]);
    expect(ruleWarnings({ total: 3, days: new Map([[MON, 1], [TUE, 1], [WED, 1]]) })).toEqual(['3 shifts this week (max 2)']);
    expect(ruleWarnings({ total: 2, days: new Map([[MON, 2]]) })).toEqual(['2 shifts on one day']);
    expect(ruleWarnings({ total: 3, days: new Map([[MON, 2], [TUE, 1]]) })).toHaveLength(2);
    expect(ruleWarnings({ total: 3, days: new Map([[MON, 3]]) }, { maxPerWeek: 3, maxPerDay: 3 })).toEqual([]);
  });

  it('applying an auto-assignment never produces a rule warning', () => {
    const shifts = [FRI, SAT, SUN, MON, TUE, WED, THU].flatMap((d, i) => [
      shift(`a${i}`, d, '06:00', '08:00'), shift(`b${i}`, d, '17:00', '19:00'),
    ]);
    const ids = shifts.map(s => s.id);
    const r = planAutoAssign(shifts, [avail(...ANNA, ids), avail(...BEN, ids), avail(...CARL, ids.slice(0, 6))]);
    const applied = shifts.map(s => {
      const p = r.find(x => x.shiftId === s.id);
      return p ? { ...s, supervisorId: p.supervisorId, supervisorName: p.supervisorName, claimed: true } : s;
    });
    expect(r).toHaveLength(6);
    for (const l of loadOf(applied).values()) expect(ruleWarnings(l)).toEqual([]);
    expectRulesHold(shifts, r);
  });
});
