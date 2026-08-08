import { Link } from 'react-router-dom'
import { Pill, ClipboardPen, ShieldAlert, Check, CheckCircle2, Store, Truck } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'

const TONE = {
  Issued: 'green',
  Verified: 'teal',
  'Partially dispensed': 'amber',
  Dispensed: 'blue',
  'Out for delivery': 'violet',
  Delivered: 'green',
  Refill: 'violet',
  Interaction: 'rose',
  Allergy: 'rose',
  Rejected: 'rose',
}

export default function DoctorPrescribe() {
  const { mine, me } = useDoctor()
  const { patch } = useData()
  const toast = useToast()

  const rows = mine('prescriptions')
  const holds = rows.filter(
    (r) => r.status === 'Interaction' || r.status === 'Allergy' || r.status === 'Refill'
  )

  const authoriseRefill = (r) => {
    patch(
      'prescriptions',
      r.resourceId,
      { status: 'Issued', flag: 'None', refills: Math.max(0, Number(r.refills || 1) - 1), issuedAt: Date.now() },
      { title: 'Refill authorised', sub: `${r.resourceId} · ${r.patient}` }
    )
    toast.success('Refill authorised and sent to the pharmacy', { title: r.drug })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Prescriptions</h1>
          <p className="pf-sub">
            {holds.length
              ? `${holds.length} need${holds.length > 1 ? '' : 's'} a decision from you.`
              : 'Nothing on hold.'}
          </p>
        </div>
        {/* Writing happens on the Rx pad — one entry point, one workflow. */}
        <Link className="btn btn-primary" to="/doctor/pad">
          <ClipboardPen size={16} /> Rx
        </Link>
      </header>

      {holds.length > 0 && (
        <section className="pf-panel" style={{ marginBottom: 14 }}>
          <div className="pf-panel-head">
            <ShieldAlert size={15} /> Needs a decision
            <span className="count">{holds.length}</span>
          </div>
          <div className="pf-panel-body">
            {holds.map((r) => (
              <div className="pf-row" key={r.resourceId}>
                <span className={`pf-dot tone-${r.status === 'Refill' ? 'violet' : 'rose'}`} />
                <div>
                  <div className="pf-row-title">
                    {r.drug} — {r.patient}
                  </div>
                  <div className="pf-row-sub">
                    {r.status === 'Refill'
                      ? `${r.refills || 0} refill(s) remaining · ${r.dosage}`
                      : `${r.status} flag raised · ${r.dosage}`}
                  </div>
                </div>
                <div className="pf-row-actions">
                  <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
                  {r.status === 'Refill' ? (
                    <button className="pf-btn ok" onClick={() => authoriseRefill(r)}>
                      <Check size={13} /> Authorise
                    </button>
                  ) : (
                    <button
                      className="pf-btn ok"
                      onClick={() => {
                        patch('prescriptions', r.resourceId, {
                          status: 'Issued',
                          flag: 'None',
                          overrideNote: `${r.status} flag accepted by ${me?.name}`,
                        }, { title: 'Safety flag accepted', sub: `${r.resourceId} · ${r.drug}` })
                        toast.success('Flag accepted — released to the pharmacy', { title: r.drug })
                      }}
                    >
                      <Check size={13} /> Accept &amp; release
                    </button>
                  )}
                  <button
                    className="pf-btn danger"
                    onClick={() => {
                      patch('prescriptions', r.resourceId, { status: 'Rejected' }, {
                        title: 'Prescription withdrawn',
                        sub: `${r.resourceId} · ${r.drug}`,
                      })
                      toast.info('Prescription withdrawn', { title: r.drug })
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Pill size={15} /> Everything you have prescribed
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              You have not prescribed anything yet.
            </p>
          )}
          {rows.map((r) => (
            <div className="pf-row" key={r.resourceId}>
              <div>
                <div className="pf-row-title">
                  {r.drug} — {r.patient}
                </div>
                <div className="pf-row-sub">
                  {r.dosage} · {r.qty ? `${r.qty} units · ` : ''}
                  {r.fulfilment === 'Home delivery' ? <Truck size={11} style={{ verticalAlign: -1 }} /> : <Store size={11} style={{ verticalAlign: -1 }} />}{' '}
                  {r.pharmacy || 'no pharmacy set'}
                </div>
              </div>
              <div className="pf-row-actions">
                {r.overrideNote && <span className="pill tone-amber">Flag accepted</span>}
                <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </>
  )
}
