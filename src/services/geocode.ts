/**
 * Place search via OpenStreetMap Nominatim. Its usage policy forbids autocomplete, so callers
 * should only search on explicit submit.
 */
import type { LatLng } from '../core/types'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export interface SearchResult extends LatLng {
  name: string
  detail: string
}

interface NominatimPlace {
  lat: string
  lon: string
  name?: string
  display_name: string
}

function toResult(p: NominatimPlace): SearchResult {
  const [first, ...rest] = p.display_name.split(', ')
  return {
    lat: Number(p.lat),
    lng: Number(p.lon),
    name: p.name || first,
    detail: rest.slice(0, 3).join(', '),
  }
}

export async function searchPlaces(query: string, near?: LatLng): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6' })
  if (near) {
    // Bias (not restrict) results towards the area already being planned.
    const d = 0.5
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','))
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`)
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`)
  return ((await res.json()) as NominatimPlace[]).map(toResult)
}

export async function reverseGeocode(point: LatLng): Promise<string> {
  try {
    const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: 'jsonv2', zoom: '18' })
    const res = await fetch(`${NOMINATIM}/reverse?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as NominatimPlace
    return toResult(data).name
  } catch {
    return `Pinned location (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`
  }
}
