import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../services/api'
import { VehicleSeatMap } from './booking/VehicleSeatMap'
import type { ApiRecord, FieldDefinition, ResourceDefinition } from '../types'

interface Props {
  resource: ResourceDefinition
  record: ApiRecord | null
  onClose: () => void
  onSaved: () => void
}

function initialFieldValue(record: ApiRecord | null, field: FieldDefinition): string | boolean {
  if (!record && field.defaultValue !== undefined) return field.defaultValue
  const nestedStation = record?.station
  const value = field.name === 'station_id' && nestedStation && typeof nestedStation === 'object'
    ? (nestedStation as Record<string, unknown>).id
    : record?.[field.name]
  if (field.type === 'checkbox') return Boolean(value)
  if (field.type === 'select' && typeof value === 'string' && field.options) {
    return field.options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.value ?? value
  }
  if (field.type === 'json') return value == null ? '' : JSON.stringify(value, null, 2)
  if (field.type === 'datetime-local' && typeof value === 'string' && value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  return value === null || value === undefined ? '' : String(value)
}

function recommendedSeatLayout(capacity: number): Array<Array<number | null>> {
  const seatsPerRow = capacity <= 4 ? capacity : capacity <= 8 ? 2 : capacity <= 16 ? 4 : capacity <= 28 ? 5 : 6
  const rows: Array<Array<number | null>> = []
  for (let seatNumber = 1; seatNumber <= capacity;) {
    const row = Array.from(
      { length: Math.min(seatsPerRow, capacity - seatNumber + 1) },
      (_, index) => seatNumber + index,
    )
    if (row.length === 1 && rows.length) rows[rows.length - 1].push(row[0])
    else rows.push(row)
    seatNumber += row.length
  }
  return rows
}

function validateVehicleSeatSettings(
  values: Record<string, string | boolean>,
): string | null {
  const capacity = Number(values.capacity)
  if (!Number.isInteger(capacity) || capacity < 1) {
    return 'Passenger capacity must be a whole number greater than zero.'
  }

  const layoutText = String(values.seat_layout ?? '').trim()
  if (layoutText) {
    let layout: unknown
    try {
      layout = JSON.parse(layoutText)
    } catch {
      return 'Seat layout must be valid JSON.'
    }
    if (!Array.isArray(layout) || !layout.every((row) =>
      Array.isArray(row) && row.every((seat) =>
        seat === null || (typeof seat === 'number' && Number.isInteger(seat) && seat > 0),
      ),
    )) {
      return 'Seat layout must be an array of rows containing positive whole seat numbers or null.'
    }
    const seats = layout.flat().filter((seat): seat is number => typeof seat === 'number')
    if (new Set(seats).size !== seats.length) return 'Each seat number must appear only once.'
    if (seats.length !== capacity || seats.some((seat) => seat > capacity)) {
      return `Seat layout must contain every seat number from 1 to ${capacity} exactly once.`
    }
  }

  const disabledText = String(values.disabled_seats ?? '').trim()
  if (disabledText) {
    let disabledSeats: unknown
    try {
      disabledSeats = JSON.parse(disabledText)
    } catch {
      return 'Disabled seats must be valid JSON.'
    }
    if (!Array.isArray(disabledSeats) || !disabledSeats.every((seat) =>
      Number.isInteger(seat) && seat > 0 && seat <= capacity,
    )) {
      return `Disabled seats must be whole seat numbers from 1 to ${capacity}.`
    }
    if (new Set(disabledSeats).size !== disabledSeats.length) {
      return 'Disabled seat numbers must not repeat.'
    }
  }
  return null
}

function optionLabel(option: ApiRecord, source: string): string {
  let label = ''
  if (source === 'drivers') {
    const user = option.user
    if (user && typeof user === 'object') {
      const userRecord = user as Record<string, unknown>
      label = `${String(userRecord.username ?? 'Driver')} · #${option.id}`
    }
  }
  if (!label) {
    const name = option.name ?? option.registration_number ?? option.title
    label = typeof name === 'string' ? name : `#${option.id}`
  }
  if (typeof option.available === 'boolean') {
    return option.available
      ? `${label} · Available`
      : typeof option.unavailable_reason === 'string' &&
          option.unavailable_reason.startsWith('Set a valid trip schedule')
        ? `${label} · Add schedule to check availability`
        : `${label} · Unavailable${typeof option.unavailable_reason === 'string' ? ` — ${option.unavailable_reason}` : ''}`
  }
  return label
}

interface RouteStop {
  stationId: number
  sequenceOrder: number
}

function routeStopsFor(route: ApiRecord | undefined): RouteStop[] {
  if (!route || !Array.isArray(route.route_stations)) return []
  return route.route_stations.flatMap((value): RouteStop[] => {
    if (!value || typeof value !== 'object') return []
    const routeStop = value as Record<string, unknown>
    const station = routeStop.station
    const stationId = typeof station === 'number'
      ? station
      : station && typeof station === 'object'
        ? Number((station as Record<string, unknown>).id)
        : NaN
    const sequenceOrder = Number(routeStop.sequence_order)
    return Number.isInteger(stationId) && Number.isFinite(sequenceOrder)
      ? [{ stationId, sequenceOrder }]
      : []
  }).sort((a, b) => a.sequenceOrder - b.sequenceOrder)
}

function seatLayoutFromJson(value: string): Array<Array<number | null>> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.length) return null
    const isRow = (row: unknown): row is Array<number | null> =>
      Array.isArray(row) && row.every((seat) => seat === null || (typeof seat === 'number' && Number.isInteger(seat) && seat > 0))
    if (!parsed.every(isRow)) return null
    const seats = parsed.flat().filter((seat): seat is number => seat !== null)
    return new Set(seats).size === seats.length ? parsed : null
  } catch {
    return null
  }
}

function disabledSeatNumbersFromJson(value: string): number[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((seat): seat is number => typeof seat === 'number' && Number.isInteger(seat) && seat > 0)
      : []
  } catch {
    return []
  }
}

export function ResourceForm({ resource, record, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(resource.fields.map((field) => [field.name, initialFieldValue(record, field)])),
  )
  const [options, setOptions] = useState<Record<string, ApiRecord[]>>({})
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seatLayoutPreview = resource.key === 'vehicles' && typeof values.seat_layout === 'string'
    ? seatLayoutFromJson(values.seat_layout)
    : null
  const disabledSeatPreview = resource.key === 'vehicles' && typeof values.disabled_seats === 'string'
    ? new Set(disabledSeatNumbersFromJson(values.disabled_seats))
    : new Set<number>()
  const hasCompleteAssignmentWindow =
    typeof values.departure_time === 'string' &&
    Boolean(values.departure_time) &&
    typeof values.arrival_time === 'string' &&
    Boolean(values.arrival_time)

  useEffect(() => {
    let active = true
    const sources = Array.from(new Set(resource.fields.map((field) => field.source).filter((source): source is string => Boolean(source))))
    const departure = values.departure_time
    const arrival = values.arrival_time
    const availabilityParams = new URLSearchParams()
    if (typeof departure === 'string' && departure) availabilityParams.set('departure_time', new Date(departure).toISOString())
    if (typeof arrival === 'string' && arrival) availabilityParams.set('arrival_time', new Date(arrival).toISOString())
    if (record) availabilityParams.set('trip_id', String(record.id))
    Promise.all(sources.map(async (source) => {
      const isAssignmentSource = source.startsWith('assignment-')
      const query = isAssignmentSource ? availabilityParams.toString() : ''
      const path = `/api/${source}/${query ? `?${query}` : ''}`
      try {
        return { source, records: await api.get<ApiRecord[]>(path), error: null }
      } catch (reason) {
        return {
          source,
          records: null,
          error: reason instanceof Error ? reason.message : 'Could not load form options.',
        }
      }
    })).then((results) => {
      if (!active) return
      const nextOptions: Record<string, ApiRecord[]> = {}
      const nextOptionErrors: Record<string, string> = {}
      for (const result of results) {
        if (result.records) nextOptions[result.source] = result.records
        else if (result.error) nextOptionErrors[result.source] = result.error
      }
      setOptions(nextOptions)
      setOptionErrors(nextOptionErrors)
      setError(Object.values(nextOptionErrors)[0] ?? null)
    }).finally(() => { if (active) setLoadingOptions(false) })
    return () => { active = false }
  }, [resource, record, values.departure_time, values.arrival_time])

  function updateValue(name: string, value: string | boolean) {
    let next = { ...values, [name]: value }
    if (resource.key === 'trips' && name === 'route') {
      const stops = routeStopsFor((options.routes ?? []).find((route) => String(route.id) === String(value)))
      const startPosition = stops.findIndex((stop) => String(stop.stationId) === String(next.start_station))
      const destinationPosition = stops.findIndex((stop) => String(stop.stationId) === String(next.destination_station))
      if (startPosition < 0 || destinationPosition <= startPosition) {
        next = { ...next, start_station: '', destination_station: '' }
        setFieldErrors((errors) => ({
          ...errors,
          start_station: '',
          destination_station: '',
          route: '',
        }))
      } else {
        setFieldErrors((errors) => ({ ...errors, route: '' }))
      }
    }
    const sameStation = resource.key === 'trips' &&
      name === 'start_station' &&
      value !== '' &&
      value === values.destination_station
    const currentRouteStops = routeStopsFor(
      (options.routes ?? []).find((route) => String(route.id) === String(next.route)),
    )
    const selectedStartPosition = currentRouteStops.findIndex((stop) => String(stop.stationId) === String(value))
    const selectedDestinationPosition = currentRouteStops.findIndex((stop) => String(stop.stationId) === String(next.destination_station))
    const clearedDestination = resource.key === 'trips' &&
      name === 'start_station' &&
      value !== '' &&
      (sameStation || (selectedDestinationPosition >= 0 && selectedDestinationPosition <= selectedStartPosition))
    if (clearedDestination) next = { ...next, destination_station: '' }
    setValues(next)
    if (resource.key !== 'trips') return

    if (name === 'start_station') {
      if (clearedDestination) {
        setFieldErrors((errors) => ({
          ...errors,
          start_station: '',
          destination_station: sameStation
            ? 'Start and destination stations must differ.'
            : 'Choose an end station that comes after this start station on the selected route.',
        }))
      } else {
        setFieldErrors((errors) => ({
          ...errors,
          start_station: '',
          ...(next.destination_station ? { destination_station: '' } : {}),
        }))
      }
    } else if (name === 'destination_station') {
      if (value !== '' && value === next.start_station) {
        setFieldErrors((errors) => ({
          ...errors,
          destination_station: 'Start and destination stations must differ.',
        }))
      } else {
        setFieldErrors((errors) => ({
          ...errors,
          start_station: next.start_station ? '' : errors.start_station ?? '',
          destination_station: '',
        }))
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const nextFieldErrors: Record<string, string> = {}
    if (resource.key === 'trips') {
      const selectedRoute = (options.routes ?? []).find((route) => String(route.id) === String(values.route))
      const stops = routeStopsFor(selectedRoute)
      const startPosition = stops.findIndex((stop) => String(stop.stationId) === String(values.start_station))
      const destinationPosition = stops.findIndex((stop) => String(stop.stationId) === String(values.destination_station))
      if (!values.start_station) nextFieldErrors.start_station = 'Select a start station.'
      if (!values.destination_station) nextFieldErrors.destination_station = 'Select an end station.'
      if (values.start_station && values.start_station === values.destination_station) {
        nextFieldErrors.destination_station = 'Start and destination stations must differ.'
      } else if (
        values.start_station &&
        values.destination_station &&
        (startPosition < 0 || destinationPosition <= startPosition)
      ) {
        nextFieldErrors.route = 'The route must include the selected stations in travel order.'
      }
      if (Object.keys(nextFieldErrors).length) {
        setFieldErrors(nextFieldErrors)
        return
      }
      setFieldErrors({})
    }
    if (resource.key === 'vehicles') {
      const validationError = validateVehicleSeatSettings(values)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setSaving(true)
    const payload: Record<string, unknown> = {}
    for (const field of resource.fields) {
      const value = values[field.name]
      if (field.type === 'checkbox') {
        payload[field.name] = Boolean(value)
      } else if (value === '') {
        if (field.required) payload[field.name] = ''
        else if (field.source) payload[field.name] = null
        else if (field.type === 'json') payload[field.name] = []
        else if (field.type === 'datetime-local') payload[field.name] = null
        else if (field.type !== 'number') payload[field.name] = ''
      } else if (field.type === 'number') {
        payload[field.name] = Number(value)
      } else if (field.type === 'datetime-local') {
        payload[field.name] = typeof value === 'string' ? new Date(value).toISOString() : null
      } else if (field.type === 'json') {
        try {
          payload[field.name] = JSON.parse(String(value))
        } catch {
          setError(`${field.label} must be valid JSON.`)
          setSaving(false)
          return
        }
      } else if (field.type === 'select' && field.source) {
        payload[field.name] = value === 'none' ? null : Number(value)
      } else {
        payload[field.name] = value
      }
    }

    try {
      if (record) {
        await api.patch(`/api/${resource.endpoint}/${record.id}/`, payload)
      } else {
        await api.post(`/api/${resource.endpoint}/`, payload)
      }
      onSaved()
    } catch (reason) {
      if (reason instanceof ApiError) {
        const tripFieldError = resource.key === 'trips'
          ? reason.details.find((detail) =>
            ['route:', 'start_station:', 'destination_station:'].some((field) => detail.startsWith(field)),
          )
          : undefined
        if (tripFieldError) {
          const separator = tripFieldError.indexOf(':')
          const fieldName = tripFieldError.slice(0, separator)
          const message = tripFieldError.slice(separator + 1).trim()
          setFieldErrors((errors) => ({ ...errors, [fieldName]: message }))
          setError(reason.details.filter((detail) => detail !== tripFieldError).join(' · ') || null)
        } else {
          setError(reason.details.join(' · ') || reason.message)
        }
      } else setError(reason instanceof Error ? reason.message : 'The record could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop-custom" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="resource-form-title">
        <header className="form-modal-header">
          <div><span className="eyebrow">{record ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h2 id="resource-form-title">{record ? `Edit ${resource.singular.toLowerCase()}` : `Add ${resource.singular.toLowerCase()}`}</h2></div>
          <button type="button" className="icon-button" aria-label="Close form" disabled={saving} onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>
        {error && <div className="form-alert" role="alert"><i className="bi bi-exclamation-triangle" /><span>{error}</span></div>}
        {loadingOptions && resource.fields.some((field) => field.source) && <div className="form-hint"><span className="spinner-border spinner-border-sm" role="status" /> Loading related records…</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            {resource.fields.map((field) => {
              const selectedRoute = resource.key === 'trips'
                ? (options.routes ?? []).find((route) => String(route.id) === String(values.route))
                : undefined
              const routeStops = routeStopsFor(selectedRoute)
              const startPosition = routeStops.findIndex((stop) => String(stop.stationId) === String(values.start_station))
              const stationOptions = (options[field.source ?? ''] ?? []).filter((option) => {
                if (resource.key !== 'trips' || field.source !== 'stations') return true
                if (!selectedRoute) return false
                const position = routeStops.findIndex((stop) => stop.stationId === option.id)
                if (field.name === 'start_station') return position >= 0 && position < routeStops.length - 1
                if (field.name === 'destination_station') return startPosition >= 0 && position > startPosition
                return true
              })
              const fieldOptions = field.options ?? []
              const selectedValue = String(values[field.name] ?? '')
              const hasCurrentOption = fieldOptions.some((option) => option.value === selectedValue)
              return (
              <label className={`form-field${field.type === 'textarea' || field.type === 'json' ? ' field-wide' : ''}${field.type === 'checkbox' ? ' checkbox-field' : ''}`} key={field.name}>
                {field.type === 'checkbox' ? (
                  <span className="checkbox-label"><input checked={Boolean(values[field.name])} type="checkbox" onChange={(event) => updateValue(field.name, event.target.checked)} /><span>{field.label}</span></span>
                ) : (
                  <>
                    <span className="field-label">{field.label}{field.required && <b aria-hidden="true"> *</b>}</span>
                    {field.type === 'select' ? (
                      <select
                        required={field.required && !(resource.key === 'trips' && field.source === 'stations')}
                        value={String(values[field.name] ?? '')}
                        disabled={
                          Boolean(field.source) &&
                          (loadingOptions ||
                            (field.source === 'stations' &&
                              (!(options.stations ?? []).length || Boolean(optionErrors.stations))))
                        }
                        aria-invalid={Boolean(fieldErrors[field.name])}
                        aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
                        onChange={(event) => updateValue(field.name, event.target.value)}
                      >
                        <option value="">
                          {field.source === 'stations' && loadingOptions
                            ? 'Loading stations…'
                            : field.source === 'stations' && optionErrors.stations
                              ? 'Stations could not be loaded'
                              : resource.key === 'trips' && field.source === 'stations' && !selectedRoute
                                ? 'Select a route first'
                                : resource.key === 'trips' && field.source === 'stations' && !routeStops.length
                                  ? 'No stations configured for this route'
                                  : field.source === 'stations' && !stationOptions.length
                                    ? 'No valid stations available'
                                : `Select ${field.label.toLowerCase()}`}
                        </option>
                        {!field.required && field.source && <option value="none">No assignment</option>}
                        {fieldOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                        {selectedValue && !hasCurrentOption && !field.source && (
                          <option value={selectedValue}>{selectedValue}</option>
                        )}
                        {field.source && stationOptions.map((option) => (
                          <option
                            value={option.id}
                            key={option.id}
                            disabled={
                              (field.source === 'assignment-drivers' && option.status !== 'active') ||
                              (field.source === 'assignment-vehicles' && option.status !== 'active') ||
                              (hasCompleteAssignmentWindow && option.available === false)
                            }
                          >
                            {optionLabel(option, field.source!)}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' || field.type === 'json' ? (
                      <textarea rows={3} required={field.required} value={String(values[field.name] ?? '')} onChange={(event) => updateValue(field.name, event.target.value)} />
                    ) : (
                      <input
                        type={field.type}
                        required={field.required}
                        min={field.min}
                        step={field.step ?? (field.type === 'number' ? 'any' : undefined)}
                        value={String(values[field.name] ?? '')}
                        onChange={(event) => updateValue(field.name, event.target.value)}
                      />
                    )}
                    {field.help && <small className="field-help">{field.help}</small>}
                    {fieldErrors[field.name] && (
                      <small className="field-error" id={`${field.name}-error`} role="alert">
                        {fieldErrors[field.name]}
                      </small>
                    )}
                    {field.source === 'stations' && optionErrors.stations && (
                      <small className="field-error" role="alert">
                        Station choices unavailable: {optionErrors.stations}
                      </small>
                    )}
                    {resource.key === 'vehicles' && field.name === 'seat_layout' && (
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          type="button"
                          disabled={!Number.isInteger(Number(values.capacity)) || Number(values.capacity) < 1}
                          onClick={() => updateValue('seat_layout', JSON.stringify(recommendedSeatLayout(Number(values.capacity)), null, 2))}
                        >
                          <i className="bi bi-magic" /> Generate recommended layout
                        </button>
                        <button className="btn btn-sm btn-light" type="button" onClick={() => updateValue('seat_layout', '')}>
                          Use API default
                        </button>
                      </div>
                    )}
                  </>
                )}
              </label>
              )
            })}
            {resource.key === 'vehicles' && (
              <section className="vehicle-layout-preview field-wide" aria-labelledby="vehicle-layout-preview-title">
                <div><span className="eyebrow">LIVE PREVIEW</span><h3 id="vehicle-layout-preview-title">Passenger seat layout</h3></div>
                {seatLayoutPreview ? (
                  <VehicleSeatMap
                    layout={seatLayoutPreview}
                    seatStates={Object.fromEntries(seatLayoutPreview.flat().filter((seat): seat is number => seat !== null).map((seat) => [seat, disabledSeatPreview.has(seat) ? 'disabled' : 'available']))}
                    selectedSeats={[]}
                    disabled
                    onSeatToggle={() => {}}
                  />
                ) : (
                  <p className="empty-inline">Enter a valid seat layout above to preview the passenger seat map. Leave it blank to use the API default.</p>
                )}
              </section>
            )}
          </div>
          <footer className="form-modal-footer">
            <button className="btn btn-light" type="button" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving || loadingOptions}>
              {saving ? <><span className="spinner-border spinner-border-sm" /> Saving…</> : <><i className="bi bi-check2" /> {record ? 'Save changes' : 'Create record'}</>}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
