import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react'

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  success?: boolean
  icon?: string
}

export function PrimaryButton({
  children,
  loading = false,
  success = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ride-button ride-button-primary ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading
        ? <span className="ride-button-spinner" aria-hidden="true" />
        : success
          ? <i className="bi bi-check-lg" aria-hidden="true" />
          : icon && <i className={`bi ${icon}`} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}

export function BottomSheet({
  children,
  className = '',
  size = 'half',
  label,
}: {
  children: ReactNode
  className?: string
  size?: 'half' | 'full'
  label?: string
}) {
  return (
    <section className={`ride-bottom-sheet ride-bottom-sheet-${size} ${className}`} aria-label={label}>
      <span className="ride-sheet-grip" aria-hidden="true" />
      {children}
    </section>
  )
}

export interface AddressInputProps extends InputHTMLAttributes<HTMLInputElement> {
  kind: 'pickup' | 'dropoff'
  label: string
}

export function AddressInput({ kind, label, className = '', ...props }: AddressInputProps) {
  return (
    <label className={`ride-address-input ${className}`}>
      <span className={`ride-address-dot ride-address-${kind}`} aria-hidden="true" />
      <span className="ride-address-copy">
        <small>{label}</small>
        <input {...props} />
      </span>
    </label>
  )
}

export function RideCard({
  name,
  eta,
  price,
  icon = 'bi-car-front',
  selected = false,
  onSelect,
}: {
  name: string
  eta: string
  price: string
  icon?: string
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button className={`ride-option-card${selected ? ' ride-option-selected' : ''}`} type="button" onClick={onSelect}>
      <span className="ride-option-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      <span className="ride-option-copy"><strong>{name}</strong><small>{eta}</small></span>
      <strong className="ride-option-price">{price}</strong>
    </button>
  )
}

export function DriverCard({
  name,
  rating,
  vehicle,
  plate,
  photo,
}: {
  name: string
  rating?: string
  vehicle?: string
  plate?: string
  photo?: string | null
}) {
  return (
    <div className="ride-driver-card">
      <span className="ride-driver-photo">{photo ? <img src={photo} alt="" /> : <i className="bi bi-person-fill" aria-hidden="true" />}</span>
      <span className="ride-driver-copy"><strong>{name}</strong><small>{rating ? <><i className="bi bi-star-fill" aria-hidden="true" /> {rating}</> : null}</small></span>
      <span className="ride-driver-vehicle"><strong>{vehicle || 'Vehicle assigned'}</strong>{plate && <small>{plate}</small>}</span>
    </div>
  )
}

export function FareRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return <div className={`ride-fare-row${total ? ' ride-fare-total' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`ride-skeleton ${className}`} aria-hidden="true" />
}

export function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'information' }) {
  return <span className={`ride-status-chip ride-status-${tone}`}><span aria-hidden="true" />{children}</span>
}

export function CircularCountdown({ value, max = 15 }: { value: number; max?: number }) {
  const percentage = Math.max(0, Math.min(1, value / max))
  return (
    <span className="ride-countdown" style={{ '--countdown-progress': `${percentage * 360}deg` } as CSSProperties}>
      <strong>{value}</strong>
    </span>
  )
}
