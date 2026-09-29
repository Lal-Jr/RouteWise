import { formatTime, parseTime } from '../core/time'
import type { Visit } from '../core/solver'
import type { LiveState } from '../core/types'

interface Props {
  live: LiveState
  next: Visit | undefined
  nameOf: (id: string) => string
  onComplete: () => void
  onDelay: (minutes: number) => void
  onSkip: (id: string) => void
  onSetClock: (now: number) => void
  onFollowClock: (on: boolean) => void
  onEnd: () => void
}

export function LivePanel({ live, next, nameOf, onComplete, onDelay, onSkip, onSetClock, onFollowClock, onEnd }: Props) {
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
              Visited, leaving {formatTime(next.end)}
            </button>
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
