import { useMemo, useState } from 'react'
import { FileCheck, Clock, AlertTriangle, Ban, CheckCircle2 } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useLab } from './LabContext.jsx'
import { outOfRange, turnaround } from '../portal/format.js'

const TONE = {
  'Ready to approve': 'amber',
  Abnormal: 'rose',
  Approved: 'green',
  Rejected: 'rose',
}

/* Everything this lab has finished with, plus the one number a lab is judged
   on: turnaround. Measured from order to report, because that is the wait the
   patient and the requesting clinician actually experience — not the shorter
   bench-to-report time a lab would rather quote. */
export default function LabReports() {
  const { lab, buckets } = useLab()
  const [view, setView] = useState(null)

  const reported = buckets.reported
  const released = buckets.released
  const rejected = buckets.rejected

  const stats = useMemo(() => {
    const done = [...reported, ...released].filter((o) => o.orderedAt && o.reportedAt)
    if (done.length === 0) return { count: 0, median: null, slowest: null }
    const spans = done
      .map((o) => ({ o, ms: o.reportedAt - o.orderedAt }))
      .sort((a, b) => a.ms - b.ms)
    /* Median, not mean: one sample that sat over a weekend drags an average
       into telling you nothing about a normal day. */
    const mid = spans[Math.floor(spans.length / 2)]
    return { count: spans.length, median: mid.ms, slowest: spans[spans.length - 1] }
  }, [reported, released])

  const Group = ({ icon: Icon, title, rows, note }) => (
    <section className="pf-panel" style={{ marginBottom: 14 }}>
      <div className="pf-panel-head">
        <Icon size={15} /> {title}
        <span className="count">{rows.length}</span>
      </div>
      <div className="pf-panel-body">
        {rows.length === 0 && <p className="pf-empty">{note || 'Nothing here.'}</p>}
        {rows.map((o) => {
          const flagged = (o.analytes || []).filter((a) => outOfRange(a) === true)
          const tat = turnaround(o.orderedAt, o.reportedAt)
          return (
            <button className="pf-row" key={o.resourceId} onClick={() => setView(o)}>
              <span className={`pf-dot tone-${TONE[o.status] || 'teal'}`} />
              <div>
                <div className="pf-row-title">
                  {o.test} — {o.patient}
                </div>
                <div className="pf-row-sub">
                  {o.accession || 'no accession'} · {o.doctor}
                  {flagged.length > 0 && ` · ${flagged.length} out of range`}
                  {tat && ` · turnaround ${tat}`}
                  {o.rejectionReason && ` · ${o.rejectionReason}`}
                </div>
              </div>
              <div className="pf-row-actions">
                {o.verifiedBy && <span className="pill tone-teal">{o.verifiedBy}</span>}
                <span className={`pill tone-${TONE[o.status] || 'teal'}`}>{o.status}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Reports</h1>
          <p className="pf-sub">What {lab} has reported, and how long it took.</p>
        </div>
      </header>

      <section className="pf-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="pf-card">
          <div className="pf-card-head">
            <Clock size={15} /> Median turnaround
          </div>
          <div className="pf-card-big">
            {stats.median === null ? '—' : turnaround(0, stats.median)}
          </div>
          <div className="pf-card-line">
            {stats.count === 0 ? 'nothing reported yet' : `across ${stats.count} report(s)`}
          </div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <AlertTriangle size={15} /> With the clinician
          </div>
          <div className="pf-card-big">{reported.length}</div>
          <div className="pf-card-line">reported, awaiting release</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <CheckCircle2 size={15} /> Released
          </div>
          <div className="pf-card-big">{released.length}</div>
          <div className="pf-card-line">the patient can see these</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Ban size={15} /> Rejected
          </div>
          <div className="pf-card-big">{rejected.length}</div>
          <div className="pf-card-line">repeat sample needed</div>
        </div>
      </section>

      {stats.slowest && (
        <p className="pf-note" style={{ marginTop: 0, marginBottom: 14 }}>
          <Clock size={14} />
          Slowest recently: <strong>{stats.slowest.o.test}</strong> for {stats.slowest.o.patient} at{' '}
          {turnaround(0, stats.slowest.ms)}. Median is the number to plan against; this is the one
          to explain.
        </p>
      )}

      <Group
        icon={AlertTriangle}
        title="Reported — waiting on the clinician"
        rows={reported}
        note="Nothing is waiting on a clinician."
      />
      <Group
        icon={CheckCircle2}
        title="Released to the patient"
        rows={released}
        note="Nothing has been released yet."
      />
      <Group icon={Ban} title="Rejected samples" rows={rejected} note="No samples rejected." />

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view ? `${view.test} — ${view.patient}` : ''}
        subtitle={view ? `${view.resourceId} · ${view.accession || 'no accession'}` : ''}
        width={640}
        footer={
          <button className="btn btn-ghost" onClick={() => setView(null)}>
            Close
          </button>
        }
      >
        {view && (
          <>
            {view.result && (
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                <strong>Summary:</strong> {view.result}
              </p>
            )}
            {(view.analytes || []).length > 0 ? (
              <div className="pf-scroll">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th>Analyte</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.analytes.map((a, i) => {
                      const bad = outOfRange(a)
                      return (
                        <tr key={i}>
                          <td>{a.name}</td>
                          <td className={`num ${bad === true ? 'out' : ''}`}>{a.value}</td>
                          <td>{a.unit}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {a.low || a.high
                              ? `${a.low || '—'} – ${a.high || '—'}`
                              : 'not recorded — unchecked'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="pf-empty">No analyte-level results recorded.</p>
            )}
            {view.interpretation && (
              <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.7 }}>
                <strong>Interpretation:</strong> {view.interpretation}
              </p>
            )}
            <p className="pf-hint">
              Ordered {view.orderedAt ? new Date(view.orderedAt).toLocaleString() : 'date unknown'}
              {view.collectedAt && ` · collected ${new Date(view.collectedAt).toLocaleString()}`}
              {view.reportedAt && ` · reported ${new Date(view.reportedAt).toLocaleString()}`}
              {view.verifiedBy && ` · verified by ${view.verifiedBy}`}
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
