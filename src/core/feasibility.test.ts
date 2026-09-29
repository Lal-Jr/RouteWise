import { describe, expect, it } from 'vitest'
import { unschedulableReason } from './feasibility'
import type { Stop } from './types'

const day = { dayStart: 9 * 60, dayEnd: 18 * 60 }
const stop = (extra: Partial<Stop> = {}): Stop => ({ id: 'a', name: 'A', lat: 0, lng: 0, duration: 60, priority: 'normal', ...extra })

describe('unschedulableReason', () => {
  it('accepts a stop that fits its hours', () => {
    expect(unschedulableReason(stop({ window: { open: 600, close: 720 } }), day)).toBeNull()
  })

  it('flags hours that close before they open', () => {
    expect(unschedulableReason(stop({ window: { open: 720, close: 600 } }), day)).toMatch(/before opening/)
  })

  it('flags a place that is only open outside the day', () => {
    expect(unschedulableReason(stop({ window: { open: 19 * 60, close: 22 * 60 } }), day)).toMatch(/isn’t open/)
  })

  it('flags a visit longer than the time it is open during the day', () => {
    expect(unschedulableReason(stop({ duration: 120, window: { open: 17 * 60, close: 20 * 60 } }), day)).toMatch(/longer/)
  })
})
