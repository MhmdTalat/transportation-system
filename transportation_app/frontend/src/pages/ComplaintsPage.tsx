import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../services/api'

type Complaint = {
  id: number
  reporter: { username: string }
  subject: string
  description: string
  status: 'open' | 'under_review' | 'resolved' | 'rejected'
  resolution: string
  created_at: string
}

const statusNames: Record<Complaint['status'], string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  rejected: 'Rejected',
}

export function ComplaintsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const admin = user?.role === 'admin' || user?.role === 'authority'
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setComplaints(await api.get<Complaint[]>('/api/complaints/'))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not load complaints.'))
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const formElement = event.currentTarget
    setBusy(true)
    setError(null)
    try {
      await api.post<Complaint>('/api/complaints/', {
        subject: form.get('subject'),
        description: form.get('description'),
      })
      formElement.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not submit the complaint.'))
    } finally {
      setBusy(false)
    }
  }

  async function update(
    complaint: Complaint,
    status: Complaint['status'],
    resolution: string,
  ) {
    setBusy(true)
    setError(null)
    try {
      await api.patch<Complaint>(`/api/complaints/${complaint.id}/`, { status, resolution })
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not update the complaint.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container-fluid py-4">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-secondary small mb-1">{t('Support')}</p>
          <h1 className="h3 mb-0">{t(admin ? 'Complaint management' : 'Contact support')}</h1>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={() => void load()}>
          <i className="bi bi-arrow-clockwise me-2" />{t('Refresh')}
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!admin && (
        <form className="card card-body mb-4" onSubmit={(event) => void submit(event)}>
          <h2 className="h5">{t('Submit a complaint')}</h2>
          <label className="mb-3">
            <span className="form-label">{t('Subject')}</span>
            <input className="form-control" name="subject" maxLength={255} required />
          </label>
          <label>
            <span className="form-label">{t('What happened?')}</span>
            <textarea className="form-control" name="description" rows={4} required />
          </label>
          <div className="mt-3">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? t('Submitting…') : t('Submit complaint')}
            </button>
          </div>
        </form>
      )}

      <section className="d-grid gap-3">
        {complaints.length === 0
          ? <div className="card card-body text-secondary">{t('No complaints to show.')}</div>
          : complaints.map((complaint) => (
            <article className="card card-body" key={complaint.id}>
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <h2 className="h5 mb-1">{complaint.subject}</h2>
                  <small className="text-secondary">
                    {admin ? `${complaint.reporter.username} · ` : ''}
                    {new Date(complaint.created_at).toLocaleString()}
                  </small>
                </div>
                <span className="badge text-bg-secondary align-self-start">{t(statusNames[complaint.status])}</span>
              </div>
              <p className="my-3">{complaint.description}</p>
              {complaint.resolution && (
                <p className="alert alert-light mb-0"><strong>{t('Resolution')}:</strong> {complaint.resolution}</p>
              )}
              {admin && (
                <ComplaintEditor
                  complaint={complaint}
                  disabled={busy}
                  onSave={(status, resolution) => void update(complaint, status, resolution)}
                />
              )}
            </article>
          ))}
      </section>
    </main>
  )
}

function ComplaintEditor({
  complaint,
  disabled,
  onSave,
}: {
  complaint: Complaint
  disabled: boolean
  onSave: (status: Complaint['status'], resolution: string) => void
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(complaint.status)
  const [resolution, setResolution] = useState(complaint.resolution)
  return (
    <div className="row g-2 mt-3 align-items-end">
      <label className="col-md-3">
        <span className="form-label">{t('Status')}</span>
        <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value as Complaint['status'])}>
          {Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
        </select>
      </label>
      <label className="col-md-7">
        <span className="form-label">{t('Resolution / internal update')}</span>
        <input className="form-control" value={resolution} onChange={(event) => setResolution(event.target.value)} />
      </label>
      <div className="col-md-2">
        <button className="btn btn-primary w-100" type="button" disabled={disabled} onClick={() => onSave(status, resolution)}>
          {t('Save update')}
        </button>
      </div>
    </div>
  )
}
