import { Evaluator, type Plan, type Problem, type SolverStop } from './solver'

/** Places on a line: node i sits at position xs[i]; travel time is the distance. */
export function lineProblem(xs: number[], stops: Omit<SolverStop, 'node'>[], opts: Partial<Problem> = {}): Problem {
  return {
    startNode: 0,
    endNode: 0,
    startTime: 0,
    dayEnd: 10_000,
    stops: stops.map((s, i) => ({ ...s, node: i + 1 })),
    travel: (a, b) => Math.abs(xs[a] - xs[b]),
    ...opts,
  }
}

export const stop = (id: string, extra: Partial<SolverStop> = {}): Omit<SolverStop, 'node'> => ({
  id,
  duration: 10,
  priority: 'normal',
  ...extra,
})

/** A plan that follows `order` exactly, without optimizing. */
export function planFor(problem: Problem, order: string[]): Plan {
  return { order, dropped: [], schedule: new Evaluator(problem).simulate(order) }
}
