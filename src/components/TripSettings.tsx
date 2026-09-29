import { useState } from 'react'
import { formatTime, parseTime } from '../core/time'
import type { Trip, TravelMode } from '../core/types'
import { Icon, type IconName } from './Icon'

interface Props {
  trip: Trip
  locked: boolean
  onChange: (patch: Partial<Trip>, why?: string) => void
}

const MODES: { mode: TravelMode; label: string; icon: IconName }[] = [
  { mode: 'walking', label: 'Walk', icon: 'walk' },
  { mode: 'cycling', label: 'Bike', icon: 'bike' },
  { mode: 'driving', label: 'Drive', icon: 'car' },
]

export function TripSettings({ trip, locked, onChange }: Props) {
  // Collapsed to one line once the day has stops, so the plan is what you see first.
  const [expanded, setExpanded] = useState(() => !trip.start || trip.stops.length === 0)
  const open = expanded || !trip.start
  const mode = MODES.find((m) => m.mode === trip.mode) ?? MODES[0]

  if (!open) {
    const end = trip.returnToStart ? 'round trip' : `ends at ${trip.end ? trip.end.name : 'last stop'}`
    return (
      <button className="card settings-summary" onClick={() => setExpanded(true)} aria-expanded={false}>
        <span className="settings-summary-main">
          <strong>{trip.start?.name}</strong>
          <span className="muted small">
            {formatTime(trip.dayStart)}–{formatTime(trip.dayEnd)} · {end}
          </span>
        </span>
        <span className="settings-summary-mode">
          <Icon name={mode.icon} size={16} />
          {mode.label}
        </span>
        <span className="settings-summary-edit">Edit</span>
      </button>
    )
  }

  return (
    <section className="card settings">
      {trip.start && trip.stops.length > 0 && (
        <button className="btn btn-sm btn-ghost settings-done" onClick={() => setExpanded(false)}>
          Done
        </button>
      )}
      <div className="field-row">
        <span className="field-label">Start</span>
        <span className="field-value">{trip.start?.name ?? <em className="muted">Search below or click the map, then “Set start”</em>}</span>
      </div>
      <div className="field-row">
        <span className="field-label">End</span>
        <label className="check">
          <input
            type="checkbox"
            checked={trip.returnToStart}
            disabled={locked}
            onChange={(e) => onChange({ returnToStart: e.target.checked }, 'Changed end point')}
          />
          Return to start
        </label>
      </div>
      {!trip.returnToStart && (
        <div className="field-row">
          <span className="field-label" />
          {trip.end ? (
            <span className="field-value end-value">
              {trip.end.name}
              {!locked && (
                <button
                  className="icon-btn"
                  aria-label="Clear end point"
                  title="End wherever the last stop is"
                  onClick={() => onChange({ end: null }, 'Changed end point')}
                >
                  ×
                </button>
              )}
            </span>
          ) : (
            <em className="field-value muted small">Ends at the last stop. Use “Set end” to pick a place.</em>
          )}
        </div>
      )}
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Day starts</span>
          <input
            type="time"
            value={formatTime(trip.dayStart)}
            disabled={locked}
            onChange={(e) => {
              const m = parseTime(e.target.value)
              if (m !== null) onChange({ dayStart: m }, 'Changed day start')
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">Day ends</span>
          <input
            type="time"
            value={formatTime(trip.dayEnd)}
            onChange={(e) => {
              const m = parseTime(e.target.value)
              if (m !== null) onChange({ dayEnd: m }, 'Changed day end')
            }}
          />
        </label>
      </div>
      {trip.dayEnd <= trip.dayStart && (
        <p className="flag flag-late small">The day ends before it starts. Set a later end time.</p>
      )}
      <div className="grid-2 grid-mode">
        <div className="field">
          <span className="field-label">Travel by</span>
          <div className="segmented" role="radiogroup" aria-label="Travel mode">
            {MODES.map(({ mode, label, icon }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={trip.mode === mode}
                className={trip.mode === mode ? 'active' : ''}
                onClick={() => onChange({ mode }, `Switched to ${label.toLowerCase()}`)}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label" title="Extra minutes added to every leg">Buffer (min)</span>
          <input
            type="number"
            min={0}
            max={60}
            value={trip.bufferMin}
            onChange={(e) => onChange({ bufferMin: Math.max(0, Number(e.target.value) || 0) }, 'Changed buffer')}
          />
        </label>
      </div>
    </section>
  )
}
