import type { Problem } from './solver'
import type { LiveState, Minutes, Place, Trip } from './types'

/** Travel times between places, in minutes, keyed by place id. */
export interface TravelMatrix {
  ids: string[]
  minutes: Minutes[][]
  /** Metres, used for display only. */
  metres: number[][]
  source: 'road' | 'estimate'
}

/** Every place the matrix needs to cover: start, a distinct end point, then the stops. */
export function tripPlaces(trip: Trip): Place[] {
  const places: Place[] = []
  if (trip.start) places.push(trip.start)
  if (!trip.returnToStart && trip.end && trip.end.id !== trip.start?.id) places.push(trip.end)
  places.push(...trip.stops)
  return places
}

/**
 * Builds the solver problem for the remaining part of the trip. Returns null when the
 * matrix does not (yet) cover every place, e.g. while it is being fetched.
 */
export function buildProblem(trip: Trip, matrix: TravelMatrix, live?: LiveState): Problem | null {
  if (!trip.start) return null
  const index = new Map(matrix.ids.map((id, i) => [id, i]))
  if (!tripPlaces(trip).every((p) => index.has(p.id))) return null

  const finished = new Set([
    ...(live?.completed.map((c) => c.stopId) ?? []),
    ...(live?.skipped ?? []),
  ])
  const startNode = index.get(live?.currentPlaceId ?? trip.start.id)
  if (startNode === undefined) return null

  const endId = trip.returnToStart ? trip.start.id : trip.end?.id
  const buffer = trip.bufferMin
  return {
    startNode,
    endNode: endId === undefined ? null : index.get(endId)!,
    startTime: live ? live.now : trip.dayStart,
    dayEnd: trip.dayEnd,
    stops: trip.stops
      .filter((s) => !finished.has(s.id))
      .map((s) => ({
        id: s.id,
        node: index.get(s.id)!,
        duration: s.duration,
        window: s.window,
        priority: s.priority,
      })),
    travel: (a, b) => (a === b ? 0 : matrix.minutes[a][b] + buffer),
  }
}
