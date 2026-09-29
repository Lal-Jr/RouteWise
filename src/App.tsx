import { useCallback, useState } from 'react'
import { Itinerary } from './components/Itinerary'
import { LivePanel } from './components/LivePanel'
import { MapView } from './components/MapView'
import { NoticeBanner } from './components/NoticeBanner'
import { SearchBox } from './components/SearchBox'
import { TripSettings } from './components/TripSettings'
import { Toast } from './components/Toast'
import { formatDuration, formatTime } from './core/time'
import type { Place, PlaceRole } from './core/types'
import { newId, useTripPlanner } from './state/useTripPlanner'
import './App.css'

export default function App() {
  const { trip, live, plan, matrix, matrixLoading, notice, toast, autoRepair, placeById, remainingLine, doneLine, actions } =
    useTripPlanner()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nameOf = useCallback((id: string) => placeById.get(id)?.name ?? 'Unknown place', [placeById])

  const addPlace = (place: Omit<Place, 'id'>, as: PlaceRole) => {
    if (as === 'start') actions.updateTrip({ start: { id: `start-${newId()}`, ...place } }, 'Changed start')
    else if (as === 'end') actions.updateTrip({ end: { id: `end-${newId()}`, ...place }, returnToStart: false }, 'Changed end point')
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
            {trip.start && (
              <button className="btn btn-sm btn-ghost" onClick={actions.shareTrip}>
                Share
              </button>
            )}
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
          allowAnchors={!live}
        />
        <p className="hint small muted">Or click anywhere on the map.</p>

        {trip.stops.length === 0 && (
          <div className="empty card">
            <strong>Plan a day</strong>
            <ol className="steps small">
              <li className={trip.start ? 'step-done' : ''}>Set where your day starts.</li>
              <li>Add the places you want to visit.</li>
              <li>Open a stop to set its opening hours, visit length and priority.</li>
            </ol>
            <p className="small muted">
              RouteWise finds an order that fits your day and keeps it working as plans change.
            </p>
            {!trip.start && (
              <button className="btn btn-sm" onClick={actions.loadDemo}>
                Try a demo day in Paris
              </button>
            )}
          </div>
        )}

        {trip.start && trip.stops.length > 0 && schedule && plan && (
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
                    : 'Road routing is unavailable right now, so travel times are estimated from distance'}
              </p>
            </section>

            {notice && <NoticeBanner key={notice.id} notice={notice} nameOf={nameOf} onDismiss={actions.dismissNotice} />}

            {live && (
              <LivePanel
                live={live}
                next={schedule.visits[0]}
                nextPlace={schedule.visits[0] && placeById.get(schedule.visits[0].stopId)}
                mode={trip.mode}
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
        {trip.start && trip.stops.length > 0 && !schedule && <p className="muted small">Fetching travel times…</p>}
      </aside>

      {toast && <Toast key={toast.id} entry={toast} onUndo={actions.undoLast} onDismiss={actions.dismissToast} />}

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
