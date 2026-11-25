import type { Availability, ShiftBlock } from '../types';
import { comparePeriodOrder } from './week';

export interface ProposedAssignment {
  shiftId: string;
  supervisorId: string;
  supervisorName: string;
  replacesName?: string;
}

export interface AutoAssignRules {
  maxPerWeek: number; // shifts per supervisor in one Friday–Thursday period
  maxPerDay: number;  // shifts per supervisor on one day
}

export const DEFAULT_RULES: AutoAssignRules = { maxPerWeek: 2, maxPerDay: 1 };

// Costs steer which of the maximum possible assignments is chosen:
// spreading shifts (a 2nd shift costs more) beats preferences, preferences beat "could".
const COST_EXTRA_SHIFT = 4; // per shift a supervisor already holds in the period
const COST_NOT_PREFERRED = 2;

export interface Load { total: number; days: Map<number, number> }

/** How many shifts each supervisor holds, and on which days. */
export function loadOf(shifts: ShiftBlock[]): Map<string, Load> {
  const load = new Map<string, Load>();
  for (const s of shifts) {
    if (!s.supervisorId) continue;
    const l = load.get(s.supervisorId) ?? { total: 0, days: new Map() };
    l.total++;
    l.days.set(s.dayOfWeek, (l.days.get(s.dayOfWeek) ?? 0) + 1);
    load.set(s.supervisorId, l);
  }
  return load;
}

// ── Min-cost max-flow (successive shortest paths, Bellman–Ford) ─────────────
interface Edge { to: number; cap: number; cost: number; rev: number }

class FlowGraph {
  adj: Edge[][] = [];
  node(): number { this.adj.push([]); return this.adj.length - 1; }
  edge(from: number, to: number, cap: number, cost: number): Edge {
    const e: Edge = { to, cap, cost, rev: this.adj[to].length };
    this.adj[from].push(e);
    this.adj[to].push({ to: from, cap: 0, cost: -cost, rev: this.adj[from].length - 1 });
    return e;
  }
  /** Pushes one unit at a time along the cheapest path until none is left. */
  run(s: number, t: number): void {
    const n = this.adj.length;
    for (;;) {
      const dist = new Array<number>(n).fill(Infinity);
      const prev = new Array<[number, number] | null>(n).fill(null);
      dist[s] = 0;
      for (let changed = true, round = 0; changed && round < n; round++) {
        changed = false;
        for (let u = 0; u < n; u++) {
          if (dist[u] === Infinity) continue;
          this.adj[u].forEach((e, i) => {
            if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
              dist[e.to] = dist[u] + e.cost;
              prev[e.to] = [u, i];
              changed = true;
            }
          });
        }
      }
      if (dist[t] === Infinity) return;
      for (let v = t; v !== s; ) {
        const [u, i] = prev[v]!;
        const e = this.adj[u][i];
        e.cap -= 1;
        this.adj[v][e.rev].cap += 1;
        v = u;
      }
    }
  }
}

/**
 * Proposes assignments for open shifts (and shifts whose assignee explicitly marked
 * themselves unavailable) in one period. Fills as many shifts as possible without
 * breaking the rules; shifts nobody can take within the rules stay open.
 * Existing assignments are kept and count towards the limits.
 */
export function planAutoAssign(
  shifts: ShiftBlock[],
  availabilities: Availability[],
  rules: AutoAssignRules = DEFAULT_RULES,
): ProposedAssignment[] {
  const availOf = new Map(availabilities.map(a => [a.supervisorId, a]));
  const ordered = [...shifts].sort(comparePeriodOrder);
  // An assignee who marked themselves unavailable keeps the shift if nobody can replace
  // them; then it counts towards their limits, so plan again with it fixed until stable.
  const stuck = new Set<string>();
  for (;;) {
    const proposals = solve(ordered, availOf, rules, stuck);
    const replaced = new Set(proposals.map(p => p.shiftId));
    const newlyStuck = ordered.filter(s => s.supervisorId && !stuck.has(s.id) && !replaced.has(s.id)
      && !availOf.get(s.supervisorId)?.shiftBlockIds.includes(s.id) && availOf.has(s.supervisorId));
    if (newlyStuck.length === 0) return proposals;
    newlyStuck.forEach(s => stuck.add(s.id));
  }
}

function solve(
  ordered: ShiftBlock[],
  availOf: Map<string, Availability>,
  rules: AutoAssignRules,
  stuck: Set<string>,
): ProposedAssignment[] {
  const availabilities = [...availOf.values()];
  const needs = (s: ShiftBlock) => !s.supervisorId
    || (!stuck.has(s.id) && availOf.has(s.supervisorId) && !availOf.get(s.supervisorId)!.shiftBlockIds.includes(s.id));
  const todo = ordered.filter(needs);
  const kept = loadOf(ordered.filter(s => !needs(s)));

  const g = new FlowGraph();
  const source = g.node();
  const sink = g.node();
  const shiftNode = new Map<string, number>();
  for (const s of todo) {
    const n = g.node();
    shiftNode.set(s.id, n);
    g.edge(n, sink, 1, 0);
  }

  // Edges supervisor-day → shift; flow on one means "assign"
  const choice: { edge: Edge; shift: ShiftBlock; av: Availability }[] = [];
  const people = [...availabilities].sort((a, b) =>
    a.supervisorName.localeCompare(b.supervisorName) || a.supervisorId.localeCompare(b.supervisorId));

  for (const av of people) {
    const load = kept.get(av.supervisorId) ?? { total: 0, days: new Map<number, number>() };
    const free = rules.maxPerWeek - load.total;
    const candidates = todo.filter(s => av.shiftBlockIds.includes(s.id));
    if (free <= 0 || candidates.length === 0) continue;

    const sup = g.node();
    for (let k = 0; k < free; k++) g.edge(source, sup, 1, (load.total + k) * COST_EXTRA_SHIFT);

    const preferred = new Set(av.preferredBlockIds ?? []);
    const dayNodes = new Map<number, number>();
    for (const s of candidates) {
      const dayFree = rules.maxPerDay - (load.days.get(s.dayOfWeek) ?? 0);
      if (dayFree <= 0) continue;
      let dn = dayNodes.get(s.dayOfWeek);
      if (dn === undefined) {
        dn = g.node();
        dayNodes.set(s.dayOfWeek, dn);
        g.edge(sup, dn, dayFree, 0);
      }
      const edge = g.edge(dn, shiftNode.get(s.id)!, 1, preferred.has(s.id) ? 0 : COST_NOT_PREFERRED);
      choice.push({ edge, shift: s, av });
    }
  }

  g.run(source, sink);

  return choice
    .filter(c => c.edge.cap === 0)
    .sort((a, b) => comparePeriodOrder(a.shift, b.shift))
    .map(({ shift, av }) => ({
      shiftId: shift.id,
      supervisorId: av.supervisorId,
      supervisorName: av.supervisorName,
      replacesName: shift.supervisorName,
    }));
}

/** Rule violations of one supervisor in a period, for warnings in the plan editor. */
export function ruleWarnings(load: Load | undefined, rules: AutoAssignRules = DEFAULT_RULES): string[] {
  if (!load) return [];
  const w: string[] = [];
  if (load.total > rules.maxPerWeek) w.push(`${load.total} shifts this week (max ${rules.maxPerWeek})`);
  if ([...load.days.values()].some(n => n > rules.maxPerDay)) w.push('2 shifts on one day');
  return w;
}
