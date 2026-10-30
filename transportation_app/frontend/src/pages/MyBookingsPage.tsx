import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import { formatCurrency, formatDate } from '../i18n/format'
import type { BookingRecord } from '../types'

function tripDate(value: string | null): string {
  if (!value) return 'Not scheduled'
  return formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fare(value: string): string {
  return formatCurrency(value)
}

export function MyBookingsPage({ administrator = false }: { administrator?: boolean }) {
  const { t } = useTranslation()
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
      setError(reason instanceof ApiError ? reason.message : t('Your bookings could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { window.clearTimeout(timer); window.clearInterval(clock) }
  }, [load])

  async function cancel(booking: BookingRecord) {
    if (!window.confirm(t('Cancel the booking for seat {{seats}}?', { seats: booking.seat_numbers.join(', ') }))) return
    setCancelling(booking.id)
    try {
      await api.post(`/api/bookings/${booking.id}/cancel/`, {})
      showToast(t('Booking cancelled. The seats are available again.'))
      await load()
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t('The booking could not be cancelled.'), 'error')
    } finally {
      setCancelling(null)
    }
  }

  if (loading) return <div className="dashboard-loading" aria-label={t('Loading bookings')}><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>{t('Bookings unavailable')}</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>{t('Try again')}</button></section>

  const active = bookings.filter((booking) => booking.status === 'confirmed' && booking.trip.departure_time && new Date(booking.trip.departure_time).getTime() > now)
  const history = bookings.filter((booking) => !active.includes(booking))
  const renderBooking = (booking: BookingRecord) => (
    <article className="panel booking-history-card" key={booking.id} id={`booking-${booking.id}`}>
      <div className="booking-history-main">
        <div className="booking-id"><span className="eyebrow">{t('BOOKING')} BK-{String(booking.id).padStart(4, '0')}</span><span className={`booking-state state-${booking.status}`}>{t(booking.status)}</span></div>
        {administrator && <p className="booking-passenger-name"><i className="bi bi-person" /> {booking.passenger.first_name || booking.passenger.username} {booking.passenger.last_name ?? ''}</p>}
        <h3>{booking.trip.start_station_name ?? `Station ${booking.trip.start_station}`} <i className="bi bi-arrow-right" /> {booking.trip.destination_station_name ?? `Station ${booking.trip.destination_station}`}</h3>
        <p><i className="bi bi-calendar3" /> {tripDate(booking.trip.departure_time)}</p>
      </div>
      <div className="booking-history-meta"><span>{t('Seats')}</span><strong>{booking.seat_numbers.map((seat) => String(seat).padStart(2, '0')).join(', ')}</strong></div>
      <div className="booking-history-meta"><span>{t('Total')}</span><strong>{fare(booking.total_amount)}</strong></div>
      {booking.status === 'confirmed' && booking.trip.status === 'scheduled' && <button className="btn btn-outline-danger" type="button" disabled={cancelling === booking.id} onClick={() => { void cancel(booking) }}>{cancelling === booking.id ? t('Cancelling…') : t('Cancel booking')}</button>}
    </article>
  )

  return (
    <div className="passenger-page">
      <header className="page-heading"><div><span className="eyebrow">{t(administrator ? 'PASSENGER RESERVATIONS' : 'YOUR RESERVATIONS')}</span><h1>{t(administrator ? 'Booking operations' : 'My bookings')}</h1><p>{t(administrator ? 'Review passenger bookings and cancel reservations when operations require it.' : 'Manage upcoming journeys and review past bookings.')}</p></div>{!administrator && <Link className="btn btn-primary" to="/search"><i className="bi bi-search" /> {t('Find a trip')}</Link>}</header>
      <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">{t(administrator ? 'CONFIRMED BOOKINGS' : 'READY TO TRAVEL')}</span><h2>{t('Upcoming bookings')} <span className="heading-count">{active.length}</span></h2></div></header>{active.length ? <div className="booking-history-list">{active.map(renderBooking)}</div> : <div className="panel booking-empty"><i className="bi bi-calendar2-check" /><h3>{t('No upcoming bookings')}</h3><p>{t(administrator ? 'Confirmed future reservations will appear here.' : 'Book your next trip and it will appear here.')}</p>{!administrator && <Link className="btn btn-primary" to="/search">{t('Search trips')}</Link>}</div>}</section>
      <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">{t('PAST & CANCELLED')}</span><h2>{t('Booking history')} <span className="heading-count">{history.length}</span></h2></div></header>{history.length ? <div className="booking-history-list">{history.map(renderBooking)}</div> : <p className="empty-inline">{t('Your booking history will appear here.')}</p>}</section>
    </div>
  )
}
