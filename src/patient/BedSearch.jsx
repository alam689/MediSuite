import { useMemo, useState } from 'react'
import {
  BedDouble,
  Building2,
  Phone,
  AlertTriangle,
  MapPin,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { useData, relTime } from '../store/DataStore.jsx'
import { CARE_UNITS, freeBeds } from '../data/schemas.js'
import SearchSelect from './SearchSelect.jsx'

/* =====================================================================
   Critical-care bed search.

   The most important thing on this page is the warning at the top, not the
   search. Someone looking up ICU beds is often in the worst hour of their
   life, and a bed count is a snapshot that can be wrong by the time they
   read it. So:

   - the emergency notice comes first and cannot be dismissed;
   - every result shows how old its number is, and anything past
     STALE_MINUTES is called out rather than quietly presented as current;
   - "call to confirm" is the primary action on every card, not "reserve".
     This platform cannot hold a critical-care bed, and a button implying it
     could would be a dangerous lie.
   ===================================================================== */

const STALE_MINUTES = 30

/* Availability is derived from the counts, never from a stored label, so it
   cannot contradict the numbers next to it. */
function availability(r) {
  if (r.status === 'Closed') return { key: 'closed', label: 'Closed', tone: 'rose' }
  if (r.status === 'Diverting') return { key: 'divert', label: 'Not accepting', tone: 'amber' }
  const free = freeBeds(r)
  if (free === 0) return { key: 'full', label: 'Full', tone: 'rose' }
  if (free <= 2) return { key: 'limited', label: 'Limited', tone: 'amber' }
  return { key: 'open', label: 'Beds available', tone: 'green' }
}

const RANK = { open: 0, limited: 1, divert: 2, full: 3, closed: 4 }

export default function BedSearch() {
  const { records } = useData()
  const rows = records('capacity')

  const [hospital, setHospital] = useState('')
  const [unit, setUnit] = useState('All')

  const hospitals = useMemo(
    () => [...new Set(rows.map((r) => r.hospital).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const q = hospital.trim().toLowerCase()
  const results = useMemo(() => {
    return rows
      .filter((r) => {
        if (unit !== 'All' && r.unit !== unit) return false
        if (!q) return true
        return (
          (r.hospital || '').toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const d = RANK[availability(a).key] - RANK[availability(b).key]
        if (d !== 0) return d
        return freeBeds(b) - freeBeds(a)
      })
  }, [rows, unit, q])

  const totalFree = results.reduce(
    (n, r) => n + (availability(r).key === 'open' || availability(r).key === 'limited' ? freeBeds(r) : 0),
    0
  )

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Critical care beds</h1>
          <p className="pt-sub">ICU, CCU, ventilator and high-dependency availability.</p>
        </div>
      </header>

      {/* Comes first, deliberately. */}
      <div className="bed-emergency">
        <AlertTriangle size={20} />
        <div>
          <strong>If this is an emergency, do not use this page to decide where to go.</strong>
          <span>
            Call your local emergency number or go to the nearest emergency department now. Ambulance
            crews route to the right hospital and can pre-alert them — that is faster and safer than
            searching here. This list is a guide for planning, not a live booking system.
          </span>
        </div>
      </div>

      <div className="pt-filters">
        <SearchSelect
          value={hospital}
          onChange={setHospital}
          options={hospitals}
          icon={Building2}
          label="Search hospital or area"
          placeholder="Any hospital or area — click or type to search…"
          emptyText="No hospital matches"
        />
      </div>

      <div className="pt-chips">
        {['All', ...CARE_UNITS].map((u) => (
          <button key={u} className={`pt-chip ${unit === u ? 'on' : ''}`} onClick={() => setUnit(u)}>
            {u === 'All' ? 'All units' : u}
          </button>
        ))}
      </div>

      <p className="bed-count">
        {results.length === 0
          ? 'No units match your search.'
          : `${results.length} unit${results.length > 1 ? 's' : ''} · ${totalFree} bed${totalFree === 1 ? '' : 's'} reported free`}
      </p>

      <div className="bed-grid">
        {results.map((r) => {
          const av = availability(r)
          const free = freeBeds(r)
          const stale = Date.now() - Number(r.updatedAt || 0) > STALE_MINUTES * 60000
          return (
            <article className={`bed-card tone-${av.tone}`} key={r.resourceId}>
              <div className="bed-top">
                <div>
                  <div className="bed-unit">{r.unit}</div>
                  <div className="bed-hosp">{r.hospital}</div>
                  <div className="bed-addr">
                    <MapPin size={11} /> {r.address}
                  </div>
                </div>
                <span className={`pill tone-${av.tone}`}>{av.label}</span>
              </div>

              <div className="bed-figures">
                <div className="bed-free">
                  <b>{av.key === 'closed' || av.key === 'divert' ? '—' : free}</b>
                  <span>free of {r.total}</span>
                </div>
                <div
                  className="bed-bar"
                  role="img"
                  aria-label={`${free} of ${r.total} beds free`}
                  title={`${r.occupied} occupied · ${free} free`}
                >
                  <span style={{ width: `${r.total ? (Number(r.occupied || 0) / r.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className={`bed-updated ${stale ? 'stale' : ''}`}>
                {stale ? <RefreshCw size={12} /> : <Clock size={12} />}
                {stale
                  ? `Last updated ${relTime(r.updatedAt)} — may be out of date, call first`
                  : `Updated ${relTime(r.updatedAt)}`}
              </div>

              {r.phone && (
                <a className="btn btn-primary bed-call" href={`tel:${r.phone.replace(/\s/g, '')}`}>
                  <Phone size={15} /> Call to confirm
                </a>
              )}
              <div className="bed-phone">{r.phone}</div>
            </article>
          )
        })}
      </div>

      {results.length === 0 && (
        <div className="pt-panel">
          <p className="pt-empty">
            Nothing matches that search. Try another hospital or area, or clear the unit filter.
          </p>
        </div>
      )}

      <p className="bed-foot">
        <BedDouble size={14} />
        <span>
          Bed numbers are reported by each facility and change minute to minute. A bed shown here may
          be taken by the time you arrive, and a unit shown as full may free one. <strong>Always
          call before travelling</strong> — this platform cannot hold or reserve a critical-care bed.
        </span>
      </p>
    </>
  )
}
