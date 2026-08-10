import { Link } from 'react-router-dom'
import { Ambulance, Route, IdCard, CircleCheck, AlertTriangle, ArrowRight } from 'lucide-react'
import { relTime } from '../store/DataStore.jsx'
import { useAmbulance, daysLeft, LICENCE_WARN_DAYS } from './AmbulanceContext.jsx'

/* The operator's first screen: is anything happening right now, is anything
   about to stop me working, and what has the fleet been doing. */
export default function AmbulanceHome() {
  const { operator, fleet, trips, live, vehicle } = useAmbulance()

  const available = fleet.filter((a) => a.status === 'Available').length
  const offRoad = fleet.filter((a) => a.status === 'Off duty' || a.status === 'Maintenance').length
  const completed = trips.filter((t) => t.status === 'Completed').length
  const licenceIssues = fleet.filter((a) => {
    const left = daysLeft(a.licenseExpiry)
    return left !== null && left <= LICENCE_WARN_DAYS
  })

  const recent = [...trips]
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0))
    .slice(0, 6)

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Dispatch overview</h1>
          <p className="pf-sub">{operator}</p>
        </div>
      </header>

      <section className="pf-cards" style={{ marginBottom: 18 }}>
        <div className="pf-card">
          <div className="pf-card-head">
            <Ambulance size={16} /> Available now
          </div>
          <div className="pf-card-big">{available}</div>
          <div className="pf-card-line muted">
            of {fleet.length} enlisted{offRoad ? ` · ${offRoad} off the road` : ''}
          </div>
          <Link className="pf-card-link" to="/ambulance/fleet">
            Manage fleet <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Route size={16} /> Live trips
          </div>
          <div className="pf-card-big">{live.length}</div>
          <div className="pf-card-line muted">
            {live.length === 0 ? 'nothing under way' : 'patients waiting or on board'}
          </div>
          <Link className="pf-card-link" to="/ambulance/trips">
            Open dispatch <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <CircleCheck size={16} /> Completed
          </div>
          <div className="pf-card-big">{completed}</div>
          <div className="pf-card-line muted">trips in the log</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <IdCard size={16} /> Licences to watch
          </div>
          <div className="pf-card-big">{licenceIssues.length}</div>
          <div className="pf-card-line muted">
            {licenceIssues.length === 0 ? 'all valid' : `within ${LICENCE_WARN_DAYS} days or expired`}
          </div>
          <Link className="pf-card-link" to="/ambulance/drivers">
            Check drivers <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {licenceIssues.length > 0 && (
        <div className="pf-warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <span>
            {licenceIssues.map((a) => `${a.driverName} (${a.regNo})`).join(', ')} — check the licence
            before the next dispatch.
          </span>
        </div>
      )}

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Route size={15} /> Recent trips
          <span className="count">{recent.length}</span>
        </div>
        <div className="pf-panel-body">
          {recent.length === 0 && (
            <p className="pf-empty">
              No trips yet. When a patient requests one of your vehicles from their app, it lands
              here and on the dispatch board.
            </p>
          )}
          {recent.map((t) => {
            const v = vehicle(t.ambulanceId)
            return (
              <div className="pf-row" key={t.resourceId}>
                <div>
                  <div className="pf-row-title">
                    {t.patient} — {t.ambulanceId}
                    {v ? ` (${v.regNo})` : ''}
                  </div>
                  <div className="pf-row-sub">
                    {t.pickup || '—'}
                    {t.destination ? ` → ${t.destination}` : ''}
                    {t.requestedAt ? ` · ${relTime(t.requestedAt)}` : ''}
                  </div>
                </div>
                <span
                  className={`pill tone-${
                    t.status === 'Completed'
                      ? 'green'
                      : t.status === 'Cancelled'
                        ? 'rose'
                        : t.status === 'Arrived'
                          ? 'blue'
                          : 'amber'
                  }`}
                >
                  {t.status}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
