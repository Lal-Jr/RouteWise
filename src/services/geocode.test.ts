import { describe, expect, it } from 'vitest'
import { toResult } from './geocode'

describe('toResult', () => {
  it('uses the place name when there is one', () => {
    const r = toResult({ lat: '1', lon: '2', name: 'Louvre Museum', display_name: 'Louvre Museum, Rue de Rivoli, Paris, France' })
    expect(r).toMatchObject({ name: 'Louvre Museum', detail: 'Rue de Rivoli, Paris, France', lat: 1, lng: 2 })
  })

  it('keeps the street with a bare house number', () => {
    const r = toResult({ lat: '1', lon: '2', display_name: '141, Rue de Rivoli, Paris, Île-de-France, France' })
    expect(r.name).toBe('141 Rue de Rivoli')
    expect(r.detail).toBe('Paris, Île-de-France, France')
  })
})
