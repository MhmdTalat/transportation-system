import { useCallback, useEffect, useMemo, useState } from 'react'
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
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function numberLabel(value: number | null): string {
  return value === null ? 'Not collected' : value.toLocaleString()
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
  const value = metric.current
  const displayValue = value === null
    ? 'Not collected'
    : `${numberLabel(value)}${percentage ? '%' : distance ? ' km' : ''}`
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
          {change}
        </span>
        <span>vs previous period</span>
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
  const max = Math.max(1, ...data.map((item) => item.count))
  const hasTrips = data.some((item) => item.count > 0)
  if (!hasTrips) return <ChartEmpty message="No trips match the selected filters." />

  return (
    <div className="analytics-status-list">
      {data.map((item) => (
        <Link className="analytics-status-row" to={`/trips?status=${encodeURIComponent(item.status)}`} key={item.status}>
          <span className="analytics-status-label"><i style={{ backgroundColor: statusColors[item.status] }} />{statusLabels[item.status] ?? item.status}</span>
          <span className="analytics-status-track"><span style={{ width: `${item.count / max * 100}%`, backgroundColor: statusColors[item.status] }} /></span>
          <strong>{item.count.toLocaleString()}</strong>
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
  if (!rows.length) return <ChartEmpty message={emptyMessage} />
  return (
    <ol className="analytics-popular-list">
      {rows.map((row, index) => (
        <li key={row.id}>
          <span className="analytics-popular-rank">{String(index + 1).padStart(2, '0')}</span>
          <Link to={`/${resource}/${row.id}`}>{row.name}</Link>
          <span>{row.trips} {row.trips === 1 ? 'trip' : 'trips'}</span>
        </li>
      ))}
    </ol>
  )
}

function DashboardSkeleton() {
  return (
    <div className="analytics-skeleton" role="status" aria-label="Loading analytics">
      <div className="analytics-skeleton-heading" />
      <div className="analytics-skeleton-filters" />
      <div className="analytics-skeleton-kpis">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div>
      <div className="analytics-skeleton-charts"><div /><div /><div /></div>
      <span className="visually-hidden">Loading analytics data…</span>
    </div>
  )
}

export function Dashboard() {
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
        if (current) setStationError(reason instanceof Error ? reason.message : 'Could not load station filters.')
      })
    return () => { current = false }
  }, [])

  useEffect(() => {
    let current = true
    if (filters.period === 'custom' && (!filters.startDate || !filters.endDate)) {
      return () => { current = false }
    }
    void getAnalyticsDashboard(filters)
      .then((result) => { if (current) setData(result) })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof ApiError ? reason.message : 'Could not load analytics data.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters, refreshCount])

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
  const metrics = useMemo(() => summary ? [
    { key: 'total_users', title: 'Registered users', href: '/users', icon: 'bi-people', description: 'Accounts registered by period end' },
    { key: 'active_users', title: 'Active users', href: '/users', icon: 'bi-person-check', description: 'Active accounts that signed in during this period' },
    { key: 'trips_created', title: 'Trips created', href: '/trips', icon: 'bi-signpost-2', description: 'Trips created within the selected dates' },
    { key: 'completed_trips', title: 'Completed trips', href: '/trips?status=completed', icon: 'bi-check2-circle', description: 'Currently marked completed' },
    { key: 'completion_rate', title: 'Completion rate', href: '/trips?status=completed', icon: 'bi-graph-up-arrow', description: 'Completed ÷ completed and cancelled', percentage: true, percentagePoints: true },
    { key: 'cancelled_trips', title: 'Cancelled trips', href: '/trips?status=cancelled', icon: 'bi-x-circle', description: 'Currently marked cancelled' },
    { key: 'cancellation_rate', title: 'Cancellation rate', href: '/trips?status=cancelled', icon: 'bi-arrow-counterclockwise', description: 'Cancelled ÷ completed and cancelled', percentage: true, percentagePoints: true },
    { key: 'scheduled_trips', title: 'Scheduled trips', href: '/trips?status=scheduled', icon: 'bi-calendar2-week', description: 'Trips currently scheduled' },
    { key: 'in_progress_trips', title: 'In progress', href: '/trips?status=in_progress', icon: 'bi-broadcast', description: 'Trips currently in progress' },
    { key: 'completed_route_distance_km_estimate', title: 'Completed route km (est.)', href: '/trips?status=completed', icon: 'bi-signpost', description: 'Configured route distance, not GPS distance', distance: true },
  ] : [], [summary])

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
          <span className="analytics-eyebrow">WASALNI / BUSINESS INTELLIGENCE</span>
          <h1>Analytics overview</h1>
          <p>Operational performance, user activity, and trip trends from your live records.</p>
        </div>
        <div className="analytics-heading-actions">
          <span className="analytics-updated"><i className="bi bi-clock-history" aria-hidden="true" /> Updated {data ? formatTimestamp(data.updated_at) : '—'}</span>
          <button className="analytics-button analytics-button-muted" type="button" onClick={exportCsv} disabled={!data}>
            <i className="bi bi-download" aria-hidden="true" /> Export CSV
          </button>
          <button className="analytics-button analytics-button-primary" type="button" onClick={refresh} disabled={loading}>
            <i className={`bi ${loading ? 'bi-arrow-repeat analytics-spin' : 'bi-arrow-clockwise'}`} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      <section className="analytics-filterbar" aria-label="Analytics filters">
        <label>
          <span>Reporting period</span>
          <select value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {filters.period === 'custom' && (
          <>
            <label>
              <span>From</span>
              <input aria-label="Start date" type="date" value={filters.startDate} max={filters.endDate || localDate()} onChange={(event) => updateFilter('startDate', event.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input aria-label="End date" type="date" value={filters.endDate} min={filters.startDate} max={localDate()} onChange={(event) => updateFilter('endDate', event.target.value)} />
            </label>
          </>
        )}
        <label>
          <span>Trip status</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>User role</span>
          <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="">All roles</option>
            {roles.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}
          </select>
        </label>
        <label>
          <span>Station</span>
          <select value={filters.station} onChange={(event) => updateFilter('station', event.target.value)} disabled={Boolean(stationError)}>
            <option value="">{stationError ? 'Stations unavailable' : 'All stations'}</option>
            {stations.map((station) => <option value={station.id} key={station.id}>{station.name}{station.is_active ? '' : ' · Inactive'}</option>)}
          </select>
        </label>
        <button className="analytics-clear-button" type="button" onClick={clearFilters}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Clear filters</button>
      </section>
      {customDatesInvalid && <p className="analytics-filter-error" role="alert">The start date must be on or before the end date.</p>}
      {customDatesIncomplete && <p className="analytics-filter-error" role="alert">Select both dates to load a custom reporting range.</p>}
      {stationError && <p className="analytics-filter-note" role="status">Station filter unavailable: {stationError}</p>}

      {isUpdating ? (
        <div className="analytics-refresh-state" role="status"><span className="spinner-border spinner-border-sm" /> Updating metrics for the selected filters…</div>
      ) : hasCustomDateIssue ? (
        <section className="analytics-error" role="alert">
          <i className="bi bi-calendar-x" aria-hidden="true" />
          <div><strong>Choose a valid reporting range</strong><p>{customDatesInvalid ? 'The start date must be on or before the end date.' : 'Select both dates to load a custom reporting range.'}</p></div>
        </section>
      ) : error ? (
        <section className="analytics-error" role="alert">
          <i className="bi bi-cloud-slash" aria-hidden="true" />
          <div><strong>Analytics could not be loaded</strong><p>{error}</p></div>
          <button className="analytics-button analytics-button-muted" type="button" onClick={refresh}>Retry</button>
        </section>
      ) : data && summary ? (
        <>
          <div className="analytics-period-caption">
            <span><i className="bi bi-calendar3" aria-hidden="true" /> {formatDate(data.filters.start_date)} – {formatDate(data.filters.end_date)}</span>
            <span>Comparisons use the previous {data.filters.period === 'custom' ? 'equivalent-length' : 'equivalent'} period.</span>
          </div>

          <section className="analytics-kpi-grid" aria-label="Key performance indicators">
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
            <ChartPanel eyebrow="TRIP ACTIVITY" title="Trip volume" description="Trips created per day in the selected period." href="/trips" linkLabel="View trips" className="analytics-panel-wide">
              {data.charts.trip_volume.some((item) => item.count > 0) ? (
                <div className="analytics-chart" role="img" aria-label="Line chart of trips created each day">
                  <ResponsiveContainer width="100%" height={248}>
                    <LineChart data={data.charts.trip_volume} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} minTickGap={28} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={42} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => formatDate(String(value))} formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Trips']} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Line type="monotone" dataKey="count" name="Trips" stroke="var(--analytics-lime)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: 'var(--analytics-lime)', stroke: 'var(--analytics-surface)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message="No trips were created during this period." />}
            </ChartPanel>

            <ChartPanel eyebrow="USER ACTIVITY" title="New registrations" description="New user accounts created per day." href="/users" linkLabel="View users">
              {data.charts.user_registrations.some((item) => item.count > 0) ? (
                <div className="analytics-chart" role="img" aria-label="Area chart of new user registrations per day">
                  <ResponsiveContainer width="100%" height={248}>
                    <LineChart data={data.charts.user_registrations} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} minTickGap={32} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={38} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => formatDate(String(value))} formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Registrations']} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Line type="monotone" dataKey="count" name="Registrations" stroke="#88d8bf" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message="No new accounts were registered during this period." />}
            </ChartPanel>

            <ChartPanel eyebrow="ACCOUNT MIX" title="Registrations by role" description="New accounts by passenger, driver, and administrative role." href="/users" linkLabel="View users">
              {data.charts.user_registrations_by_role.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label="Bar chart of new registrations by user role">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.user_registrations_by_role} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="role" tickFormatter={(value) => roles.find((role) => role.value === value)?.label ?? String(value)} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={38} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => roles.find((role) => role.value === value)?.label ?? String(value)} formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Registrations']} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name="Registrations" fill="#c3a4ff" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message="No user registrations match the selected filters." />}
            </ChartPanel>

            <ChartPanel eyebrow="CURRENT TRIP STATUS" title="Status breakdown" description="Current status of trips created in this reporting period." href="/trips" linkLabel="Open trip records">
              <StatusBreakdown data={data.charts.trip_status} />
            </ChartPanel>

            <ChartPanel eyebrow="DISPATCH PATTERNS" title="Busiest creation hours" description="When trip records are created, using the project timezone." href="/trips" linkLabel="View trips">
              {data.charts.trip_creation_hours.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label="Bar chart of trip creation counts by hour">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.trip_creation_hours} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={(value) => `${String(value).padStart(2, '0')}:00`} interval={3} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={40} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} labelFormatter={(value) => `Hour ${String(value).padStart(2, '0')}:00`} formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Trips created']} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name="Trips created" fill="var(--analytics-lime)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message="No trip creation activity in this period." />}
            </ChartPanel>

            <ChartPanel eyebrow="WEEKLY PATTERN" title="Busiest days" description="Trip records grouped by the local day they were created." href="/trips" linkLabel="View trips">
              {data.charts.trip_creation_weekdays.some((item) => item.count > 0) ? (
                <div className="analytics-chart analytics-chart-compact" role="img" aria-label="Bar chart of trips created by day of week">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.charts.trip_creation_weekdays} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="var(--analytics-grid)" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(value) => String(value).slice(0, 3)} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={40} stroke="var(--analytics-muted)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--analytics-tooltip)', border: '1px solid var(--analytics-border)', borderRadius: 10, color: 'var(--analytics-text)' }} formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Trips created']} />
                      <Legend wrapperStyle={{ color: 'var(--analytics-muted)', fontSize: 10 }} />
                      <Bar dataKey="count" name="Trips created" fill="#a9bdff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <ChartEmpty message="No trip creation activity in this period." />}
            </ChartPanel>

            <ChartPanel eyebrow="POPULARITY" title="Popular routes" description="Routes used by trips created during this period." href="/routes" linkLabel="All routes">
              <PopularList rows={data.charts.popular_routes} resource="routes" emptyMessage="No routes match the selected filters." />
            </ChartPanel>

            <ChartPanel eyebrow="ORIGIN STATIONS" title="Popular departures" description="Most common start stations in this period." href="/stations" linkLabel="All stations">
              <PopularList rows={data.charts.popular_start_stations} resource="stations" emptyMessage="No departure stations match these filters." />
            </ChartPanel>

            <ChartPanel eyebrow="DESTINATION STATIONS" title="Popular destinations" description="Most common destination stations in this period." href="/stations" linkLabel="All stations">
              <PopularList rows={data.charts.popular_destination_stations} resource="stations" emptyMessage="No destinations match these filters." />
            </ChartPanel>
          </div>

          <section className="analytics-data-notes">
            <div className="analytics-data-note-icon"><i className="bi bi-info-circle" aria-hidden="true" /></div>
            <div>
              <strong>Data coverage and metric definitions</strong>
              <p>{data.definitions.completion_rate} Active users are accounts with a recorded sign-in during the range. User counts are scoped by role; trip status and station filters apply to trip metrics.</p>
              <div className="analytics-unavailable-list">
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> Actual trip duration is unavailable: only scheduled times are stored.</span>
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> Actual distance traveled is unavailable: GPS or odometer data is not collected.</span>
                <span><i className="bi bi-dash-circle" aria-hidden="true" /> API latency, error rates, database performance, and background-job failures are not instrumented.</span>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="analytics-error" role="alert">
          <i className="bi bi-cloud-slash" aria-hidden="true" />
          <div><strong>Analytics data is unavailable</strong><p>Please refresh the dashboard to try again.</p></div>
          <button className="analytics-button analytics-button-muted" type="button" onClick={() => navigate(0)}>Refresh page</button>
        </section>
      )}
    </div>
  )
}
