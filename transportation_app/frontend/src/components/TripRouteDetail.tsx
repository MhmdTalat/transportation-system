import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../services/api'
import type { ApiRecord, RouteRecord, RouteStationRecord, StationRecord } from '../types'
import { RouteMap } from './RouteMap'

interface Props {
  record: ApiRecord
}

interface TripRouteData {
  stations: StationRecord[]
  routeStations: RouteStationRecord[]
  route: RouteRecord
}

function recordId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function TripRouteDetail({ record }: Props) {
  const [data, setData] = useState<TripRouteData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tripId = recordId(record.id)
  const startId = recordId(record.start_station)
  const destinationId = recordId(record.destination_station)
  const routeId = recordId(record.route)

  const load = useCallback(async () => {
    if (!startId || !destinationId || !routeId) {
      setError('Route, origin, or destination references are missing from this trip record.')
      return
    }
    try {
      const [stations, route, routeStations] = await Promise.all([
        api.get<StationRecord[]>('/api/stations/'),
        api.get<RouteRecord>(`/api/routes/${routeId}/`),
        api.get<RouteStationRecord[]>('/api/route-stations/'),
      ])
      const routeStationIds = routeStations
        .filter((item) => item.route === routeId)
        .map((item) => typeof item.station === 'number' ? item.station : item.station.id)
      const stationsInRoute = stations.filter((station) =>
        station.id === startId || station.id === destinationId || routeStationIds.includes(station.id),
      )
      if (!stationsInRoute.some((station) => station.id === startId) || !stationsInRoute.some((station) => station.id === destinationId)) {
        setError('The API does not contain coordinates for this trip’s origin or destination.')
        return
      }
      setData({ stations: stationsInRoute, routeStations, route })
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The planned trip route could not be loaded.')
    }
  }, [destinationId, routeId, startId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  if (error) {
    return <section className="panel trip-route-detail"><header className="panel-header"><div><span className="eyebrow">PLANNED ROUTE</span><h2>Journey overview</h2></div></header><p className="route-detail-error" role="alert">{error}</p></section>
  }
  if (!data) return <section className="panel trip-route-detail"><div className="route-detail-loading" aria-label="Loading route" /></section>

  const trip = tripId && startId && destinationId
    ? { start_station: startId, destination_station: destinationId }
    : null
  const distance = data.route.distance_km
  return (
    <section className="panel trip-route-detail">
      <header className="panel-header">
        <div><span className="eyebrow">PLANNED ROUTE</span><h2>{data.route.name}</h2><p>{distance == null ? 'Origin and destination from trip record' : `${distance} km planned distance`}</p></div>
        <span className="route-distance-chip"><i className="bi bi-signpost-2" /> {distance == null ? 'Distance unavailable' : `${distance} km`}</span>
      </header>
      <RouteMap stations={data.stations} routeStations={data.routeStations} trip={trip && routeId ? { ...trip, route: routeId } : null} compact />
      <div className="route-detail-endpoints">
        <span><i className="bi bi-geo-alt-fill" /><strong>{data.stations.find((station) => station.id === startId)?.name}</strong><small>{data.stations.find((station) => station.id === startId)?.governorate ?? 'Origin station'}</small></span>
        <i className="bi bi-arrow-right route-endpoint-arrow" />
        <span><i className="bi bi-flag-fill" /><strong>{data.stations.find((station) => station.id === destinationId)?.name}</strong><small>{data.stations.find((station) => station.id === destinationId)?.governorate ?? 'Destination station'}</small></span>
      </div>
    </section>
  )
}
