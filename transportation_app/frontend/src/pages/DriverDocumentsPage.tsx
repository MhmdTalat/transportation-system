import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, api } from '../services/api'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../i18n/format'

type DriverDocument = {
  id: number
  driver: number
  document_type: 'drivers_license' | 'identity' | 'vehicle_registration'
  original_filename: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string
  created_at: string
}

type Driver = {
  id: number
  user: { username: string; email: string }
  verification_status: 'pending' | 'approved' | 'rejected'
  rejection_note: string
}

const documentNames: Record<DriverDocument['document_type'], string> = {
  drivers_license: "Driver's license",
  identity: 'Identity document',
  vehicle_registration: 'Vehicle registration',
}

export function DriverDocumentsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const admin = user?.role === 'admin' || user?.role === 'authority'
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [documentType, setDocumentType] = useState<DriverDocument['document_type']>('drivers_license')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const documentRows = await api.get<DriverDocument[]>('/api/driver-documents/')
      setDocuments(documentRows)
      if (admin) {
        setDrivers(await api.get<Driver[]>('/api/drivers/'))
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Could not load driver documents.'))
    }
  }, [admin, t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!file) {
      setError(t('Choose a PDF, JPEG, or PNG document first.'))
      return
    }
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('document_type', documentType)
    form.append('file', file)
    try {
      await api.upload<DriverDocument>('/api/driver-documents/', form)
      setFile(null)
      formElement.reset()
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Document upload failed.'))
    } finally {
      setBusy(false)
    }
  }

  async function download(document: DriverDocument) {
    setError(null)
    try {
      const contents = await api.download(`/api/driver-documents/${document.id}/download/`)
      const url = URL.createObjectURL(contents)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.original_filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Document download failed.'))
    }
  }

  async function review(document: DriverDocument, status: 'approved' | 'rejected') {
    const rejection_note = status === 'rejected'
      ? window.prompt(t('Reason for rejecting this document?'))?.trim() ?? ''
      : ''
    if (status === 'rejected' && !rejection_note) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/api/driver-documents/${document.id}/review/`, { status, rejection_note })
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Document review failed.'))
    } finally {
      setBusy(false)
    }
  }

  async function verify(driver: Driver, status: 'approved' | 'rejected') {
    const note = status === 'rejected'
      ? window.prompt(t('Reason for rejecting this driver?'))?.trim() ?? ''
      : ''
    if (status === 'rejected' && !note) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/api/drivers/${driver.id}/verification/`, { status, note })
      await load()
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Driver verification failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="container-fluid py-4">
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-secondary small mb-1">{t(admin ? 'Fleet operations' : 'Driver account')}</p>
          <h1 className="h3 mb-0">{t('Driver documents')}</h1>
        </div>
        <button className="btn btn-outline-secondary" type="button" onClick={() => void load()}>
          <i className="bi bi-arrow-clockwise me-2" />{t('Refresh')}
        </button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!admin && (
        <form className="card card-body mb-4" onSubmit={(event) => void upload(event)}>
          <h2 className="h5">{t('Submit a document for review')}</h2>
          <div className="row g-3 align-items-end">
            <label className="col-md-4">
              <span className="form-label">{t('Document type')}</span>
              <select
                className="form-select"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as DriverDocument['document_type'])}
              >
                {Object.entries(documentNames).map(([value, label]) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </label>
            <label className="col-md-5">
              <span className="form-label">{t('File (PDF, JPEG, or PNG; max 10 MB)')}</span>
              <input
                className="form-control"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" type="submit" disabled={busy}>
                {busy ? t('Submitting…') : t('Upload for review')}
              </button>
            </div>
          </div>
        </form>
      )}

      <section className="card card-body mb-4">
        <h2 className="h5">{t('Submitted documents')}</h2>
        {documents.length === 0
          ? <p className="text-secondary mb-0">{t('No driver documents have been submitted.')}</p>
          : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>{t('Driver')}</th><th>{t('Document')}</th><th>{t('File')}</th><th>{t('Status')}</th><th>{t('Submitted')}</th><th /></tr></thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>{admin ? `#${document.driver}` : t('You')}</td>
                      <td>{t(documentNames[document.document_type])}</td>
                      <td>{document.original_filename}</td>
                      <td>
                        <span className={`badge text-bg-${document.status === 'approved' ? 'success' : document.status === 'rejected' ? 'danger' : 'secondary'}`}>
                          {t(document.status)}
                        </span>
                        {document.rejection_note && <small className="d-block text-danger">{document.rejection_note}</small>}
                      </td>
                      <td>{formatDate(document.created_at)}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-outline-secondary me-2" type="button" onClick={() => void download(document)}>{t('Download')}</button>
                        {admin && document.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success me-1" type="button" disabled={busy} onClick={() => void review(document, 'approved')}>{t('Approve')}</button>
                            <button className="btn btn-sm btn-outline-danger" type="button" disabled={busy} onClick={() => void review(document, 'rejected')}>{t('Reject')}</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {admin && (
        <section className="card card-body">
          <h2 className="h5">{t('Driver verification')}</h2>
          {drivers.length === 0
            ? <p className="text-secondary mb-0">{t('No driver accounts are registered.')}</p>
            : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr><th>{t('Driver')}</th><th>{t('Email')}</th><th>{t('Verification')}</th><th>{t('Decision')}</th></tr></thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td>{driver.user.username}</td>
                        <td>{driver.user.email}</td>
                        <td>{t(driver.verification_status)}{driver.rejection_note && <small className="d-block text-danger">{driver.rejection_note}</small>}</td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-success me-1" type="button" disabled={busy || driver.verification_status === 'approved'} onClick={() => void verify(driver, 'approved')}>{t('Approve')}</button>
                          <button className="btn btn-sm btn-outline-danger" type="button" disabled={busy || driver.verification_status === 'rejected'} onClick={() => void verify(driver, 'rejected')}>{t('Reject')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}
    </main>
  )
}
