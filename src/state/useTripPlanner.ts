import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildProblem, tripPlaces, type TravelMatrix } from '../core/problem'
import { followPlan, repairPlan, snapshot, type Change, type PlanSnapshot, type RepairStrategy } from '../core/repair'
import { optimize, type Plan } from '../core/solver'
import { followClock } from '../core/time'
import type { LatLng, LiveState, Minutes, Place, Stop, Trip } from '../core/types'
import { fetchMatrix, fetchRouteLine } from '../services/routing'
import { demoTrip } from './demo'

export interface Notice {
  id: number
  reason: string | null
  strategy: RepairStrategy | 'optimized'
  changes: Change[]
  /** Travel minutes saved by a manual optimize. */
  saved?: Minutes
}

const EMPTY_SNAPSHOT: PlanSnapshot = { order: [], dropped: [], starts: {} }

function usePersistent<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable (private mode, quota); state still works for this session.
    }
  }, [key, value])
  return [value, setValue]
}

function sameSnapshot(a: PlanSnapshot, b: PlanSnapshot): boolean {
  if (a.order.join('|') !== b.order.join('|') || a.dropped.join('|') !== b.dropped.join('|')) return false
  const keys = Object.keys(a.starts)
  if (keys.length !== Object.keys(b.starts).length) return false
  return keys.every((k) => b.starts[k] !== undefined && Math.abs(a.starts[k] - b.starts[k]) < 0.01)
}

/** A notice is worth showing if the plan's shape changed, or times moved while travelling. */
function isNoteworthy(strategy: RepairStrategy, changes: Change[], live: boolean): boolean {
  if (strategy === 'reorder' || strategy === 'drop') return true
  if (changes.some((c) => c.kind === 'dropped' || c.kind === 'restored')) return true
  return live && strategy === 'retime'
}

export const newId = () => crypto.randomUUID()

export function useTripPlanner() {
  const [trip, setTrip] = usePersistent<Trip>('routewise.trip', demoTrip)
  const [live, setLive] = usePersistent<LiveState | null>('routewise.live', null)
  const [snap, setSnap] = usePersistent<PlanSnapshot>('routewise.plan', EMPTY_SNAPSHOT)
  const [autoRepair, setAutoRepair] = usePersistent('routewise.autoRepair', true)
  const [matrix, setMatrix] = useState<TravelMatrix | null>(null)
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const reason = useRef<string | null>(null)
  const silent = useRef(false)
  /** Set for wall-clock ticks: only a change to the plan's shape is worth a banner. */
  const tick = useRef(false)
  const noticeSeq = useRef(0)

  // --- Travel times -------------------------------------------------------------------------
  const places = useMemo(() => tripPlaces(trip), [trip])
  const placesKey = `${trip.mode}|${places.map((p) => `${p.id}@${p.lat},${p.lng}`).join(';')}`
  useEffect(() => {
    const controller = new AbortController()
    setMatrixLoading(true)
    fetchMatrix(places, trip.mode, controller.signal)
      .then((m) => {
        setMatrix(m)
        setMatrixLoading(false)
      })
      .catch(() => {
        // Aborted because the places changed again; the newer request takes over.
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placesKey captures places and mode
  }, [placesKey])

  // --- Plan evaluation and automatic repair ------------------------------------------------------
  const problem = useMemo(() => (matrix ? buildProblem(trip, matrix, live ?? undefined) : null), [trip, matrix, live])

  const evaluation = useMemo(() => {
    if (!problem) return null
    if (snap.order.length === 0 && snap.dropped.length === 0) {
      // Nothing planned yet (fresh trip, demo loaded, trip finished): plan from scratch.
      return { plan: optimize(problem), strategy: 'none' as const, changes: [] as Change[] }
    }
    if (!autoRepair) {
      return { plan: followPlan(problem, snap), strategy: 'none' as const, changes: [] as Change[] }
    }
    return repairPlan(problem, snap)
  }, [problem, snap, autoRepair])

  const lastPlan = useRef<Plan | null>(null)
  if (evaluation) lastPlan.current = evaluation.plan
  const plan = evaluation?.plan ?? lastPlan.current

  useEffect(() => {
    if (!evaluation) return
    const next = snapshot(evaluation.plan)
    if (!sameSnapshot(next, snap)) {
      setSnap(next)
      if (!silent.current && isNoteworthy(evaluation.strategy, evaluation.changes, live !== null && !tick.current)) {
        setNotice({
          id: ++noticeSeq.current,
          reason: reason.current,
          strategy: evaluation.strategy,
          changes: evaluation.changes,
        })
      }
    }
    silent.current = false
    tick.current = false
    reason.current = null
  }, [evaluation, snap, setSnap, live])

  const because = (why: string) => {
    reason.current = why
  }

  // --- Route geometry ----------------------------------------------------------------------------
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const endPlace = trip.returnToStart ? trip.start : trip.end
  const remainingPath = useMemo(() => {
    if (!plan || !trip.start) return []
    const from = placeById.get(live?.currentPlaceId ?? trip.start.id) ?? trip.start
    const stops = plan.order.map((id) => placeById.get(id)).filter((p): p is Place => !!p)
    return [from, ...stops, ...(endPlace ? [endPlace] : [])]
  }, [plan, trip.start, live?.currentPlaceId, placeById, endPlace])
  const donePath = useMemo(() => {
    if (!live || !trip.start) return []
    return [trip.start, ...live.completed.map((c) => placeById.get(c.stopId)).filter((p): p is Place => !!p)]
  }, [live, trip.start, placeById])

  const remainingLine = useRouteLine(remainingPath, trip.mode)
  const doneLine = useRouteLine(donePath, trip.mode)

  // --- Trip editing ------------------------------------------------------------------------------
  const updateTrip = useCallback((patch: Partial<Trip>, why?: string) => {
    if (why) because(why)
    setTrip((t) => ({ ...t, ...patch }))
  }, [setTrip])

  const addStop = useCallback(
    (place: Omit<Place, 'id'>, extra: Partial<Stop> = {}) => {
      because(`Added ${place.name}`)
      setTrip((t) => ({
        ...t,
        stops: [...t.stops, { id: newId(), duration: 60, priority: 'normal', ...place, ...extra }],
      }))
    },
    [setTrip],
  )

  const updateStop = useCallback(
    (id: string, patch: Partial<Stop>) => {
      setTrip((t) => {
        const s = t.stops.find((x) => x.id === id)
        if (s) because(`Updated ${s.name}`)
        return { ...t, stops: t.stops.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
      })
    },
    [setTrip],
  )

  const removeStop = useCallback(
    (id: string) => {
      setTrip((t) => ({ ...t, stops: t.stops.filter((s) => s.id !== id) }))
    },
    [setTrip],
  )

  /** Manually moves a stop within the itinerary; auto-repair may undo it if it breaks feasibility. */
  const moveStop = useCallback(
    (id: string, delta: number) => {
      const order = snap.order.slice()
      const i = order.indexOf(id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= order.length) return
      ;[order[i], order[j]] = [order[j], order[i]]
      because('Manual reorder')
      setSnap({ ...snap, order })
    },
    [snap, setSnap],
  )

  const optimizeNow = useCallback(() => {
    if (!problem || !plan) return
    const before = plan.schedule.travelTotal
    const next = optimize(problem, plan.order)
    silent.current = true
    setSnap(snapshot(next))
    setNotice({
      id: ++noticeSeq.current,
      reason: 'Full re-optimization',
      strategy: 'optimized',
      changes: [],
      saved: before - next.schedule.travelTotal,
    })
  }, [problem, plan, setSnap])

  const loadDemo = useCallback(() => {
    silent.current = true
    setLive(null)
    setSnap(EMPTY_SNAPSHOT)
    setTrip(demoTrip)
    setNotice(null)
  }, [setLive, setSnap, setTrip])

  const clearTrip = useCallback(() => {
    silent.current = true
    setLive(null)
    setSnap(EMPTY_SNAPSHOT)
    setTrip((t) => ({ ...t, start: null, end: null, stops: [] }))
    setNotice(null)
  }, [setLive, setSnap, setTrip])

  // --- Live trip ---------------------------------------------------------------------------------
  const startTrip = useCallback(() => {
    if (!trip.start) return
    setLive({ now: trip.dayStart, currentPlaceId: trip.start.id, completed: [], skipped: [] })
    setNotice(null)
  }, [trip.start, trip.dayStart, setLive])

  const endTrip = useCallback(() => {
    silent.current = true
    setLive(null)
    setSnap(EMPTY_SNAPSHOT)
    setNotice(null)
  }, [setLive, setSnap])

  const completeNext = useCallback(() => {
    const visit = plan?.schedule.visits[0]
    if (!live || !visit) return
    silent.current = true // following the plan as scheduled is not a disruption
    setLive({
      ...live,
      now: visit.end,
      currentPlaceId: visit.stopId,
      completed: [...live.completed, { stopId: visit.stopId, arrivedAt: visit.arrival, departedAt: visit.end }],
    })
  }, [plan, live, setLive])

  const delay = useCallback(
    (minutes: Minutes, why = `Running ${minutes} min late`) => {
      if (!live) return
      because(why)
      setLive({ ...live, now: live.now + minutes })
    },
    [live, setLive],
  )

  const setClock = useCallback(
    (now: Minutes) => {
      if (!live) return
      because('Clock updated')
      setLive({ ...live, now })
    },
    [live, setLive],
  )

  const setFollowClock = useCallback(
    (on: boolean) => {
      if (!live) return
      setLive({ ...live, followClock: on })
    },
    [live, setLive],
  )

  // While following real time, catch the trip clock up with the wall clock.
  const following = live?.followClock === true
  useEffect(() => {
    if (!following) return
    const sync = () => {
      setLive((l) => {
        if (!l) return l
        const now = followClock(l.now, new Date())
        if (now === l.now) return l
        tick.current = true
        because('Clock caught up with real time')
        return { ...l, now }
      })
    }
    sync()
    const timer = setInterval(sync, 15_000)
    return () => clearInterval(timer)
  }, [following, setLive])

  const skipStop = useCallback(
    (id: string) => {
      if (!live) return
      const s = trip.stops.find((x) => x.id === id)
      because(`Skipped ${s?.name ?? 'stop'}`)
      setLive({ ...live, skipped: [...live.skipped, id] })
    },
    [live, trip.stops, setLive],
  )

  return {
    trip,
    live,
    plan,
    matrix,
    matrixLoading,
    notice,
    autoRepair,
    placeById,
    remainingLine,
    doneLine,
    actions: {
      updateTrip,
      addStop,
      updateStop,
      removeStop,
      moveStop,
      optimizeNow,
      loadDemo,
      clearTrip,
      setAutoRepair,
      dismissNotice: () => setNotice(null),
      startTrip,
      endTrip,
      completeNext,
      delay,
      setClock,
      setFollowClock,
      skipStop,
    },
  }
}

function useRouteLine(points: LatLng[], mode: Trip['mode']): LatLng[] {
  const [line, setLine] = useState<LatLng[]>([])
  const key = `${mode}|${points.map((p) => `${p.lat},${p.lng}`).join(';')}`
  useEffect(() => {
    setLine(points) // straight segments until the road geometry arrives
    if (points.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchRouteLine(points, mode, controller.signal).then(setLine, () => {})
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures points and mode
  }, [key])
  return line
}
