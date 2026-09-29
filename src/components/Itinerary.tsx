import { unschedulableReason } from '../core/feasibility'
import type { Plan, Visit } from '../core/solver'
import { formatDuration, formatTime, parseTime } from '../core/time'
import type { LiveState, Priority, Stop, Trip } from '../core/types'
import { Icon, type IconName } from './Icon'

const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Must visit',
  high: 'High',
  normal: 'Normal',
  low: 'Nice to have',
}

const MODE_VERB = { walking: 'walk', cycling: 'ride', driving: 'drive' } as const
const MODE_ICON: Record<Trip['mode'], IconName> = { walking: 'walk', cycling: 'bike', driving: 'car' }

interface Props {
  trip: Trip
  plan: Plan
  live: LiveState | null
  selectedId: string | null
  nameOf: (id: string) => string
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<Stop>) => void
  onRemove: (id: string) => void
  onMove: (id: string, delta: number) => void
}

export function Itinerary({ trip, plan, live, selectedId, nameOf, onSelect, onUpdate, onRemove, onMove }: Props) {
  const stopById = new Map(trip.stops.map((s) => [s.id, s]))
  const { schedule } = plan
  const firstNumber = (live?.completed.length ?? 0) + 1
  const endName = trip.returnToStart ? trip.start?.name : trip.end?.name
  const departTime = live ? live.now : trip.dayStart

  return (
    <div className="itinerary">
      <ol className="timeline">
        {live?.completed.map((c, i) => (
          <li key={c.stopId} className="tl-stop tl-done">
            <span className="badge badge-done" aria-hidden>
              ✓
            </span>
            <div className="tl-main">
              <span className="tl-name">
                {i + 1}. {nameOf(c.stopId)}
              </span>
              <span className="muted small">
                {formatTime(c.arrivedAt)}–{formatTime(c.departedAt)}
              </span>
            </div>
          </li>
        ))}

        <li className="tl-anchor">
          <span className="badge badge-anchor" aria-hidden>
            <Icon name="home" size={15} />
          </span>
          <div className="tl-main">
            <span className="tl-name">{live ? `Leave ${nameOf(live.currentPlaceId)}` : `Depart ${trip.start?.name}`}</span>
            <span className="muted small">{formatTime(departTime)}</span>
          </div>
        </li>

        {schedule.visits.map((v, i) => {
          const stop = stopById.get(v.stopId)
          if (!stop) return null
          return (
            <StopItem
              key={v.stopId}
              visit={v}
              stop={stop}
              number={firstNumber + i}
              verb={MODE_VERB[trip.mode]}
              modeIcon={MODE_ICON[trip.mode]}
              selected={selectedId === v.stopId}
              canMoveUp={i > 0}
              canMoveDown={i < schedule.visits.length - 1}
              onSelect={() => onSelect(selectedId === v.stopId ? null : v.stopId)}
              onUpdate={(patch) => onUpdate(v.stopId, patch)}
              onRemove={() => onRemove(v.stopId)}
              onMove={(d) => onMove(v.stopId, d)}
            />
          )
        })}

        {endName && (
          <>
            <li className="tl-leg muted small">
              <Icon name={MODE_ICON[trip.mode]} size={14} />
              {formatDuration(schedule.endTravel)} {MODE_VERB[trip.mode]}
            </li>
            <li className={`tl-anchor ${schedule.overtime > 0 ? 'tl-late' : ''}`}>
              <span className="badge badge-anchor" aria-hidden>
                <Icon name="flag" size={15} />
              </span>
              <div className="tl-main">
                <span className="tl-name">Arrive {endName}</span>
                <span className="small">
                  {formatTime(schedule.finish)}
                  {schedule.overtime > 0 && (
                    <span className="flag flag-late"> {formatDuration(schedule.overtime)} past day end</span>
                  )}
                </span>
              </div>
            </li>
          </>
        )}
      </ol>

      {plan.dropped.length > 0 && (
        <div className="dropped">
          <h3>Didn’t fit today</h3>
          <p className="muted small">
            Automatically left out to keep the day feasible. They come back on their own if time frees up.
          </p>
          <ul>
            {plan.dropped.map((id) => {
              const s = stopById.get(id)
              if (!s) return null
              const why = unschedulableReason(s, trip)
              const open = selectedId === id
              return (
                <li key={id} id={`stop-${id}`} className={open ? 'dropped-open' : ''}>
                  <div className="dropped-row">
                    <button className="tl-head" onClick={() => onSelect(open ? null : id)} aria-expanded={open}>
                      <span className="tl-name">{s.name}</span>
                      <span className="muted small">
                        {PRIORITY_LABEL[s.priority]} · {formatDuration(s.duration)}
                      </span>
                    </button>
                    <div className="btn-row">
                      {!why && (
                        <button className="btn btn-sm" onClick={() => onUpdate(id, { priority: 'must' })}>
                          Make must-visit
                        </button>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => onRemove(id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  {why && <div className="flag flag-late small">{why} Open it to change the hours or visit length.</div>}
                  {open && (
                    <StopEditor
                      stop={s}
                      canMoveUp={false}
                      canMoveDown={false}
                      onUpdate={(patch) => onUpdate(id, patch)}
                      onRemove={() => onRemove(id)}
                      onMove={() => {}}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

interface StopItemProps {
  visit: Visit
  stop: Stop
  number: number
  verb: string
  modeIcon: IconName
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<Stop>) => void
  onRemove: () => void
  onMove: (delta: number) => void
}

function StopItem({ visit, stop, number, verb, modeIcon, selected, canMoveUp, canMoveDown, onSelect, onUpdate, onRemove, onMove }: StopItemProps) {
  return (
    <>
      <li className="tl-leg muted small">
        <Icon name={modeIcon} size={14} />
        {formatDuration(visit.travel)} {verb}
        {visit.wait >= 1 && <span className="flag flag-wait"> then wait {formatDuration(visit.wait)}</span>}
      </li>
      <li
        className={`tl-stop ${visit.late > 0 ? 'tl-late' : ''} ${selected ? 'tl-selected' : ''}`}
        id={`stop-${stop.id}`}
      >
        <span className={`badge ${visit.late > 0 ? 'badge-late' : ''}`} aria-hidden>
          {number}
        </span>
        <div className="tl-main">
          <button className="tl-head" onClick={onSelect} aria-expanded={selected}>
            <span className="tl-name">{stop.name}</span>
            <span className="tl-time">
              {formatTime(visit.start)}–{formatTime(visit.end)}
            </span>
          </button>
          <div className="tl-meta small muted">
            {stop.window ? `Open ${formatTime(stop.window.open)}–${formatTime(stop.window.close)}` : 'Any time'}
            {' · '}
            <span className={`chip chip-${stop.priority}`}>{PRIORITY_LABEL[stop.priority]}</span>
          </div>
          {visit.late > 0 && (
            <div className="flag flag-late small">Runs {formatDuration(visit.late)} past closing</div>
          )}
          {selected && (
            <StopEditor
              stop={stop}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onMove={onMove}
            />
          )}
        </div>
      </li>
    </>
  )
}

interface EditorProps {
  stop: Stop
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (patch: Partial<Stop>) => void
  onRemove: () => void
  onMove: (delta: number) => void
}

function StopEditor({ stop, canMoveUp, canMoveDown, onUpdate, onRemove, onMove }: EditorProps) {
  const setWindowPart = (part: 'open' | 'close', value: string) => {
    const m = parseTime(value)
    if (m === null || !stop.window) return
    onUpdate({ window: { ...stop.window, [part]: m } })
  }
  return (
    <div className="editor">
      <label className="field">
        <span className="field-label">Name</span>
        <input
          type="text"
          value={stop.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) onUpdate({ name: 'Unnamed stop' })
          }}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Visit length (min)</span>
          <input
            type="number"
            min={0}
            step={5}
            value={stop.duration}
            onChange={(e) => onUpdate({ duration: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="field">
          <span className="field-label">Priority</span>
          <select value={stop.priority} onChange={(e) => onUpdate({ priority: e.target.value as Priority })}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={!!stop.window}
          onChange={(e) => onUpdate({ window: e.target.checked ? { open: 9 * 60, close: 18 * 60 } : undefined })}
        />
        Has opening hours
      </label>
      {stop.window && (
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Opens</span>
            <input type="time" value={formatTime(stop.window.open)} onChange={(e) => setWindowPart('open', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Closes</span>
            <input type="time" value={formatTime(stop.window.close)} onChange={(e) => setWindowPart('close', e.target.value)} />
          </label>
        </div>
      )}
      <div className="btn-row">
        {(canMoveUp || canMoveDown) && (
          <>
            <button className="btn btn-sm" disabled={!canMoveUp} onClick={() => onMove(-1)}>
              ↑ Earlier
            </button>
            <button className="btn btn-sm" disabled={!canMoveDown} onClick={() => onMove(1)}>
              ↓ Later
            </button>
          </>
        )}
        <button className="btn btn-sm btn-danger push-right" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}
