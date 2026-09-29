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

/**
 * Wall-clock time as trip minutes, never earlier than `current`. Times shortly after midnight
 * are read as the next day ("+1d") when the trip clock is still late the previous evening.
 */
export function followClock(current: Minutes, date: Date): Minutes {
  let real = date.getHours() * 60 + date.getMinutes()
  while (current - real > 720) real += 1440
  return Math.max(current, real)
}
