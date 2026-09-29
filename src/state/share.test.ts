import { describe, expect, it } from 'vitest'
import { demoTrip } from './demo'
import { shareUrl, tripFromHash } from './share'

describe('share links', () => {
  it('round-trips a trip, including non-ASCII names', () => {
    const url = new URL(shareUrl(demoTrip, 'https://example.com/RouteWise/'))
    expect(url.pathname).toBe('/RouteWise/')
    expect(tripFromHash(url.hash)).toEqual(demoTrip)
  })

  it('ignores missing or malformed links', () => {
    expect(tripFromHash('')).toBeNull()
    expect(tripFromHash('#trip=not-base64!')).toBeNull()
    expect(tripFromHash('#trip=' + btoa('{"stops":"nope"}'))).toBeNull()
  })
})
