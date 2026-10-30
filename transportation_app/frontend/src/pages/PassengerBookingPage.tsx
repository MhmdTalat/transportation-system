import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../auth/useAuth'
import { VehicleSeatMap } from '../components/booking/VehicleSeatMap'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import { formatCurrency, formatDate } from '../i18n/format'
import type { SeatAvailability, StationRecord, TripRecord } from '../types'
import { useScrollLock } from '../hooks/useScrollLock'
import { RadarPulseBackground } from '../components/ride/RadarPulseBackground'
import { SoftShapesBackground } from '../components/ride/SoftShapesBackground'

function money(value: number | string): string {
  return formatCurrency(value)
}

function dateLabel(value: string | null): string {
  if (!value) return 'Time not scheduled'
  return formatDate(value, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function timeLabel(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDate(date, { hour: 'numeric', minute: '2-digit' })
}

function localDateInput(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function tripDuration(departure: string | null, arrival: string | null): string | null {
  if (!departure || !arrival) return null
  const duration = new Date(arrival).getTime() - new Date(departure).getTime()
  if (!Number.isFinite(duration) || duration <= 0) return null
  const minutes = Math.round(duration / 60_000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`
}

export function PassengerBookingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [stations, setStations] = useState<StationRecord[]>([])
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [minimumTravelDate] = useState(() => localDateInput(new Date()))
  const [tomorrowValue] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return localDateInput(tomorrow)
  })
  const dateInput = useRef<HTMLInputElement>(null)
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null)
  const [availability, setAvailability] = useState<SeatAvailability | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingSeats, setLoadingSeats] = useState(false)
  const [searching, setSearching] = useState(false)
  const [booking, setBooking] = useState(false)
  useScrollLock(confirmationOpen)
  const [error, setError] = useState<string | null>(null)

  const stationNames = useMemo(() => new Map(stations.map((station) => [station.id, station.name])), [stations])
  const total = Number(selectedTrip?.fare_amount ?? 0) * selectedSeats.length
  const loadTrips = useCallback(async (filters: { origin?: string; destination?: string; date?: string } = {}) => {
    const query = new URLSearchParams()
    if (filters.origin) query.set('start_station_id', filters.origin)
    if (filters.destination) query.set('destination_station_id', filters.destination)
    if (filters.date) query.set('date', filters.date)
    const result = await api.get<TripRecord[]>(`/api/trips/search/${query.size ? `?${query}` : ''}`)
    setTrips(result)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      api.get<StationRecord[]>('/api/stations/'),
      api.get<TripRecord[]>('/api/trips/search/'),
    ]).then(([stationData, tripData]) => {
      if (active) {
        setStations(stationData)
        setTrips(tripData)
        setError(null)
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof ApiError ? reason.message : t('Trips could not be loaded.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [t])

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearching(true)
    setError(null)
    try {
      await loadTrips({ origin, destination, date: travelDate })
      setSelectedTrip(null)
      setAvailability(null)
      setSelectedSeats([])
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not search trips.'))
    } finally {
      setSearching(false)
    }
  }

  async function searchByDate(date: string) {
    setTravelDate(date)
    setSearching(true)
    setError(null)
    try {
      await loadTrips({ origin, destination, date })
      setSelectedTrip(null)
      setAvailability(null)
      setSelectedSeats([])
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not search trips.'))
    } finally {
      setSearching(false)
    }
  }

  async function chooseTrip(trip: TripRecord) {
    setSelectedTrip(trip)
    setSelectedSeats([])
    setAvailability(null)
    setLoadingSeats(true)
    try {
      setAvailability(await api.get<SeatAvailability>(`/api/trips/${trip.id}/seats/`))
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t('Could not load seat availability.'), 'error')
    } finally {
      setLoadingSeats(false)
    }
  }

  async function refreshSeats(): Promise<SeatAvailability | null> {
    if (!selectedTrip) return null
    try {
      const latest = await api.get<SeatAvailability>(`/api/trips/${selectedTrip.id}/seats/`)
      setAvailability(latest)
      return latest
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t('Could not refresh seat availability.'), 'error')
      return null
    }
  }

  async function confirmBooking() {
    if (!selectedTrip || !selectedSeats.length) return
    setBooking(true)
    try {
      const latest = await refreshSeats()
      if (!latest) return
      const currentlyAvailable = new Set(latest.seats.filter((seat) => seat.state === 'available').map((seat) => seat.number))
      const unavailable = selectedSeats.filter((seat) => !currentlyAvailable.has(seat))
      if (unavailable.length) {
        setSelectedSeats((current) => current.filter((seat) => currentlyAvailable.has(seat)))
        setConfirmationOpen(false)
        showToast(t('Seat {{seat}} is no longer available. Please select another seat.', { seat: unavailable[0] }), 'error')
        return
      }
      await api.post('/api/bookings/', { trip: selectedTrip.id, seat_numbers: selectedSeats })
      showToast(t('Your booking is confirmed.'))
      setConfirmationOpen(false)
      setSelectedTrip(null)
      setSelectedSeats([])
      setAvailability(null)
      await loadTrips({ origin, destination, date: travelDate })
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await refreshSeats()
        setConfirmationOpen(false)
        showToast(reason.message, 'error')
      } else {
        showToast(reason instanceof Error ? reason.message : t('The booking could not be completed.'), 'error')
      }
    } finally {
      setBooking(false)
    }
  }

  function toggleSeat(seat: number) {
    if (!availability) return
    const seatState = availability.seats.find((item) => item.number === seat)?.state
    if (seatState === 'booked' || seatState === 'disabled') {
      showToast(t('Seat {{seat}} is unavailable. Please choose another seat.', { seat }), 'error')
      return
    }

    setSelectedSeats((current) => {
      if (current.includes(seat)) {
        return current.filter((selected) => selected !== seat)
      }
      if (current.length >= 10) {
        showToast(t('You can select up to 10 seats per booking.'), 'error')
        return current
      }
      return [...current, seat].sort((a, b) => a - b)
    })
  }

  function openDatePicker() {
    const input = dateInput.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }

  if (loading) {
    return <div className="dashboard-loading" aria-label={t('Loading available trips')}><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  }

  return (
    <div className="passenger-page">
      <header className="page-heading">
        <div><span className="eyebrow">{t('YOUR NEXT JOURNEY STARTS HERE')}</span><h1>{t('Find a trip')}</h1><p>{t('Choose a scheduled trip, select your seats, and confirm your booking.')}</p></div>
        <Link className="btn btn-light" to="/bookings"><i className="bi bi-ticket-perforated" /> {t('My bookings')}</Link>
      </header>
      <form className="panel trip-search-form" onSubmit={(event) => { void search(event) }}>
        <label className="form-field"><span className="field-label">{t('From')}</span><select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="">{t('Any station')}</option>{stations.map((station) => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label>
        <button className="trip-search-swap" type="button" aria-label={t('Swap origin and destination')} title={t('Swap route')} onClick={() => { setOrigin(destination); setDestination(origin) }}><i className="bi bi-arrow-left-right" aria-hidden="true" /></button>
        <label className="form-field"><span className="field-label">{t('To')}</span><select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">{t('Any destination')}</option>{stations.filter((station) => String(station.id) !== origin).map((station) => <option value={station.id} key={station.id}>{station.name}</option>)}</select></label>
        <label className="form-field"><span className="field-label">{t('Travel date')}</span><input ref={dateInput} type="date" min={minimumTravelDate} value={travelDate} onChange={(event) => setTravelDate(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={searching || (Boolean(origin) !== Boolean(destination))}>{searching ? <><span className="spinner-border spinner-border-sm" /> {t('Searching')}</> : <><i className="bi bi-search" /> {t('Search trips')}</>}</button>
        <div className="date-shortcuts" role="group" aria-label={t('Quick date selection')}>
          <button className="date-shortcut" type="button" disabled={searching || (Boolean(origin) !== Boolean(destination))} aria-pressed={travelDate === minimumTravelDate} onClick={() => { void searchByDate(minimumTravelDate) }}>{t('Today')}</button>
          <button className="date-shortcut" type="button" disabled={searching || (Boolean(origin) !== Boolean(destination))} aria-pressed={travelDate === tomorrowValue} onClick={() => { void searchByDate(tomorrowValue) }}>{t('Tomorrow')}</button>
          <button className="date-shortcut" type="button" onClick={openDatePicker}><i className="bi bi-calendar3" aria-hidden="true" /> {t('Choose date')}</button>
        </div>
        {Boolean(origin) !== Boolean(destination) && <small className="form-hint">{t('Choose both a starting station and destination, or leave both open.')}</small>}
      </form>
      {error && <div className="form-alert" role="alert"><i className="bi bi-exclamation-triangle" /><span>{error}</span></div>}
      {searching && (
        <section className="trip-searching-panel" role="status" aria-live="polite">
          <RadarPulseBackground color="var(--color-accent)" speed={1} intensity={0.75} />
          <div><strong>{t('Searching available trips')}</strong><span>{t('Checking routes and seats')}</span></div>
        </section>
      )}
      <div className="booking-workspace">
        <section className="trip-results" aria-label={t('Available trips')}>
          <header className="section-heading"><div><span className="eyebrow">{t('SCHEDULED SERVICES')}</span><h2>{t('{{count}} trips available', { count: trips.length })}</h2></div></header>
          {trips.length === 0 ? <div className="panel booking-empty"><i className="bi bi-calendar-x" /><h3>{t('No bookable trips found')}</h3><p>{t('Try another date or route. Only published trips with seats available are shown.')}</p></div> : (
            <div className="passenger-trip-list">
              {trips.map((trip) => (
                <article className={`panel passenger-trip-card${selectedTrip?.id === trip.id ? ' trip-selected' : ''}`} key={trip.id}>
                  <div className="trip-card-route">
                    <div className="trip-route-timeline">
                      <div className="trip-route-times"><time dateTime={trip.departure_time ?? undefined}>{timeLabel(trip.departure_time)}</time><time dateTime={trip.arrival_time ?? undefined}>{timeLabel(trip.arrival_time)}</time></div>
                      <div className="trip-route-stops">
                        <div className="trip-route-stop"><i className="bi bi-circle-fill" aria-hidden="true" /><strong>{stationNames.get(trip.start_station) ?? `Station ${trip.start_station}`}</strong></div>
                        <div className="trip-route-stop"><i className="bi bi-geo-alt-fill" aria-hidden="true" /><strong>{stationNames.get(trip.destination_station) ?? `Station ${trip.destination_station}`}</strong></div>
                      </div>
                    </div>
                  </div>
                  <div className="trip-card-meta">
                    <span><i className="bi bi-calendar3" /> {dateLabel(trip.departure_time)}</span>
                    <span><i className="bi bi-person-seat" /> {t('{{count}} seats available', { count: trip.available_seats })}</span>
                    {trip.vehicle_registration && <span><i className="bi bi-bus-front" /> {trip.vehicle_registration}</span>}
                    {tripDuration(trip.departure_time, trip.arrival_time) && <span className="trip-duration-chip"><i className="bi bi-clock" /> {tripDuration(trip.departure_time, trip.arrival_time)}</span>}
                    <StatusBadge status={trip.status} kind="trip" />
                    <strong>{money(trip.fare_amount)} <small>{t('/ seat')}</small></strong>
                  </div>
                  <button className={selectedTrip?.id === trip.id ? 'btn btn-light' : 'btn btn-outline-primary'} type="button" onClick={() => { void chooseTrip(trip) }}>{t(selectedTrip?.id === trip.id ? 'Selected trip' : 'Choose seats')} <i className="bi bi-arrow-right" /></button>
                </article>
              ))}
            </div>
          )}
        </section>
        {selectedTrip && (
          <section className="panel seat-panel" aria-labelledby="seat-selection-title">
            <header className="panel-header"><div><span className="eyebrow">{t('SEAT SELECTION')}</span><h2 id="seat-selection-title">{t('Choose your seats')}</h2><p>{stationNames.get(selectedTrip.start_station)} {t('to')} {stationNames.get(selectedTrip.destination_station)}</p></div><button className="icon-button" aria-label={t('Refresh seat availability')} title={t('Refresh seats')} type="button" disabled={loadingSeats || booking} onClick={() => { void refreshSeats() }}><i className={`bi bi-arrow-clockwise${loadingSeats ? ' spin' : ''}`} /></button></header>
            {loadingSeats || !availability ? <div className="form-hint"><span className="spinner-border spinner-border-sm" /> {t('Loading current seat availability…')}</div> : (
              <>
                <div className="seat-legend">
                  <span><i className="seat-legend-dot available" /> {t('Available')}</span>
                  <span><i className="seat-legend-dot chosen" /> {t('Your seat')}</span>
                  <span><i className="seat-legend-dot booked" /> {t('Booked')}</span>
                  <span><i className="seat-legend-dot disabled" /> {t('Blocked')}</span>
                </div>
                <div className="seat-picker-grid">
                  <div className="seat-layout-column">
                    <span className="seat-front">{t('Front of vehicle')}</span>
                    <VehicleSeatMap
                      layout={availability.layout}
                      seatStates={Object.fromEntries(availability.seats.map((item) => [item.number, item.state]))}
                      selectedSeats={selectedSeats}
                      disabled={booking}
                      onSeatToggle={toggleSeat}
                    />
                    <span className="seat-rear">{t('Rear of vehicle')}</span>
                    <div className="seat-capacity">
                      <div><strong>{availability.booked_seats} / {availability.vehicle_capacity}</strong><span>{t('seats booked')}</span></div>
                      <strong>{availability.available_seats} seats available</strong>
                      <div className="occupancy-track" role="img" aria-label={`${availability.booked_seats} of ${availability.vehicle_capacity} seats booked`}><span style={{ width: `${availability.vehicle_capacity ? (availability.booked_seats / availability.vehicle_capacity) * 100 : 0}%` }} /></div>
                    </div>
                  </div>
                  <aside className="booking-selection-summary">
                    <span className="eyebrow">{t('YOUR SELECTION')}</span>
                    <div className="selected-seat-summary"><span>{selectedSeats.length ? t('{{count}} seats selected', { count: selectedSeats.length }) : t('Seats')}</span>
                      {selectedSeats.length ? <div className="selected-seat-chips">{selectedSeats.map((seat) => <button className="selected-seat-chip" key={seat} type="button" aria-label={t('Remove seat {{seat}}', { seat })} onClick={() => toggleSeat(seat)}>{String(seat).padStart(2, '0')} <i className="bi bi-x" aria-hidden="true" /></button>)}</div> : <strong>{t('Choose a seat')}</strong>}
                    </div>
                    <div className="selected-seat-summary"><span>{selectedSeats.length} × {money(selectedTrip.fare_amount)}</span><strong>{money(total)}</strong></div>
                    <button className="btn btn-primary" type="button" disabled={!selectedSeats.length || booking || loadingSeats} onClick={() => setConfirmationOpen(true)}>{t('Continue booking')} <i className="bi bi-arrow-right" /></button>
                  </aside>
                </div>
              </>
            )}
          </section>
        )}
      </div>
      {confirmationOpen && selectedTrip && (
        <div className="modal-backdrop-custom" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !booking) setConfirmationOpen(false) }}>
          <SoftShapesBackground color="var(--color-accent)" speed={1} intensity={0.15} />
          <section className="form-modal booking-confirmation" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title">
            <header className="form-modal-header"><div><span className="eyebrow">{t('FINAL REVIEW')}</span><h2 id="booking-confirm-title">{t('Confirm your booking')}</h2></div><button className="icon-button" type="button" aria-label={t('Close')} disabled={booking} onClick={() => setConfirmationOpen(false)}><i className="bi bi-x-lg" /></button></header>
            <div className="confirmation-route"><strong>{stationNames.get(selectedTrip.start_station)}</strong><i className="bi bi-arrow-right" /><strong>{stationNames.get(selectedTrip.destination_station)}</strong></div>
            <dl className="confirmation-details">
              <div><dt>{t('Date & departure')}</dt><dd>{dateLabel(selectedTrip.departure_time)}</dd></div>
              <div><dt>{t('Seats')}</dt><dd>{selectedSeats.map((seat) => String(seat).padStart(2, '0')).join(', ')}</dd></div>
              <div><dt>{t('Passenger')}</dt><dd>{user?.first_name || user?.username} {user?.last_name ?? ''}</dd></div>
              <div className="confirmation-total"><dt>{t('Total')}</dt><dd>{money(total)}</dd></div>
            </dl>
            <footer className="form-modal-footer"><button className="btn btn-light" type="button" disabled={booking} onClick={() => setConfirmationOpen(false)}>{t('Back to seats')}</button><button className="btn btn-primary" type="button" disabled={booking} onClick={() => { void confirmBooking() }}>{booking ? <><span className="spinner-border spinner-border-sm" /> {t('Confirming…')}</> : t('Confirm booking')}</button></footer>
          </section>
        </div>
      )}
    </div>
  )
}
