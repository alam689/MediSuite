import { useMemo, useState } from 'react'
import { BedDouble, Minus, Plus, RefreshCw, Eye, AlertTriangle, Building2 } from 'lucide-react'
import { useData, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { freeBeds } from '../data/schemas.js'
import { useHospital } from './HospitalContext.jsx'

const STALE_MINUTES = 30
const OPERATIONAL = ['Open', 'Diverting', 'Closed']

export default function HospitalBeds() {
  const { facility, facilityLabel, isAll, units } = useHospital()
  const { patch } = useData()
  const toast = useToast()
  const [busy, setBusy] = useState(null)

  /* In group view the board is grouped by site: a bed card that doesn't say
     which hospital it belongs to is an invitation to free the wrong bed. */
  const groups = useMemo(() => {
    if (!isAll) return [[facility, units]]
    const map = new Map()
    for (const u of units) {
      if (!map.has(u.hospital)) map.set(u.hospital, [])
      map.get(u.hospital).push(u)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [isAll, units, facility])

  /* Every write stamps updatedAt. Patients are shown the age of these
     numbers and warned when they're stale, so the timestamp has to reflect
     reality rather than the last time anyone opened the page. */
  const move = (u, delta) => {
    const occupied = Number(u.occupied || 0) + delta
    if (occupied < 0 || occupied > Number(u.total || 0)) return
    setBusy(u.resourceId)
    patch('capacity', u.resourceId, { occupied, updatedAt: Date.now() }, {
      title: delta > 0 ? 'Admission recorded' : 'Discharge recorded',
      sub: `${u.unit} · ${u.hospital} · ${Math.max(0, Number(u.total || 0) - occupied)} free`,
    })
    toast.success(delta > 0 ? 'Bed taken' : 'Bed freed', {
      title: `${u.unit} — ${Math.max(0, Number(u.total || 0) - occupied)} free`,
    })
    setTimeout(() => setBusy(null), 250)
  }

  const setStatus = (u, status) => {
    patch('capacity', u.resourceId, { status, updatedAt: Date.now() }, {
      title: `Unit set to ${status.toLowerCase()}`,
      sub: `${u.unit} · ${u.hospital}`,
    })
    toast.info(`${u.unit} — ${status}`, { title: u.hospital })
  }

  const confirmCount = (u) => {
    // No number changes: this only re-stamps the time. It exists because the
    // honest answer to "is this still 3?" is often "yes" — and a patient
    // needs to know someone checked, not just that nothing moved.
    patch('capacity', u.resourceId, { updatedAt: Date.now() }, {
      title: 'Count confirmed',
      sub: `${u.unit} · ${u.hospital} · ${freeBeds(u)} free`,
    })
    toast.success('Count confirmed as current', { title: u.unit })
  }

  return (
    <>
      <header className="hs-head">
        <div>
          <h1 className="hs-title">Beds &amp; units</h1>
          <p className="hs-sub">
            {isAll ? `${facilityLabel} — grouped by site. ` : ''}
            These numbers are what patients see when they search for critical care.
          </p>
        </div>
      </header>

      {units.length === 0 ? (
        <div className="hs-panel">
          <p className="hs-empty">
            No critical-care units are registered for {facilityLabel}. Add them in the clinician
            workspace under Bed Capacity.
          </p>
        </div>
      ) : (
        groups.map(([site, list]) => (
        <section key={site} className="hs-group">
          {isAll && (
            <div className="hs-group-head">
              <Building2 size={14} />
              {site}
              <span className="hs-group-meta">
                {list.reduce((n, u) => n + freeBeds(u), 0)} free · {list.length} unit(s)
              </span>
            </div>
          )}
        <div className="hs-beds">
          {list.map((u) => {
            const free = freeBeds(u)
            const total = Number(u.total || 0)
            const stale = Date.now() - Number(u.updatedAt || 0) > STALE_MINUTES * 60000
            const tone = u.status !== 'Open' ? 'blue' : free === 0 ? 'rose' : free <= 2 ? 'amber' : 'green'
            return (
              <article className={`hs-bed tone-${tone} ${busy === u.resourceId ? 'is-busy' : ''}`} key={u.resourceId}>
                <div className="hs-bed-top">
                  <div>
                    <div className="hs-bed-unit">{u.unit}</div>
                    <div className="hs-row-sub">{u.resourceId}</div>
                  </div>
                  <span className={`pill tone-${tone}`}>
                    {u.status !== 'Open' ? u.status : free === 0 ? 'Full' : `${free} free`}
                  </span>
                </div>

                <div className="hs-bed-count">
                  <button
                    className="hs-step"
                    onClick={() => move(u, -1)}
                    disabled={Number(u.occupied || 0) <= 0}
                    aria-label="Discharge — free a bed"
                    title="Discharge (frees a bed)"
                  >
                    <Minus size={15} />
                  </button>
                  <div className="hs-bed-figure">
                    <b>{free}</b>
                    <span>free of {total}</span>
                  </div>
                  <button
                    className="hs-step"
                    onClick={() => move(u, +1)}
                    disabled={free <= 0}
                    aria-label="Admit — take a bed"
                    title="Admit (takes a bed)"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="hs-bar" title={`${u.occupied} occupied · ${free} free`}>
                  <span style={{ width: `${total ? (Number(u.occupied || 0) / total) * 100 : 0}%` }} />
                </div>

                <div className="hs-bed-status">
                  {OPERATIONAL.map((s) => (
                    <button
                      key={s}
                      className={`hs-seg ${u.status === s ? 'on' : ''}`}
                      onClick={() => setStatus(u, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className={`hs-bed-foot ${stale ? 'stale' : ''}`}>
                  <span>
                    {stale && <AlertTriangle size={11} />}
                    Updated {relTime(u.updatedAt)}
                  </span>
                  <button className="hs-confirm" onClick={() => confirmCount(u)} title="Re-stamp as current">
                    <RefreshCw size={11} /> Still correct
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        </section>
        ))
      )}

      <p className="hs-note">
        <Eye size={13} />
        Anything you change here appears immediately in the patient-facing critical care search —
        including the “last updated” time. A count over {STALE_MINUTES} minutes old is shown to
        patients as possibly out of date.
      </p>
    </>
  )
}
