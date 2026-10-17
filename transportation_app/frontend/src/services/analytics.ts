import { api } from './api'

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'custom'

export interface AnalyticsFilters {
  period: AnalyticsPeriod
  startDate: string
  endDate: string
  status: string
  role: string
  station: string
}

export interface AnalyticsComparison {
  current: number | null
  previous: number | null
}

export interface AnalyticsDashboardData {
  filters: {
    period: AnalyticsPeriod
    start_date: string
    end_date: string
    status: string
    role: string
    station: number | null
  }
  updated_at: string
  summary: Record<string, AnalyticsComparison>
  charts: {
    trip_volume: Array<{ date: string; count: number }>
    booking_volume: Array<{ date: string; count: number }>
    user_registrations: Array<{ date: string; count: number }>
    user_registrations_by_role: Array<{ role: string; count: number }>
    trip_status: Array<{ status: string; count: number }>
    popular_start_stations: Array<{ id: number; name: string; trips: number }>
    popular_destination_stations: Array<{ id: number; name: string; trips: number }>
    popular_routes: Array<{ id: number; name: string; trips: number }>
    trip_creation_hours: Array<{ hour: number; count: number }>
    trip_creation_weekdays: Array<{ day: string; count: number }>
  }
  definitions: Record<string, string>
  unavailable_metrics: Record<string, string>
}

export interface AnalyticsStationOption {
  id: number
  name: string
  is_active: boolean
}

export function getAnalyticsDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboardData> {
  const query = new URLSearchParams()
  if (filters.period === 'custom') {
    query.set('start_date', filters.startDate)
    query.set('end_date', filters.endDate)
  } else {
    query.set('period', filters.period)
  }
  if (filters.status) query.set('status', filters.status)
  if (filters.role) query.set('role', filters.role)
  if (filters.station) query.set('station', filters.station)
  return api.get<AnalyticsDashboardData>(`/api/analytics/dashboard/?${query}`)
}
