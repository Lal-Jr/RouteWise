import { describe, expect, it } from 'vitest'
import { repairPlan, snapshot } from './repair'
import { optimize } from './solver'
import { lineProblem, planFor, stop } from './testUtils'

describe('repairPlan', () => {
  const xs = [0, 10, 20, 30]
  const stops = [stop('a'), stop('b'), stop('c', { priority: 'low' })]

  it('does nothing when the plan is unchanged', () => {
    const problem = lineProblem(xs, stops, { dayEnd: 200 })
    const plan = optimize(problem)
    const result = repairPlan(problem, snapshot(plan))
    expect(result.strategy).toBe('none')
    expect(result.changes).toEqual([])
    expect(result.plan.order).toEqual(plan.order)
  })

  it('only retimes when a delay still fits', () => {
    const plan = optimize(lineProblem(xs, stops, { dayEnd: 200 }))
    const delayed = lineProblem(xs, stops, { dayEnd: 200, startTime: 20 })
    const result = repairPlan(delayed, snapshot(plan))
    expect(result.strategy).toBe('retime')
    expect(result.plan.order).toEqual(plan.order)
    expect(result.changes.every((c) => c.kind === 'shifted' && c.by === 20)).toBe(true)
  })

  it('reorders when a stop closes earlier than planned', () => {
    const plan = planFor(lineProblem(xs, stops, { dayEnd: 200 }), ['a', 'b', 'c'])
    const edited = lineProblem(xs, [stop('a'), stop('b'), stop('c', { priority: 'low', window: { open: 0, close: 45 } })], {
      dayEnd: 200,
    })
    const result = repairPlan(edited, snapshot(plan))
    expect(result.strategy).toBe('reorder')
    expect(result.plan.schedule.feasible).toBe(true)
    expect(result.changes.some((c) => c.kind === 'moved')).toBe(true)
    const c = result.plan.schedule.visits.find((v) => v.stopId === 'c')!
    expect(c.end).toBeLessThanOrEqual(45)
  })

  it('drops the lowest-priority stop when running late, then restores it when time frees up', () => {
    const problem = lineProblem(xs, stops, { dayEnd: 90 })
    const plan = optimize(problem)
    expect(plan.dropped).toEqual([])

    const late = lineProblem(xs, stops, { dayEnd: 90, startTime: 20 })
    const repaired = repairPlan(late, snapshot(plan))
    expect(repaired.strategy).toBe('drop')
    expect(repaired.plan.dropped).toEqual(['c'])
    expect(repaired.plan.schedule.feasible).toBe(true)

    const recovered = repairPlan(problem, snapshot(repaired.plan))
    expect(recovered.plan.dropped).toEqual([])
    expect(recovered.changes).toContainEqual({ kind: 'restored', stopId: 'c' })
  })

  it('inserts newly added stops and reports them', () => {
    const problem = lineProblem(xs, stops.slice(0, 2), { dayEnd: 200 })
    const plan = optimize(problem)
    const result = repairPlan(lineProblem(xs, stops, { dayEnd: 200 }), snapshot(plan))
    expect(result.plan.order).toContain('c')
    expect(result.changes).toContainEqual({ kind: 'added', stopId: 'c' })
  })

  it('is stable: repairing a repaired plan changes nothing', () => {
    const late = lineProblem(xs, stops, { dayEnd: 90, startTime: 20 })
    const first = repairPlan(late, snapshot(optimize(lineProblem(xs, stops, { dayEnd: 90 }))))
    const second = repairPlan(late, snapshot(first.plan))
    expect(second.strategy).toBe('none')
    expect(second.changes).toEqual([])
  })
})
