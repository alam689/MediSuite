import { Truck, PackageCheck, Home, CheckCircle2, MapPin } from 'lucide-react'
import { useData, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { usePharmacy } from './PharmacyContext.jsx'

const TONE = { Dispensed: 'amber', 'Out for delivery': 'violet', Delivered: 'green' }

/* Home delivery is a separate stage from dispensing on purpose. A bag filled
   and sitting on the counter is not a medicine the patient has, and letting
   "Dispensed" mean both is how a patient is told their insulin arrived when
   it is still in the shop. */
export default function PharmacyDeliveries() {
  const { branch, deliveries } = usePharmacy()
  const { records, patch } = useData()
  const toast = useToast()

  const patients = records('patients')
  const addressOf = (rx) => {
    const p = patients.find((x) =>
      rx.patientId ? x.resourceId === rx.patientId : x.name === rx.patient
    )
    return p?.phone ? `${p.phone}` : 'no contact number on file'
  }

  const ready = deliveries.filter((d) => d.status === 'Dispensed')
  const enRoute = deliveries.filter((d) => d.status === 'Out for delivery')
  const done = deliveries.filter((d) => d.status === 'Delivered')

  const move = (rx, status, message) => {
    patch(
      'prescriptions',
      rx.resourceId,
      {
        status,
        ...(status === 'Out for delivery' ? { dispatchedAt: Date.now() } : {}),
        ...(status === 'Delivered' ? { deliveredAt: Date.now() } : {}),
      },
      { title: message, sub: `${rx.resourceId} · ${rx.patient}` }
    )
    toast.success(message, { title: rx.patient })
  }

  const Group = ({ icon: Icon, title, rows, action }) => (
    <section className="pf-panel" style={{ marginBottom: 14 }}>
      <div className="pf-panel-head">
        <Icon size={15} /> {title}
        <span className="count">{rows.length}</span>
      </div>
      <div className="pf-panel-body">
        {rows.length === 0 && <p className="pf-empty">Nothing here.</p>}
        {rows.map((r) => (
          <div className="pf-row" key={r.resourceId}>
            <span className={`pf-dot tone-${TONE[r.status] || 'teal'}`} />
            <div>
              <div className="pf-row-title">
                {r.patient} — {r.drug}
              </div>
              <div className="pf-row-sub">
                {r.dispensedQty || r.qty} unit(s) · <MapPin size={11} style={{ verticalAlign: -1 }} />{' '}
                {addressOf(r)}
                {r.dispatchedAt && r.status === 'Out for delivery' && ` · left ${relTime(r.dispatchedAt)}`}
                {r.deliveredAt && ` · delivered ${relTime(r.deliveredAt)}`}
              </div>
            </div>
            <div className="pf-row-actions">
              <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
              {action && action(r)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Deliveries</h1>
          <p className="pf-sub">
            Home deliveries from {branch}
            {ready.length ? ` — ${ready.length} ready to go out.` : '.'}
          </p>
        </div>
      </header>

      <section className="pf-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="pf-card">
          <div className="pf-card-head">
            <PackageCheck size={15} /> Packed
          </div>
          <div className="pf-card-big">{ready.length}</div>
          <div className="pf-card-line">filled, still in the shop</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Truck size={15} /> On the road
          </div>
          <div className="pf-card-big">{enRoute.length}</div>
          <div className="pf-card-line">out with a courier</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Home size={15} /> Delivered
          </div>
          <div className="pf-card-big">{done.length}</div>
          <div className="pf-card-line">confirmed with the patient</div>
        </div>
      </section>

      <Group
        icon={PackageCheck}
        title="Packed — ready to dispatch"
        rows={ready}
        action={(r) => (
          <button className="pf-btn go" onClick={() => move(r, 'Out for delivery', 'Sent out for delivery')}>
            <Truck size={13} /> Dispatch
          </button>
        )}
      />
      <Group
        icon={Truck}
        title="Out for delivery"
        rows={enRoute}
        action={(r) => (
          <button className="pf-btn ok" onClick={() => move(r, 'Delivered', 'Delivery confirmed')}>
            <CheckCircle2 size={13} /> Confirm delivered
          </button>
        )}
      />
      <Group icon={Home} title="Delivered" rows={done} />

      <p className="pf-note">
        <Truck size={14} />
        Confirming a delivery is what tells the patient's portal it arrived. Only mark it when the
        courier has confirmed hand-over — marking it early is worse than marking it late.
      </p>
    </>
  )
}
