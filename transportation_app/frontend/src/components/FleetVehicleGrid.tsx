import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../services/api'
import { displayValue } from '../services/resources'
import type { ApiRecord, DriverRecord, RouteRecord, StationRecord, TripRecord } from '../types'
import { StatusBadge } from './StatusBadge'

interface Props {
  vehicles: ApiRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onEdit: (vehicle: ApiRecord) => void
  onDelete: (vehicle: ApiRecord) => void
  allowDelete: boolean
}

interface AssignmentData {
  drivers: DriverRecord[]
  trips: TripRecord[]
  routes: RouteRecord[]
  stations: StationRecord[]
}

export function FleetVehicleGrid({ vehicles, loading, error, onRetry, onEdit, onDelete, allowDelete }: Props) {
  const { t } = useTranslation()
  const [assignments, setAssignments] = useState<AssignmentData | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  const loadAssignments = useCallback(async () => {
    try {
      const [drivers, trips, routes, stations] = await Promise.all([
        api.get<DriverRecord[]>('/api/drivers/'),
        api.get<TripRecord[]>('/api/trips/'),
        api.get<RouteRecord[]>('/api/routes/'),
        api.get<StationRecord[]>('/api/stations/'),
      ])
      setAssignments({ drivers, trips, routes, stations })
      setAssignmentError(null)
    } catch (reason) {
      setAssignmentError(reason instanceof ApiError ? reason.message : t('Vehicle assignments could not be loaded.'))
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAssignments() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAssignments])

  if (loading) {
    return <div className="fleet-card-grid" aria-label={t('Loading fleet')}><div className="fleet-card-skeleton" /><div className="fleet-card-skeleton" /><div className="fleet-card-skeleton" /></div>
  }
  if (error) {
    return <div className="table-card table-message" role="alert"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><strong>{t('Fleet records unavailable')}</strong><p>{error}</p><button className="btn btn-outline-primary" onClick={onRetry} type="button"><i className="bi bi-arrow-clockwise" /> {t('Try again')}</button></div>
  }
  if (!vehicles.length) {
    return <div className="table-card table-message"><span className="empty-icon"><i className="bi bi-truck-front" /></span><strong>{t('No vehicles registered')}</strong><p>{t('Add a vehicle to begin building your fleet register.')}</p></div>
  }

  const driversByVehicle = new Map((assignments?.drivers ?? []).flatMap((driver) => driver.vehicle ? [[driver.vehicle, driver] as const] : []))
  const routesById = new Map((assignments?.routes ?? []).map((route) => [route.id, route]))
  const stationsById = new Map((assignments?.stations ?? []).map((station) => [station.id, station]))

  return (
    <div className="fleet-card-wrap">
      {assignmentError && <div className="fleet-assignment-warning" role="status"><i className="bi bi-info-circle" /> {t('Assignment details are unavailable: {{error}}', { error: assignmentError })}</div>}
      <div className="fleet-card-grid">
        {vehicles.map((vehicle) => {
          const registration = displayValue(vehicle.registration_number)
          const driver = assignments ? driversByVehicle.get(vehicle.id) : undefined
          const trip = assignments?.trips.find((item) => item.vehicle === vehicle.id && item.status === 'in_progress')
          const route = trip ? routesById.get(trip.route) : undefined
          const origin = trip ? stationsById.get(trip.start_station) : undefined
          const destination = trip ? stationsById.get(trip.destination_station) : undefined
          return (
            <article className="fleet-vehicle-card" key={vehicle.id}>
              <div className="fleet-card-top">
                <span className="fleet-vehicle-icon"><i className="bi bi-truck-front-fill" /></span>
                <strong>{registration}</strong>
                <StatusBadge status={trip ? 'in_transit' : String(vehicle.status ?? 'inactive')} kind="vehicle" />
              </div>
              <div className="fleet-vehicle-capacity"><strong>{displayValue(vehicle.capacity)}</strong><span>{t('passenger capacity')}</span></div>
              <div className="fleet-card-info">
                <div><span>{t('Assigned driver')}</span><strong>{driver?.user.username ?? (assignments ? t('Unassigned') : t('Loading…'))}</strong></div>
                <div><span>{t('Current trip')}</span>
                  {trip ? (
                    <strong className="fleet-trip-route"><i className="bi bi-geo-alt-fill" />{origin?.name ?? `Station #${trip.start_station}`}<i className="bi bi-arrow-right" />{destination?.name ?? `Station #${trip.destination_station}`}<small>{route?.name ?? `Trip #${trip.id}`}</small></strong>
                  ) : <strong>{assignments ? t('No trip in transit') : t('Loading…')}</strong>}
                </div>
              </div>
              <p className="fleet-telemetry-note"><i className="bi bi-info-circle" /> {t('Fuel and live vehicle telemetry aren’t provided by the API.')}</p>
              <div className="fleet-card-actions">
                <Link className="btn btn-primary" to={`/vehicles/${vehicle.id}`}><i className="bi bi-box-arrow-up-right" /> {t('View vehicle')}</Link>
                <button className="row-action" type="button" aria-label={t('Edit {{registration}}', { registration })} onClick={() => onEdit(vehicle)}><i className="bi bi-pencil" /></button>
                {allowDelete && <button className="row-action danger-action" type="button" aria-label={t('Delete {{registration}}', { registration })} onClick={() => onDelete(vehicle)}><i className="bi bi-trash3" /></button>}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
