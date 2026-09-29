import type { Minutes } from './types'

/** 545 -> "09:05"; values past midnight get a "+1d" suffix. */
export function formatTime(m: Minutes): string {
  const total = Math.round(m)
  const day = Math.floor(total / 1440)
  const inDay = ((total % 1440) + 1440) % 1440
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0')
  const mm = String(inDay % 60).padStart(2, '0')
  return day > 0 ? `${hh}:${mm} +${day}d` : `${hh}:${mm}`
}

/** "9:05" / "09:05" -> 545; returns null for anything unparseable. */
export function parseTime(s: string): Minutes | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null
  return h * 60 + m
}

/** 95 -> "1h 35m", 40 -> "40m". */
export function formatDuration(m: Minutes): string {
  const total = Math.round(m)
  if (total < 60) return `${total}m`
  const h = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

/** Local calendar date as "2026-09-29". */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** Minutes from midnight at the start of `day` ("2026-09-29") until `date`. */
export function minutesSince(day: string, date: Date): Minutes {
  const [y, m, d] = day.split('-').map(Number)
  return Math.floor((date.getTime() - new Date(y, m - 1, d).getTime()) / 60_000)
}

/**
 * Wall-clock time as trip minutes, never earlier than `current`. With the trip's `day` the
 * result counts from that day's midnight, so the next morning reads as "+1d". Without it,
 * times shortly after midnight are read as the next day when the clock is still late the
 * previous evening.
 */
export function followClock(current: Minutes, date: Date, day?: string): Minutes {
  let real: Minutes
  if (day) {
    real = minutesSince(day, date)
  } else {
    real = date.getHours() * 60 + date.getMinutes()
    while (current - real > 720) real += 1440
  }
  return Math.max(current, real)
}
