/**
 * Road travel times from the public FOSSGIS OSRM servers (car, bike and foot profiles).
 * Any failure or unroutable pair falls back to a straight-line estimate so planning always works.
 */
import type { TravelMatrix } from '../core/problem'
import type { LatLng, Place, TravelMode } from '../core/types'

const OSRM_BASE: Record<TravelMode, string> = {
  driving: 'https://routing.openstreetmap.de/routed-car',
  cycling: 'https://routing.openstreetmap.de/routed-bike',
  walking: 'https://routing.openstreetmap.de/routed-foot',
}

/** Average speeds for the straight-line fallback, in km/h. */
const FALLBACK_SPEED: Record<TravelMode, number> = { driving: 30, cycling: 15, walking: 4.8 }
/** Roads are rarely straight; inflate crow-flies distance by this much. */
const DETOUR_FACTOR = 1.3
const TIMEOUT_MS = 10_000

export function haversineMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function estimate(a: LatLng, b: LatLng, mode: TravelMode): { minutes: number; metres: number } {
  const metres = haversineMetres(a, b) * DETOUR_FACTOR
  return { metres, minutes: metres / 1000 / FALLBACK_SPEED[mode] * 60 }
}

export function estimateMatrix(places: Place[], mode: TravelMode): TravelMatrix {
  const cells = places.map((a) => places.map((b) => estimate(a, b, mode)))
  return {
    ids: places.map((p) => p.id),
    minutes: cells.map((row) => row.map((c) => c.minutes)),
    metres: cells.map((row) => row.map((c) => c.metres)),
    source: 'estimate',
  }
}

const coordList = (points: LatLng[]) => points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface OsrmTable {
  code: string
  durations: (number | null)[][]
  distances: (number | null)[][]
}

/*
 * Road matrices are cached in localStorage by mode and coordinates. Reloading the page or
 * reopening a trip then plans instantly, and the rate-limited public server sees one request
 * per distinct set of places instead of one per page load.
 */
const CACHE_KEY = 'routewise.matrixCache'
const CACHE_ENTRIES = 12

type MatrixCache = Record<string, { at: number; matrix: TravelMatrix }>

function readCache(): MatrixCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as MatrixCache
  } catch {
    return {}
  }
}

function writeCache(key: string, matrix: TravelMatrix) {
  const cache = readCache()
  cache[key] = { at: Date.now(), matrix }
  const newest = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_ENTRIES)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(newest)))
  } catch {
    // Storage full or unavailable: the matrix is simply fetched again next time.
  }
}

export async function fetchMatrix(places: Place[], mode: TravelMode, signal?: AbortSignal): Promise<TravelMatrix> {
  if (places.length < 2) return estimateMatrix(places, mode)
  const cacheKey = `${mode}|${places.map((p) => `${p.id}@${coordList([p])}`).join(';')}`
  const cached = readCache()[cacheKey]
  if (cached) return cached.matrix
  try {
    const url = `${OSRM_BASE[mode]}/table/v1/driving/${coordList(places)}?annotations=duration,distance`
    const data = (await fetchJson(url, signal)) as OsrmTable
    if (data.code !== 'Ok') throw new Error(data.code)
    const fallback = estimateMatrix(places, mode)
    const matrix: TravelMatrix = {
      ids: places.map((p) => p.id),
      minutes: data.durations.map((row, i) => row.map((s, j) => (s === null ? fallback.minutes[i][j] : s / 60))),
      metres: data.distances.map((row, i) => row.map((m, j) => (m === null ? fallback.metres[i][j] : m))),
      source: 'road',
    }
    writeCache(cacheKey, matrix)
    return matrix
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('Routing service unavailable, using straight-line estimates', err)
    return estimateMatrix(places, mode)
  }
}

/** Road geometry through `points` in order; straight segments if routing fails. */
export async function fetchRouteLine(points: LatLng[], mode: TravelMode, signal?: AbortSignal): Promise<LatLng[]> {
  if (points.length < 2) return points
  try {
    const url = `${OSRM_BASE[mode]}/route/v1/driving/${coordList(points)}?overview=full&geometries=geojson`
    const data = (await fetchJson(url, signal)) as {
      code: string
      routes: { geometry: { coordinates: [number, number][] } }[]
    }
    if (data.code !== 'Ok' || !data.routes.length) throw new Error(data.code)
    return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  } catch (err) {
    if (signal?.aborted) throw err
    return points
  }
}
