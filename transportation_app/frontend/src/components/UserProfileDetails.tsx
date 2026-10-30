import { useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useToast } from './ToastContext'
import { api, ApiError } from '../services/api'
import { formatDate as formatLocalizedDate } from '../i18n/format'
import type { ApiRecord, BookingRecord, UserRecord } from '../types'

function field(record: ApiRecord, key: string, t: TFunction): string {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : t('Not provided')
}

function formatDate(value: string | undefined, t: TFunction): string {
  if (!value) return t('Not provided')
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? t('Not provided')
    : formatLocalizedDate(date, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

function bookingTripName(booking: BookingRecord, t: TFunction): string {
  const from = booking.trip?.start_station_name
  const to = booking.trip?.destination_station_name
  return from && to ? t('{{from}} to {{to}}', { from, to }) : t('Trip #{{id}}', { id: booking.trip?.id ?? '—' })
}

function departureDate(booking: BookingRecord): number {
  const date = booking.trip?.departure_time
  return date ? new Date(date).getTime() : Number.POSITIVE_INFINITY
}

function getUserBookings(userId: number): Promise<BookingRecord[]> {
  const query = new URLSearchParams({ passenger_id: String(userId) })
  return api.get<BookingRecord[]>(`/api/bookings/?${query}`)
}

function UserAvatar({ user, name }: { user: UserRecord; name: string }) {
  const { t } = useTranslation()
  const [imageFailed, setImageFailed] = useState(false)
  const photoUrl = typeof user.profile_photo_url === 'string' ? user.profile_photo_url.trim() : ''

  if (photoUrl && !imageFailed) {
    return (
      <img
        className="user-profile-avatar"
        src={photoUrl}
        alt={t('Profile photo for {{name}}', { name })}
        onError={() => setImageFailed(true)}
      />
    )
  }

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className="user-profile-avatar user-profile-avatar-fallback" aria-label={t('Profile for {{name}}', { name })}>{initials || <i className="bi bi-person" aria-hidden="true" />}</span>
}

function InfoItem({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  return (
    <div className="user-profile-info-item">
      <span className="user-profile-info-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      <div className="user-profile-info-copy">
        <span>{label}</span>
        {href
          ? <a href={href}>{value}</a>
          : <strong>{value}</strong>}
      </div>
    </div>
  )
}

export function UserProfileDetails({ record }: { record: ApiRecord }) {
  const { t } = useTranslation()
  const user = record as UserRecord
  const { showToast } = useToast()
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const fullName = [user.first_name, user.last_name].filter((part) => typeof part === 'string' && part.trim()).join(' ') || user.username || t('User')
  const email = field(record, 'email', t)
  const phone = field(record, 'phone_number', t)
  const photo = field(record, 'profile_photo_url', t)
  const photoUrl = typeof user.profile_photo_url === 'string' ? user.profile_photo_url.trim() : ''

  useEffect(() => {
    if (user.role !== 'passenger') return
    let active = true
    async function load() {
      try {
        const result = await getUserBookings(user.id)
        if (active) {
          setBookings(result)
          setNow(Date.now())
        }
      } catch (reason) {
        if (active) {
          setBookingsError(reason instanceof ApiError ? reason.message : t('Could not load this passenger’s bookings.'))
        }
      } finally {
        if (active) setBookingsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [user.id, user.role, t])

  const upcomingBookings = useMemo(() => bookings
    .filter((booking) => booking.status === 'confirmed' && departureDate(booking) > now)
    .sort((left, right) => departureDate(left) - departureDate(right)), [bookings, now])
  const completedCount = bookings.filter((booking) => booking.status === 'completed').length
  const cancelledCount = bookings.filter((booking) => booking.status === 'cancelled').length

  async function retryBookings() {
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      setBookings(await getUserBookings(user.id))
      setNow(Date.now())
    } catch (reason) {
      setBookingsError(reason instanceof ApiError ? reason.message : t('Could not load this passenger’s bookings.'))
    } finally {
      setBookingsLoading(false)
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(t('{{label}} copied.', { label }))
    } catch {
      showToast(t('Could not copy {{label}}.', { label: label.toLowerCase() }), 'error')
    }
  }

  return (
    <div className="user-profile-page">
      <div className="user-profile-breadcrumb">
        <Link className="back-link" to="/users"><i className="bi bi-arrow-left" /> {t('Back to Users')}</Link>
        <nav aria-label={t('Breadcrumb')}>
          <Link to="/">{t('Dashboard')}</Link><i className="bi bi-chevron-right" aria-hidden="true" />
          <Link to="/users">{t('Users')}</Link><i className="bi bi-chevron-right" aria-hidden="true" />
          <span>{user.role === 'passenger' ? t('Passenger Profile') : t('{{role}} Profile', { role: t(user.role || 'User') })}</span>
        </nav>
      </div>

      <header className="user-profile-heading">
        <div>
          <span className="eyebrow">{t('USER PROFILE')}</span>
          <h1>{user.role === 'passenger' ? t('Passenger profile') : t('{{role}} profile', { role: t(user.role || 'User') })}</h1>
          <p>{t('Profile and trip information for this account.')}</p>
        </div>
        <div className="user-profile-actions">
          <button className="btn btn-light" type="button" onClick={() => { void copyValue(String(user.id), t('User ID')) }}>
            <i className="bi bi-copy" aria-hidden="true" /> {t('Copy user ID')}
          </button>
          <Link className="btn btn-outline-primary" to="/bookings"><i className="bi bi-ticket-perforated" aria-hidden="true" /> {t('All bookings')}</Link>
          <a className="user-profile-schema-link" href="/swagger/" target="_blank" rel="noreferrer">{t('API schema')}</a>
        </div>
      </header>

      <div className="user-profile-grid">
        <aside className="panel user-profile-summary">
          <div className="user-profile-identity">
            <UserAvatar key={photoUrl} user={user} name={fullName} />
            <h2>{fullName}</h2>
            <p>@{field(record, 'username', t) === t('Not provided') ? '—' : user.username}</p>
            <span className="user-profile-role"><i className="bi bi-person-badge" aria-hidden="true" />{t(user.role || 'User')}</span>
            <span className="user-profile-id">{t('User #{{id}}', { id: user.id })}</span>
          </div>
          <div className="user-profile-contact">
            <h3>{t('Contact')}</h3>
            <InfoItem icon="bi-envelope" label={t('Email address')} value={email} href={email !== t('Not provided') ? `mailto:${email}` : undefined} />
            <InfoItem icon="bi-telephone" label={t('Phone number')} value={phone} href={phone !== t('Not provided') ? `tel:${phone}` : undefined} />
            {email !== t('Not provided') && (
              <button className="user-profile-copy-contact" type="button" onClick={() => { void copyValue(email, t('Email')) }}>
                <i className="bi bi-copy" aria-hidden="true" /> {t('Copy email')}
              </button>
            )}
            {phone !== t('Not provided') && (
              <button className="user-profile-copy-contact" type="button" onClick={() => { void copyValue(phone, t('Phone number')) }}>
                <i className="bi bi-copy" aria-hidden="true" /> {t('Copy phone number')}
              </button>
            )}
          </div>
        </aside>

        <div className="user-profile-main">
          <section className="panel user-profile-section">
            <header className="user-profile-section-heading">
              <span className="user-profile-section-icon"><i className="bi bi-person-lines-fill" aria-hidden="true" /></span>
              <div><h2>{t('Personal information')}</h2><p>{t('Contact and identity details returned by the account service.')}</p></div>
            </header>
            <div className="user-profile-information-grid">
              <InfoItem icon="bi-person" label={t('First name')} value={field(record, 'first_name', t)} />
              <InfoItem icon="bi-person" label={t('Last name')} value={field(record, 'last_name', t)} />
              <InfoItem icon="bi-at" label={t('Username')} value={field(record, 'username', t)} />
              <InfoItem icon="bi-envelope" label={t('Email address')} value={email} href={email !== t('Not provided') ? `mailto:${email}` : undefined} />
              <InfoItem icon="bi-telephone" label={t('Phone number')} value={phone} href={phone !== t('Not provided') ? `tel:${phone}` : undefined} />
              <InfoItem icon="bi-image" label={t('Profile photo')} value={photo === t('Not provided') ? photo : t('Photo URL provided')} />
            </div>
          </section>

          <section className="panel user-profile-section">
            <header className="user-profile-section-heading">
              <span className="user-profile-section-icon"><i className="bi bi-shield-check" aria-hidden="true" /></span>
              <div><h2>{t('Account information')}</h2><p>{t('Account metadata available from the user record.')}</p></div>
            </header>
            <div className="user-profile-information-grid">
              <InfoItem icon="bi-hash" label={t('User ID')} value={String(user.id)} />
              <InfoItem icon="bi-person-badge" label={t('Role')} value={t(user.role || 'Not provided')} />
              {typeof user.is_active === 'boolean' && (
                <div className="user-profile-info-item">
                  <span className="user-profile-info-icon"><i className="bi bi-toggle-on" aria-hidden="true" /></span>
                  <div className="user-profile-info-copy"><span>{t('Account status')}</span><strong className={`user-profile-status${user.is_active ? ' is-active' : ' is-inactive'}`}>{t(user.is_active ? 'Active' : 'Inactive')}</strong></div>
                </div>
              )}
              {typeof user.date_joined === 'string' && <InfoItem icon="bi-calendar3" label={t('Date joined')} value={formatDate(user.date_joined, t)} />}
              {typeof record.created_at === 'string' && <InfoItem icon="bi-calendar3" label={t('Created')} value={formatDate(record.created_at, t)} />}
              {typeof record.updated_at === 'string' && <InfoItem icon="bi-clock-history" label={t('Last updated')} value={formatDate(record.updated_at, t)} />}
            </div>
          </section>

          {user.role === 'passenger' && <section className="panel user-profile-section user-bookings-section" id="user-bookings">
            <header className="user-profile-section-heading user-bookings-heading">
              <span className="user-profile-section-icon"><i className="bi bi-ticket-perforated" aria-hidden="true" /></span>
              <div><h2>{t('Passenger bookings')}</h2><p>{t('Booking and trip activity linked to this account.')}</p></div>
              {!bookingsLoading && !bookingsError && <span className="user-bookings-count">{t('{{count}} total', { count: bookings.length })}</span>}
            </header>
            {bookingsLoading ? (
              <div className="user-bookings-loading" role="status"><span className="spinner-border spinner-border-sm" /> {t('Loading bookings…')}</div>
            ) : bookingsError ? (
              <div className="user-bookings-error" role="alert"><span>{bookingsError}</span><button className="btn btn-light" type="button" onClick={() => { void retryBookings() }}>{t('Retry')}</button></div>
            ) : bookings.length === 0 ? (
              <div className="user-bookings-empty"><i className="bi bi-calendar2-x" aria-hidden="true" /><span>{t('No bookings are associated with this account.')}</span></div>
            ) : (
              <>
                <div className="user-booking-metrics">
                  <div><strong>{bookings.length}</strong><span>{t('Total bookings')}</span></div>
                  <div><strong>{upcomingBookings.length}</strong><span>{t('Upcoming trips')}</span></div>
                  <div><strong>{completedCount}</strong><span>{t('Completed')}</span></div>
                  <div><strong>{cancelledCount}</strong><span>{t('Cancelled')}</span></div>
                </div>
                <div className="user-bookings-list">
                  {[...upcomingBookings, ...bookings.filter((booking) => !upcomingBookings.includes(booking)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))].slice(0, 5).map((booking) => (
                    <article className="user-booking-row" key={booking.id}>
                      <span className="user-booking-icon"><i className="bi bi-signpost-2" aria-hidden="true" /></span>
                      <div className="user-booking-route"><strong>{bookingTripName(booking, t)}</strong><span>{booking.trip?.departure_time ? formatDate(booking.trip.departure_time, t) : t('Departure not provided')}</span></div>
                      <div className="user-booking-seats"><span>{t('Seats')}</span><strong>{booking.seat_numbers?.length ? booking.seat_numbers.join(', ') : '—'}</strong></div>
                      <span className={`user-booking-status status-${booking.status}`}>{t(booking.status)}</span>
                    </article>
                  ))}
                </div>
                {bookings.length > 5 && <Link className="user-bookings-more" to="/bookings">{t('View all {{count}} bookings', { count: bookings.length })} <i className="bi bi-arrow-right" aria-hidden="true" /></Link>}
              </>
            )}
          </section>}
        </div>
      </div>
    </div>
  )
}
