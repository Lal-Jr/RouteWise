import { formatDuration } from './time'
import type { Stop, Trip } from './types'

/**
 * Why a stop can never be scheduled, whatever the order, or null if it could fit.
 * Only looks at the stop's own hours against the day, not at travel between stops.
 */
export function unschedulableReason(stop: Stop, trip: Pick<Trip, 'dayStart' | 'dayEnd'>): string | null {
  const open = Math.max(stop.window?.open ?? trip.dayStart, trip.dayStart)
  const close = Math.min(stop.window?.close ?? trip.dayEnd, trip.dayEnd)
  if (stop.window && stop.window.close <= stop.window.open) return 'Closing time is before opening time.'
  if (close <= open) return 'It isn’t open during your day.'
  if (stop.duration > close - open) {
    return `The ${formatDuration(stop.duration)} visit is longer than it’s open during your day (${formatDuration(close - open)}).`
  }
  return null
}
