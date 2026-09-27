/**
 * Orienteering-style solver for a single-day trip with time windows (TSPTW with optional stops).
 *
 * Objective, compared lexicographically via weighted sums:
 *   1. minutes of constraint violation (visits finishing after closing, day overrun)
 *   2. weight of dropped stops (low priority stops are cheaper to drop)
 *   3. travel time, plus a small penalty for idle waiting
 *
 * Trips are small (tens of stops), so every move is evaluated with a full O(n) simulation.
 */
import type { Minutes, Priority, TimeWindow } from './types'

export interface SolverStop {
  id: string
  /** Index into the travel matrix. */
  node: number
  duration: Minutes
  window?: TimeWindow
  priority: Priority
}

export interface Problem {
  startNode: number
  /** Node the day must end at, or null to finish at the last stop. */
  endNode: number | null
  startTime: Minutes
  dayEnd: Minutes
  stops: SolverStop[]
  travel: (from: number, to: number) => Minutes
}

export interface Visit {
  stopId: string
  travel: Minutes
  arrival: Minutes
  start: Minutes
  end: Minutes
  wait: Minutes
  /** Minutes the visit runs past closing time. */
  late: Minutes
}

export interface Schedule {
  visits: Visit[]
  endTravel: Minutes
  finish: Minutes
  travelTotal: Minutes
  waitTotal: Minutes
  lateTotal: Minutes
  /** Minutes the trip runs past the end of the day. */
  overtime: Minutes
  violation: Minutes
  feasible: boolean
}

export interface Plan {
  order: string[]
  dropped: string[]
  schedule: Schedule
}

const EPS = 1e-6
const VIOLATION_WEIGHT = 1e6
const DROP_UNIT = 1e4
const WAIT_WEIGHT = 0.05
const MAX_PASSES = 500

export const DROP_WEIGHT: Record<Priority, number> = {
  must: Infinity,
  high: 10,
  normal: 3,
  low: 1,
}

export class Evaluator {
  readonly problem: Problem
  private readonly byId: Map<string, SolverStop>

  constructor(problem: Problem) {
    this.problem = problem
    this.byId = new Map(problem.stops.map((s) => [s.id, s]))
  }

  stop(id: string): SolverStop {
    const s = this.byId.get(id)
    if (!s) throw new Error(`Unknown stop ${id}`)
    return s
  }

  has(id: string): boolean {
    return this.byId.has(id)
  }

  simulate(order: readonly string[]): Schedule {
    const { travel, startNode, endNode, startTime, dayEnd } = this.problem
    const visits: Visit[] = []
    let t = startTime
    let node = startNode
    let travelTotal = 0
    let waitTotal = 0
    let lateTotal = 0

    for (const id of order) {
      const s = this.stop(id)
      const leg = travel(node, s.node)
      const arrival = t + leg
      const start = s.window ? Math.max(arrival, s.window.open) : arrival
      const end = start + s.duration
      const late = s.window ? Math.max(0, end - s.window.close) : 0
      visits.push({ stopId: id, travel: leg, arrival, start, end, wait: start - arrival, late })
      travelTotal += leg
      waitTotal += start - arrival
      lateTotal += late
      t = end
      node = s.node
    }

    const endTravel = endNode === null ? 0 : travel(node, endNode)
    const finish = t + endTravel
    travelTotal += endTravel
    const overtime = Math.max(0, finish - dayEnd)
    const violation = lateTotal + overtime
    return {
      visits,
      endTravel,
      finish,
      travelTotal,
      waitTotal,
      lateTotal,
      overtime,
      violation,
      feasible: violation <= EPS,
    }
  }

  dropCost(dropped: readonly string[]): number {
    let w = 0
    for (const id of dropped) w += DROP_WEIGHT[this.stop(id).priority]
    return w * DROP_UNIT
  }

  cost(schedule: Schedule, dropped: readonly string[] = []): number {
    return (
      schedule.violation * VIOLATION_WEIGHT +
      this.dropCost(dropped) +
      schedule.travelTotal +
      schedule.waitTotal * WAIT_WEIGHT
    )
  }

  orderCost(order: readonly string[]): number {
    return this.cost(this.simulate(order))
  }
}

/** Every order reachable by one relocate (segments of 1–3), swap or 2-opt reversal. */
function* neighbours(order: readonly string[]): Generator<string[]> {
  const n = order.length
  for (let len = 1; len <= 3; len++) {
    for (let i = 0; i + len <= n; i++) {
      const segment = order.slice(i, i + len)
      const rest = [...order.slice(0, i), ...order.slice(i + len)]
      for (let j = 0; j <= rest.length; j++) {
        if (j === i) continue
        yield [...rest.slice(0, j), ...segment, ...rest.slice(j)]
      }
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const swapped = order.slice()
      swapped[i] = order[j]
      swapped[j] = order[i]
      yield swapped
      if (j - i >= 2) {
        yield [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)]
      }
    }
  }
}

/**
 * First-improvement local search. With `stopWhenFeasible` it returns as soon as the order
 * becomes feasible, which keeps repairs close to the traveller's existing plan.
 */
export function localSearch(
  ev: Evaluator,
  order: readonly string[],
  opts: { stopWhenFeasible?: boolean } = {},
): string[] {
  let best = order.slice()
  let bestCost = ev.orderCost(best)
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (opts.stopWhenFeasible && ev.simulate(best).feasible) break
    let improved = false
    for (const candidate of neighbours(best)) {
      const c = ev.orderCost(candidate)
      if (c < bestCost - EPS) {
        best = candidate
        bestCost = c
        improved = true
        break
      }
    }
    if (!improved) break
  }
  return best
}

/** Position in `order` where inserting `id` is cheapest; optionally only feasible positions. */
export function bestInsertion(
  ev: Evaluator,
  order: readonly string[],
  id: string,
  requireFeasible = false,
): { order: string[]; cost: number } | null {
  let best: { order: string[]; cost: number } | null = null
  for (let i = 0; i <= order.length; i++) {
    const candidate = [...order.slice(0, i), id, ...order.slice(i)]
    const schedule = ev.simulate(candidate)
    if (requireFeasible && !schedule.feasible) continue
    const c = ev.cost(schedule)
    if (!best || c < best.cost) best = { order: candidate, cost: c }
  }
  return best
}

/** Cheapest-insertion construction, seeding with the most time-constrained stops first. */
export function construct(ev: Evaluator, ids: readonly string[]): string[] {
  const { dayEnd } = ev.problem
  const seeded = [...ids].sort((a, b) => {
    const sa = ev.stop(a)
    const sb = ev.stop(b)
    const closeA = sa.window?.close ?? dayEnd
    const closeB = sb.window?.close ?? dayEnd
    if (closeA !== closeB) return closeA - closeB
    return DROP_WEIGHT[sb.priority] - DROP_WEIGHT[sa.priority]
  })
  let order: string[] = []
  for (const id of seeded) order = bestInsertion(ev, order, id)!.order
  return order
}

/**
 * Drops optional stops until the order is feasible. Prefers the lowest-priority stop whose
 * removal alone restores feasibility; otherwise removes the stop that relieves the most
 * violation per unit of priority.
 */
export function dropUntilFeasible(
  ev: Evaluator,
  order: readonly string[],
  opts: { stopWhenFeasible?: boolean; keep?: string } = {},
): { order: string[]; dropped: string[] } {
  let current = order.slice()
  const dropped: string[] = []
  let schedule = ev.simulate(current)

  while (!schedule.feasible) {
    let fixing: { id: string; weight: number; travel: number } | null = null
    let relieving: { id: string; ratio: number } | null = null

    for (const id of current) {
      const weight = DROP_WEIGHT[ev.stop(id).priority]
      if (!Number.isFinite(weight) || id === opts.keep) continue
      const without = ev.simulate(current.filter((x) => x !== id))
      if (without.feasible) {
        if (
          !fixing ||
          weight < fixing.weight ||
          (weight === fixing.weight && without.travelTotal < fixing.travel)
        ) {
          fixing = { id, weight, travel: without.travelTotal }
        }
      } else {
        const ratio = (schedule.violation - without.violation) / weight
        if (!relieving || ratio > relieving.ratio) relieving = { id, ratio }
      }
    }

    const victim = fixing?.id ?? relieving?.id
    if (!victim) break // only `must` stops remain; report the violation rather than drop them
    dropped.push(victim)
    current = localSearch(
      ev,
      current.filter((x) => x !== victim),
      opts,
    )
    schedule = ev.simulate(current)
  }
  return { order: current, dropped }
}

/** Re-adds dropped stops (highest priority first) wherever they fit without breaking feasibility. */
export function reinsertDropped(
  ev: Evaluator,
  order: readonly string[],
  dropped: readonly string[],
  opts: { improve?: boolean } = {},
): { order: string[]; dropped: string[]; restored: string[] } {
  let current = order.slice()
  const remaining: string[] = []
  const restored: string[] = []
  const byPriority = [...dropped].sort(
    (a, b) => DROP_WEIGHT[ev.stop(b).priority] - DROP_WEIGHT[ev.stop(a).priority],
  )
  for (const id of byPriority) {
    const inserted = bestInsertion(ev, current, id, true)
    if (inserted) {
      current = inserted.order
      restored.push(id)
      if (opts.improve) current = localSearch(ev, current)
    } else {
      remaining.push(id)
    }
  }
  return { order: current, dropped: remaining, restored }
}

/**
 * Greedy dropping removes one stop at a time, so it can drop a high-priority stop where
 * dropping two cheaper ones would do. For each dropped stop, force it back in, let
 * `dropUntilFeasible` choose what to give up instead, and keep the swap if the plan improves.
 */
export function exchangeDropped(
  ev: Evaluator,
  order: readonly string[],
  dropped: readonly string[],
): { order: string[]; dropped: string[] } {
  let best = { order: order.slice(), dropped: dropped.slice() }
  let bestCost = ev.cost(ev.simulate(best.order), best.dropped)
  const byPriority = [...dropped].sort(
    (a, b) => DROP_WEIGHT[ev.stop(b).priority] - DROP_WEIGHT[ev.stop(a).priority],
  )
  for (const id of byPriority) {
    if (!best.dropped.includes(id)) continue
    const forced = localSearch(ev, bestInsertion(ev, best.order, id)!.order)
    const result = dropUntilFeasible(ev, forced, { keep: id })
    const candidate = {
      order: result.order,
      dropped: [...best.dropped.filter((x) => x !== id), ...result.dropped],
    }
    const c = ev.cost(ev.simulate(candidate.order), candidate.dropped)
    if (c < bestCost - EPS) {
      best = candidate
      bestCost = c
    }
  }
  return best
}

function finalize(ev: Evaluator, order: string[], dropped: string[]): Plan {
  return { order, dropped, schedule: ev.simulate(order) }
}

/** Builds the best plan it can from scratch, optionally also trying `hint` as a starting order. */
export function optimize(problem: Problem, hint?: readonly string[]): Plan {
  const ev = new Evaluator(problem)
  const ids = problem.stops.map((s) => s.id)

  const starts = [construct(ev, ids)]
  if (hint) {
    const kept = hint.filter((id) => ev.has(id))
    let seeded = kept
    for (const id of ids) if (!kept.includes(id)) seeded = bestInsertion(ev, seeded, id)!.order
    starts.push(seeded)
  }

  let best: Plan | null = null
  for (const start of starts) {
    const improved = localSearch(ev, start)
    const initial = dropUntilFeasible(ev, improved)
    const { order, dropped } = exchangeDropped(ev, initial.order, initial.dropped)
    const refilled = reinsertDropped(ev, order, dropped, { improve: true })
    const plan = finalize(ev, refilled.order, refilled.dropped)
    if (!best || ev.cost(plan.schedule, plan.dropped) < ev.cost(best.schedule, best.dropped)) {
      best = plan
    }
  }
  return best!
}
