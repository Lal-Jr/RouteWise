import { describe, expect, it } from 'vitest'
import { Evaluator, optimize } from './solver'
import { lineProblem, stop } from './testUtils'

describe('Evaluator.simulate', () => {
  it('computes arrival, waiting, lateness and overtime', () => {
    const p = lineProblem(
      [0, 10, 20],
      [stop('a', { window: { open: 30, close: 100 } }), stop('b', { window: { open: 0, close: 45 } })],
      { dayEnd: 60 },
    )
    const s = new Evaluator(p).simulate(['a', 'b'])
    expect(s.visits[0]).toMatchObject({ arrival: 10, start: 30, wait: 20, end: 40, late: 0 })
    expect(s.visits[1]).toMatchObject({ arrival: 50, start: 50, end: 60, late: 15 })
    expect(s.finish).toBe(80)
    expect(s.overtime).toBe(20)
    expect(s.violation).toBe(35)
    expect(s.feasible).toBe(false)
  })

  it('finishes at the last stop when there is no end node', () => {
    const p = lineProblem([0, 10], [stop('a')], { endNode: null })
    expect(new Evaluator(p).simulate(['a']).finish).toBe(20)
  })
})

describe('optimize', () => {
  it('visits stops along the line instead of zig-zagging', () => {
    const p = lineProblem(
      [0, 30, 10, 40, 20],
      ['a', 'b', 'c', 'd'].map((id) => stop(id, { duration: 0 })),
    )
    const plan = optimize(p)
    expect(plan.schedule.travelTotal).toBe(80)
    expect(plan.dropped).toEqual([])
  })

  it('respects time windows even when that costs travel', () => {
    // "far" closes early, so it must be visited first despite being further away.
    const p = lineProblem(
      [0, 5, 50],
      [stop('near'), stop('far', { window: { open: 0, close: 60 } })],
    )
    const plan = optimize(p)
    expect(plan.order).toEqual(['far', 'near'])
    expect(plan.schedule.feasible).toBe(true)
  })

  it('drops the lowest-priority stop when not everything fits', () => {
    const p = lineProblem(
      [0, 10, -10, 20],
      [stop('keep', { priority: 'high' }), stop('meh', { priority: 'low' }), stop('also', { priority: 'normal' })],
      { dayEnd: 70 },
    )
    const plan = optimize(p)
    expect(plan.dropped).toEqual(['meh'])
    expect(plan.schedule.feasible).toBe(true)
  })

  it('prefers dropping two low-priority stops over one high-priority stop', () => {
    // Either "big" alone or both "l1" and "l2" fit; greedy single removals favour dropping "big".
    const p = lineProblem(
      [0, 20, 10, -10],
      [stop('big', { priority: 'high', duration: 30 }), stop('l1', { priority: 'low', duration: 15 }), stop('l2', { priority: 'low', duration: 15 })],
      { dayEnd: 80 },
    )
    const plan = optimize(p)
    expect(plan.schedule.feasible).toBe(true)
    expect(plan.dropped.sort()).toEqual(['l1', 'l2'])
  })

  it('never drops must-visit stops, reporting the violation instead', () => {
    const p = lineProblem([0, 100], [stop('a', { priority: 'must' })], { dayEnd: 50 })
    const plan = optimize(p)
    expect(plan.dropped).toEqual([])
    expect(plan.schedule.feasible).toBe(false)
    expect(plan.schedule.overtime).toBeGreaterThan(0)
  })

  it('finds the feasible order among many time-windowed stops', () => {
    // Stop i is only open in [100i, 100i + 40]; placed in scrambled positions.
    const positions = [0, 70, 20, 90, 40, 10, 60, 30, 80, 50]
    const stops = positions.slice(1).map((_, i) =>
      stop(`s${i}`, { window: { open: 100 * (i + 1), close: 100 * (i + 1) + 40 } }),
    )
    const plan = optimize(lineProblem(positions, stops))
    expect(plan.schedule.feasible).toBe(true)
    expect(plan.order).toEqual(stops.map((s) => s.id))
  })
})
