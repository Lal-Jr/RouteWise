/**
 * Schedule repair: given the plan the traveller is following and a changed situation
 * (running late, a stop edited, added or removed), restore feasibility with the least
 * disruption. Escalates only as far as needed:
 *
 *   retime  - same order, visit times shift
 *   reorder - local moves until the order is feasible again (stops at first feasible order)
 *   drop    - remove the lowest-priority optional stops
 *
 * Afterwards, previously dropped stops are restored if they now fit.
 */
import {
  Evaluator,
  bestInsertion,
  dropUntilFeasible,
  exchangeDropped,
  localSearch,
  reinsertDropped,
  type Plan,
  type Problem,
} from './solver'
import type { Minutes } from './types'

export type RepairStrategy = 'none' | 'retime' | 'reorder' | 'drop'

export type Change =
  | { kind: 'added'; stopId: string }
  | { kind: 'dropped'; stopId: string }
  | { kind: 'restored'; stopId: string }
  | { kind: 'moved'; stopId: string; from: number; to: number }
  | { kind: 'shifted'; stopId: string; by: Minutes }

export interface PlanSnapshot {
  order: string[]
  dropped: string[]
  /** Planned visit start per stop, used to report time shifts. */
  starts: Record<string, Minutes>
}

export interface RepairResult {
  plan: Plan
  strategy: RepairStrategy
  changes: Change[]
  /** Whether the previous order (with new stops inserted) was already feasible. */
  wasFeasible: boolean
}

/** Shifts smaller than this are not reported as changes. */
export const SHIFT_THRESHOLD: Minutes = 5

export function snapshot(plan: Plan): PlanSnapshot {
  return {
    order: plan.order.slice(),
    dropped: plan.dropped.slice(),
    starts: Object.fromEntries(plan.schedule.visits.map((v) => [v.stopId, v.start])),
  }
}

export function repairPlan(problem: Problem, previous: PlanSnapshot): RepairResult {
  const ev = new Evaluator(problem)
  const previousDropped = previous.dropped.filter((id) => ev.has(id))

  let order = previous.order.filter((id) => ev.has(id))
  const known = new Set([...order, ...previousDropped])
  const added = problem.stops.map((s) => s.id).filter((id) => !known.has(id))
  for (const id of added) order = bestInsertion(ev, order, id)!.order

  const wasFeasible = ev.simulate(order).feasible
  let strategy: RepairStrategy = 'none'
  let dropped = previousDropped

  if (!wasFeasible) {
    const reordered = localSearch(ev, order, { stopWhenFeasible: true })
    if (ev.simulate(reordered).feasible) {
      order = reordered
      strategy = 'reorder'
    } else {
      const result = dropUntilFeasible(ev, reordered, { stopWhenFeasible: true })
      // Only reconsider stops dropped by this repair; earlier drops are handled by reinsertion.
      const exchanged = exchangeDropped(ev, result.order, result.dropped)
      order = exchanged.order
      dropped = [...dropped, ...exchanged.dropped]
      strategy = 'drop'
    }
  }

  if (dropped.length) {
    const refilled = reinsertDropped(ev, order, dropped)
    order = refilled.order
    dropped = refilled.dropped
  }

  const plan: Plan = { order, dropped, schedule: ev.simulate(order) }
  const changes = diff(previous, plan, new Set(added))
  if (strategy === 'none' && changes.some((c) => c.kind === 'shifted')) strategy = 'retime'
  return { plan, strategy, changes, wasFeasible }
}

function diff(previous: PlanSnapshot, next: Plan, added: Set<string>): Change[] {
  const changes: Change[] = []
  const prevDropped = new Set(previous.dropped)
  const nextDropped = new Set(next.dropped)
  const nextOrder = new Set(next.order)

  for (const id of added) changes.push({ kind: 'added', stopId: id })
  for (const id of next.dropped) {
    if (!prevDropped.has(id)) changes.push({ kind: 'dropped', stopId: id })
  }
  for (const id of previous.dropped) {
    if (nextOrder.has(id)) changes.push({ kind: 'restored', stopId: id })
  }

  // A stop "moved" if it falls outside the longest run of stops that kept their relative order.
  const prevOrder = new Set(previous.order)
  const commonPrev = previous.order.filter((id) => nextOrder.has(id))
  const commonNext = next.order.filter((id) => prevOrder.has(id))
  const prevIndex = commonNext.map((id) => commonPrev.indexOf(id))
  const stayed = longestIncreasing(prevIndex)
  commonNext.forEach((id, to) => {
    if (!stayed.has(to)) changes.push({ kind: 'moved', stopId: id, from: prevIndex[to], to })
  })

  for (const visit of next.schedule.visits) {
    const before = previous.starts[visit.stopId]
    if (before === undefined || nextDropped.has(visit.stopId)) continue
    const by = visit.start - before
    if (Math.abs(by) >= SHIFT_THRESHOLD) changes.push({ kind: 'shifted', stopId: visit.stopId, by })
  }
  return changes
}

/** Positions forming one longest strictly increasing subsequence of `xs` (O(n²); n is small). */
function longestIncreasing(xs: number[]): Set<number> {
  const len = xs.map(() => 1)
  const prev = xs.map(() => -1)
  let bestEnd = -1
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < i; j++) {
      if (xs[j] < xs[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1
        prev[i] = j
      }
    }
    if (bestEnd < 0 || len[i] > len[bestEnd]) bestEnd = i
  }
  const keep = new Set<number>()
  for (let i = bestEnd; i >= 0; i = prev[i]) keep.add(i)
  return keep
}

/**
 * Follows a snapshot exactly, without repairing: new stops are appended, removed ones ignored.
 * Used when automatic repair is switched off, so violations stay visible.
 */
export function followPlan(problem: Problem, previous: PlanSnapshot): Plan {
  const ev = new Evaluator(problem)
  const dropped = previous.dropped.filter((id) => ev.has(id))
  const order = previous.order.filter((id) => ev.has(id))
  const known = new Set([...order, ...dropped])
  for (const s of problem.stops) if (!known.has(s.id)) order.push(s.id)
  return { order, dropped, schedule: ev.simulate(order) }
}
