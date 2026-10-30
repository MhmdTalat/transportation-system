import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, api } from '../services/api'

type OperationalSettingKey =
  | 'booking_cancellation_cutoff_hours'
  | 'driver_passenger_phone_window_hours'
  | 'max_active_upcoming_bookings'

type OperationalSettings = Record<OperationalSettingKey, number>

type AuditLog = {
  id: number
  actor: { username: string } | null
  action: string
  object_type: string
  object_id: string
  ip_address: string | null
  details: Record<string, unknown>
  created_at: string
}

const settingLabels: Record<OperationalSettingKey, string> = {
  booking_cancellation_cutoff_hours: 'Booking cancellation cutoff (hours)',
  driver_passenger_phone_window_hours: 'Driver phone access before departure (hours)',
  max_active_upcoming_bookings: 'Maximum active upcoming bookings per passenger',
}

const settingKeys = Object.keys(settingLabels) as OperationalSettingKey[]

export function AdminOperationsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<OperationalSettings | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [busyKey, setBusyKey] = useState<OperationalSettingKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [settingValues, auditRows] = await Promise.all([
        api.get<OperationalSettings>('/api/operational-settings/'),
        api.get<AuditLog[]>('/api/audit-logs/'),
      ])
      setSettings(settingValues)
      setLogs(auditRows)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not load operational data.'))
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function saveSetting(key: OperationalSettingKey) {
    if (!settings) return
    setBusyKey(key)
    setError(null)
    setNotice(null)
    try {
      const result = await api.patch<{ key: OperationalSettingKey; value: number }>(
        `/api/operational-settings/${key}/`,
        { value: settings[key] },
      )
      setSettings((current) => current ? { ...current, [key]: result.value } : current)
      setNotice(t('{{setting}} updated.', { setting: t(settingLabels[key]) }))
      setLogs(await api.get<AuditLog[]>('/api/audit-logs/'))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not update the setting.'))
    } finally {
      setBusyKey(null)
    }
  }

  function updateSetting(key: OperationalSettingKey, value: number) {
    setSettings((current) => current ? { ...current, [key]: value } : current)
  }

  async function refresh() {
    setBusy(true)
    await load()
    setBusy(false)
  }

  return (
    <main className="container-fluid py-4">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-secondary small mb-1">{t('Administration')}</p>
          <h1 className="h3 mb-0">{t('Operations & audit')}</h1>
        </div>
        <button className="btn btn-outline-secondary" type="button" disabled={busy} onClick={() => void refresh()}>
          <i className="bi bi-arrow-clockwise me-2" />{t('Refresh')}
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card card-body mb-4">
        <h2 className="h5">{t('Operational policies')}</h2>
        {!settings
          ? <p className="text-secondary mb-0">{t('Loading settings…')}</p>
          : (
            <div className="row g-3">
              {settingKeys.map((key) => (
                <div className="col-lg-4" key={key}>
                  <label className="form-label" htmlFor={`setting-${key}`}>{t(settingLabels[key])}</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      id={`setting-${key}`}
                      type="number"
                      min={key === 'max_active_upcoming_bookings' ? 1 : 0}
                      max="1000"
                      value={settings[key]}
                      onChange={(event) => updateSetting(key, Number(event.target.value))}
                    />
                    <button className="btn btn-primary" type="button" disabled={busyKey !== null} onClick={() => void saveSetting(key)}>
                      {busyKey === key ? t('Saving…') : t('Save')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      <section className="card card-body">
        <h2 className="h5">{t('Audit log')}</h2>
        {logs.length === 0
          ? <p className="text-secondary mb-0">{t('No administrative events have been recorded.')}</p>
          : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>{t('Action')}</th><th>{t('Object')}</th><th>{t('Actor')}</th><th>{t('IP')}</th><th>{t('Details')}</th><th>{t('Time')}</th></tr></thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.action}</td>
                      <td>{log.object_type} #{log.object_id}</td>
                      <td>{log.actor?.username ?? t('System')}</td>
                      <td>{log.ip_address ?? '—'}</td>
                      <td><code className="small">{JSON.stringify(log.details)}</code></td>
                      <td className="text-nowrap">{new Date(log.created_at).toLocaleString()}</td>
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
