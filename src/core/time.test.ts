import { describe, expect, it } from 'vitest'
import { followClock } from './time'

const at = (h: number, m: number) => new Date(2026, 0, 1, h, m)

describe('followClock', () => {
  it('moves the trip clock forward to the wall clock', () => {
    expect(followClock(9 * 60, at(9, 42))).toBe(9 * 60 + 42)
  })

  it('never moves the clock backwards', () => {
    expect(followClock(11 * 60, at(10, 30))).toBe(11 * 60)
  })

  it('reads times just after midnight as the next day', () => {
    expect(followClock(23 * 60 + 50, at(0, 10))).toBe(1440 + 10)
  })
})
