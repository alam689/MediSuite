import { useState } from 'react'
import {
  TestTube,
  Barcode,
  ArrowRightCircle,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useLab, COLLECTED, ON_BENCH } from './LabContext.jsx'

const PRIORITY_TONE = { STAT: 'rose', Urgent: 'amber', Routine: 'blue' }

/* Sample intake: the stage between a doctor asking for a test and a bench
   having something to run. Two things happen here and both matter — the
   sample is physically taken, and it is given an accession number that ties
   the tube to the request. A tube with no accession is a tube nobody can
   match to a patient. */
export default function LabOrders() {
  const { lab, buckets, prioritised, unrouted } = useLab()
  const { patch } = useData()
  const toast = useToast()

  const [collect, setCollect] = useState(null)
  const [reject, setReject] = useState(null)
  const [error, setError] = useState('')

  const awaiting = prioritised(buckets.awaitingSample)
  const collected = prioritised(buckets.collected)

  const openCollect = (o) => {
    setError('')
    /* Suggest an accession from the order id so the default is traceable
       rather than random, but leave it editable — most labs print their own. */
    setCollect({ order: o, accession: o.accession || `ACC-${String(o.resourceId).split('-')[1] || ''}` })
  }

  const confirmCollect = () => {
    const { order, accession } = collect
    if (!accession.trim()) return setError('An accession number is required to log the sample.')

    patch(
      'laboratory',
      order.resourceId,
      { status: COLLECTED, accession: accession.trim(), collectedAt: Date.now() },
      { title: 'Sample collected', sub: `${order.resourceId} · ${accession.trim()}` }
    )
    toast.success(`Sample logged as ${accession.trim()}`, { title: order.patient })
    setCollect(null)
  }

  const receive = (o) => {
    patch(
      'laboratory',
      o.resourceId,
      { status: ON_BENCH, receivedAt: Date.now() },
      { title: 'Sample received at the bench', sub: `${o.resourceId} · ${o.accession}` }
    )
    toast.success('Booked in at the bench', { title: `${o.test} · ${o.patient}` })
  }

  const confirmReject = () => {
    if (!reject.reason.trim()) return setError('Say why — a repeat draw needs a reason.')
    patch(
      'laboratory',
      reject.order.resourceId,
      { status: 'Rejected', rejectionReason: reject.reason.trim(), rejectedBy: lab },
      { title: 'Sample rejected', sub: `${reject.order.resourceId} · ${reject.reason.trim()}` }
    )
    toast.warning('Rejected — the requester has been told a repeat is needed', {
      title: reject.order.patient,
    })
    setReject(null)
  }

  const Row = ({ o, children }) => (
    <div className="pf-row" key={o.resourceId}>
      <span className={`pf-dot tone-${PRIORITY_TONE[o.priority] || 'blue'}`} />
      <div>
        <div className="pf-row-title">
          {o.test} — {o.patient}
        </div>
        <div className="pf-row-sub">
          {o.sample} · {o.doctor || 'no requester recorded'} ·{' '}
          {o.accession || 'no accession yet'}
          {o.orderedAt && ` · ordered ${relTime(o.orderedAt)}`}
          {o.clinicalNote && ` · ${o.clinicalNote}`}
        </div>
      </div>
      <div className="pf-row-actions">
        {o.priority !== 'Routine' && (
          <span className={`pill tone-${PRIORITY_TONE[o.priority]}`}>{o.priority}</span>
        )}
        {children}
      </div>
    </div>
  )

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Sample intake</h1>
          <p className="pf-sub">
            {awaiting.length
              ? `${awaiting.length} sample${awaiting.length > 1 ? 's' : ''} still to collect at ${lab}.`
              : `Nothing awaiting collection at ${lab}.`}
          </p>
        </div>
      </header>

      <section className="pf-panel" style={{ marginBottom: 14 }}>
        <div className="pf-panel-head">
          <TestTube size={15} /> Awaiting collection
          <span className="count">{awaiting.length}</span>
        </div>
        <div className="pf-panel-body">
          {awaiting.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              Every requested sample has been taken.
            </p>
          )}
          {awaiting.map((o) => (
            <Row o={o} key={o.resourceId}>
              <button className="pf-btn go" onClick={() => openCollect(o)}>
                <Barcode size={13} /> Log sample
              </button>
              <button
                className="pf-btn danger"
                onClick={() => {
                  setError('')
                  setReject({ order: o, reason: '' })
                }}
              >
                <Ban size={13} /> Reject
              </button>
            </Row>
          ))}
        </div>
      </section>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <ArrowRightCircle size={15} /> Collected — in transit to the bench
          <span className="count">{collected.length}</span>
        </div>
        <div className="pf-panel-body">
          {collected.length === 0 && <p className="pf-empty">Nothing in transit.</p>}
          {collected.map((o) => (
            <Row o={o} key={o.resourceId}>
              <button className="pf-btn ok" onClick={() => receive(o)}>
                <CheckCircle2 size={13} /> Receive at bench
              </button>
              <button
                className="pf-btn danger"
                onClick={() => {
                  setError('')
                  setReject({ order: o, reason: '' })
                }}
              >
                <Ban size={13} /> Reject
              </button>
            </Row>
          ))}
        </div>
      </section>

      <p className="pf-note">
        <Clock size={14} />
        STAT and urgent requests are sorted to the top of both lists, oldest first within each
        band. The order they were entered in is not the order they matter in.
      </p>

      {unrouted.length > 0 && (
        <p className="pf-note">
          <AlertTriangle size={14} />
          {unrouted.length} lab order(s) platform-wide name no laboratory, so they are on no bench's
          worklist. An administrator has to route them.
        </p>
      )}

      {/* ---- Log sample ---- */}
      <Modal
        open={!!collect}
        onClose={() => setCollect(null)}
        title="Log sample"
        subtitle={collect ? `${collect.order.test} · ${collect.order.patient}` : ''}
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCollect(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmCollect}>
              <Barcode size={15} /> Log it
            </button>
          </>
        }
      >
        {collect && (
          <>
            <label className="pf-field full">
              <span>Accession number</span>
              <input
                className="pf-input"
                value={collect.accession}
                onChange={(e) => setCollect({ ...collect, accession: e.target.value })}
              />
            </label>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              This is the number written on the tube. It is the only thing linking the physical
              sample back to {collect.order.patient} — an unlabelled sample is a discarded sample,
              and stamping the collection time is what makes turnaround measurable.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Reject sample ---- */}
      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title="Reject sample"
        subtitle={reject ? `${reject.order.test} · ${reject.order.patient}` : ''}
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
                placeholder="e.g. haemolysed, insufficient volume, wrong tube, unlabelled"
                onChange={(e) => setReject({ ...reject, reason: e.target.value })}
              />
            </label>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              Rejecting tells the requester a repeat is needed. Saying so is the whole point —
              a sample quietly discarded becomes a result the doctor waits forever for.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
