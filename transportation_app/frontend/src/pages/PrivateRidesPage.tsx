import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../services/api'
import { formatDate } from '../i18n/format'
import { RadarPulseBackground } from '../components/ride/RadarPulseBackground'

type PrivateRide = {
  id: number
  passenger: number
  driver: number | null
  pickup_address: string
  destination_address: string
  pickup_latitude: number
  pickup_longitude: number
  destination_latitude: number
  destination_longitude: number
  fare_amount: string | null
  status: 'requested' | 'accepted' | 'rejected' | 'cancelled' | 'completed'
  created_at: string
}

export function PrivateRidesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const admin = user?.role === 'admin' || user?.role === 'authority'
  const passenger = user?.role === 'passenger'
  const driver = user?.role === 'driver'
  const [rides, setRides] = useState<PrivateRide[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRides(await api.get<PrivateRide[]>('/api/private-rides/'))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not load private rides.'))
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function requestRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const number = (key: string) => Number(form.get(key))
    setBusy(true)
    setError(null)
    try {
      await api.post<PrivateRide>('/api/private-rides/', {
        pickup_address: form.get('pickup_address'),
        destination_address: form.get('destination_address'),
        pickup_latitude: number('pickup_latitude'),
        pickup_longitude: number('pickup_longitude'),
        destination_latitude: number('destination_latitude'),
        destination_longitude: number('destination_longitude'),
      })
      formElement.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not request a private ride.'))
    } finally {
      setBusy(false)
    }
  }

  async function act(ride: PrivateRide, action: 'accept' | 'cancel' | 'complete' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      await api.post<PrivateRide>(`/api/private-rides/${ride.id}/${action}/`, {})
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('The private-ride action failed.'))
    } finally {
      setBusy(false)
    }
  }

  const waitingForDriver = passenger && rides.some((ride) => ride.status === 'requested')

  return (
    <main className="container-fluid py-4">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-secondary small mb-1">{t('On-demand transport')}</p>
          <h1 className="h3 mb-0">{t('Private rides')}</h1>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={() => void load()}>
          <i className="bi bi-arrow-clockwise me-2" />{t('Refresh')}
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {waitingForDriver && (
        <section className="trip-searching-panel mb-4" role="status" aria-live="polite">
          <RadarPulseBackground color="var(--color-accent)" speed={1} intensity={0.75} />
          <div>
            <strong>{t('Looking for a driver')}</strong>
            <span>{t('Nearby drivers can see your open request.')}</span>
          </div>
        </section>
      )}
      {passenger && (
        <form className="card card-body mb-4" onSubmit={(event) => void requestRide(event)}>
          <h2 className="h5">{t('Request a ride')}</h2>
          <div className="row g-3">
            <label className="col-md-6">
              <span className="form-label">{t('Pickup address')}</span>
              <input className="form-control" name="pickup_address" maxLength={500} required />
            </label>
            <label className="col-md-6">
              <span className="form-label">{t('Destination address')}</span>
              <input className="form-control" name="destination_address" maxLength={500} required />
            </label>
            <label className="col-md-3">
              <span className="form-label">{t('Pickup latitude')}</span>
              <input className="form-control" name="pickup_latitude" type="number" min="-90" max="90" step="any" required />
            </label>
            <label className="col-md-3">
              <span className="form-label">{t('Pickup longitude')}</span>
              <input className="form-control" name="pickup_longitude" type="number" min="-180" max="180" step="any" required />
            </label>
            <label className="col-md-3">
              <span className="form-label">{t('Destination latitude')}</span>
              <input className="form-control" name="destination_latitude" type="number" min="-90" max="90" step="any" required />
            </label>
            <label className="col-md-3">
              <span className="form-label">{t('Destination longitude')}</span>
              <input className="form-control" name="destination_longitude" type="number" min="-180" max="180" step="any" required />
            </label>
          </div>
          <div className="mt-3">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? t('Submitting…') : t('Request private ride')}
            </button>
            <small className="text-secondary ms-3">{t('Fare is confirmed separately; a price quote is not yet available.')}</small>
          </div>
        </form>
      )}

      <section className="card card-body">
        <h2 className="h5">{t('Ride requests')}</h2>
        {rides.length === 0
          ? <p className="text-secondary mb-0">{t('There are no private rides to show.')}</p>
          : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>{t('Route')}</th><th>{t('Coordinates')}</th><th>{t('Status')}</th><th>{t('Fare')}</th><th>{t('Requested')}</th><th /></tr></thead>
                <tbody>
                  {rides.map((ride) => (
                    <tr key={ride.id}>
                      <td><strong>{ride.pickup_address}</strong><br /><span className="text-secondary">{t('to')} {ride.destination_address}</span></td>
                      <td className="small">{ride.pickup_latitude}, {ride.pickup_longitude}<br />{ride.destination_latitude}, {ride.destination_longitude}</td>
                      <td><span className="badge text-bg-secondary">{t(ride.status)}</span></td>
                      <td>{ride.fare_amount ?? t('Not quoted')}</td>
                      <td>{formatDate(ride.created_at)}</td>
                      <td className="text-end text-nowrap">
                        {driver && ride.status === 'requested' && <button className="btn btn-sm btn-success me-1" type="button" disabled={busy} onClick={() => void act(ride, 'accept')}>{t('Accept')}</button>}
                        {driver && ride.status === 'accepted' && <button className="btn btn-sm btn-primary me-1" type="button" disabled={busy} onClick={() => void act(ride, 'complete')}>{t('Complete')}</button>}
                        {admin && ride.status === 'requested' && <button className="btn btn-sm btn-outline-danger me-1" type="button" disabled={busy} onClick={() => void act(ride, 'reject')}>{t('Reject')}</button>}
                        {(admin || passenger && ride.passenger === user?.id) && ['requested', 'accepted'].includes(ride.status) && <button className="btn btn-sm btn-outline-secondary" type="button" disabled={busy} onClick={() => void act(ride, 'cancel')}>{t('Cancel')}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </main>
  )
}
