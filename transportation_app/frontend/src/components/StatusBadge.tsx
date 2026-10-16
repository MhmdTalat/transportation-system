export type StatusKind = 'trip' | 'vehicle' | 'driver' | 'generic'

interface Props {
  status: string
  kind?: StatusKind
}

const statusPresentation: Record<StatusKind, Record<string, { label: string; icon: string; tone: string }>> = {
  trip: {
    scheduled: { label: 'Scheduled', icon: 'bi-calendar-event', tone: 'info' },
    assigned: { label: 'Assigned', icon: 'bi-person-check', tone: 'info' },
    ready: { label: 'Ready', icon: 'bi-check2-circle', tone: 'success' },
    in_progress: { label: 'In transit', icon: 'bi-signpost-2', tone: 'live' },
    arrived: { label: 'Arrived', icon: 'bi-geo-alt', tone: 'success' },
    completed: { label: 'Completed', icon: 'bi-check-circle', tone: 'success' },
    delayed: { label: 'Delayed', icon: 'bi-exclamation-triangle', tone: 'warning' },
    on_time: { label: 'On time', icon: 'bi-check2-circle', tone: 'success' },
    boarding: { label: 'Boarding', icon: 'bi-door-open', tone: 'info' },
    full: { label: 'Full', icon: 'bi-people-fill', tone: 'warning' },
    cancelled: { label: 'Cancelled', icon: 'bi-x-circle', tone: 'danger' },
  },
  vehicle: {
    available: { label: 'Available', icon: 'bi-check-circle', tone: 'success' },
    active: { label: 'Available', icon: 'bi-check-circle', tone: 'success' },
    operational: { label: 'Available', icon: 'bi-check-circle', tone: 'success' },
    assigned: { label: 'Assigned', icon: 'bi-person-check', tone: 'info' },
    in_transit: { label: 'In transit', icon: 'bi-truck', tone: 'live' },
    maintenance: { label: 'Maintenance', icon: 'bi-wrench-adjustable', tone: 'warning' },
    offline: { label: 'Offline', icon: 'bi-wifi-off', tone: 'danger' },
    inactive: { label: 'Inactive', icon: 'bi-pause-circle', tone: 'neutral' },
  },
  driver: {
    available: { label: 'Available', icon: 'bi-person-check', tone: 'success' },
    active: { label: 'Available', icon: 'bi-person-check', tone: 'success' },
    assigned: { label: 'Assigned', icon: 'bi-person-badge', tone: 'info' },
    driving: { label: 'Driving', icon: 'bi-steering-wheel', tone: 'live' },
    in_transit: { label: 'Driving', icon: 'bi-steering-wheel', tone: 'live' },
    off_duty: { label: 'Off duty', icon: 'bi-moon', tone: 'neutral' },
    suspended: { label: 'Suspended', icon: 'bi-exclamation-octagon', tone: 'danger' },
  },
  generic: {
    active: { label: 'Active', icon: 'bi-check-circle', tone: 'success' },
    available: { label: 'Available', icon: 'bi-check-circle', tone: 'success' },
    completed: { label: 'Completed', icon: 'bi-check-circle', tone: 'success' },
    paid: { label: 'Paid', icon: 'bi-check-circle', tone: 'success' },
    in_progress: { label: 'In progress', icon: 'bi-arrow-repeat', tone: 'live' },
    scheduled: { label: 'Scheduled', icon: 'bi-calendar-event', tone: 'info' },
    pending: { label: 'Pending', icon: 'bi-clock', tone: 'warning' },
    maintenance: { label: 'Maintenance', icon: 'bi-wrench-adjustable', tone: 'warning' },
    delayed: { label: 'Delayed', icon: 'bi-exclamation-triangle', tone: 'warning' },
    cancelled: { label: 'Cancelled', icon: 'bi-x-circle', tone: 'danger' },
    failed: { label: 'Failed', icon: 'bi-x-circle', tone: 'danger' },
    offline: { label: 'Offline', icon: 'bi-wifi-off', tone: 'danger' },
    inactive: { label: 'Inactive', icon: 'bi-pause-circle', tone: 'neutral' },
  },
}

export function StatusBadge({ status, kind = 'generic' }: Props) {
  const normalized = status.toLowerCase().replaceAll(' ', '_')
  const presentation = statusPresentation[kind][normalized] ?? statusPresentation.generic[normalized]
  const label = presentation?.label ?? status.replaceAll('_', ' ')
  const icon = presentation?.icon ?? 'bi-record-circle'
  const tone = presentation?.tone ?? 'neutral'

  return (
    <span className={`status-pill status-tone-${tone}`} aria-label={`Status: ${label}`}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      {label}
    </span>
  )
}
