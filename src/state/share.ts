import type { Trip } from '../core/types'

const PARAM = 'trip='

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(data: string): string {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

const isPlace = (p: unknown): boolean =>
  typeof p === 'object' && p !== null && typeof (p as { name?: unknown }).name === 'string' &&
  Number.isFinite((p as { lat?: unknown }).lat) && Number.isFinite((p as { lng?: unknown }).lng)

/** A link that opens this trip (not live progress) in someone else's browser. */
export function shareUrl(trip: Trip, base = window.location.href): string {
  const url = new URL(base)
  url.hash = PARAM + toBase64Url(JSON.stringify(trip))
  return url.toString()
}

/** Reads a trip from a share link's hash; null when there is none or it is malformed. */
export function tripFromHash(hash: string): Trip | null {
  const at = hash.indexOf(PARAM)
  if (at < 0) return null
  try {
    const trip = JSON.parse(fromBase64Url(hash.slice(at + PARAM.length))) as Trip
    const ok =
      (trip.start === null || isPlace(trip.start)) &&
      (trip.end === null || isPlace(trip.end)) &&
      Array.isArray(trip.stops) &&
      trip.stops.every((s) => isPlace(s) && typeof s.id === 'string' && Number.isFinite(s.duration)) &&
      Number.isFinite(trip.dayStart) &&
      Number.isFinite(trip.dayEnd) &&
      ['walking', 'cycling', 'driving'].includes(trip.mode)
    return ok ? trip : null
  } catch {
    return null
  }
}
