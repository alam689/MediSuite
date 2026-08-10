import { useState } from 'react'
import { Route, Phone, MapPin, CheckCircle2, X, Clock, Ambulance } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { relTime } from '../store/DataStore.jsx'
import { useAmbulance, LIVE_TRIP } from './AmbulanceContext.jsx'

/* =====================================================================
   Dispatch board. A patient requesting a vehicle on their own app is the
   same event as a phone call to the control room, so it lands here as a
   trip the moment they press Request.

   Closing a trip is what puts the vehicle back on the patient's map, so
   both endings — Completed and Cancelled — release it. A trip left open
   quietly removes a working ambulance from the city.
   ===================================================================== */

const TONE = { Dispatched: 'amber', Arrived: 'blue', Completed: 'green', Cancelled: 'rose' }

export default function AmbulanceTrips() {
  const { operator, trips, live, vehicle } = useAmbulance()
  const { patch } = useData()
  const toast = useToast()
  const [cancelling, setCancelling] = useState(null)

  const past = trips
    .filter((t) => !LIVE_TRIP.includes(t.status))
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0))

  /* Releasing the vehicle is part of ending the trip, not a separate step
     someone has to remember. */
  const release = (t) => {
    const v = vehicle(t.ambulanceId)
    if (v && v.status === 'On another trip') {
      patch('ambulances', v.resourceId, { status: 'Available', updatedAt: Date.now() }, {
        title: 'Vehicle back on duty',
        sub: `${v.resourceId} · ${v.regNo}`,
      })
    }
  }

  const arrive = (t) => {
    patch('ambulanceTrips', t.resourceId, { status: 'Arrived', arrivedAt: Date.now() }, {
      title: 'Ambulance arrived at patient',
      sub: `${t.resourceId} · ${t.patient} · ${t.ambulanceId}`,
    })
    toast.success('Marked as arrived.', { title: t.patient })
  }

  const complete = (t) => {
    patch('ambulanceTrips', t.resourceId, { status: 'Completed', completedAt: Date.now() }, {
      title: 'Trip completed',
      sub: `${t.resourceId} · ${t.patient} · ${t.ambulanceId}`,
    })
    release(t)
    toast.success('Trip completed — vehicle back on duty.', { title: t.resourceId })
  }

  const cancel = () => {
    const t = cancelling
    setCancelling(null)
    patch('ambulanceTrips', t.resourceId, { status: 'Cancelled', cancelledBy: operator }, {
      title: 'Trip cancelled by operator',
      sub: `${t.resourceId} · ${t.patient} · ${t.ambulanceId}`,
    })
    release(t)
    toast.info('Trip cancelled — the patient sees this on their tracker.', { title: t.resourceId })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Trips</h1>
          <p className="pf-sub">
            {operator} — {live.length} live, {trips.length} in the log.
          </p>
        </div>
      </header>

      <section className="pf-panel" style={{ marginBottom: 14 }}>
        <div className="pf-panel-head">
          <Ambulance size={15} /> Live now
          <span className="count">{live.length}</span>
        </div>
        <div className="pf-panel-body">
          {live.length === 0 && (
            <p className="pf-empty">
              Nothing under way. A patient requesting one of your vehicles appears here immediately.
            </p>
          )}
          {live.map((t) => {
            const v = vehicle(t.ambulanceId)
            return (
              <div className="pf-row" key={t.resourceId}>
                <span className={`pf-dot tone-${TONE[t.status]}`} />
                <div>
                  <div className="pf-row-title">
                    {t.patient} — {t.ambulanceId}
                    {v ? ` (${v.regNo})` : ''}
                  </div>
                  <div className="pf-row-sub">
                    <MapPin size={11} /> {t.pickup || 'pickup not given'}
                    {t.destination ? ` → ${t.destination}` : ''} · {t.unitType || v?.unitType || '—'}
                    {v?.driverName ? ` · driver ${v.driverName}` : ''}
                    {t.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${String(t.phone).replace(/\s/g, '')}`}>
                          <Phone size={11} /> {t.phone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="pf-row-actions">
                  <span className={`pill tone-${TONE[t.status]}`}>
                    {t.status === 'Dispatched' ? `On the way · ETA ${t.etaMin || '?'}m` : 'At the patient'}
                  </span>
                  {t.status === 'Dispatched' && (
                    <button className="pf-btn go" onClick={() => arrive(t)}>
                      <MapPin size={13} /> Arrived
                    </button>
                  )}
                  <button className="pf-btn ok" onClick={() => complete(t)}>
                    <CheckCircle2 size={13} /> Complete
                  </button>
                  <button className="pf-btn danger" onClick={() => setCancelling(t)}>
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Route size={15} /> Trip log
          <span className="count">{past.length}</span>
        </div>
        <div className="pf-panel-body">
          {past.length === 0 && <p className="pf-empty">No finished trips yet.</p>}
          {past.map((t) => (
            <div className="pf-row" key={t.resourceId}>
              <span className={`pf-dot tone-${TONE[t.status]}`} />
              <div>
                <div className="pf-row-title">
                  {t.patient} — {t.ambulanceId}
                </div>
                <div className="pf-row-sub">
                  {t.pickup || '—'}
                  {t.destination ? ` → ${t.destination}` : ''} · {t.resourceId}
                  {t.requestedAt && (
                    <>
                      {' · '}
                      <Clock size={11} /> requested {relTime(t.requestedAt)}
                    </>
                  )}
                </div>
              </div>
              <span className={`pill tone-${TONE[t.status]}`}>{t.status}</span>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this trip?"
        subtitle={cancelling ? `${cancelling.resourceId} · ${cancelling.patient}` : ''}
        width={430}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCancelling(null)}>
              Keep it
            </button>
            <button className="btn btn-ghost pf-danger-btn" onClick={cancel}>
              Cancel trip
            </button>
          </>
        }
      >
        {cancelling && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {cancelling.patient} is watching this vehicle move towards them right now. Cancelling
            stops that tracker and puts {cancelling.ambulanceId} back on duty.{' '}
            {cancelling.phone ? (
              <>
                Call <b>{cancelling.phone}</b> first — someone waiting for an ambulance should hear
                it from a person, not from a screen.
              </>
            ) : (
              'There is no contact number on this request, so they will only see it on screen.'
            )}
          </p>
        )}
      </Modal>
    </>
  )
}
