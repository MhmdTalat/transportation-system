import type { ApiRecord, ResourceDefinition } from '../types'

function value(row: ApiRecord, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, row)
}

function text(row: ApiRecord, key: string): string {
  const result = value(row, key)
  if (result === null || result === undefined || result === '') return '—'
  if (typeof result === 'boolean') return result ? 'Yes' : 'No'
  if (typeof result === 'object') {
    const record = result as Record<string, unknown>
    const name =
      record.name ??
      record.registration_number ??
      record.username ??
      record.title
    return typeof name === 'string' ? name : `#${String(record.id ?? '')}`
  }
  return String(result)
}

const choices = (...values: [string, string][]) =>
  values.map(([value, label]) => ({ value, label }))

export const resources: ResourceDefinition[] = [
  {
    key: 'trips',
    endpoint: 'trips',
    title: 'Trips',
    singular: 'Trip',
    description: 'Plan, review, and manage scheduled transportation trips.',
    icon: 'bi-signpost-split',
    columns: [
      { key: 'id', label: 'Trip ID', render: (row) => `TR-${String(row.id).padStart(4, '0')}` },
      { key: 'start_station', label: 'Journey', render: (row) => `Station #${String(row.start_station)} → Station #${String(row.destination_station)}` },
      { key: 'driver', label: 'Driver', render: (row) => row.driver == null ? 'Unassigned' : `Driver #${String(row.driver)}` },
      { key: 'vehicle', label: 'Vehicle', render: (row) => row.vehicle == null ? 'Unassigned' : `Vehicle #${String(row.vehicle)}` },
      { key: 'availability', label: 'Seats', progress: (row) => {
        const maximum = Number(row.vehicle_capacity)
        const available = Number(row.available_seats)
        const booked = Number(row.booked_seats)
        return {
          value: Number.isFinite(booked) ? booked : 0,
          max: Number.isFinite(maximum) ? maximum : 0,
          label: Number.isFinite(available) ? `${available} available` : 'Availability unavailable',
        }
      } },
      { key: 'departure_time', label: 'Departure', render: (row) => text(row, 'departure_time') },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'route', label: 'Route', type: 'select', source: 'routes', required: true },
      { name: 'start_station', label: 'Start Station', type: 'select', source: 'stations', required: true },
      { name: 'destination_station', label: 'End Station', type: 'select', source: 'stations', required: true },
      { name: 'driver', label: 'Driver', type: 'select', source: 'assignment-drivers' },
      { name: 'vehicle', label: 'Vehicle', type: 'select', source: 'assignment-vehicles' },
      { name: 'departure_time', label: 'Departure', type: 'datetime-local' },
      { name: 'arrival_time', label: 'Arrival', type: 'datetime-local' },
      { name: 'status', label: 'Status', type: 'select', options: choices(['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']), required: true },
      { name: 'fare_amount', label: 'Fare amount', type: 'number', required: true },
      { name: 'is_published', label: 'Publish for passenger booking', type: 'checkbox', help: 'Publishing requires a future departure, arrival, active driver and vehicle.' },
    ],
  },
  {
    key: 'vehicles',
    endpoint: 'vehicles',
    title: 'Vehicles',
    singular: 'Vehicle',
    description: 'Keep the fleet registry and operating status up to date.',
    icon: 'bi-truck-front',
    columns: [
      { key: 'registration_number', label: 'Registration' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Added', render: (row) => text(row, 'created_at') },
    ],
    fields: [
      { name: 'registration_number', label: 'Registration number', type: 'text', required: true },
      { name: 'capacity', label: 'Passenger capacity', type: 'number', required: true, defaultValue: '30', min: 1, step: 1 },
      { name: 'seat_layout', label: 'Seat layout (JSON)', type: 'json', help: 'Use rows of seat numbers; put null where an aisle should appear. Example: [[1,2,null,3,4],[5,6,null,7,8]]. Leave empty to use the default layout.' },
      { name: 'disabled_seats', label: 'Disabled seats (JSON array)', type: 'json', help: 'Seat numbers temporarily unavailable for operations, for example [4, 11]. Reserved seats cannot be disabled.' },
      { name: 'status', label: 'Status', type: 'select', options: choices(['active', 'Active'], ['maintenance', 'Maintenance'], ['inactive', 'Inactive']), required: true, defaultValue: 'active' },
    ],
  },
  {
    key: 'drivers',
    endpoint: 'drivers',
    title: 'Drivers',
    singular: 'Driver',
    description: 'Review driver profiles, assignments, and availability.',
    icon: 'bi-person-badge',
    canCreate: false,
    columns: [
      { key: 'user', label: 'Driver', render: (row) => text(row, 'user.username') },
      { key: 'user.email', label: 'Email' },
      { key: 'user.phone_number', label: 'Phone' },
      { key: 'vehicle', label: 'Assigned vehicle', render: (row) => row.vehicle == null ? 'Unassigned' : `Vehicle #${String(row.vehicle)}` },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'vehicle', label: 'Assigned vehicle', type: 'select', source: 'vehicles' },
      { name: 'status', label: 'Status', type: 'select', options: choices(['active', 'Active'], ['inactive', 'Inactive']), required: true, defaultValue: 'active' },
    ],
  },
  {
    key: 'routes',
    endpoint: 'routes',
    title: 'Routes',
    singular: 'Route',
    description: 'Manage operating routes and their published service details.',
    icon: 'bi-bezier2',
    columns: [
      { key: 'name', label: 'Route name' },
      { key: 'distance_km', label: 'Distance', render: (row) => row.distance_km == null ? '—' : `${String(row.distance_km)} km` },
      { key: 'duration_minutes', label: 'Duration', render: (row) => row.duration_minutes == null ? '—' : `${String(row.duration_minutes)} min` },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { name: 'name', label: 'Route name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'distance_km', label: 'Distance (km)', type: 'number' },
      { name: 'duration_minutes', label: 'Estimated duration (minutes)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: choices(['active', 'Active'], ['inactive', 'Inactive']), required: true, defaultValue: 'active' },
    ],
  },
  {
    key: 'stations',
    endpoint: 'stations',
    title: 'Stations',
    singular: 'Station',
    description: 'Maintain service stops and their geographic coordinates.',
    icon: 'bi-geo-alt',
    columns: [
      { key: 'name', label: 'Station' },
      { key: 'governorate', label: 'Governorate' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'is_active', label: 'Availability' },
    ],
    fields: [
      { name: 'name', label: 'Station name', type: 'text', required: true },
      { name: 'governorate', label: 'Governorate', type: 'text' },
      { name: 'latitude', label: 'Latitude', type: 'number', required: true },
      { name: 'longitude', label: 'Longitude', type: 'number', required: true },
      { name: 'is_active', label: 'Available for service', type: 'checkbox' },
    ],
  },
  {
    key: 'route-stations',
    endpoint: 'route-stations',
    title: 'Route stops',
    singular: 'Route stop',
    description: 'Add stations to routes and keep each stop in travel order.',
    icon: 'bi-signpost-2',
    canDelete: false,
    columns: [
      { key: 'route', label: 'Route', render: (row) => `Route #${String(row.route)}` },
      { key: 'station', label: 'Station', render: (row) => text(row, 'station.name') },
      { key: 'sequence_order', label: 'Stop order' },
    ],
    fields: [
      { name: 'route', label: 'Route', type: 'select', source: 'routes', required: true },
      { name: 'station_id', label: 'Station', type: 'select', source: 'stations', required: true },
      { name: 'sequence_order', label: 'Stop order', type: 'number', required: true, min: 1, step: 1 },
    ],
  },
  {
    key: 'fare-rules',
    endpoint: 'fare-rules',
    title: 'Fare rules',
    singular: 'Fare rule',
    description: 'Configure route-linked fare calculations.',
    icon: 'bi-currency-dollar',
    columns: [
      { key: 'route', label: 'Route', render: (row) => `Route #${String(row.route)}` },
      { key: 'rule_type', label: 'Calculation' },
      { key: 'amount', label: 'Fixed fare' },
      { key: 'base_amount', label: 'Base fare' },
      { key: 'is_active', label: 'Active' },
    ],
    fields: [
      { name: 'route', label: 'Route', type: 'select', source: 'routes', required: true },
      { name: 'rule_type', label: 'Calculation type', type: 'select', options: choices(['fixed', 'Fixed'], ['distance', 'Distance based'], ['station_count', 'Station count based']), required: true },
      { name: 'amount', label: 'Fixed amount', type: 'number' },
      { name: 'base_amount', label: 'Base amount', type: 'number' },
      { name: 'per_km_rate', label: 'Rate per kilometre', type: 'number' },
      { name: 'per_station_rate', label: 'Rate per station', type: 'number' },
      { name: 'valid_from', label: 'Valid from', type: 'datetime-local' },
      { name: 'valid_to', label: 'Valid to', type: 'datetime-local' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
    ],
  },
  {
    key: 'payments',
    endpoint: 'payments',
    title: 'Payments',
    singular: 'Payment',
    description: 'Review trip payment records and their settlement status.',
    icon: 'bi-wallet2',
    columns: [
      { key: 'id', label: 'Payment ID', render: (row) => `PAY-${String(row.id).padStart(4, '0')}` },
      { key: 'trip', label: 'Trip', render: (row) => `TR-${String(row.trip).padStart(4, '0')}` },
      { key: 'amount', label: 'Amount' },
      { key: 'payment_method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'paid_at', label: 'Paid at' },
    ],
    fields: [
      { name: 'trip', label: 'Trip', type: 'select', source: 'trips', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'payment_method', label: 'Method', type: 'select', options: choices(['cash', 'Cash'], ['wallet', 'Wallet']), required: true },
      { name: 'status', label: 'Status', type: 'text', required: true },
    ],
  },
  {
    key: 'bookings',
    endpoint: 'bookings',
    title: 'Bookings',
    singular: 'Booking',
    description: 'Review passenger reservations, allocated seats, and booking lifecycle.',
    icon: 'bi-ticket-perforated',
    canCreate: false,
    canDelete: false,
    columns: [
      { key: 'id', label: 'Booking ID', render: (row) => `BK-${String(row.id).padStart(4, '0')}` },
      { key: 'passenger.username', label: 'Passenger' },
      { key: 'trip.id', label: 'Trip', render: (row) => `TR-${String((row.trip as Record<string, unknown> | undefined)?.id ?? '—')}` },
      { key: 'seat_numbers', label: 'Seats', render: (row) => Array.isArray(row.seat_numbers) ? row.seat_numbers.join(', ') : '—' },
      { key: 'total_amount', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Booked' },
    ],
    fields: [],
  },
  {
    key: 'users',
    endpoint: 'users',
    title: 'Users',
    singular: 'User',
    description: 'Review passenger, driver, and administrator accounts.',
    icon: 'bi-people',
    canCreate: false,
    canDelete: false,
    columns: [
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'phone_number', label: 'Phone' },
      { key: 'is_active', label: 'Account status', render: (row) => row.is_active === true ? 'Active' : 'Inactive' },
    ],
    fields: [],
  },
  {
    key: 'notifications',
    endpoint: 'notifications',
    title: 'Notifications',
    singular: 'Notification',
    description: 'Review delivery notices created for transportation users.',
    icon: 'bi-bell',
    canCreate: false,
    canDelete: false,
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'notification_type', label: 'Type' },
      { key: 'user', label: 'User', render: (row) => `User #${String(row.user)}` },
      { key: 'is_read', label: 'Read' },
      { key: 'created_at', label: 'Created' },
    ],
    fields: [],
  },
]

export function getResource(key: string | undefined): ResourceDefinition | undefined {
  return resources.find((resource) => resource.key === key)
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const title = record.name ?? record.registration_number ?? record.username ?? record.title
    return typeof title === 'string' ? title : `#${String(record.id ?? '')}`
  }
  return String(value)
}

export function getPathValue(row: ApiRecord, path: string): unknown {
  return value(row, path)
}
