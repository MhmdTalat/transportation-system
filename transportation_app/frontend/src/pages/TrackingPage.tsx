import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RouteMap } from '../components/RouteMap'
import { StatusBadge } from '../components/StatusBadge'
import { api, ApiError } from '../services/api'
import type { DriverRecord, RouteRecord, RouteStationRecord, StationRecord, TripRecord, VehicleRecord } from '../types'

interface TrackingData {
  trips: TripRecord[]
  routeStations: RouteStationRecord[]
  stations: StationRecord[]
  drivers: DriverRecord[]
  vehicles: VehicleRecord[]
  routes: RouteRecord[]
}

function formatTime(value: string | null): string {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function TrackingPage() {
  const [data, setData] = useState<TrackingData | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [trips, routeStations, stations, drivers, vehicles, routes] = await Promise.all([
        api.get<TripRecord[]>('/api/trips/'),
        api.get<RouteStationRecord[]>('/api/route-stations/'),
        api.get<StationRecord[]>('/api/stations/'),
        api.get<DriverRecord[]>('/api/drivers/'),
        api.get<VehicleRecord[]>('/api/vehicles/'),
        api.get<RouteRecord[]>('/api/routes/'),
      ])
      setData({ trips, routeStations, stations, drivers, vehicles, routes })
      setSelectedId((current) => current ?? trips.find((trip) => trip.status === 'in_progress')?.id ?? null)
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load operations tracking data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const activeTrips = useMemo(
    () => data?.trips.filter((trip) => trip.status === 'in_progress') ?? [],
    [data],
  )

  if (loading) {
    return <div className="dashboard-loading" aria-label="Loading fleet tracking"><div className="loading-title" /><div className="tracking-skeleton" /></div>
  }

  if (error || !data) {
    return (
      <section className="page-error">
        <span className="empty-icon"><i className="bi bi-cloud-slash" /></span>
        <h1>Tracking unavailable</h1>
        <p>{error ?? 'Operations data could not be loaded.'}</p>
        <button className="btn btn-primary" onClick={() => { setLoading(true); void load() }} type="button"><i className="bi bi-arrow-clockwise" /> Retry</button>
      </section>
    )
  }

  const selectedTrip = activeTrips.find((trip) => trip.id === selectedId) ?? activeTrips[0] ?? null
  const stationById = new Map(data.stations.map((station) => [station.id, station]))
  const routeById = new Map(data.routes.map((route) => [route.id, route]))
  const driverById = new Map(data.drivers.map((driver) => [driver.id, driver]))
  const vehicleById = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const selectedDriver = selectedTrip?.driver ? driverById.get(selectedTrip.driver) : undefined
  const selectedVehicle = selectedTrip?.vehicle ? vehicleById.get(selectedTrip.vehicle) : undefined
  const origin = selectedTrip ? stationById.get(selectedTrip.start_station) : undefined
  const destination = selectedTrip ? stationById.get(selectedTrip.destination_station) : undefined
  const route = selectedTrip ? routeById.get(selectedTrip.route) : undefined

  return (
    <div className="tracking-page">
      <div className="page-heading tracking-heading">
        <div>
          <span className="eyebrow">FLEET COMMAND CENTER</span>
          <h1>Fleet tracking</h1>
          <p>Monitor active trips and their planned routes across the service network.</p>
        </div>
        <div className="tracking-status">
          <span className="tracking-count"><i className="bi bi-truck-front" /> {activeTrips.length} active {activeTrips.length === 1 ? 'trip' : 'trips'}</span>
          <span className="gps-unavailable"><i className="bi bi-geo-alt" /> GPS feed unavailable</span>
        </div>
      </div>

      <section className="tracking-command">
        <aside className="tracking-trip-list">
          <header className="tracking-list-header">
            <div><span className="eyebrow">OPERATIONS</span><h2>Active trips <b>{activeTrips.length}</b></h2></div>
            <Link className="icon-button" to="/trips" aria-label="Open all trips"><i className="bi bi-arrow-up-right" /></Link>
          </header>
          {activeTrips.length ? activeTrips.map((trip) => {
            const tripOrigin = stationById.get(trip.start_station)
            const tripDestination = stationById.get(trip.destination_station)
            const tripVehicle = trip.vehicle ? vehicleById.get(trip.vehicle) : undefined
            const tripDriver = trip.driver ? driverById.get(trip.driver) : undefined
            return (
              <button
                className={`tracking-trip-item${selectedTrip?.id === trip.id ? ' tracking-trip-selected' : ''}`}
                key={trip.id}
                onClick={() => setSelectedId(trip.id)}
                type="button"
              >
                <span className="tracking-trip-item-top"><strong>TR-{String(trip.id).padStart(4, '0')}</strong><StatusBadge status={trip.status} kind="trip" /></span>
                <span className="tracking-journey"><span>{tripOrigin?.name ?? `Station #${trip.start_station}`}</span><i className="bi bi-arrow-right" /><span>{tripDestination?.name ?? `Station #${trip.destination_station}`}</span></span>
                <span className="tracking-trip-meta">
                  <span><i className="bi bi-truck-front" /> {tripVehicle?.registration_number ?? 'Vehicle unassigned'}</span>
                  <span><i className="bi bi-person-badge" /> {tripDriver?.user.username ?? 'Driver unassigned'}</span>
                </span>
              </button>
            )
          }) : (
            <div className="tracking-empty">
              <span className="empty-icon"><i className="bi bi-signpost-2" /></span>
              <strong>No active trips</strong>
              <p>There are currently no trips in progress.</p>
              <Link to="/trips">Review trip schedule <i className="bi bi-arrow-right" /></Link>
            </div>
          )}
        </aside>

        <div className="tracking-map-column">
          <div className="tracking-map-toolbar">
            <div><span className="eyebrow">SERVICE NETWORK</span><strong>{selectedTrip ? `Trip TR-${String(selectedTrip.id).padStart(4, '0')} route` : 'Station locations'}</strong></div>
            <span className="map-legend"><i /> Stations</span>
          </div>
          <RouteMap stations={data.stations} routeStations={data.routeStations} trip={selectedTrip} />
        </div>

        <aside className="tracking-trip-detail">
          {selectedTrip ? (
            <>
              <span className="eyebrow">TRIP DETAIL</span>
              <div className="tracking-detail-title"><h2>TR-{String(selectedTrip.id).padStart(4, '0')}</h2><StatusBadge status={selectedTrip.status} kind="trip" /></div>
              <div className="route-timeline">
                <div className="route-timeline-stop"><span className="route-stop-marker route-stop-origin"><i className="bi bi-geo-alt-fill" /></span><div><small>ORIGIN</small><strong>{origin?.name ?? `Station #${selectedTrip.start_station}`}</strong><span>{origin?.governorate ?? 'Start station'}</span></div></div>
                <div className="route-timeline-line"><span>{route?.distance_km == null ? 'Planned route' : `${route.distance_km} km`}</span></div>
                <div className="route-timeline-stop"><span className="route-stop-marker route-stop-destination"><i className="bi bi-flag-fill" /></span><div><small>DESTINATION</small><strong>{destination?.name ?? `Station #${selectedTrip.destination_station}`}</strong><span>{destination?.governorate ?? 'Destination station'}</span></div></div>
              </div>
              <div className="tracking-detail-stats">
                <div><span><i className="bi bi-clock" /> Departure</span><strong>{formatTime(selectedTrip.departure_time)}</strong></div>
                <div><span><i className="bi bi-truck-front" /> Vehicle</span><strong>{selectedVehicle?.registration_number ?? 'Unassigned'}</strong></div>
                <div><span><i className="bi bi-person-badge" /> Driver</span><strong>{selectedDriver?.user.username ?? 'Unassigned'}</strong></div>
              </div>
              <div className="position-notice"><i className="bi bi-info-circle" /><span>Trip status is active, but the API does not provide live GPS position or ETA.</span></div>
              <Link className="tracking-detail-link" to={`/trips/${selectedTrip.id}`}>Open trip record <i className="bi bi-arrow-up-right" /></Link>
            </>
          ) : (
            <div className="tracking-empty-detail"><span className="aside-icon"><i className="bi bi-radar" /></span><h2>Network overview</h2><p>{data.stations.length} stations and {data.routes.length} configured routes. Start a trip to view its planned route here.</p><Link to="/routes">Review routes <i className="bi bi-arrow-right" /></Link></div>
          )}
        </aside>
      </section>
    </div>
  )
}
