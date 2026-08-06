import { useMemo, useState } from 'react'
import {
  ClipboardList,
  BadgeCheck,
  PackageCheck,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Store,
  ShieldAlert,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { usePharmacy } from './PharmacyContext.jsx'
import { daysUntil } from '../portal/format.js'

const TONE = {
  Issued: 'blue',
  Verified: 'teal',
  'Partially dispensed': 'amber',
  Dispensed: 'green',
}

/* How long a script stays fillable. Real validity is set by jurisdiction and
   drug class; one number for everything is a demo simplification, and it is
   deliberately visible in the UI rather than hidden in a constant nobody
   reads. */
const VALID_DAYS = 90

/* Recompute a shelf line's status after its count changes.

   Expiry outranks quantity: a full shelf of stock that expires next month is
   still "Expiring", and overwriting that with "In stock" because the number
   went up would hide the thing that actually matters. */
function stockStatus(item, nextQty) {
  const days = daysUntil(item.expiry)
  if (days !== null && days <= 60) return 'Expiring'
  if (nextQty <= Number(item.reorderLevel || 0)) return 'Low stock'
  return 'In stock'
}

/* Everything the pharmacist must be able to check before filling. Each entry
   is shown with its own pass/fail — a single "verified" tick would hide
   which check actually failed. */
function authenticityChecks(rx, doctors) {
  const prescriber = doctors.find((d) => d.resourceId === rx.doctorId)
  const age = rx.issuedAt ? Math.floor((Date.now() - rx.issuedAt) / 86400000) : null

  return [
    {
      label: 'Prescriber is a registered clinician',
      ok: !!prescriber,
      detail: prescriber
        ? `${prescriber.name} · ${prescriber.license}`
        : `No clinician record matches "${rx.doctor}"`,
    },
    {
      label: 'Prescriber licence is verified',
      ok: !!prescriber && prescriber.status !== 'In review',
      detail: !prescriber
        ? 'Cannot check — prescriber unknown'
        : prescriber.status === 'In review'
          ? 'Licence still awaiting verification'
          : 'Verified by the facility administrator',
    },
    {
      label: `Issued within ${VALID_DAYS} days`,
      /* No issue date is not a pass. An undated script is unverifiable, and
         treating "unknown" as "fine" is how an expired one gets filled. */
      ok: age !== null && age <= VALID_DAYS,
      detail:
        age === null
          ? 'No issue date recorded on this prescription'
          : age <= VALID_DAYS
            ? `Issued ${age} day(s) ago`
            : `Issued ${age} day(s) ago — beyond validity`,
    },
    {
      label: 'No unresolved clinical hold',
      ok: rx.flag !== 'Interaction' && rx.flag !== 'Allergy',
      detail:
        rx.flag === 'Interaction' || rx.flag === 'Allergy'
          ? `${rx.flag} flag${rx.overrideNote ? ` — ${rx.overrideNote}` : ' — not accepted by the prescriber'}`
          : 'None raised',
    },
  ]
}

export default function PharmacyQueue() {
  const { branch, queue, blocked, history, unrouted, stockFor, alternativesFor } = usePharmacy()
  const { records, patch } = useData()
  const toast = useToast()

  const doctors = records('doctors')
  const [verify, setVerify] = useState(null)
  const [fill, setFill] = useState(null)
  const [reject, setReject] = useState(null)
  const [error, setError] = useState('')

  const checks = useMemo(
    () => (verify ? authenticityChecks(verify, doctors) : []),
    [verify, doctors]
  )
  const allPass = checks.length > 0 && checks.every((c) => c.ok)

  /* ---- Verify ---- */
  const confirmVerify = () => {
    patch(
      'prescriptions',
      verify.resourceId,
      { status: 'Verified', verifiedBy: branch, verifiedAt: Date.now() },
      { title: 'Prescription verified', sub: `${verify.resourceId} · ${verify.drug}` }
    )
    toast.success('Verified — ready to fill', { title: verify.drug })
    setVerify(null)
  }

  /* ---- Dispense ---- */
  const openFill = (rx) => {
    const item = stockFor(rx.drug)
    const remaining = Math.max(0, Number(rx.qty || 0) - Number(rx.dispensedQty || 0))
    setError('')
    setFill({
      rx,
      item,
      alternatives: alternativesFor(rx.drug, item?.resourceId),
      /* Default to what can actually be handed over today, not to what was
         prescribed — offering 30 when 18 are on the shelf sets up an error. */
      qty: Math.min(remaining || 0, Number(item?.stock || 0)) || 0,
      remaining,
      substituteId: '',
      reason: '',
    })
  }

  const confirmFill = () => {
    const { rx, qty, remaining, substituteId, reason } = fill
    const n = Number(qty)
    if (!Number.isFinite(n) || n <= 0) return setError('Enter how many units you are handing over.')
    if (n > remaining) return setError(`This prescription only has ${remaining} unit(s) left to fill.`)

    const source = substituteId
      ? fill.alternatives.find((a) => a.resourceId === substituteId)
      : fill.item
    if (!source) return setError('No stock line selected — choose what you are dispensing from.')
    if (n > Number(source.stock || 0)) {
      return setError(`Only ${source.stock} unit(s) of ${source.name} on the shelf.`)
    }
    if (substituteId && !reason.trim()) {
      return setError('A substitution has to be justified — record why.')
    }

    const dispensed = Number(rx.dispensedQty || 0) + n
    const complete = dispensed >= Number(rx.qty || 0)

    patch(
      'prescriptions',
      rx.resourceId,
      {
        dispensedQty: dispensed,
        status: complete ? 'Dispensed' : 'Partially dispensed',
        dispensedBy: branch,
        dispensedAt: Date.now(),
        ...(substituteId
          ? {
              substitution: `${rx.drug} → ${source.name} (${reason.trim()})`,
              substitutedBy: branch,
            }
          : {}),
      },
      {
        title: complete ? 'Prescription dispensed' : 'Partially dispensed',
        sub: `${rx.resourceId} · ${n} of ${rx.qty} unit(s)${substituteId ? ' · substituted' : ''}`,
      }
    )

    const nextQty = Math.max(0, Number(source.stock || 0) - n)
    patch(
      'pharmacy',
      source.resourceId,
      { stock: nextQty, status: stockStatus(source, nextQty) },
      { title: `Stock down ${n}`, sub: `${source.name} · ${nextQty} left` }
    )

    toast.success(
      complete
        ? rx.fulfilment === 'Home delivery'
          ? 'Filled — ready to send out for delivery'
          : 'Filled — ready for the patient to collect'
        : `${n} unit(s) handed over, ${Number(rx.qty) - dispensed} still owed`,
      { title: rx.drug }
    )
    setFill(null)
  }

  /* ---- Reject ---- */
  const confirmReject = () => {
    if (!reject.reason.trim()) return setError('Say why — the prescriber and patient both see this.')
    patch(
      'prescriptions',
      reject.rx.resourceId,
      { status: 'Rejected', rejectedBy: branch, rejectionReason: reject.reason.trim() },
      { title: 'Prescription rejected', sub: `${reject.rx.resourceId} · ${reject.reason.trim()}` }
    )
    toast.warning('Rejected and returned to the prescriber', { title: reject.rx.drug })
    setReject(null)
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Prescription queue</h1>
          <p className="pf-sub">
            {queue.length
              ? `${queue.length} script${queue.length > 1 ? 's' : ''} to work through at ${branch}.`
              : `Nothing waiting at ${branch}.`}
          </p>
        </div>
      </header>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <ClipboardList size={15} /> Waiting
          <span className="count">{queue.length}</span>
        </div>
        <div className="pf-panel-body">
          {queue.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              The queue is clear.
            </p>
          )}
          {queue.map((r) => {
            const item = stockFor(r.drug)
            const remaining = Math.max(0, Number(r.qty || 0) - Number(r.dispensedQty || 0))
            const short = !item || Number(item.stock || 0) < remaining
            return (
              <div className="pf-row" key={r.resourceId}>
                <span className={`pf-dot tone-${TONE[r.status] || 'teal'}`} />
                <div>
                  <div className="pf-row-title">
                    {r.drug} — {r.patient}
                  </div>
                  <div className="pf-row-sub">
                    {r.dosage} · {remaining} of {r.qty} unit(s) to fill · {r.doctor} ·{' '}
                    {r.fulfilment === 'Home delivery' ? (
                      <>
                        <Truck size={11} style={{ verticalAlign: -1 }} /> delivery
                      </>
                    ) : (
                      <>
                        <Store size={11} style={{ verticalAlign: -1 }} /> collection
                      </>
                    )}
                    {short && (
                      <>
                        {' · '}
                        <strong style={{ color: 'var(--tone-rose)' }}>
                          {item ? `only ${item.stock} in stock` : 'not stocked here'}
                        </strong>
                      </>
                    )}
                  </div>
                </div>
                <div className="pf-row-actions">
                  {(r.flag === 'Interaction' || r.flag === 'Allergy') && (
                    <span className="pill tone-rose">
                      <ShieldAlert size={11} /> {r.flag}
                    </span>
                  )}
                  <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
                  {r.status === 'Issued' && (
                    <button className="pf-btn go" onClick={() => setVerify(r)}>
                      <BadgeCheck size={13} /> Verify
                    </button>
                  )}
                  {(r.status === 'Verified' || r.status === 'Partially dispensed') && (
                    <button className="pf-btn ok" onClick={() => openFill(r)}>
                      <PackageCheck size={13} /> Dispense
                    </button>
                  )}
                  <button
                    className="pf-btn danger"
                    onClick={() => {
                      setError('')
                      setReject({ rx: r, reason: '' })
                    }}
                  >
                    <Ban size={13} /> Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Not our queue and not history: the prescriber has to move first. */}
      <section className="pf-panel" style={{ marginTop: 14 }}>
        <div className="pf-panel-head">
          <ShieldAlert size={15} /> Held with the prescriber
          <span className="count">{blocked.length}</span>
        </div>
        <div className="pf-panel-body">
          {blocked.length === 0 && (
            <p className="pf-empty">Nothing is stuck with a prescriber.</p>
          )}
          {blocked.map((r) => (
            <div className="pf-row" key={r.resourceId}>
              <span className="pf-dot tone-rose" />
              <div>
                <div className="pf-row-title">
                  {r.drug} — {r.patient}
                </div>
                <div className="pf-row-sub">
                  {r.status === 'Refill'
                    ? `Refill needs authorising by ${r.doctor}`
                    : `${r.status} check outstanding with ${r.doctor}`}
                </div>
              </div>
              <span className="pill tone-rose">{r.status}</span>
            </div>
          ))}
        </div>
      </section>

      {blocked.length > 0 && (
        <p className="pf-note">
          <ShieldAlert size={14} />
          You cannot dispense these and there is no override — the hold is a clinical decision. If a
          patient is waiting, chase the prescriber rather than the queue.
        </p>
      )}

      {unrouted.length > 0 && (
        <p className="pf-note">
          <AlertTriangle size={14} />
          {unrouted.length} prescription(s) in the system have no dispensary set, so they are in no
          branch's queue and nobody is filling them. An administrator has to route them.
        </p>
      )}

      <section className="pf-panel" style={{ marginTop: 14 }}>
        <div className="pf-panel-head">
          <CheckCircle2 size={15} /> Completed &amp; closed
          <span className="count">{history.length}</span>
        </div>
        <div className="pf-panel-body">
          {history.length === 0 && <p className="pf-empty">Nothing dispensed here yet.</p>}
          {history.map((r) => (
            <div className="pf-row" key={r.resourceId}>
              <div>
                <div className="pf-row-title">
                  {r.drug} — {r.patient}
                </div>
                <div className="pf-row-sub">
                  {r.dispensedQty || 0} of {r.qty} unit(s)
                  {r.substitution ? ` · substituted: ${r.substitution}` : ''}
                  {r.rejectionReason ? ` · rejected: ${r.rejectionReason}` : ''}
                </div>
              </div>
              <span className={`pill tone-${r.status === 'Rejected' ? 'rose' : 'green'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Verify ---- */}
      <Modal
        open={!!verify}
        onClose={() => setVerify(null)}
        title="Verify prescription"
        subtitle={verify ? `${verify.resourceId} · ${verify.drug} · ${verify.patient}` : ''}
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setVerify(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmVerify} disabled={!allPass}>
              <BadgeCheck size={15} /> Verify
            </button>
          </>
        }
      >
        {verify && (
          <>
            <div className="pf-panel">
              <div className="pf-panel-body">
                {checks.map((c, i) => (
                  <div className="pf-row" key={i}>
                    <span className={`pf-dot tone-${c.ok ? 'green' : 'rose'}`} />
                    <div>
                      <div className="pf-row-title">{c.label}</div>
                      <div className="pf-row-sub">{c.detail}</div>
                    </div>
                    <span className={`pill tone-${c.ok ? 'green' : 'rose'}`}>
                      {c.ok ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {!allPass && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-rose)', marginTop: 14 }}>
                <ShieldAlert size={16} />
                <span>
                  <strong>Cannot verify.</strong> Contact the prescriber. There is deliberately no
                  override here — a pharmacist waving through a failed authenticity check is the
                  thing this screen exists to prevent.
                </span>
              </div>
            )}
            <p className="pf-hint">
              Validity is set at {VALID_DAYS} days for every drug class in this build. Real
              validity varies by jurisdiction and by schedule, and a production system must take it
              from policy rather than a constant.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Dispense ---- */}
      <Modal
        open={!!fill}
        onClose={() => setFill(null)}
        title="Dispense"
        subtitle={fill ? `${fill.rx.drug} · ${fill.rx.patient}` : ''}
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFill(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmFill}>
              <PackageCheck size={15} /> Hand over
            </button>
          </>
        }
      >
        {fill && (
          <>
            <div className="pf-form">
              <label className="pf-field">
                <span>Units to hand over</span>
                <input
                  className="pf-input"
                  type="number"
                  min="1"
                  max={fill.remaining}
                  value={fill.qty}
                  onChange={(e) => setFill({ ...fill, qty: Number(e.target.value) })}
                />
              </label>
              <label className="pf-field">
                <span>Still owed after this</span>
                <input
                  className="pf-input"
                  value={Math.max(0, fill.remaining - Number(fill.qty || 0))}
                  readOnly
                />
              </label>
              <div className="pf-field full">
                <span>Dispensing from</span>
                <select
                  className="pf-input"
                  value={fill.substituteId}
                  onChange={(e) => setFill({ ...fill, substituteId: e.target.value })}
                >
                  <option value="">
                    {fill.item
                      ? `${fill.item.name} — ${fill.item.stock} in stock (as prescribed)`
                      : 'Not stocked here — choose a substitute'}
                  </option>
                  {(fill.alternatives || []).map((a) => (
                    <option key={a.resourceId} value={a.resourceId}>
                      {a.name} — {a.stock} in stock (substitute)
                    </option>
                  ))}
                </select>
              </div>
              {fill.substituteId && (
                <label className="pf-field full">
                  <span>Why are you substituting?</span>
                  <input
                    className="pf-input"
                    value={fill.reason}
                    placeholder="e.g. prescribed brand out of stock, generic equivalent agreed"
                    onChange={(e) => setFill({ ...fill, reason: e.target.value })}
                  />
                </label>
              )}
            </div>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              Handing over reduces this branch's shelf count by the same number. A substitution is
              recorded on the prescription and is visible to the prescriber and the patient — record
              it only where it is legally and clinically permitted.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Reject ---- */}
      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title="Reject prescription"
        subtitle={reject ? `${reject.rx.resourceId} · ${reject.rx.drug}` : ''}
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReject(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmReject}>
              <Ban size={15} /> Reject
            </button>
          </>
        }
      >
        {reject && (
          <>
            <label className="pf-field full">
              <span>Reason</span>
              <textarea
                className="pf-input"
                rows={3}
                value={reject.reason}
                placeholder="e.g. dose exceeds maximum, illegible, patient reports adverse reaction"
                onChange={(e) => setReject({ ...reject, reason: e.target.value })}
              />
            </label>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              This returns the script to the prescriber with your reason attached. The patient sees
              that it could not be filled and is told to contact their doctor — not left waiting.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
