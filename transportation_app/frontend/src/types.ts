export type ApiRecord = Record<string, unknown> & { id: number }

export interface AuthTokenResponse {
  access: string
  refresh: string
}

export interface UserRecord extends ApiRecord {
  username: string
  first_name: string
  last_name: string
  email: string
  role: 'passenger' | 'driver' | 'admin' | 'authority'
  phone_number: string | null
  profile_photo_url: string | null
  is_active?: boolean
  date_joined?: string
}

export interface StationRecord extends ApiRecord {
  name: string
  latitude: number
  longitude: number
  governorate: string | null
  is_active: boolean
}

export interface RouteRecord extends ApiRecord {
  name: string
  description: string | null
  distance_km: number | null
  duration_minutes: number | null
  status: string
}

export interface RouteStationRecord extends ApiRecord {
  route: number
  station: StationRecord | number
  sequence_order: number
}

export interface VehicleRecord extends ApiRecord {
  registration_number: string
  capacity: number
  seat_layout: (number | null)[][]
  disabled_seats: number[]
  status: string
}

export interface DriverRecord extends ApiRecord {
  user: UserRecord
  vehicle: number | null
  status: string
}

export interface TripRecord extends ApiRecord {
  route: number
  vehicle: number | null
  driver: number | null
  start_station: number
  start_station_name: string
  destination_station: number
  destination_station_name: string
  departure_time: string | null
  arrival_time: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  is_published: boolean
  fare_amount: string
  vehicle_capacity: number
  vehicle_registration: string | null
  booked_seats: number
  available_seats: number
  created_at: string
  payment: ApiRecord | null
}

export interface BookingRecord extends ApiRecord {
  passenger: UserRecord
  trip: TripRecord
  seat_numbers: number[]
  status: 'confirmed' | 'cancelled' | 'completed'
  total_amount: string
  created_at: string
}

export interface SeatAvailability {
  trip: number
  vehicle_capacity: number
  booked_seats: number
  available_seats: number
  layout: (number | null)[][]
  seats: { number: number; state: 'available' | 'booked' | 'disabled' }[]
}

export interface NotificationRecord extends ApiRecord {
  user: number
  booking: number | null
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
}

export interface ColumnDefinition {
  key: string
  label: string
  render?: (row: ApiRecord) => string
  progress?: (row: ApiRecord) => { value: number; max: number; label: string }
}

export interface FieldDefinition {
  name: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'json' | 'select' | 'checkbox' | 'datetime-local'
  required?: boolean
  defaultValue?: string
  min?: number
  step?: number | 'any'
  options?: { value: string; label: string }[]
  source?: string
  help?: string
}

export interface ResourceDefinition {
  key: string
  endpoint: string
  title: string
  singular: string
  description: string
  icon: string
  columns: ColumnDefinition[]
  fields: FieldDefinition[]
  canCreate?: boolean
  canDelete?: boolean
}
