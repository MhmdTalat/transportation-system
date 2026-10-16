import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import type { BookingRecord } from '../types'

function tripDate(value: string | null): string {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function fare(value: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(Number(value))
}

export function MyBookingsPage({ administrator = false }: { administrator?: boolean }) {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setBookings(await api.get<BookingRecord[]>('/api/bookings/'))
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Your bookings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { window.clearTimeout(timer); window.clearInterval(clock) }
  }, [load])

  async function cancel(booking: BookingRecord) {
    if (!window.confirm(`Cancel the booking for seat${booking.seat_numbers.length === 1 ? '' : 's'} ${booking.seat_numbers.join(', ')}?`)) return
    setCancelling(booking.id)
    try {
      await api.post(`/api/bookings/${booking.id}/cancel/`, {})
      showToast('Booking cancelled. The seats are available again.')
      await load()
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'The booking could not be cancelled.', 'error')
    } finally {
      setCancelling(null)
    }
  }

  if (loading) return <div className="dashboard-loading" aria-label="Loading bookings"><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>Bookings unavailable</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>Try again</button></section>

  const active = bookings.filter((booking) => booking.status === 'confirmed' && booking.trip.departure_time && new Date(booking.trip.departure_time).getTime() > now)
  const history = bookings.filter((booking) => !active.includes(booking))
  const renderBooking = (booking: BookingRecord) => (
    <article className="panel booking-history-card" key={booking.id} id={`booking-${booking.id}`}>
      <div className="booking-history-main">
        <div className="booking-id"><span className="eyebrow">BOOKING BK-{String(booking.id).padStart(4, '0')}</span><span className={`booking-state state-${booking.status}`}>{booking.status}</span></div>
        {administrator && <p className="booking-passenger-name"><i className="bi bi-person" /> {booking.passenger.first_name || booking.passenger.username} {booking.passenger.last_name ?? ''}</p>}
        <h3>{booking.trip.start_station_name ?? `Station ${booking.trip.start_station}`} <i className="bi bi-arrow-right" /> {booking.trip.destination_station_name ?? `Station ${booking.trip.destination_station}`}</h3>
        <p><i className="bi bi-calendar3" /> {tripDate(booking.trip.departure_time)}</p>
      </div>
      <div className="booking-history-meta"><span>Seats</span><strong>{booking.seat_numbers.map((seat) => String(seat).padStart(2, '0')).join(', ')}</strong></div>
      <div className="booking-history-meta"><span>Total</span><strong>{fare(booking.total_amount)}</strong></div>
      {booking.status === 'confirmed' && booking.trip.status === 'scheduled' && <button className="btn btn-outline-danger" type="button" disabled={cancelling === booking.id} onClick={() => { void cancel(booking) }}>{cancelling === booking.id ? 'Cancelling…' : 'Cancel booking'}</button>}
    </article>
  )

  return (
    <div className="passenger-page">
      <header className="page-heading"><div><span className="eyebrow">{administrator ? 'PASSENGER RESERVATIONS' : 'YOUR RESERVATIONS'}</span><h1>{administrator ? 'Booking operations' : 'My bookings'}</h1><p>{administrator ? 'Review passenger bookings and cancel reservations when operations require it.' : 'Manage upcoming journeys and review past bookings.'}</p></div>{!administrator && <Link className="btn btn-primary" to="/search"><i className="bi bi-search" /> Find a trip</Link>}</header>
      <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">{administrator ? 'CONFIRMED BOOKINGS' : 'READY TO TRAVEL'}</span><h2>Upcoming bookings <span className="heading-count">{active.length}</span></h2></div></header>{active.length ? <div className="booking-history-list">{active.map(renderBooking)}</div> : <div className="panel booking-empty"><i className="bi bi-calendar2-check" /><h3>No upcoming bookings</h3><p>{administrator ? 'Confirmed future reservations will appear here.' : 'Book your next trip and it will appear here.'}</p>{!administrator && <Link className="btn btn-primary" to="/search">Search trips</Link>}</div>}</section>
      <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">PAST &amp; CANCELLED</span><h2>Booking history <span className="heading-count">{history.length}</span></h2></div></header>{history.length ? <div className="booking-history-list">{history.map(renderBooking)}</div> : <p className="empty-inline">Your booking history will appear here.</p>}</section>
    </div>
  )
}
