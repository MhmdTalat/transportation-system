import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../services/api'
import type { BookingRecord, NotificationRecord } from '../types'

function when(value: string | null): string {
  if (!value) return 'Time not scheduled'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function currency(value: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(Number(value))
}

export function PassengerDashboard() {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const [bookingData, notificationData] = await Promise.all([
        api.get<BookingRecord[]>('/api/bookings/'),
        api.get<NotificationRecord[]>('/api/notifications/'),
      ])
      setBookings(bookingData)
      setNotifications(notificationData)
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Your travel overview could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { window.clearTimeout(timer); window.clearInterval(clock) }
  }, [load])

  const upcoming = useMemo(() => bookings
    .filter((booking) => booking.status === 'confirmed' && booking.trip.departure_time && new Date(booking.trip.departure_time).getTime() > now)
    .sort((a, b) => new Date(a.trip.departure_time ?? '').getTime() - new Date(b.trip.departure_time ?? '').getTime()),
  [bookings, now])

  if (loading) return <div className="dashboard-loading" aria-label="Loading passenger home"><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>Travel overview unavailable</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>Try again</button></section>

  const next = upcoming[0]
  const recent = bookings.filter((booking) => booking.id !== next?.id).slice(0, 3)
  const unread = notifications.filter((item) => !item.is_read)

  return (
    <div className="passenger-page">
      <header className="page-heading"><div><span className="eyebrow">PASSENGER HOME</span><h1>Your journeys</h1><p>Upcoming trips, booking history, and travel updates in one place.</p></div><Link className="btn btn-primary" to="/search"><i className="bi bi-search" /> Find a trip</Link></header>
      {next ? (
        <section className="panel upcoming-trip-card">
          <div className="upcoming-trip-heading"><span className="eyebrow">UPCOMING TRIP</span><span className="booking-state state-confirmed">Confirmed</span></div>
          <h2>{next.trip.start_station_name} <i className="bi bi-arrow-right" /> {next.trip.destination_station_name}</h2>
          <div className="upcoming-trip-facts"><span><i className="bi bi-calendar3" /> {when(next.trip.departure_time)}</span><span><i className="bi bi-person-seat" /> Seats: {next.seat_numbers.map((seat) => String(seat).padStart(2, '0')).join(', ')}</span><strong>{currency(next.total_amount)}</strong></div>
          <Link className="btn btn-light" to={`/bookings#booking-${next.id}`}>View booking <i className="bi bi-arrow-right" /></Link>
        </section>
      ) : <div className="panel booking-empty"><i className="bi bi-calendar2-check" /><h2>No upcoming trips</h2><p>Explore the schedule to book a journey that works for you.</p><Link className="btn btn-primary" to="/search">Search available trips</Link></div>}

      <div className="passenger-home-grid">
        <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">YOUR TRAVEL ACTIVITY</span><h2>Recent bookings</h2></div><Link className="panel-link" to="/bookings">View history <i className="bi bi-arrow-right" /></Link></header>
          {recent.length ? <div className="booking-history-list">{recent.map((booking) => <Link className="panel recent-booking" to={`/bookings#booking-${booking.id}`} key={booking.id}><span className="booking-state state-confirmed">{booking.status}</span><strong>{booking.trip.start_station_name} <i className="bi bi-arrow-right" /> {booking.trip.destination_station_name}</strong><small>{when(booking.trip.departure_time)}</small></Link>)}</div> : <p className="empty-inline">Your recent trips will show here.</p>}
        </section>
        <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">TRAVEL UPDATES</span><h2>Notifications <span className="heading-count">{unread.length}</span></h2></div><Link className="panel-link" to="/notifications">View all <i className="bi bi-arrow-right" /></Link></header>
          {unread.length ? <div className="panel passenger-alert-list">{unread.slice(0, 4).map((item) => <Link className="passenger-alert" key={item.id} to={item.booking ? `/bookings#booking-${item.booking}` : '/notifications'}><i className="bi bi-bell" /><span><strong>{item.title}</strong><small>{item.message}</small></span></Link>)}</div> : <p className="empty-inline">No unread updates.</p>}
        </section>
      </div>
    </div>
  )
}
