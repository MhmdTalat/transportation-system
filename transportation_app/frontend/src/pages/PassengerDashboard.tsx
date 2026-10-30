import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../services/api'
import { formatCurrency, formatDate } from '../i18n/format'
import type { BookingRecord, NotificationRecord } from '../types'
import { BottomSheet, StatusChip } from '../components/ride/RideComponents'
import { MovingCarsBackground } from '../components/ride/MovingCarsBackground'

function when(value: string | null): string {
  if (!value) return 'Time not scheduled'
  return formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function currency(value: string): string {
  return formatCurrency(value)
}

export function PassengerDashboard() {
  const { t } = useTranslation()
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
      setError(reason instanceof ApiError ? reason.message : t('Your travel overview could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { window.clearTimeout(timer); window.clearInterval(clock) }
  }, [load])

  const upcoming = useMemo(() => bookings
    .filter((booking) => booking.status === 'confirmed' && booking.trip.departure_time && new Date(booking.trip.departure_time).getTime() > now)
    .sort((a, b) => new Date(a.trip.departure_time ?? '').getTime() - new Date(b.trip.departure_time ?? '').getTime()),
  [bookings, now])

  if (loading) return <div className="dashboard-loading" aria-label={t('Loading passenger home')}><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>{t('Travel overview unavailable')}</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>{t('Try again')}</button></section>

  const next = upcoming[0]
  const recent = bookings.filter((booking) => booking.id !== next?.id).slice(0, 3)
  const unread = notifications.filter((item) => !item.is_read)

  return (
    <div className="passenger-page passenger-ride-home">
      <header className="page-heading"><div><span className="eyebrow">{t('PASSENGER HOME')}</span><h1>{t('Your journeys')}</h1><p>{t('Upcoming trips, booking history, and travel updates in one place.')}</p></div><Link className="btn btn-primary" to="/search"><i className="bi bi-search" /> {t('Find a trip')}</Link></header>
      <div className="passenger-home-map" role="img" aria-label={t('Trip search map preview')}>
        <MovingCarsBackground color="var(--color-accent)" speed={1} intensity={0.75} />
        <span className="passenger-map-marker"><i className="bi bi-car-front-fill" aria-hidden="true" /></span>
      </div>
      <BottomSheet className="passenger-home-sheet" label={t('Passenger trip options')}>
        <div className="where-to">
          <div className="ride-address-input" aria-label={t('Choose pickup and destination')}>
            <span className="ride-address-dot ride-address-dropoff" aria-hidden="true" />
            <span className="ride-address-copy"><small>{t('PLAN A TRIP')}</small><strong>{t('Where would you like to go?')}</strong></span>
          </div>
          <Link className="where-to-button" to="/search" aria-label={t('Find a trip')}><i className="bi bi-arrow-right" /></Link>
        </div>
        {next ? (
          <section className="panel upcoming-trip-card">
          <div className="upcoming-trip-heading"><span className="eyebrow">{t('UPCOMING TRIP')}</span><StatusChip tone="success">{t('Confirmed')}</StatusChip></div>
          <h2>{next.trip.start_station_name} <i className="bi bi-arrow-right" /> {next.trip.destination_station_name}</h2>
          <div className="upcoming-trip-facts"><span><i className="bi bi-calendar3" /> {when(next.trip.departure_time)}</span><span><i className="bi bi-person-seat" /> {t('Seats:')} {next.seat_numbers.map((seat) => String(seat).padStart(2, '0')).join(', ')}</span><strong>{currency(next.total_amount)}</strong></div>
          <Link className="ride-button ride-button-primary" to={`/bookings#booking-${next.id}`}>{t('View booking')} <i className="bi bi-arrow-right" /></Link>
        </section>
        ) : <div className="panel booking-empty"><i className="bi bi-calendar2-check" /><h2>{t('No upcoming trips')}</h2><p>{t('Explore the schedule to book a journey that works for you.')}</p><Link className="ride-button ride-button-primary" to="/search"><i className="bi bi-search" /> {t('Search available trips')}</Link></div>}
      </BottomSheet>

      <div className="passenger-home-grid">
        <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">{t('YOUR TRAVEL ACTIVITY')}</span><h2>{t('Recent bookings')}</h2></div><Link className="panel-link" to="/bookings">{t('View history')} <i className="bi bi-arrow-right" /></Link></header>
          {recent.length ? <div className="booking-history-list">{recent.map((booking) => <Link className="panel recent-booking" to={`/bookings#booking-${booking.id}`} key={booking.id}><span className="booking-state state-confirmed">{t(booking.status)}</span><strong>{booking.trip.start_station_name} <i className="bi bi-arrow-right" /> {booking.trip.destination_station_name}</strong><small>{when(booking.trip.departure_time)}</small></Link>)}</div> : <p className="empty-inline">{t('Your recent trips will show here.')}</p>}
        </section>
        <section className="booking-group"><header className="section-heading"><div><span className="eyebrow">{t('TRAVEL UPDATES')}</span><h2>{t('Notifications')} <span className="heading-count">{unread.length}</span></h2></div><Link className="panel-link" to="/notifications">{t('View all')} <i className="bi bi-arrow-right" /></Link></header>
          {unread.length ? <div className="panel passenger-alert-list">{unread.slice(0, 4).map((item) => <Link className="passenger-alert" key={item.id} to={item.booking ? `/bookings#booking-${item.booking}` : '/notifications'}><i className="bi bi-bell" /><span><strong>{item.title}</strong><small>{item.message}</small></span></Link>)}</div> : <p className="empty-inline">{t('No unread updates.')}</p>}
        </section>
      </div>
    </div>
  )
}
