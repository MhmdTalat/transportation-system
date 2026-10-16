import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import type { TripRecord } from '../types'

interface PassengerSummary {
  booking_id: number
  passenger_name: string
  phone_number: string | null
  seat_numbers: number[]
}

function schedule(value: string | null): string {
  if (!value) return 'Schedule not set'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function DriverDashboard() {
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [passengers, setPassengers] = useState<PassengerSummary[]>([])
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [passengersLoading, setPassengersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const { showToast } = useToast()

  const loadTrips = useCallback(async () => {
    try {
      setTrips(await api.get<TripRecord[]>('/api/trips/'))
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Your assigned trips could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTrips() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTrips])

  const currentTrip = useMemo(() =>
    trips.find((trip) => trip.status === 'in_progress')
      ?? [...trips].filter((trip) => trip.status === 'scheduled').sort((a, b) =>
        new Date(a.departure_time ?? '').getTime() - new Date(b.departure_time ?? '').getTime(),
      )[0]
      ?? null,
  [trips])

  async function showPassengers(trip: TripRecord) {
    setSelectedTripId(trip.id)
    setPassengersLoading(true)
    try {
      setPassengers(await api.get<PassengerSummary[]>(`/api/trips/${trip.id}/passengers/`))
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Passenger list could not be loaded.', 'error')
    } finally {
      setPassengersLoading(false)
    }
  }

  async function updateStatus(trip: TripRecord, next: 'in_progress' | 'completed') {
    setSavingStatus(true)
    try {
      await api.patch(`/api/trips/${trip.id}/`, { status: next })
      showToast(next === 'in_progress' ? 'Trip started. Drive safely.' : 'Trip completed.')
      await loadTrips()
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Trip status could not be updated.', 'error')
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) return <div className="dashboard-loading" aria-label="Loading assigned trips"><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>Driver workspace unavailable</h1><p>{error}</p><button className="btn btn-primary" onClick={() => { setLoading(true); void loadTrips() }} type="button">Try again</button></section>

  const activeTrips = trips.filter((trip) => ['scheduled', 'in_progress'].includes(trip.status))
  return (
    <div className="driver-page">
      <header className="page-heading"><div><span className="eyebrow">DRIVER WORKSPACE</span><h1>My trips</h1><p>Review assignments, passenger counts, and trip operations.</p></div><Link className="btn btn-light" to="/notifications"><i className="bi bi-bell" /> Notifications</Link></header>
      {currentTrip ? (
        <section className="panel driver-current-trip">
          <div className="driver-trip-heading"><span className="eyebrow">{currentTrip.status === 'in_progress' ? 'CURRENT TRIP' : 'NEXT ASSIGNMENT'}</span><span className={`booking-state state-${currentTrip.status}`}>{currentTrip.status.replace('_', ' ')}</span></div>
          <h2>{currentTrip.start_station_name ?? `Station ${currentTrip.start_station}`} <i className="bi bi-arrow-right" /> {currentTrip.destination_station_name ?? `Station ${currentTrip.destination_station}`}</h2>
          <div className="driver-trip-facts"><div><span>Departure</span><strong>{schedule(currentTrip.departure_time)}</strong></div><div><span>Passengers</span><strong>{currentTrip.booked_seats} / {currentTrip.vehicle_capacity}</strong></div><div><span>Vehicle</span><strong>{currentTrip.vehicle_registration ?? (currentTrip.vehicle ? `Vehicle #${currentTrip.vehicle}` : 'Not assigned')}</strong></div></div>
          <div className="driver-trip-actions">
            {currentTrip.status === 'scheduled' && <button className="btn btn-primary" disabled={savingStatus} type="button" onClick={() => { void updateStatus(currentTrip, 'in_progress') }}><i className="bi bi-play-fill" /> Start trip</button>}
            {currentTrip.status === 'in_progress' && <button className="btn btn-primary" disabled={savingStatus} type="button" onClick={() => { void updateStatus(currentTrip, 'completed') }}><i className="bi bi-check2-circle" /> Complete trip</button>}
            <button className="btn btn-light" type="button" disabled={passengersLoading} onClick={() => { void showPassengers(currentTrip) }}><i className="bi bi-people" /> View passengers ({currentTrip.booked_seats})</button>
          </div>
        </section>
      ) : <div className="panel booking-empty"><i className="bi bi-calendar2-check" /><h2>No active assignments</h2><p>Your upcoming trips will appear here when an administrator assigns them.</p></div>}

      <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>Assigned trips <span className="heading-count">{activeTrips.length}</span></h2></div></header>
        {activeTrips.length ? <div className="driver-assignment-list">{activeTrips.map((trip) => (
          <article className="panel driver-assignment" key={trip.id}>
            <div><span className="eyebrow">TR-{String(trip.id).padStart(4, '0')}</span><h3>{trip.start_station_name ?? `Station ${trip.start_station}`} <i className="bi bi-arrow-right" /> {trip.destination_station_name ?? `Station ${trip.destination_station}`}</h3><p>{schedule(trip.departure_time)}</p></div>
            <span className={`booking-state state-${trip.status}`}>{trip.status.replace('_', ' ')}</span>
            <button className="btn btn-outline-primary" type="button" onClick={() => { void showPassengers(trip) }}>Passenger list</button>
          </article>
        ))}</div> : <p className="empty-inline">No upcoming or in-progress trips are assigned.</p>}
      </section>

      {selectedTripId !== null && <section className="panel passenger-manifest"><header className="panel-header"><div><span className="eyebrow">TR-{String(selectedTripId).padStart(4, '0')}</span><h2>Passenger manifest</h2></div><button className="icon-button" type="button" aria-label="Close manifest" onClick={() => setSelectedTripId(null)}><i className="bi bi-x-lg" /></button></header>
        {passengersLoading ? <p className="empty-inline">Loading passenger list…</p> : passengers.length ? <div className="manifest-list">{passengers.map((passenger) => <div className="manifest-row" key={passenger.booking_id}><span className="manifest-seat">{passenger.seat_numbers.map((seat) => String(seat).padStart(2, '0')).join(', ')}</span><strong>{passenger.passenger_name}</strong><a href={`tel:${passenger.phone_number ?? ''}`}>{passenger.phone_number || 'No phone provided'}</a></div>)}</div> : <p className="empty-inline">There are no confirmed passengers for this trip.</p>}
      </section>}
    </div>
  )
}
