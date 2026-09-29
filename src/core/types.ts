/** Minutes since midnight of the trip day. */
export type Minutes = number

export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  id: string
  name: string
}

/** Opening hours: a visit must start at or after `open` and finish by `close`. */
export interface TimeWindow {
  open: Minutes
  close: Minutes
}

/** `must` stops are never dropped by the optimizer or by repair. */
export type Priority = 'must' | 'high' | 'normal' | 'low'

export interface Stop extends Place {
  duration: Minutes
  window?: TimeWindow
  priority: Priority
}

export type TravelMode = 'driving' | 'cycling' | 'walking'

export interface Trip {
  start: Place | null
  /** Where the day ends. Ignored when `returnToStart` is set; null means "wherever the last stop is". */
  end: Place | null
  returnToStart: boolean
  dayStart: Minutes
  dayEnd: Minutes
  mode: TravelMode
  /** Slack added to every leg to absorb small delays. */
  bufferMin: Minutes
  stops: Stop[]
}

/** Progress while the trip is being travelled. */
export interface LiveState {
  now: Minutes
  /** Id of the place the traveller is at (the start place or a completed stop). */
  currentPlaceId: string
  completed: { stopId: string; arrivedAt: Minutes; departedAt: Minutes }[]
  skipped: string[]
  /** Advance `now` with the wall clock instead of only by hand. */
  followClock?: boolean
}
