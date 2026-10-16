import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastContext'
import { api, ApiError } from '../services/api'
import type { ApiRecord, BookingRecord, UserRecord } from '../types'

function field(record: ApiRecord, key: string): string {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : 'Not provided'
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function bookingTripName(booking: BookingRecord): string {
  const from = booking.trip?.start_station_name
  const to = booking.trip?.destination_station_name
  return from && to ? `${from} to ${to}` : `Trip #${booking.trip?.id ?? '—'}`
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
  const [imageFailed, setImageFailed] = useState(false)
  const photoUrl = typeof user.profile_photo_url === 'string' ? user.profile_photo_url.trim() : ''

  if (photoUrl && !imageFailed) {
    return (
      <img
        className="user-profile-avatar"
        src={photoUrl}
        alt={`${name}'s profile`}
        onError={() => setImageFailed(true)}
      />
    )
  }

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className="user-profile-avatar user-profile-avatar-fallback" aria-label={`${name} profile`}>{initials || <i className="bi bi-person" aria-hidden="true" />}</span>
}

function InfoItem({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  return (
    <div className="user-profile-info-item">
      <span className="user-profile-info-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      <div className="user-profile-info-copy">
        <span>{label}</span>
        {href && value !== 'Not provided'
          ? <a href={href}>{value}</a>
          : <strong>{value}</strong>}
      </div>
    </div>
  )
}

export function UserProfileDetails({ record }: { record: ApiRecord }) {
  const user = record as UserRecord
  const { showToast } = useToast()
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [now, setNow] = useState(0)

  const fullName = [user.first_name, user.last_name].filter((part) => typeof part === 'string' && part.trim()).join(' ') || user.username || 'User'
  const email = field(record, 'email')
  const phone = field(record, 'phone_number')
  const photo = field(record, 'profile_photo_url')
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
          setBookingsError(reason instanceof ApiError ? reason.message : 'Could not load this passenger’s bookings.')
        }
      } finally {
        if (active) setBookingsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [user.id, user.role])

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
      setBookingsError(reason instanceof ApiError ? reason.message : 'Could not load this passenger’s bookings.')
    } finally {
      setBookingsLoading(false)
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(`${label} copied.`)
    } catch {
      showToast(`Could not copy ${label.toLowerCase()}.`, 'error')
    }
  }

  return (
    <div className="user-profile-page">
      <div className="user-profile-breadcrumb">
        <Link className="back-link" to="/users"><i className="bi bi-arrow-left" /> Back to Users</Link>
        <nav aria-label="Breadcrumb">
          <Link to="/">Dashboard</Link><i className="bi bi-chevron-right" aria-hidden="true" />
          <Link to="/users">Users</Link><i className="bi bi-chevron-right" aria-hidden="true" />
          <span>{user.role === 'passenger' ? 'Passenger Profile' : `${user.role} Profile`}</span>
        </nav>
      </div>

      <header className="user-profile-heading">
        <div>
          <span className="eyebrow">USER PROFILE</span>
          <h1>{user.role === 'passenger' ? 'Passenger profile' : `${user.role || 'User'} profile`}</h1>
          <p>Profile and trip information for this account.</p>
        </div>
        <div className="user-profile-actions">
          <button className="btn btn-light" type="button" onClick={() => { void copyValue(String(user.id), 'User ID') }}>
            <i className="bi bi-copy" aria-hidden="true" /> Copy user ID
          </button>
          <Link className="btn btn-outline-primary" to="/bookings"><i className="bi bi-ticket-perforated" aria-hidden="true" /> All bookings</Link>
          <a className="user-profile-schema-link" href="/swagger/" target="_blank" rel="noreferrer">API schema</a>
        </div>
      </header>

      <div className="user-profile-grid">
        <aside className="panel user-profile-summary">
          <div className="user-profile-identity">
            <UserAvatar key={photoUrl} user={user} name={fullName} />
            <h2>{fullName}</h2>
            <p>@{field(record, 'username') === 'Not provided' ? '—' : user.username}</p>
            <span className="user-profile-role"><i className="bi bi-person-badge" aria-hidden="true" />{user.role || 'User'}</span>
            <span className="user-profile-id">User #{user.id}</span>
          </div>
          <div className="user-profile-contact">
            <h3>Contact</h3>
            <InfoItem icon="bi-envelope" label="Email address" value={email} href={email !== 'Not provided' ? `mailto:${email}` : undefined} />
            <InfoItem icon="bi-telephone" label="Phone number" value={phone} href={phone !== 'Not provided' ? `tel:${phone}` : undefined} />
            {email !== 'Not provided' && (
              <button className="user-profile-copy-contact" type="button" onClick={() => { void copyValue(email, 'Email') }}>
                <i className="bi bi-copy" aria-hidden="true" /> Copy email
              </button>
            )}
            {phone !== 'Not provided' && (
              <button className="user-profile-copy-contact" type="button" onClick={() => { void copyValue(phone, 'Phone number') }}>
                <i className="bi bi-copy" aria-hidden="true" /> Copy phone number
              </button>
            )}
          </div>
        </aside>

        <div className="user-profile-main">
          <section className="panel user-profile-section">
            <header className="user-profile-section-heading">
              <span className="user-profile-section-icon"><i className="bi bi-person-lines-fill" aria-hidden="true" /></span>
              <div><h2>Personal information</h2><p>Contact and identity details returned by the account service.</p></div>
            </header>
            <div className="user-profile-information-grid">
              <InfoItem icon="bi-person" label="First name" value={field(record, 'first_name')} />
              <InfoItem icon="bi-person" label="Last name" value={field(record, 'last_name')} />
              <InfoItem icon="bi-at" label="Username" value={field(record, 'username')} />
              <InfoItem icon="bi-envelope" label="Email address" value={email} href={email !== 'Not provided' ? `mailto:${email}` : undefined} />
              <InfoItem icon="bi-telephone" label="Phone number" value={phone} href={phone !== 'Not provided' ? `tel:${phone}` : undefined} />
              <InfoItem icon="bi-image" label="Profile photo" value={photo === 'Not provided' ? photo : 'Photo URL provided'} />
            </div>
          </section>

          <section className="panel user-profile-section">
            <header className="user-profile-section-heading">
              <span className="user-profile-section-icon"><i className="bi bi-shield-check" aria-hidden="true" /></span>
              <div><h2>Account information</h2><p>Account metadata available from the user record.</p></div>
            </header>
            <div className="user-profile-information-grid">
              <InfoItem icon="bi-hash" label="User ID" value={String(user.id)} />
              <InfoItem icon="bi-person-badge" label="Role" value={user.role || 'Not provided'} />
              {typeof user.is_active === 'boolean' && (
                <div className="user-profile-info-item">
                  <span className="user-profile-info-icon"><i className="bi bi-toggle-on" aria-hidden="true" /></span>
                  <div className="user-profile-info-copy"><span>Account status</span><strong className={`user-profile-status${user.is_active ? ' is-active' : ' is-inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</strong></div>
                </div>
              )}
              {typeof user.date_joined === 'string' && <InfoItem icon="bi-calendar3" label="Date joined" value={formatDate(user.date_joined)} />}
              {typeof record.created_at === 'string' && <InfoItem icon="bi-calendar3" label="Created" value={formatDate(record.created_at)} />}
              {typeof record.updated_at === 'string' && <InfoItem icon="bi-clock-history" label="Last updated" value={formatDate(record.updated_at)} />}
            </div>
          </section>

          {user.role === 'passenger' && <section className="panel user-profile-section user-bookings-section" id="user-bookings">
            <header className="user-profile-section-heading user-bookings-heading">
              <span className="user-profile-section-icon"><i className="bi bi-ticket-perforated" aria-hidden="true" /></span>
              <div><h2>Passenger bookings</h2><p>Booking and trip activity linked to this account.</p></div>
              {!bookingsLoading && !bookingsError && <span className="user-bookings-count">{bookings.length} total</span>}
            </header>
            {bookingsLoading ? (
              <div className="user-bookings-loading" role="status"><span className="spinner-border spinner-border-sm" /> Loading bookings…</div>
            ) : bookingsError ? (
              <div className="user-bookings-error" role="alert"><span>{bookingsError}</span><button className="btn btn-light" type="button" onClick={() => { void retryBookings() }}>Retry</button></div>
            ) : bookings.length === 0 ? (
              <div className="user-bookings-empty"><i className="bi bi-calendar2-x" aria-hidden="true" /><span>No bookings are associated with this account.</span></div>
            ) : (
              <>
                <div className="user-booking-metrics">
                  <div><strong>{bookings.length}</strong><span>Total bookings</span></div>
                  <div><strong>{upcomingBookings.length}</strong><span>Upcoming trips</span></div>
                  <div><strong>{completedCount}</strong><span>Completed</span></div>
                  <div><strong>{cancelledCount}</strong><span>Cancelled</span></div>
                </div>
                <div className="user-bookings-list">
                  {[...upcomingBookings, ...bookings.filter((booking) => !upcomingBookings.includes(booking)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))].slice(0, 5).map((booking) => (
                    <article className="user-booking-row" key={booking.id}>
                      <span className="user-booking-icon"><i className="bi bi-signpost-2" aria-hidden="true" /></span>
                      <div className="user-booking-route"><strong>{bookingTripName(booking)}</strong><span>{booking.trip?.departure_time ? formatDate(booking.trip.departure_time) : 'Departure not provided'}</span></div>
                      <div className="user-booking-seats"><span>Seats</span><strong>{booking.seat_numbers?.length ? booking.seat_numbers.join(', ') : '—'}</strong></div>
                      <span className={`user-booking-status status-${booking.status}`}>{booking.status}</span>
                    </article>
                  ))}
                </div>
                {bookings.length > 5 && <Link className="user-bookings-more" to="/bookings">View all {bookings.length} bookings <i className="bi bi-arrow-right" aria-hidden="true" /></Link>}
              </>
            )}
          </section>}
        </div>
      </div>
    </div>
  )
}
