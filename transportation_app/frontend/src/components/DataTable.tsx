import { useMemo, useState } from 'react'
import type { ApiRecord, ColumnDefinition } from '../types'
import { displayValue, getPathValue } from '../services/resources'
import { StatusBadge, type StatusKind } from './StatusBadge'

interface Props {
  rows: ApiRecord[]
  columns: ColumnDefinition[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onEdit: (row: ApiRecord) => void
  onDelete: (row: ApiRecord) => void
  onOpen: (row: ApiRecord) => void
  onToggleActive?: (row: ApiRecord) => void
  allowDelete: boolean
  allowEdit: boolean
  statusKind?: StatusKind
  initialStatus?: string
}

const pageSize = 10

export function DataTable({
  rows,
  columns,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onOpen,
  onToggleActive,
  allowDelete,
  allowEdit,
  statusKind = 'generic',
  initialStatus = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'id',
    direction: 'desc',
  })
  const [page, setPage] = useState(1)
  const statusValues = useMemo(
    () => Array.from(new Set(rows.map((row) => (
      typeof row.status === 'string' ? row.status :
        typeof row.is_active === 'boolean' ? row.is_active ? 'active' : 'inactive' : undefined
    )).filter((value): value is string => typeof value === 'string'))),
    [rows],
  )
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    const matching = rows.filter((row) => {
      const matchesQuery = !search || columns.some((column) => {
        const value = column.progress
          ? column.progress(row).label
          : column.render ? column.render(row) : displayValue(getPathValue(row, column.key))
        return value.toLowerCase().includes(search)
      })
      const rowStatus = typeof row.status === 'string'
        ? row.status
        : typeof row.is_active === 'boolean' ? row.is_active ? 'active' : 'inactive' : undefined
      const matchesStatus = !status || rowStatus === status
      return matchesQuery && matchesStatus
    })
    return matching.sort((left, right) => {
      const a = getPathValue(left, sort.key)
      const b = getPathValue(right, sort.key)
      const comparison = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [columns, query, rows, sort, status])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function sortBy(key: string) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <label className="search-box">
          <i className="bi bi-search" aria-hidden="true" />
          <span className="visually-hidden">Search records</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search records..." />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><i className="bi bi-x" /></button>}
        </label>
        {statusValues.length > 0 && (
          <label className="filter-select">
            <span className="visually-hidden">Filter by status</span>
            <i className="bi bi-funnel" aria-hidden="true" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              {statusValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
        )}
        <span className="table-count">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</span>
      </div>

      {loading ? (
        <div className="table-skeleton" aria-label="Loading records">
          <div className="skeleton-head" />
          {Array.from({ length: 6 }, (_, index) => <div className="skeleton-row" key={index}><i /><i /><i /><i /><i /></div>)}
        </div>
      ) : error ? (
        <div className="table-message error-state" role="alert">
          <span className="empty-icon"><i className="bi bi-cloud-slash" /></span>
          <strong>We couldn’t load these records</strong>
          <p>{error}</p>
          <button className="btn btn-outline-primary" onClick={onRetry} type="button"><i className="bi bi-arrow-clockwise" /> Try again</button>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="table-message">
          <span className="empty-icon"><i className="bi bi-inbox" /></span>
          <strong>{rows.length ? 'No matching records' : 'Nothing here yet'}</strong>
          <p>{rows.length ? 'Adjust your search or filters to find what you need.' : 'Records will appear here when the API has data.'}</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table app-table align-middle mb-0">
              <thead><tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    <button className="table-sort" type="button" onClick={() => sortBy(column.key)}>
                      {column.label}<i className={`bi ${sort.key === column.key ? (sort.direction === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up'}`} aria-hidden="true" />
                    </button>
                  </th>
                ))}
                <th className="actions-heading" scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column, index) => {
                      const content = column.render ? column.render(row) : displayValue(getPathValue(row, column.key))
                      const statusCell = column.key === 'status'
                      const progress = column.progress?.(row)
                      return (
                        <td key={column.key} className={index === 0 ? 'primary-cell' : ''}>
                          {statusCell ? <StatusBadge status={String(row.status ?? 'unknown')} kind={statusKind} /> : progress ? (
                            <span className="table-progress">
                              <span className="table-progress-label"><strong>{progress.value} / {progress.max || '—'}</strong><small>{progress.label}</small></span>
                              <span className="table-progress-track" role="img" aria-label={`${progress.value} of ${progress.max} seats booked`}><span style={{ width: `${progress.max > 0 ? Math.min(100, Math.max(0, progress.value / progress.max * 100)) : 0}%` }} /></span>
                            </span>
                          ) : column.key === 'is_active' && typeof row.is_active === 'boolean' ? (
                            <StatusBadge status={row.is_active ? 'active' : 'inactive'} />
                          ) : content}
                        </td>
                      )
                    })}
                    <td>
                      <div className="row-actions">
                        <button className="row-action" type="button" title="View details" aria-label={`View record ${row.id}`} onClick={() => onOpen(row)}><i className="bi bi-arrow-up-right-square" /></button>
                        {allowEdit && <button className="row-action" type="button" title="Edit" aria-label={`Edit record ${row.id}`} onClick={() => onEdit(row)}><i className="bi bi-pencil" /></button>}
                        {onToggleActive && (row.role === 'passenger' || row.role === 'driver') && typeof row.is_active === 'boolean' && (
                          <button
                            className={`row-action${row.is_active ? ' danger-action' : ''}`}
                            type="button"
                            title={row.is_active ? 'Deactivate account' : 'Reactivate account'}
                            aria-label={`${row.is_active ? 'Deactivate' : 'Reactivate'} ${String(row.role)} account ${String(row.username ?? row.id)}`}
                            onClick={() => onToggleActive(row)}
                          >
                            <i className={`bi ${row.is_active ? 'bi-person-x' : 'bi-person-check'}`} aria-hidden="true" />
                          </button>
                        )}
                        {allowDelete && <button className="row-action danger-action" type="button" title="Delete" aria-label={`Delete record ${row.id}`} onClick={() => onDelete(row)}><i className="bi bi-trash3" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Showing <strong>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong></span>
            <div className="pagination-actions">
              <button className="pagination-button" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><i className="bi bi-chevron-left" /></button>
              <span className="page-indicator">{currentPage} / {pageCount}</span>
              <button className="pagination-button" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
