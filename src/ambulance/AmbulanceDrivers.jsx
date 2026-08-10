import { IdCard, Phone, Ambulance, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useAmbulance, daysLeft, LICENCE_WARN_DAYS } from './AmbulanceContext.jsx'
import { prettyDate } from '../patient/helpers.js'

/* =====================================================================
   The crew roster, derived from the fleet rather than stored twice.

   A driver record kept separately from the vehicle would need reconciling
   the first time someone edited one and not the other — and the question
   that matters here ("who is driving AMB-203 today, and is their licence
   valid?") is answered by the enlistment itself.

   Sorted by how close the licence is to lapsing, because that is the only
   thing on this page that becomes urgent on its own.
   ===================================================================== */

export default function AmbulanceDrivers() {
  const { operator, fleet } = useAmbulance()

  const crew = [...fleet]
    .map((a) => ({ ...a, left: daysLeft(a.licenseExpiry) }))
    .sort((a, b) => (a.left ?? 99999) - (b.left ?? 99999))

  const expired = crew.filter((c) => c.left !== null && c.left < 0)
  const soon = crew.filter((c) => c.left !== null && c.left >= 0 && c.left <= LICENCE_WARN_DAYS)

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Drivers</h1>
          <p className="pf-sub">
            {operator} — {crew.length} driver(s) on the fleet.
          </p>
        </div>
      </header>

      {(expired.length > 0 || soon.length > 0) && (
        <div className="pf-warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <span>
            {expired.length > 0 && (
              <>
                <strong>{expired.length}</strong> licence(s) already expired
              </>
            )}
            {expired.length > 0 && soon.length > 0 && ' · '}
            {soon.length > 0 && (
              <>
                <strong>{soon.length}</strong> expiring within {LICENCE_WARN_DAYS} days
              </>
            )}
            . An expired licence does not stop the platform dispatching the vehicle — it stops you
            being allowed to. Change the driver or take the vehicle off duty.
          </span>
        </div>
      )}

      <section className="pf-panel">
        <div className="pf-panel-head">
          <IdCard size={15} /> Crew
          <span className="count">{crew.length}</span>
        </div>
        <div className="pf-panel-body">
          {crew.length === 0 && (
            <p className="pf-empty">
              No drivers yet — a driver is recorded when you enlist a vehicle on the Fleet page.
            </p>
          )}
          {crew.map((c) => {
            const bad = c.left !== null && c.left < 0
            const warn = c.left !== null && c.left >= 0 && c.left <= LICENCE_WARN_DAYS
            return (
              <div className="pf-row" key={c.resourceId}>
                <span className={`pf-dot tone-${bad ? 'rose' : warn ? 'amber' : 'green'}`} />
                <div>
                  <div className="pf-row-title">
                    {c.driverName || 'No driver recorded'}
                    {c.paramedic === 'Yes' && (
                      <span className="pill tone-teal" style={{ marginLeft: 8 }}>
                        Paramedic
                      </span>
                    )}
                  </div>
                  <div className="pf-row-sub">
                    <Ambulance size={11} /> {c.regNo} · {c.unitType} · {c.resourceId}
                    {c.driverPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${String(c.driverPhone).replace(/\s/g, '')}`}>
                          <Phone size={11} /> {c.driverPhone}
                        </a>
                      </>
                    )}
                  </div>
                  <div className="pf-row-sub">
                    Licence {c.driverLicense || '—'}
                    {c.licenseExpiry ? ` · expires ${prettyDate(c.licenseExpiry)}` : ' · no expiry recorded'}
                    {c.driverExperience !== '' && c.driverExperience !== undefined
                      ? ` · ${c.driverExperience} yrs driving`
                      : ''}
                  </div>
                </div>
                <div className="pf-row-actions">
                  <span className={`pill tone-${bad ? 'rose' : warn ? 'amber' : 'green'}`}>
                    {c.left === null
                      ? 'Expiry unknown'
                      : bad
                        ? `Expired ${Math.abs(c.left)}d ago`
                        : warn
                          ? `${c.left}d left`
                          : 'Valid'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <p className="pf-note" style={{ marginTop: 16 }}>
        <ShieldCheck size={13} />
        <span>
          Licence numbers are held for you and the regulator — patients are shown the driver's name
          and the vehicle, never the licence. Edit a driver on the <b>Fleet</b> page, where the crew
          is enlisted alongside the vehicle they drive.
        </span>
      </p>
    </>
  )
}
