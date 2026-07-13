import { useMemo, useState } from 'react'
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import Avatar from './Avatar.jsx'

/*
  Generic interactive table.
  columns: [{ key, label, type?, tone?, sortable?, filter? (bool), render?(row) }]
  toneFor(row, col) -> tone name for pill/badge columns.
*/
export default function DataTable({
  columns,
  rows,
  toneFor,
  onRowClick,
  rowActions,
  pageSize = 8,
  emptyLabel = 'No records yet',
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(0)

  const filterCols = columns.filter((c) => c.filter)

  const filterValues = useMemo(() => {
    const map = {}
    for (const c of filterCols) {
      map[c.key] = Array.from(
        new Set(rows.map((r) => r[c.key]).filter((v) => v != null))
      ).sort()
    }
    return map
  }, [filterCols, rows])

  const processed = useMemo(() => {
    let out = rows
    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        Object.values(r).some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        )
      )
    }
    for (const [k, v] of Object.entries(filters)) {
      if (v) out = out.filter((r) => String(r[k]) === v)
    }
    if (sort.key) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key]
        const bv = b[sort.key]
        const na = parseFloat(String(av).replace(/[^0-9.-]/g, ''))
        const nb = parseFloat(String(bv).replace(/[^0-9.-]/g, ''))
        let cmp
        if (!isNaN(na) && !isNaN(nb)) cmp = na - nb
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return out
  }, [rows, query, filters, sort])

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = processed.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  )

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )

  return (
    <div className="dt">
      <div className="dt-toolbar">
        <label className="dt-search">
          <Search size={15} />
          <input
            placeholder="Search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
          />
        </label>
        {filterCols.map((c) => (
          <select
            key={c.key}
            className="dt-filter"
            value={filters[c.key] || ''}
            onChange={(e) => {
              setFilters((f) => ({ ...f, [c.key]: e.target.value }))
              setPage(0)
            }}
          >
            <option value="">All {c.label}</option>
            {filterValues[c.key].map((v) => (
              <option value={v} key={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        <span className="dt-count">{processed.length} records</span>
      </div>

      <div className="dt-scroll">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.sortable !== false ? 'is-sortable' : ''}
                  onClick={
                    c.sortable !== false ? () => toggleSort(c.key) : undefined
                  }
                >
                  <span>{c.label}</span>
                  {sort.key === c.key &&
                    (sort.dir === 'asc' ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    ))}
                </th>
              ))}
              {rowActions && <th className="dt-actions-h">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr
                key={r.resourceId}
                className={onRowClick ? 'is-clickable' : ''}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render ? (
                      c.render(r)
                    ) : c.type === 'avatarName' ? (
                      <span className="cell-avatar">
                        <Avatar src={r[c.imageKey]} name={r[c.key]} size={30} />
                        <strong>{r[c.key]}</strong>
                      </span>
                    ) : c.type === 'pill' ? (
                      <span
                        className={`pill tone-${toneFor ? toneFor(r, c) : 'teal'}`}
                      >
                        {r[c.key]}
                      </span>
                    ) : c.type === 'ref' ? (
                      <span
                        className="wl-ref"
                        style={{ '--tc': `var(--tone-${toneFor ? toneFor(r, c) : 'teal'})` }}
                      >
                        {r[c.key]}
                      </span>
                    ) : c.type === 'strong' ? (
                      <strong>{r[c.key]}</strong>
                    ) : (
                      r[c.key]
                    )}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className="dt-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowActions(r)}
                  </td>
                )}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  className="dt-empty"
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                >
                  <Inbox size={22} />
                  <span>{emptyLabel}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="dt-pager">
          <button
            className="icon-btn"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            className="icon-btn"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
