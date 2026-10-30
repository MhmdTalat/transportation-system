import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, ApiError } from '../services/api'
import { formatDate as formatLocalizedDate } from '../i18n/format'
import {
  getAnalyticsDashboard,
  type AnalyticsComparison,
  type AnalyticsDashboardData,
  type AnalyticsFilters,
  type AnalyticsStationOption,
} from '../services/analytics'

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statusColors: Record<string, string> = {
  scheduled: '#91a59a',
  in_progress: '#9aabff',
  completed: '#b7ee68',
  cancelled: '#ff8d82',
}

const roles = [
  { value: 'passenger', label: 'Passengers' },
  { value: 'driver', label: 'Drivers' },
  { value: 'admin', label: 'Admins' },
  { value: 'authority', label: 'Authorities' },
]

function localDate(daysAgo = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function defaultFilters(): AnalyticsFilters {
  return {
    period: '30d',
    startDate: localDate(29),
    endDate: localDate(),
    status: '',
    role: '',
    station: '',
  }
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : formatLocalizedDate(date, { month: 'short', day: 'numeric' })
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : formatLocalizedDate(date)
}

function numberLabel(value: number | null, language = 'en'): string {
  return value === null ? 'Not collected' : value.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-EG')
}

function changeLabel(value: AnalyticsComparison, percentagePoints = false): string {
  const { current, previous } = value
  if (current === null) return 'Not collected'
  if (previous === null) return 'No previous data'
  const change = current - previous
  if (change === 0) return 'No change'
  const sign = change > 0 ? '+' : '−'
  if (percentagePoints) return `${sign}${Math.abs(change).toFixed(1)} pp`
  if (previous === 0) return change > 0 ? 'New activity' : 'No activity'
  const percent = Math.round(Math.abs(change / previous) * 100)
  return `${sign}${percent}%`
}

function MetricCard({
  title,
  metric,
  href,
  icon,
  description,
  percentage = false,
  percentagePoints = false,
  distance = false,
}: {
  title: string
  metric: AnalyticsComparison
  href: string
  icon: string
  description: string
  percentage?: boolean
  percentagePoints?: boolean
  distance?: boolean
}) {
  const { t, i18n } = useTranslation()
  const value = metric.current
  const displayValue = value === null
    ? t('Not collected')
    : `${numberLabel(value, i18n.language)}${percentage ? '%' : distance ? ` ${t('km')}` : ''}`
  const change = changeLabel(metric, percentagePoints)
  const changeDirection = metric.current === null || metric.previous === null
    ? 'same'
    : metric.current > metric.previous ? 'up' : metric.current < metric.previous ? 'down' : 'same'

  return (
    <Link className="analytics-kpi-card" to={href}>
      <div className="analytics-kpi-top">
        <span>{title}</span>
        <span className="analytics-kpi-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      </div>
      <strong className={`analytics-kpi-value${value === null ? ' is-unavailable' : ''}`}>{displayValue}</strong>
      <div className="analytics-kpi-meta">
        <span className={`analytics-trend trend-${changeDirection}`}>
          {changeDirection !== 'same' && <i className={`bi bi-arrow-${changeDirection === 'up' ? 'up' : 'down'}`} aria-hidden="true" />}
          {t(change)}
        </span>
        <span>{t('vs previous period')}</span>
      </div>
      <span className="analytics-kpi-description">{description}</span>
    </Link>
  )
}

function ChartPanel({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  children,
  className = '',
}: {
  eyebrow: string
  title: string
  description: string
  href: string
  linkLabel: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`analytics-panel ${className}`}>
      <header className="analytics-panel-header">
        <div>
          <span className="analytics-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link className="analytics-panel-link" to={href}>{linkLabel}<i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
      </header>
      {children}
    </section>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="analytics-chart-empty">
      <i className="bi bi-bar-chart-line" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

function StatusBreakdown({ data }: { data: AnalyticsDashboardData['charts']['trip_status'] }) {
  const { t, i18n } = useTranslation()
  const max = Math.max(1, ...data.map((item) => item.count))
  const hasTrips = data.some((item) => item.count > 0)
  if (!hasTrips) return <ChartEmpty message={t('No trips match the selected filters.')} />

  return (
    <div className="analytics-status-list">
      {data.map((item) => (
        <Link className="analytics-status-row" to={`/trips?status=${encodeURIComponent(item.status)}`} key={item.status}>
          <span className="analytics-status-label"><i style={{ backgroundColor: statusColors[item.status] }} />{t(statusLabels[item.status] ?? item.status)}</span>
          <span className="analytics-status-track"><span style={{ width: `${item.count / max * 100}%`, backgroundColor: statusColors[item.status] }} /></span>
          <strong>{item.count.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</strong>
        </Link>
      ))}
    </div>
  )
}

function PopularList({
  rows,
  resource,
  emptyMessage,
}: {
  rows: Array<{ id: number; name: string; trips: number }>
  resource: 'routes' | 'stations'
  emptyMessage: string
}) {
  const { t, i18n } = useTranslation()
  if (!rows.length) return <ChartEmpty message={emptyMessage} />
  return (
    <ol className="analytics-popular-list">
      {rows.map((row, index) => (
        <li key={row.id}>
          <span className="analytics-popular-rank">{String(index + 1).padStart(2, '0')}</span>
          <Link to={`/${resource}/${row.id}`}>{row.name}</Link>
          <span>{row.trips.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')} {t(row.trips === 1 ? 'trip' : 'trips')}</span>
        </li>
      ))}
    </ol>
  )
}

function DashboardSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="analytics-skeleton" role="status" aria-label={t('Loading analytics')}>
      <div className="analytics-skeleton-heading" />
      <div className="analytics-skeleton-filters" />
      <div className="analytics-skeleton-kpis">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div>
      <div className="analytics-skeleton-charts"><div /><div /><div /></div>
      <span className="visually-hidden">{t('Loading analytics data…')}</span>
    </div>
  )
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(defaultFilters)
  const [data, setData] = useState<AnalyticsDashboardData | null>(null)
  const [stations, setStations] = useState<AnalyticsStationOption[]>([])
  const [stationError, setStationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    let current = true
    void api.get<AnalyticsStationOption[]>('/api/stations/')
      .then((items) => { if (current) setStations(items) })
      .catch((reason: unknown) => {
        if (current) setStationError(reason instanceof Error ? reason.message : t('Could not load station filters.'))
      })
    return () => { current = false }
  }, [t])

  useEffect(() => {
    let current = true
    if (filters.period === 'custom' && (!filters.startDate || !filters.endDate)) {
      return () => { current = false }
    }
    void getAnalyticsDashboard(filters)
      .then((result) => { if (current) setData(result) })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof ApiError ? reason.message : t('Could not load analytics data.'))
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters, refreshCount, t])

  const clearFilters = useCallback(() => {
    setLoading(true)
    setError(null)
    setFilters(defaultFilters())
  }, [])

  const exportCsv = useCallback(() => {
    if (!data) return
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const rows = [
      ['Date', 'Trips created', 'New registrations'],
      ...data.charts.trip_volume.map((item, index) => [
        item.date,
        item.count,
        data.charts.user_registrations[index]?.count ?? 0,
      ]),
    ]
    const blob = new Blob(
      [`\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`],
      { type: 'text/csv;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `wasalni-analytics-${data.filters.start_date}-${data.filters.end_date}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [data])

  const summary = data?.summary
  const numberLocale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const metrics = useMemo(() => summary ? [
    { key: 'total_users', title: t('Registered users'), href: '/users', icon: 'bi-people', description: t('Accounts registered by period end') },
    { key: 'active_users', title: t('Active users'), href: '/users', icon: 'bi-person-check', description: t('Active accounts that signed in during this period') },
    { key: 'trips_created', title: t('Trips created'), href: '/trips', icon: 'bi-signpost-2', description: t('Trips created within the selected dates') },
    { key: 'completed_trips', title: t('Completed trips'), href: '/trips?status=completed', icon: 'bi-check2-circle', description: t('Currently marked completed') },
    { key: 'completion_rate', title: t('Completion rate'), href: '/trips?status=completed', icon: 'bi-graph-up-arrow', description: t('Completed ÷ completed and cancelled'), percentage: true, percentagePoints: true },
    { key: 'cancelled_trips', title: t('Cancelled trips'), href: '/trips?status=cancelled', icon: 'bi-x-circle', description: t('Currently marked cancelled') },
    { key: 'cancellation_rate', title: t('Cancellation rate'), href: '/trips?status=cancelled', icon: 'bi-arrow-counterclockwise', description: t('Cancelled ÷ completed and cancelled'), percentage: true, percentagePoints: true },
    { key: 'scheduled_trips', title: t('Scheduled trips'), href: '/trips?status=scheduled', icon: 'bi-calendar2-week', description: t('Trips currently scheduled') },
    { key: 'in_progress_trips', title: t('In progress'), href: '/trips?status=in_progress', icon: 'bi-broadcast', description: t('Trips currently in progress') },
    { key: 'completed_route_distance_km_estimate', title: t('Completed route km (est.)'), href: '/trips?status=completed', icon: 'bi-signpost', description: t('Configured route distance, not GPS distance'), distance: true },
  ] : [], [summary, t])

  const customDatesInvalid = filters.period === 'custom' &&
    Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate)
  const customDatesIncomplete = filters.period === 'custom' &&
    (!filters.startDate || !filters.endDate)
  const filtersMatchData = Boolean(data &&
    data.filters.period === filters.period &&
    data.filters.status === filters.status &&
    data.filters.role === filters.role &&
    String(data.filters.station ?? '') === filters.station &&
    (filters.period !== 'custom' ||
      (data.filters.start_date === filters.startDate && data.filters.end_date === filters.endDate)))
  const hasCustomDateIssue = customDatesInvalid || customDatesIncomplete
  const isUpdating = !hasCustomDateIssue && (loading || (!error && !filtersMatchData))

  function updateFilter(name: keyof AnalyticsFilters, value: string) {
    setLoading(true)
    setError(null)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function refresh() {
    setLoading(true)
    setError(null)
    setRefreshCount((count) => count + 1)
  }

  if (loading && !data) return <DashboardSkeleton />

  return (
    <div className="analytics-dashboard">
      <header className="analytics-heading">
        <div>
          <span className="analytics-eyebrow">{t('WASALNI / BUSINESS INTELLIGENCE')}</span>
          <h1>{t('Analytics overview')}</h1>
          <p>{t('Operational performance, user activity, and trip trends from your live records.')}</p>
        </div>
        <div className="analytics-heading-actions">
          <span className="analytics-updated"><i className="bi bi-clock-history" aria-hidden="true" /> {t('Updated {{time}}', { time: data ? formatTimestamp(data.updated_at) : '—' })}</span>
          <button className="analytics-button analytics-button-muted" type="button" onClick={exportCsv} disabled={!data}>
            <i className="bi bi-download" aria-hidden="true" /> {t('Export CSV')}
          </button>
          <button className="analytics-button analytics-button-primary" type="button" onClick={refresh} disabled={loading}>
            <i className={`bi ${loading ? 'bi-arrow-repeat analytics-spin' : 'bi-arrow-clockwise'}`} aria-hidden="true" /> {t('Refresh')}
          </button>
        </div>
      </header>

      <section className="analytics-filterbar" aria-label={t('Analytics filters')}>
        <label>
          <span>{t('Reporting period')}</span>
          <select value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}>
            <option value="7d">{t('Last 7 days')}</option>
            <option value="30d">{t('Last 30 days')}</option>
            <option value="90d">{t('Last 90 days')}</option>
            <option value="custom">{t('Custom range')}</option>
          </select>
        </label>
        {filters.period === 'custom' && (
          <>
            <label>
              <span>{t('From')}</span>
              <input aria-label={t('Start date')} type="date" value={filters.startDate} max={filters.endDate || localDate()} onChange={(event) => updateFilter('startDate', event.target.value)} />
            </label>
            <label>
              <span>{t('To')}</span>
              <input aria-label={t('End date')} type="date" value={filters.endDate} min={filters.startDate} max={localDate()} onChange={(event) => updateFilter('endDate', event.target.value)} />
            </label>
          </>
        )}
        <label>
          <span>{t('Trip status')}</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">{t('All statuses')}</option>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('User role')}</span>
          <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="">{t('All roles')}</option>
            {roles.map((role) => <option value={role.value} key={role.value}>{t(role.label)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('Station')}</span>
          <select value={filters.station} onChange={(event) => updateFilter('station', event.target.value)} disabled={Boolean(stationError)}>
            <option value="">{stationError ? t('Stations unavailable') : t('All stations')}</option>
            {stations.map((station) => <option value={station.id} key={station.id}>{station.name}{station.is_active ? '' : ` · ${t('Inactive')}`}</option>)}
          </select>
        </label>
        <button className="analytics-clear-button" type="button" onClick={clearFilters}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> {t('Clear filters')}</button>
      </section>
      {customDatesInvalid && <p className="analytics-filter-error" role="alert">{t('The start date must be on or before the end date.')}</p>}
      {customDatesIncomplete && <p className="analytics-filter-error" role="alert">{t('Select both dates to load a custom reporting range.')}</p>}
      {stationError && <p className="analytics-filter-note" role="status">{t('Station filter unavailable: {{error}}', { error: stationError })}</p>}

      {isUpdating ? (
        <div className="analytics-refresh-state" role="status"><span className="spinner-border spinner-border-sm" /> {t('Updating metrics for the selected filters…')}</div>
      ) : hasCustomDateIssue ? (
        <section className="analytics-error" role="alert">
          <i className="bi bi-calendar-x" aria-hidden="true" />
          <div><strong>{t('Choose a valid reporting range')}</strong><p>{t(customDatesInvalid ? 'The start date must be on or before the end date.' : 'Select both dates to load a custom reporting range.')}</p></div>
        </section>
      ) : error ? (
        <section className="analytics-error" role="alert">
          <i className="bi bi-cloud-slash" aria-hidden="true" />
          <div><strong>{t('Analytics could not be loaded')}</strong><p>{error}</p></div>
          <button className="analytics-button analytics-button-muted" type="button" onClick={refresh}>{t('Retry')}</button>
        </section>
      ) : data && summary ? (
        <>
          <div className="analytics-period-caption">
            <span><i className="bi bi-calendar3" aria-hidden="true" /> {formatDate(data.filters.start_date)} – {formatDate(data.filters.end_date)}</span>
            <span>{t('Comparisons use the previous {{period}} period.', { period: t(data.filters.period === 'custom' ? 'equivalent-length' : 'equivalent') })}</span>
          </div>

          <section className="analytics-kpi-grid" aria-label={t('Key performance indicators')}>
            {metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                title={metric.title}
                metric={summary[metric.key]}
                href={metric.href}
                icon={metric.icon}
                description={metric.description}
                percentage={'percentage' in metric ? metric.percentage : false}
                percentagePoints={'percentagePoints' in metric ? metric.percentagePoints : false}
                distance={'distance' in metric ? metric.distance : false}
              />
            ))}
          </section>

          <div className="analytics-chart-grid">
            <ChartPanel eyebrow={t('TRIP ACTIVITY')} title={t('Trip volume')} description={t('Trips created per day in the selected period.')} href="/trips" linkLabel={t('View trips')} className="analytics-panel-wide">
              {data.charts.trip_volume.some((item) => item.count > 0) ? (
                <div className="analytics-chart" role="img" aria-label={t('Line chart of trips created each day')}>
                  <ResponsiveContainer width="100%" height={248}>
                    <LineChart data={data.charts.trip_volume} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} minTickGap={28} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={42} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => formatDate(String(value))} formatter={(value) => [Number(value ?? 0).toLocaleString(numberLocale), t('Trips')]} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Line type="monotone" dataKey="count" name={t('Trips')} stroke="var(--analytics-lime)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: 'var(--analytics-lime)', stroke: 'var(--analytics-surface)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message={t('No trips were created during this period.')} />}
            </ChartPanel>

            <ChartPanel eyebrow={t('USER ACTIVITY')} title={t('New registrations')} description={t('New user accounts created per day.')} href="/users" linkLabel={t('View users')}>
              {data.charts.user_registrations.some((item) => item.count > 0) ? (
                <div className="analytics-chart" role="img" aria-label={t('Area chart of new user registrations per day')}>
                  <ResponsiveContainer width="100%" height={248}>
                    <LineChart data={data.charts.user_registrations} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} minTickGap={32} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={38} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => formatDate(String(value))} formatter={(value) => [Number(value ?? 0).toLocaleString(numberLocale), t('Registrations')]} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Line type="monotone" dataKey="count" name={t('Registrations')} stroke="#88d8bf" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message={t('No new accounts were registered during this period.')} />}
            </ChartPanel>

            <ChartPanel eyebrow={t('ACCOUNT MIX')} title={t('Registrations by role')} description={t('New accounts by passenger, driver, and administrative role.')} href="/users" linkLabel={t('View users')}>
              {data.charts.user_registrations_by_role.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label={t('Bar chart of new registrations by user role')}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.user_registrations_by_role} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="role" tickFormatter={(value) => t(roles.find((role) => role.value === value)?.label ?? String(value))} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={38} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => t(roles.find((role) => role.value === value)?.label ?? String(value))} formatter={(value) => [Number(value ?? 0).toLocaleString(numberLocale), t('Registrations')]} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name={t('Registrations')} fill="#c3a4ff" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message={t('No user registrations match the selected filters.')} />}
            </ChartPanel>

            <ChartPanel eyebrow={t('CURRENT TRIP STATUS')} title={t('Status breakdown')} description={t('Current status of trips created in this reporting period.')} href="/trips" linkLabel={t('Open trip records')}>
              <StatusBreakdown data={data.charts.trip_status} />
            </ChartPanel>

            <ChartPanel eyebrow={t('DISPATCH PATTERNS')} title={t('Busiest creation hours')} description={t('When trip records are created, using the project timezone.')} href="/trips" linkLabel={t('View trips')}>
              {data.charts.trip_creation_hours.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label={t('Bar chart of trip creation counts by hour')}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.trip_creation_hours} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={(value) => `${String(value).padStart(2, '0')}:00`} interval={3} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={40} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => t('Hour {{hour}}:00', { hour: String(value).padStart(2, '0') })} formatter={(value) => [Number(value ?? 0).toLocaleString(numberLocale), t('Trips created')]} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name={t('Trips created')} fill="var(--analytics-lime)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message={t('No trip creation activity in this period.')} />}
            </ChartPanel>

            <ChartPanel eyebrow={t('WEEKLY PATTERN')} title={t('Busiest days')} description={t('Trip records grouped by the local day they were created.')} href="/trips" linkLabel={t('View trips')}>
              {data.charts.trip_creation_weekdays.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label={t('Bar chart of trips created by day of week')}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.trip_creation_weekdays} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(value) => t(String(value))} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={40} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} formatter={(value) => [Number(value ?? 0).toLocaleString(numberLocale), t('Trips created')]} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name={t('Trips created')} fill="#a9bdff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message={t('No trip creation activity in this period.')} />}
            </ChartPanel>

            <ChartPanel eyebrow={t('POPULARITY')} title={t('Popular routes')} description={t('Routes used by trips created during this period.')} href="/routes" linkLabel={t('All routes')}>
              <PopularList rows={data.charts.popular_routes} resource="routes" emptyMessage={t('No routes match the selected filters.')} />
            </ChartPanel>

            <ChartPanel eyebrow={t('ORIGIN STATIONS')} title={t('Popular departures')} description={t('Most common start stations in this period.')} href="/stations" linkLabel={t('All stations')}>
              <PopularList rows={data.charts.popular_start_stations} resource="stations" emptyMessage={t('No departure stations match these filters.')} />
            </ChartPanel>

            <ChartPanel eyebrow={t('DESTINATION STATIONS')} title={t('Popular destinations')} description={t('Most common destination stations in this period.')} href="/stations" linkLabel={t('All stations')}>
              <PopularList rows={data.charts.popular_destination_stations} resource="stations" emptyMessage={t('No destinations match these filters.')} />
            </ChartPanel>
          </div>

          <section className="analytics-data-notes">
            <div className="analytics-data-note-icon"><i className="bi bi-info-circle" aria-hidden="true" /></div>
            <div>
              <strong>{t('Data coverage and metric definitions')}</strong>
              <p>{t('{{definition}} Active users are accounts with a recorded sign-in during the range. User counts are scoped by role; trip status and station filters apply to trip metrics.', { definition: data.definitions.completion_rate })}</p>
              <div className="analytics-unavailable-list">
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> {t('Actual trip duration is unavailable: only scheduled times are stored.')}</span>
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> {t('Actual distance traveled is unavailable: GPS or odometer data is not collected.')}</span>
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> {t('API latency, error rates, database performance, and background-job failures are not instrumented.')}</span>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="analytics-error" role="alert">
          <i className="bi bi-cloud-slash" aria-hidden="true" />
          <div><strong>{t('Analytics data is unavailable')}</strong><p>{t('Please refresh the dashboard to try again.')}</p></div>
          <button className="analytics-button analytics-button-muted" type="button" onClick={() => navigate(0)}>{t('Refresh page')}</button>
        </section>
      )}
    </div>
  )
}
