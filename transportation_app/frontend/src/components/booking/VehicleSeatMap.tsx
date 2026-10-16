import { useMemo, useRef } from 'react'

export type SeatMapState = 'available' | 'booked' | 'disabled'

export interface VehicleSeatMapProps {
  layout: Array<Array<number | null>>
  seatStates: Record<number, SeatMapState>
  selectedSeats: number[]
  disabled?: boolean
  onSeatToggle: (seat: number) => void
}

function getSeatLabel(seat: number, state: SeatMapState, selected: boolean): string {
  if (selected) return `Seat ${seat}, selected`
  if (state === 'booked') return `Seat ${seat}, booked, unavailable`
  if (state === 'disabled') return `Seat ${seat}, blocked, unavailable`
  return `Seat ${seat}, available`
}

export function VehicleSeatMap({
  layout,
  seatStates,
  selectedSeats,
  disabled = false,
  onSeatToggle,
}: VehicleSeatMapProps) {
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({})

  const orderedSeats = useMemo(
    () => layout.flatMap((row) => row.filter((seat): seat is number => seat !== null)),
    [layout],
  )

  const focusSeat = (seat: number, direction: 'left' | 'right' | 'up' | 'down') => {
    const currentIndex = orderedSeats.indexOf(seat)
    if (currentIndex === -1) return

    const nextSeat = (() => {
      const row = layout.find((candidate) => candidate.includes(seat))
      if (!row) return undefined
      const currentPosition = row.indexOf(seat)
      const currentRowIndex = layout.indexOf(row)

      if (direction === 'left') {
        const priorRow = layout[currentRowIndex] ?? []
        const target = priorRow[currentPosition - 1]
        return target ?? undefined
      }

      if (direction === 'right') {
        const nextRow = layout[currentRowIndex] ?? []
        const target = nextRow[currentPosition + 1]
        return target ?? undefined
      }

      const seatRowIndex = currentRowIndex + (direction === 'up' ? -1 : 1)
      const seatIndex = currentPosition
      const targetRow = layout[seatRowIndex]
      return targetRow?.[seatIndex] ?? undefined
    })()

    if (nextSeat === undefined) return
    buttonRefs.current[nextSeat]?.focus()
  }

  return (
    <div className="vehicle-seat-layout" role="grid" aria-label="Vehicle seat map">
      <div className="seat-driver" aria-hidden="true">
        <i className="bi bi-steering-wheel" /> DRIVER
      </div>
      {layout.map((row, rowIndex) => (
        <div className="vehicle-seat-row" role="row" key={`row-${rowIndex}`}>
          {row.map((seat, seatIndex) => {
            if (seat === null) {
              return <span className="seat-aisle" aria-hidden="true" key={`aisle-${rowIndex}-${seatIndex}`} />
            }

            const state = seatStates[seat] ?? 'available'
            const selected = selectedSeats.includes(seat)
            const unavailable = state !== 'available'
            const seatLabel = getSeatLabel(seat, state, selected)

            return (
              <button
                key={seat}
                ref={(element) => {
                  buttonRefs.current[seat] = element
                }}
                className={`vehicle-seat${selected ? ' seat-selected' : ''}${state === 'booked' ? ' seat-booked' : ''}${state === 'disabled' ? ' seat-disabled' : ''}`}
                type="button"
                role="gridcell"
                disabled={unavailable || disabled}
                aria-label={seatLabel}
                aria-pressed={selected}
                aria-disabled={unavailable || disabled}
                title={state === 'booked' ? `Seat ${seat} is already booked.` : state === 'disabled' ? `Seat ${seat} is blocked.` : `Seat ${seat}`}
                onClick={() => onSeatToggle(seat)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') { event.preventDefault(); focusSeat(seat, 'left') }
                  if (event.key === 'ArrowRight') { event.preventDefault(); focusSeat(seat, 'right') }
                  if (event.key === 'ArrowUp') { event.preventDefault(); focusSeat(seat, 'up') }
                  if (event.key === 'ArrowDown') { event.preventDefault(); focusSeat(seat, 'down') }
                  if ((event.key === 'Enter' || event.key === ' ') && !unavailable && !disabled) {
                    event.preventDefault();
                    onSeatToggle(seat)
                  }
                }}
              >
                <span aria-hidden="true">
                  {state === 'booked' ? <i className="bi bi-lock-fill" /> : state === 'disabled' ? <i className="bi bi-slash-circle" /> : selected ? <i className="bi bi-check-lg" /> : null}
                </span>
                {String(seat).padStart(2, '0')}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
