import { useCallback, useState } from 'react'
import { Itinerary } from './components/Itinerary'
import { LivePanel } from './components/LivePanel'
import { MapView } from './components/MapView'
import { NoticeBanner } from './components/NoticeBanner'
import { SearchBox } from './components/SearchBox'
import { TripSettings } from './components/TripSettings'
import { UndoToast } from './components/UndoToast'
import { formatDuration, formatTime } from './core/time'
import type { Place } from './core/types'
import { newId, useTripPlanner } from './state/useTripPlanner'
import './App.css'

export default function App() {
  const { trip, live, plan, matrix, matrixLoading, notice, undo, autoRepair, placeById, remainingLine, doneLine, actions } =
    useTripPlanner()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nameOf = useCallback((id: string) => placeById.get(id)?.name ?? 'Unknown place', [placeById])

  const addPlace = (place: Omit<Place, 'id'>, as: 'stop' | 'start') => {
    if (as === 'start') actions.updateTrip({ start: { id: `start-${newId()}`, ...place } }, 'Changed start')
    else actions.addStop(place)
  }

  const selectFromMap = (id: string) => {
    setSelectedId(id)
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const schedule = plan?.schedule
  const issues = schedule ? schedule.visits.filter((v) => v.late > 0).length + (schedule.overtime > 0 ? 1 : 0) : 0

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              ⟡
            </span>
            <h1>RouteWise</h1>
          </div>
          <div className="btn-row">
            <button className="btn btn-sm btn-ghost" onClick={actions.loadDemo}>
              Demo trip
            </button>
            <button className="btn btn-sm btn-ghost" onClick={actions.clearTrip}>
              New trip
            </button>
          </div>
        </header>

        <TripSettings trip={trip} locked={!!live} onChange={actions.updateTrip} />

        <SearchBox
          near={trip.start ?? undefined}
          placeholder={trip.start ? 'Add a place (museum, café, address…)' : 'Where does your day start?'}
          onPick={(r, as) => addPlace({ name: r.name, lat: r.lat, lng: r.lng }, as)}
          allowStart={!live}
        />
        <p className="hint small muted">Or click anywhere on the map.</p>

        {!trip.start && (
          <div className="empty card">
            <strong>Plan a day</strong>
            <p className="small muted">
              Set a starting point, add the places you want to see with their opening hours, and RouteWise finds a
              feasible order. It keeps the plan working as your day changes.
            </p>
          </div>
        )}

        {trip.start && schedule && plan && (
          <>
            <section className="summary">
              <div className={`status ${schedule.feasible ? 'status-ok' : 'status-bad'}`}>
                {schedule.feasible ? 'Feasible plan' : `${issues} timing issue${issues === 1 ? '' : 's'}`}
              </div>
              <dl className="stats">
                <div>
                  <dt>Stops</dt>
                  <dd>
                    {schedule.visits.length}
                    {plan.dropped.length > 0 && <span className="muted"> / {schedule.visits.length + plan.dropped.length}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Travel</dt>
                  <dd>{formatDuration(schedule.travelTotal)}</dd>
                </div>
                <div>
                  <dt>Waiting</dt>
                  <dd>{formatDuration(schedule.waitTotal)}</dd>
                </div>
                <div>
                  <dt>Done by</dt>
                  <dd>{formatTime(schedule.finish)}</dd>
                </div>
              </dl>
              <div className="btn-row">
                <button className="btn" onClick={actions.optimizeNow} title="Search for a better order from scratch">
                  Re-optimize
                </button>
                <label className="check small" title="Automatically reorder or drop stops whenever the plan becomes infeasible">
                  <input type="checkbox" checked={autoRepair} onChange={(e) => actions.setAutoRepair(e.target.checked)} />
                  Auto-repair
                </label>
                {!live && (
                  <button className="btn btn-primary push-right" onClick={actions.startTrip} disabled={!schedule.visits.length}>
                    Start trip
                  </button>
                )}
              </div>
              <p className="small muted source">
                {matrixLoading
                  ? 'Updating travel times…'
                  : matrix?.source === 'road'
                    ? 'Travel times from OpenStreetMap road routing'
                    : 'Routing service unreachable: using straight-line estimates'}
              </p>
            </section>

            {notice && <NoticeBanner key={notice.id} notice={notice} nameOf={nameOf} onDismiss={actions.dismissNotice} />}

            {live && (
              <LivePanel
                live={live}
                next={schedule.visits[0]}
                nameOf={nameOf}
                onComplete={actions.completeNext}
                onDelay={actions.delay}
                onSkip={actions.skipStop}
                onSetClock={actions.setClock}
                onFollowClock={actions.setFollowClock}
                onEnd={actions.endTrip}
              />
            )}

            <Itinerary
              trip={trip}
              plan={plan}
              live={live}
              selectedId={selectedId}
              nameOf={nameOf}
              onSelect={setSelectedId}
              onUpdate={actions.updateStop}
              onRemove={actions.removeStop}
              onMove={actions.moveStop}
            />
          </>
        )}
        {trip.start && !schedule && <p className="muted small">Fetching travel times…</p>}
      </aside>

      {undo && <UndoToast key={undo.id} entry={undo} onUndo={actions.undoLast} onDismiss={actions.dismissUndo} />}

      <main className="map-pane">
        <MapView
          trip={trip}
          plan={plan}
          live={live}
          remainingLine={remainingLine}
          doneLine={doneLine}
          selectedId={selectedId}
          onSelect={selectFromMap}
          onAddPlace={addPlace}
        />
      </main>
    </div>
  )
}
