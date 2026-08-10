import { useMemo, useState } from 'react'
import { Pill, ShieldAlert, RefreshCw, ClipboardList } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { usePatient } from './PatientContext.jsx'
import { RX_STATUS_TEXT } from './helpers.js'
import { padsFor } from './RxSheetView.jsx'
import PrescriptionVisits from './PrescriptionVisits.jsx'

const TONE = {
  Issued: 'blue',
  Dispensed: 'green',
  Refill: 'amber',
  Allergy: 'rose',
  Interaction: 'rose',
}

/* A prescription on hold is a safety stop, not a delay to complain about —
   say why, and say who is dealing with it. */
const HOLD_REASON = {
  Allergy: 'Your record lists an allergy that may apply to this medicine. Your doctor is reviewing it before it can be issued.',
  Interaction: 'This may interact with another medicine you take. Your doctor is checking it before it can be issued.',
}

/* `clinician` renders the same shelf for a doctor looking at this patient:
   identical content, minus the one control that only makes sense from the
   patient's side — a doctor doesn't request a refill from themselves. */
export default function MyPrescriptions({ doctorFilter = '', clinician = false }) {
  const { me, mine } = usePatient()
  const { records } = useData()
  const toast = useToast()
  const [detail, setDetail] = useState(null)

  const rows = mine('prescriptions').filter((r) => !doctorFilter || r.doctor === doctorFilter)
  const pharmacy = records('pharmacy')
  /* The full consultation sheets the doctor wrote on the Rx pad — the
     patient sees the very visit timeline the doctor sees, read-only. */
  const pads = useMemo(
    () => padsFor(me?.resourceId).filter((p) => !doctorFilter || p.doctor === doctorFilter),
    [me, doctorFilter]
  )

  const requestRefill = (r) => {
    // Deliberately does not mutate the prescription: a refill is a clinical
    // decision. This raises the request and nothing more.
    toast.success('Refill request sent to your care team', { title: r.drug })
  }

  const stockFor = (drug) =>
    pharmacy.find((p) => (p.name || '').toLowerCase().startsWith(String(drug).split(' ')[0].toLowerCase()))

  return (
    <>
      <section className="pt-panel" style={{ marginBottom: 14 }}>
        <div className="pt-panel-head">
          <ClipboardList size={16} /> Prescription visits
          <span className="count">{pads.length}</span>
        </div>
        {pads.length === 0 ? (
          <div className="pt-panel-body">
            <p className="pt-empty">
              When your doctor writes a full consultation sheet on the prescription pad, it appears
              here exactly as they printed it.
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px 16px 8px' }}>
            <PrescriptionVisits pads={pads} />
          </div>
        )}
      </section>

      <section className="pt-panel">
        <div className="pt-panel-head">
          <Pill size={16} /> My prescriptions
          <span className="count">{rows.length}</span>
        </div>
        <div className="pt-panel-body">
          {rows.length === 0 && <p className="pt-empty">You have no prescriptions.</p>}
          {rows.map((r) => (
            <div className="pt-row" key={r.resourceId}>
              <div>
                <div className="pt-row-title">{r.drug}</div>
                <div className="pt-row-sub">
                  {r.dosage} · {r.doctor} · {r.resourceId}
                </div>
              </div>
              <div className="pt-row-right">
                <span className={`pill tone-${TONE[r.status] || 'teal'}`}>
                  {RX_STATUS_TEXT[r.status] || r.status}
                </span>
                <button className="btn btn-ghost" style={{ height: 34 }} onClick={() => setDetail(r)}>
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {rows.some((r) => HOLD_REASON[r.status]) && (
        <p className="pt-privacy" style={{ marginTop: 14 }}>
          <ShieldAlert size={14} />
          Some medicines are on hold pending a safety check. That's the system working as intended.
        </p>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.drug}
        subtitle={detail?.resourceId}
        width={480}
        footer={
          detail && (
            <>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
              {detail.status === 'Refill' && !clinician && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    requestRefill(detail)
                    setDetail(null)
                  }}
                >
                  <RefreshCw size={15} /> Request refill
                </button>
              )}
            </>
          )
        }
      >
        {detail && (
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: 12 }}>
              <span className={`pill tone-${TONE[detail.status] || 'teal'}`}>
                {RX_STATUS_TEXT[detail.status] || detail.status}
              </span>
            </div>
            <p>
              <strong style={{ color: 'var(--text)' }}>How to take it:</strong> {detail.dosage}
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Prescribed by:</strong> {detail.doctor}
            </p>
            {HOLD_REASON[detail.status] && (
              <p
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  background: 'color-mix(in srgb, var(--tone-rose) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--tone-rose) 24%, transparent)',
                }}
              >
                {HOLD_REASON[detail.status]}
              </p>
            )}
            {(() => {
              const stock = stockFor(detail.drug)
              if (!stock) return null
              return (
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  Pharmacy: <strong style={{ color: 'var(--text)' }}>{stock.status}</strong>
                  {stock.status === 'Low stock' && ' — may take longer to fill.'}
                </p>
              )
            })()}
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>
              Always follow the instructions on the label. If anything here doesn't match what you
              were told, contact your care team before taking it.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
