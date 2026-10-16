import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import type { NotificationRecord } from '../types'

function relativeTime(value: string): string {
  const created = new Date(value).getTime()
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function NotificationCenterPage() {
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setItems(await api.get<NotificationRecord[]>('/api/notifications/'))
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load() }, 0)
    const timer = window.setInterval(() => { void load() }, 60_000)
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer) }
  }, [load])

  async function markRead(item: NotificationRecord) {
    if (item.is_read) return
    try {
      await api.patch(`/api/notifications/${item.id}/`, { is_read: true })
      setItems((current) => current.map((notification) => notification.id === item.id ? { ...notification, is_read: true } : notification))
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Notification could not be marked as read.', 'error')
    }
  }

  async function markAllRead() {
    try {
      await api.post('/api/notifications/mark-all-read/', {})
      setItems((current) => current.map((item) => ({ ...item, is_read: true })))
      showToast('All notifications marked as read.')
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Notifications could not be updated.', 'error')
    }
  }

  const unread = items.filter((item) => !item.is_read).length
  if (loading) return <div className="dashboard-loading" aria-label="Loading notifications"><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>Notifications unavailable</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>Try again</button></section>

  return (
    <div className="passenger-page">
      <header className="page-heading"><div><span className="eyebrow">UPDATES &amp; REMINDERS</span><h1>Notifications</h1><p>{unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You are all caught up.'}</p></div>{unread > 0 && <button className="btn btn-light" type="button" onClick={() => { void markAllRead() }}>Mark all as read</button>}</header>
      {items.length ? <div className="notification-list">{items.map((item) => (
        <article className={`panel notification-card${item.is_read ? '' : ' notification-unread'}`} key={item.id}>
          <span className={`notification-icon notification-${item.notification_type}`}><i className={`bi ${item.notification_type === 'trip_reminder' ? 'bi-alarm' : item.notification_type === 'booking_confirmation' ? 'bi-ticket-perforated' : 'bi-info-circle'}`} /></span>
          <div className="notification-copy"><div className="notification-title-row"><h2>{item.title}</h2>{!item.is_read && <span className="unread-label">NEW</span>}</div><p>{item.message}</p><time dateTime={item.created_at}>{relativeTime(item.created_at)}</time></div>
          <div className="notification-actions">{item.booking && <Link className="btn btn-light" to={`/bookings#booking-${item.booking}`} onClick={() => { void markRead(item) }}>View booking</Link>}{!item.is_read && <button className="btn btn-outline-primary" type="button" onClick={() => { void markRead(item) }}>Mark read</button>}</div>
        </article>
      ))}</div> : <div className="panel booking-empty"><i className="bi bi-bell-slash" /><h2>No notifications yet</h2><p>Booking confirmations and trip reminders will appear here.</p></div>}
    </div>
  )
}
