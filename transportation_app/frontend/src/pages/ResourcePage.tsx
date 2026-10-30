import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DataTable } from '../components/DataTable'
import { FleetVehicleGrid } from '../components/FleetVehicleGrid'
import { ResourceForm } from '../components/ResourceForm'
import { StatusBadge } from '../components/StatusBadge'
import { TripRouteDetail } from '../components/TripRouteDetail'
import { UserProfileDetails } from '../components/UserProfileDetails'
import { useToast } from '../components/ToastContext'
import { api, ApiError } from '../services/api'
import { displayValue, getResource } from '../services/resources'
import type { ApiRecord, ResourceDefinition } from '../types'

export function ResourcePage() {
  const { t } = useTranslation()
  const { resource: resourceKey, id } = useParams()
  const [searchParams] = useSearchParams()
  const resource = getResource(resourceKey)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [rows, setRows] = useState<ApiRecord[]>([])
  const [record, setRecord] = useState<ApiRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formRecord, setFormRecord] = useState<ApiRecord | null | undefined>(undefined)

  const load = useCallback(async () => {
    if (!resource) return
    try {
      if (id) {
        const result = await api.get<ApiRecord>(`/api/${resource.endpoint}/${id}/`)
        setRecord(result)
      } else {
        const result = await api.get<ApiRecord[]>(`/api/${resource.endpoint}/`)
        setRows(result)
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('Unable to load records from the API.'))
    } finally {
      setLoading(false)
    }
  }, [id, resource, t])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function retryLoad() {
    setLoading(true)
    setError(null)
    void load()
  }

  if (!resource) {
    return <section className="page-error"><span className="empty-icon"><i className="bi bi-signpost-split" /></span><h1>{t('Module not found')}</h1><p>{t('This section isn’t connected to the transportation API.')}</p><Link className="btn btn-primary" to="/">{t('Return to dashboard')}</Link></section>
  }
  const currentResource: ResourceDefinition = resource

  function deleteRecord(row: ApiRecord) {
    const label = `${currentResource.singular.toLowerCase()} #${row.id}`
    if (
      currentResource.key === 'trips'
      && typeof row.booked_seats === 'number'
      && row.booked_seats > 0
    ) {
      showToast(t('This trip has {{count}} booked seat(s) and cannot be deleted. Cancel the trip instead.', { count: row.booked_seats }), 'error')
      return
    }
    if (!window.confirm(t('Delete {{label}}? This action cannot be undone.', { label: t(currentResource.singular.toLowerCase()) }))) return
    void api.delete(`/api/${currentResource.endpoint}/${row.id}/`)
      .then(() => {
        showToast(t('{{resource}} deleted.', { resource: t(currentResource.singular) }))
        if (id) navigate(`/${currentResource.key}`, { replace: true })
        else retryLoad()
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 400) {
          showToast(reason.message, 'error')
          return
        }
        if (
          reason instanceof ApiError
          && (
            reason.status === 400
            || reason.message.includes('ProtectedError at /api/')
          )
          && ['stations', 'routes', 'trips'].includes(currentResource.key)
        ) {
          showToast(t('This {{resource}} is referenced by existing trip or booking records and cannot be deleted.', { resource: t(currentResource.singular.toLowerCase()) }), 'error')
          return
        }
        showToast(reason instanceof Error ? reason.message : t('Could not delete {{label}}.', { label }), 'error')
      })
  }

  function toggleUserActive(row: ApiRecord) {
    const role = String(row.role)
    if ((role !== 'passenger' && role !== 'driver') || typeof row.is_active !== 'boolean') return
    const nextActive = !row.is_active
    const accountName = String(row.username ?? `#${row.id}`)
    const action = nextActive ? 'reactivate' : 'deactivate'
    if (!window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${role} account ${accountName}?`)) return

    void api.patch<ApiRecord>(`/api/users/${row.id}/`, { is_active: nextActive })
      .then(() => {
        showToast(`${role === 'driver' ? 'Driver' : 'Passenger'} account ${nextActive ? 'reactivated' : 'deactivated'}.`)
        retryLoad()
      })
      .catch((reason: unknown) => {
        showToast(reason instanceof Error ? reason.message : `Could not ${action} ${role} account ${accountName}.`, 'error')
      })
  }

  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const lines = [
      currentResource.columns.map((column) => escape(column.label)).join(','),
      ...rows.map((row) => currentResource.columns.map((column) =>
        escape(column.render ? column.render(row) : displayValue(row[column.key])),
      ).join(',')),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${currentResource.key}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast(`${currentResource.title} exported to CSV.`)
  }

  const selectedRecord = id ? record : null
  const canEdit = currentResource.fields.length > 0
  const initialStatus = currentResource.key === 'trips'
    ? searchParams.get('status') ?? ''
    : ''
  const userCollections = [
    {
      key: 'passenger',
      title: 'Passengers',
      description: 'Accounts used to discover trips and manage bookings.',
      icon: 'bi-person-walking',
      rows: rows.filter((row) => String(row.role ?? '').toLowerCase() === 'passenger'),
    },
    {
      key: 'driver',
      title: 'Drivers',
      description: 'Driver accounts available to the operations team.',
      icon: 'bi-person-badge',
      rows: rows.filter((row) => String(row.role ?? '').toLowerCase() === 'driver'),
    },
    {
      key: 'other',
      title: 'Other accounts',
      description: 'Administrators and any other account roles.',
      icon: 'bi-people',
      rows: rows.filter((row) => !['passenger', 'driver'].includes(String(row.role ?? '').toLowerCase())),
    },
  ]

  return (
    <div className="resource-page">
      {!(id && currentResource.key === 'users' && record) && <div className="page-heading">
        <div>
          {id && <Link className="back-link" to={`/${currentResource.key}`}><i className="bi bi-arrow-left" /> {t('Back to')} {t(currentResource.title)}</Link>}
          <span className="eyebrow">{id ? `${t(currentResource.singular.toUpperCase())} ${t('RECORD')}` : t('OPERATIONS DIRECTORY')}</span>
          <h1>{id ? `${t(currentResource.singular)} #${id}` : t(currentResource.title)}</h1>
          <p>{id ? t('Review the record details available from your transportation API.') : t(currentResource.description)}</p>
        </div>
        <div className="heading-actions">
          {!id && <button className="btn btn-light" type="button" onClick={exportCsv} disabled={!rows.length}><i className="bi bi-download" /> {t('Export CSV')}</button>}
          {!id && currentResource.canCreate !== false && <button className="btn btn-primary" type="button" onClick={() => setFormRecord(null)}><i className="bi bi-plus-lg" /> {t('Add')} {t(currentResource.singular)}</button>}
          {id && selectedRecord && canEdit && <button className="btn btn-primary" type="button" onClick={() => setFormRecord(selectedRecord)}><i className="bi bi-pencil" /> {t('Edit record')}</button>}
          {id && selectedRecord && currentResource.canDelete !== false && <button className="btn btn-outline-danger" type="button" onClick={() => deleteRecord(selectedRecord)}><i className="bi bi-trash3" /> {t('Delete')}</button>}
        </div>
      </div>}

      {!id ? (
        currentResource.key === 'vehicles' ? (
          <FleetVehicleGrid
            vehicles={rows}
            loading={loading}
            error={error}
            onRetry={retryLoad}
            onEdit={(row) => setFormRecord(row)}
            onDelete={(row) => deleteRecord(row)}
            allowDelete={currentResource.canDelete !== false}
          />
        ) : currentResource.key === 'users' ? (
          <div className="user-collections">
            {userCollections.map((collection) => (
              <section className="user-collection" key={collection.key}>
                <header className="user-collection-heading">
                  <span className={`user-collection-icon user-collection-icon-${collection.key}`}><i className={`bi ${collection.icon}`} aria-hidden="true" /></span>
                  <div>
                    <h2>{t(collection.title)}</h2>
                    <p>{t(collection.description)}</p>
                  </div>
                  <span className="user-collection-count">{collection.rows.length}</span>
                </header>
                <DataTable
                  key={`trip-status-${initialStatus}-${collection.key}`}
                  rows={collection.rows}
                  columns={currentResource.columns}
                  loading={loading}
                  error={error}
                  onRetry={retryLoad}
                  onEdit={(row) => setFormRecord(row)}
                  onDelete={(row) => deleteRecord(row)}
                  onOpen={(row) => navigate(`/${resource.key}/${row.id}`)}
                  onToggleActive={toggleUserActive}
                  allowDelete={currentResource.canDelete !== false}
                  allowEdit={canEdit}
                  initialStatus={initialStatus}
                />
              </section>
            ))}
          </div>
        ) : (
          <DataTable
            key={`trip-status-${initialStatus}`}
            rows={rows}
            columns={currentResource.columns}
            loading={loading}
            error={error}
            onRetry={retryLoad}
            onEdit={(row) => setFormRecord(row)}
            onDelete={(row) => deleteRecord(row)}
            onOpen={(row) => navigate(`/${resource.key}/${row.id}`)}
            allowDelete={currentResource.canDelete !== false}
            allowEdit={canEdit}
            statusKind={currentResource.key === 'trips' ? 'trip' : currentResource.key === 'drivers' ? 'driver' : undefined}
            initialStatus={initialStatus}
          />
        )
      ) : loading ? (
        <div className="detail-skeleton" aria-label={t('Loading record')}><div /><div /><div /><div /><div /><div /></div>
      ) : error || !record ? (
        <section className="page-error inline-error"><span className="empty-icon"><i className="bi bi-cloud-slash" /></span><h2>{t('Unable to load this record')}</h2><p>{error ?? t('The record was not found.')}</p><button className="btn btn-outline-primary" type="button" onClick={retryLoad}><i className="bi bi-arrow-clockwise" /> {t('Try again')}</button></section>
      ) : currentResource.key === 'users' ? (
        <UserProfileDetails record={record} />
      ) : (
        <div className="record-layout">
          <section className="panel record-panel">
            <header className="panel-header"><div><h2>{t('Record overview')}</h2><p>{t('Fields and relationships returned by the API')}</p></div><span className="record-id-badge">ID {record.id}</span></header>
            <div className="record-grid">
              {currentResource.columns.map((column) => {
                const value = column.render ? column.render(record) : displayValue(record[column.key])
                return <div className="record-field" key={column.key}><span>{t(column.label)}</span><strong className={column.key === 'status' ? '' : undefined}>{column.key === 'status' ? <StatusBadge status={String(record.status ?? 'unknown')} kind={currentResource.key === 'trips' ? 'trip' : currentResource.key === 'drivers' ? 'driver' : currentResource.key === 'vehicles' ? 'vehicle' : 'generic'} /> : value}</strong></div>
              })}
              {Object.entries(record).filter(([key]) => !currentResource.columns.some((column) => column.key === key) && key !== 'id').map(([key, value]) => (
                <div className="record-field" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{displayValue(value)}</strong></div>
              ))}
            </div>
          </section>
          <aside className="panel detail-aside">
            <span className="aside-icon"><i className={`bi ${currentResource.icon}`} /></span>
            <h3>{t('{{resource}} details', { resource: t(currentResource.singular) })}</h3>
            <p>{t('This view reflects data returned by the configured API. Editing and deletion use the matching resource endpoints.')}</p>
            <div className="aside-note"><i className="bi bi-shield-check" /><span>{t('Changes are sent to the backend and may be subject to server-side validation.')}</span></div>
            <a className="panel-link" href="/swagger/" target="_blank" rel="noreferrer">{t('View API schema')} <i className="bi bi-arrow-up-right" /></a>
          </aside>
        </div>
      )}
      {id && record && currentResource.key === 'trips' && <TripRouteDetail record={record} />}

      {formRecord !== undefined && <ResourceForm
        resource={currentResource}
        record={formRecord}
        onClose={() => setFormRecord(undefined)}
        onSaved={() => {
          setFormRecord(undefined)
          showToast(`${currentResource.singular} ${formRecord ? 'updated' : 'created'} successfully.`)
          setLoading(true)
          void load()
        }}
      />}
    </div>
  )
}
