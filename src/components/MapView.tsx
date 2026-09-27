import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Plan } from '../core/solver'
import type { LatLng, LiveState, Place, Trip } from '../core/types'
import { reverseGeocode } from '../services/geocode'

interface Props {
  trip: Trip
  plan: Plan | null
  live: LiveState | null
  remainingLine: LatLng[]
  doneLine: LatLng[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddPlace: (place: Omit<Place, 'id'>, as: 'stop' | 'start') => void
}

const icon = (html: string, className: string) =>
  L.divIcon({ html, className: `pin ${className}`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] })

const toLatLngs = (line: LatLng[]): [number, number][] => line.map((p) => [p.lat, p.lng])

export function MapView({ trip, plan, live, remainingLine, doneLine, selectedId, onSelect, onAddPlace }: Props) {
  const [pending, setPending] = useState<(LatLng & { name: string | null }) | null>(null)

  const completed = useMemo(() => new Map(live?.completed.map((c, i) => [c.stopId, i + 1]) ?? []), [live])
  const skipped = useMemo(() => new Set(live?.skipped ?? []), [live])
  const planned = useMemo(() => {
    const offset = live?.completed.length ?? 0
    return new Map(plan?.order.map((id, i) => [id, offset + i + 1]) ?? [])
  }, [plan, live])
  const lateIds = useMemo(
    () => new Set(plan?.schedule.visits.filter((v) => v.late > 0).map((v) => v.stopId) ?? []),
    [plan],
  )

  const center: [number, number] = trip.start ? [trip.start.lat, trip.start.lng] : [48.8566, 2.3522]

  return (
    <MapContainer center={center} zoom={13} className="map" zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToTrip trip={trip} />
      <PanTo point={trip.stops.find((s) => s.id === selectedId) ?? null} />
      <ClickToAdd
        onClick={async (p) => {
          setPending({ ...p, name: null })
          const name = await reverseGeocode(p)
          setPending((cur) => (cur && cur.lat === p.lat && cur.lng === p.lng ? { ...cur, name } : cur))
        }}
      />

      {doneLine.length > 1 && <Polyline positions={toLatLngs(doneLine)} pathOptions={{ className: 'route-done' }} />}
      {remainingLine.length > 1 && (
        <Polyline positions={toLatLngs(remainingLine)} pathOptions={{ className: 'route-line' }} />
      )}

      {trip.start && (
        <Marker position={[trip.start.lat, trip.start.lng]} icon={icon('⌂', 'pin-start')}>
          <Tooltip direction="top" offset={[0, -12]}>
            Start · {trip.start.name}
          </Tooltip>
        </Marker>
      )}
      {!trip.returnToStart && trip.end && (
        <Marker position={[trip.end.lat, trip.end.lng]} icon={icon('⚑', 'pin-start')}>
          <Tooltip direction="top" offset={[0, -12]}>
            End · {trip.end.name}
          </Tooltip>
        </Marker>
      )}

      {trip.stops.map((s) => {
        const done = completed.get(s.id)
        const number = planned.get(s.id)
        let html = '–'
        let cls = 'pin-dropped'
        if (done !== undefined) {
          html = '✓'
          cls = 'pin-done'
        } else if (skipped.has(s.id)) {
          html = '×'
        } else if (number !== undefined) {
          html = String(number)
          cls = lateIds.has(s.id) ? 'pin-late' : 'pin-stop'
        }
        if (selectedId === s.id) cls += ' pin-selected'
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={icon(html, cls)}
            zIndexOffset={selectedId === s.id ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              {s.name}
              {cls.startsWith('pin-dropped') && !skipped.has(s.id) ? ' (didn’t fit)' : ''}
            </Tooltip>
          </Marker>
        )
      })}

      {pending && (
        <Popup position={[pending.lat, pending.lng]} eventHandlers={{ remove: () => setPending(null) }}>
          <div className="map-popup">
            <strong>{pending.name ?? 'Looking up…'}</strong>
            <div className="btn-row">
              <button
                className="btn btn-primary btn-sm"
                disabled={!pending.name}
                onClick={() => {
                  onAddPlace({ name: pending.name!, lat: pending.lat, lng: pending.lng }, 'stop')
                  setPending(null)
                }}
              >
                Add stop
              </button>
              <button
                className="btn btn-sm"
                disabled={!pending.name || !!live}
                onClick={() => {
                  onAddPlace({ name: pending.name!, lat: pending.lat, lng: pending.lng }, 'start')
                  setPending(null)
                }}
              >
                Set start
              </button>
            </div>
          </div>
        </Popup>
      )}
    </MapContainer>
  )
}

function ClickToAdd({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function PanTo({ point }: { point: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng])
  }, [point?.lat, point?.lng, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Refit the view whenever the set of places changes (not on every edit). */
function FitToTrip({ trip }: { trip: Trip }) {
  const map = useMap()
  const points = [trip.start, ...trip.stops].filter((p): p is Place => !!p)
  const key = points.map((p) => p.id).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the set of places changes
  }, [key, map])
  return null
}
