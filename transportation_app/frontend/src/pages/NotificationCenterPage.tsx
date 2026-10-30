import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import { formatRelativeTime } from '../i18n/format'
import type { NotificationRecord } from '../types'

export function NotificationCenterPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    try {
      setItems(await api.get<NotificationRecord[]>('/api/notifications/'))
      setError(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Notifications could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [t])

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
      showToast(reason instanceof Error ? reason.message : t('Notification could not be marked as read.'), 'error')
    }
  }

  async function markAllRead() {
    try {
      await api.post('/api/notifications/mark-all-read/', {})
      setItems((current) => current.map((item) => ({ ...item, is_read: true })))
      showToast(t('All notifications marked as read.'))
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : t('Notifications could not be updated.'), 'error')
    }
  }

  const unread = items.filter((item) => !item.is_read).length
  if (loading) return <div className="dashboard-loading" aria-label={t('Loading notifications')}><div className="loading-title" /><div className="metric-skeleton chart-skeleton" /></div>
  if (error) return <section className="page-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h1>{t('Notifications unavailable')}</h1><p>{error}</p><button className="btn btn-primary" type="button" onClick={() => { setLoading(true); void load() }}>{t('Try again')}</button></section>

  return (
    <div className="passenger-page">
      <header className="page-heading"><div><span className="eyebrow">{t('UPDATES & REMINDERS')}</span><h1>{t('Notifications')}</h1><p>{unread ? t('{{count}} unread updates', { count: unread }) : t('You are all caught up.')}</p></div>{unread > 0 && <button className="btn btn-light" type="button" onClick={() => { void markAllRead() }}>{t('Mark all as read')}</button>}</header>
      {items.length ? <div className="notification-list">{items.map((item) => (
        <article className={`panel notification-card${item.is_read ? '' : ' notification-unread'}`} key={item.id}>
          <span className={`notification-icon notification-${item.notification_type}`}><i className={`bi ${item.notification_type === 'trip_reminder' ? 'bi-alarm' : item.notification_type === 'booking_confirmation' ? 'bi-ticket-perforated' : 'bi-info-circle'}`} /></span>
          <div className="notification-copy"><div className="notification-title-row"><h2>{item.title}</h2>{!item.is_read && <span className="unread-label">{t('NEW')}</span>}</div><p>{item.message}</p><time dateTime={item.created_at}>{formatRelativeTime(item.created_at)}</time></div>
          <div className="notification-actions">{item.booking && <Link className="btn btn-light" to={`/bookings#booking-${item.booking}`} onClick={() => { void markRead(item) }}>{t('View booking')}</Link>}{!item.is_read && <button className="btn btn-outline-primary" type="button" onClick={() => { void markRead(item) }}>{t('Mark read')}</button>}</div>
        </article>
      ))}</div> : <div className="panel booking-empty"><i className="bi bi-bell-slash" /><h2>{t('No notifications yet')}</h2><p>{t('Booking confirmations and trip reminders will appear here.')}</p></div>}
    </div>
  )
}
