import type { RouteStationRecord, StationRecord, TripRecord } from '../types'

interface Props {
  stations: StationRecord[]
  trip?: Pick<TripRecord, 'route' | 'start_station' | 'destination_station'> | null
  routeStations?: RouteStationRecord[]
  compact?: boolean
}

interface Point {
  station: StationRecord
  x: number
  y: number
}

function pointsFor(stations: StationRecord[]): Point[] {
  const located = stations.filter((station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
  if (!located.length) return []
  const latitudes = located.map((station) => station.latitude)
  const longitudes = located.map((station) => station.longitude)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const latitudeSpan = maxLatitude - minLatitude || 1
  const longitudeSpan = maxLongitude - minLongitude || 1

  return located.map((station) => ({
    station,
    x: 12 + ((station.longitude - minLongitude) / longitudeSpan) * 76,
    y: 15 + ((maxLatitude - station.latitude) / latitudeSpan) * 70,
  }))
}

export function RouteMap({ stations, trip, routeStations = [], compact = false }: Props) {
  const points = pointsFor(stations)
  const pointsById = new Map(points.map((point) => [point.station.id, point]))
  const origin = trip ? pointsById.get(trip.start_station) : undefined
  const destination = trip ? pointsById.get(trip.destination_station) : undefined
  const hasTripPath = Boolean(origin && destination)
  const routeStationIds = trip
    ? routeStations
      .filter((item) => item.route === trip.route)
      .sort((left, right) => left.sequence_order - right.sequence_order)
      .map((item) => typeof item.station === 'number' ? item.station : item.station.id)
    : []
  const originIndex = routeStationIds.indexOf(trip?.start_station ?? -1)
  const destinationIndex = routeStationIds.indexOf(trip?.destination_station ?? -1)
  const orderedStationIds = originIndex >= 0 && destinationIndex >= 0
    ? routeStationIds.slice(Math.min(originIndex, destinationIndex), Math.max(originIndex, destinationIndex) + 1)
    : []
  if (originIndex >= 0 && destinationIndex >= 0 && originIndex > destinationIndex) orderedStationIds.reverse()
  const tripPath = trip && origin && destination
    ? [trip.start_station, ...orderedStationIds.filter((id) => id !== trip.start_station && id !== trip.destination_station), trip.destination_station]
      .map((id) => pointsById.get(id))
      .filter((point): point is Point => point !== undefined)
    : []
  const tripPathCoordinates = tripPath.map((point) => `${point.x},${point.y}`).join(' ')
  const routePointIds = new Set(tripPath.map((point) => point.station.id))

  return (
    <div className={`route-map${compact ? ' route-map-compact' : ''}`} role="img" aria-label="Service station map; vehicle GPS positions are not available">
      <div className="map-street map-street-one" />
      <div className="map-street map-street-two" />
      <div className="map-street map-street-three" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {hasTripPath && origin && destination && (
          <>
            <polyline className="map-route-shadow" points={tripPathCoordinates} />
            <polyline className="map-route-line" points={tripPathCoordinates} />
          </>
        )}
        {points.map(({ station, x, y }) => {
          const active = routePointIds.has(station.id)
          return (
            <g className={`map-station${active ? ' map-station-active' : ''}`} key={station.id}>
              <circle cx={x} cy={y} r={active ? 2.7 : 1.8} />
              <title>{station.name}</title>
            </g>
          )
        })}
      </svg>
      {points.map(({ station, x, y }, index) => {
        const isOrigin = trip?.start_station === station.id
        const isDestination = trip?.destination_station === station.id
        const active = routePointIds.has(station.id)
        if (index > 7 && !active) return null
        return (
          <span
            className={`map-station-label${active ? ' map-station-label-active' : ''}`}
            key={station.id}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <i className={`bi ${isOrigin ? 'bi-geo-alt-fill' : isDestination ? 'bi-flag-fill' : 'bi-geo'}`} aria-hidden="true" />
            {station.name}
          </span>
        )
      })}
      {trip && !hasTripPath && <div className="map-no-coordinates">Station coordinates for this trip are unavailable.</div>}
      {!points.length && <div className="map-no-coordinates">Add station coordinates to display the service network.</div>}
      {hasTripPath && <span className="map-route-caption"><i className="bi bi-signpost-2" /> Planned trip route{tripPath.length > 2 ? ` · ${tripPath.length} stops` : ''}</span>}
      <span className="map-disclaimer"><i className="bi bi-info-circle" /> Station locations only · GPS feed not connected</span>
    </div>
  )
}
