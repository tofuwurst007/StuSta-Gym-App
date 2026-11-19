import { describe, it, expect, vi } from 'vitest';
import type { AppState, Availability } from '../types';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

const { reducer } = await import('./AppContext');

const av = (id: string, supervisorId: string, weekStart: string, shiftBlockIds: string[], extra: Partial<Availability> = {}): Availability => ({
  id, supervisorId, supervisorName: supervisorId.toUpperCase(), weekStart, shiftBlockIds, updatedAt: '2026-11-09T10:00:00Z', ...extra,
});

const state = (availabilities: Availability[]): AppState => ({
  users: [], shiftBlocks: [], spontaneousOpenings: [], notifications: [], attendanceLogs: [], availabilities, assignments: [],
});

describe('reducer UPSERT_AVAILABILITY', () => {
  it('inserts into an empty list', () => {
    const p = av('new', 'u1', '2026-11-16', ['s1']);
    expect(reducer(state([]), { type: 'UPSERT_AVAILABILITY', payload: p }).availabilities).toEqual([p]);
  });

  it('inserts when no entry exists for that supervisor+week', () => {
    const existing = [av('a1', 'u1', '2026-11-09', ['s1']), av('a2', 'u2', '2026-11-16', ['s2'])];
    const p = av('new', 'u1', '2026-11-16', ['s3']);
    const next = reducer(state(existing), { type: 'UPSERT_AVAILABILITY', payload: p });
    expect(next.availabilities).toEqual([...existing, p]);
  });

  it('replaces the existing entry for the same supervisor+week, keeping its id and position', () => {
    const others = [av('a1', 'u1', '2026-11-09', ['s1']), av('a3', 'u2', '2026-11-16', ['s2'])];
    const target = av('a2', 'u1', '2026-11-16', ['s1', 's2'], { note: 'old' });
    const before = [others[0], target, others[1]];
    const p = av('tmp-id', 'u1', '2026-11-16', ['s5'], { note: 'new', updatedAt: '2026-11-12T08:00:00Z' });
    const next = reducer(state(before), { type: 'UPSERT_AVAILABILITY', payload: p }).availabilities;

    expect(next).toHaveLength(3);
    expect(next[1]).toEqual({ ...p, id: 'a2' });
    expect(next[0]).toBe(others[0]);  // untouched (same reference)
    expect(next[2]).toBe(others[1]);
  });

  it('a replace can clear the note', () => {
    const before = [av('a1', 'u1', '2026-11-16', ['s1'], { note: 'old' })];
    const p = av('x', 'u1', '2026-11-16', []);
    const next = reducer(state(before), { type: 'UPSERT_AVAILABILITY', payload: p }).availabilities;
    expect(next).toEqual([{ ...p, id: 'a1' }]);
    expect(next[0].note).toBeUndefined();
  });

  it('does not mutate the previous state', () => {
    const before = state([av('a1', 'u1', '2026-11-16', ['s1'])]);
    const snapshot = JSON.stringify(before);
    const next = reducer(before, { type: 'UPSERT_AVAILABILITY', payload: av('x', 'u1', '2026-11-16', ['s2']) });
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(next).not.toBe(before);
    expect(next.availabilities).not.toBe(before.availabilities);
  });

  it('leaves the other state slices untouched', () => {
    const before = state([]);
    const next = reducer(before, { type: 'UPSERT_AVAILABILITY', payload: av('x', 'u1', '2026-11-16', []) });
    expect(next.shiftBlocks).toBe(before.shiftBlocks);
    expect(next.users).toBe(before.users);
  });

  it('upserting twice yields a single entry', () => {
    let s = state([]);
    s = reducer(s, { type: 'UPSERT_AVAILABILITY', payload: av('first', 'u1', '2026-11-16', ['s1']) });
    s = reducer(s, { type: 'UPSERT_AVAILABILITY', payload: av('second', 'u1', '2026-11-16', ['s2']) });
    expect(s.availabilities).toEqual([av('first', 'u1', '2026-11-16', ['s2'])]);
  });
});

describe('reducer SET_ASSIGNMENT', () => {
  const base = { ...state([]), assignments: [
    { shiftBlockId: 's1', weekStart: '2026-11-16', supervisorId: 'u1', supervisorName: 'A' },
    { shiftBlockId: 's1', weekStart: '2026-11-23', supervisorId: 'u1', supervisorName: 'A' },
  ] };

  it('assigns only in the given week', () => {
    const next = reducer(base, { type: 'SET_ASSIGNMENT', payload: { shiftId: 's1', weekStart: '2026-11-23', supervisorId: 'u2', supervisorName: 'B' } });
    expect(next.assignments.find(a => a.weekStart === '2026-11-16')?.supervisorId).toBe('u1');
    expect(next.assignments.find(a => a.weekStart === '2026-11-23')?.supervisorId).toBe('u2');
    expect(next.assignments).toHaveLength(2);
  });

  it('unassigns only in the given week', () => {
    const next = reducer(base, { type: 'SET_ASSIGNMENT', payload: { shiftId: 's1', weekStart: '2026-11-16', supervisorId: null } });
    expect(next.assignments).toEqual([base.assignments[1]]);
  });

  it('adds a new assignment for an open slot', () => {
    const next = reducer(base, { type: 'SET_ASSIGNMENT', payload: { shiftId: 's2', weekStart: '2026-11-16', supervisorId: 'u3', supervisorName: 'C' } });
    expect(next.assignments).toHaveLength(3);
  });
});
