import { dayKey, formatTime, parseTime } from '../core/time'
import type { Visit } from '../core/solver'
import type { LatLng, LiveState, TravelMode } from '../core/types'

const GMAPS_MODE: Record<TravelMode, string> = { walking: 'walking', cycling: 'bicycling', driving: 'driving' }

/** Turn-by-turn directions from wherever the phone is to `to`, in Google Maps. */
const directionsUrl = (to: LatLng, mode: TravelMode) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${GMAPS_MODE[mode]}`

const formatDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

interface Props {
  live: LiveState
  next: Visit | undefined
  nextPlace: LatLng | undefined
  mode: TravelMode
  nameOf: (id: string) => string
  onComplete: () => void
  onDelay: (minutes: number) => void
  onSkip: (id: string) => void
  onSetClock: (now: number) => void
  onFollowClock: (on: boolean) => void
  onEnd: () => void
}

export function LivePanel({ live, next, nextPlace, mode, nameOf, onComplete, onDelay, onSkip, onSetClock, onFollowClock, onEnd }: Props) {
  return (
    <section className="card live">
      <div className="live-head">
        <span className="live-dot" aria-hidden />
        <strong>On the road</strong>
        <label className="live-clock">
          <span className="muted small">Clock</span>
          <input
            type="time"
            value={formatTime(live.now)}
            disabled={live.followClock}
            onChange={(e) => {
              const m = parseTime(e.target.value)
              if (m !== null) onSetClock(m)
            }}
          />
        </label>
      </div>
      <label className="live-follow small">
        <input type="checkbox" checked={!!live.followClock} onChange={(e) => onFollowClock(e.target.checked)} />
        Follow real time
      </label>
      {live.day && live.day !== dayKey(new Date()) && (
        <div className="live-stale small">
          This trip was started on {formatDay(live.day)}.
          <button className="btn btn-sm" onClick={onEnd}>
            End it
          </button>
        </div>
      )}
      <p className="small muted">
        At <strong>{nameOf(live.currentPlaceId)}</strong>
        {live.completed.length > 0 && ` · ${live.completed.length} done`}
      </p>
      {next ? (
        <>
          <p className="live-next">
            Next: <strong>{nameOf(next.stopId)}</strong>, arrive {formatTime(next.arrival)}
            {next.wait > 0.5 && `, starts ${formatTime(next.start)}`}
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onComplete}>
              {live.followClock ? 'Visited, leaving now' : `Visited, leaving ${formatTime(next.end)}`}
            </button>
            {nextPlace && (
              <a className="btn" href={directionsUrl(nextPlace, mode)} target="_blank" rel="noreferrer">
                Navigate
              </a>
            )}
            <button className="btn" onClick={() => onSkip(next.stopId)}>
              Skip
            </button>
          </div>
        </>
      ) : (
        <p className="live-next">No stops left. Head to the finish.</p>
      )}
      <div className="btn-row">
        <span className="small muted">Running late:</span>
        {[15, 30, 60].map((m) => (
          <button key={m} className="btn btn-sm" onClick={() => onDelay(m)}>
            +{m}m
          </button>
        ))}
        <button className="btn btn-sm btn-ghost push-right" onClick={onEnd}>
          End trip
        </button>
      </div>
    </section>
  )
}
