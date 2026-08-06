import { useState } from 'react'
import { FlaskConical, Plus, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, newId, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { LABS, schemaMap } from '../data/schemas.js'
import { outOfRange, turnaround } from '../portal/format.js'

const TONE = {
  Ordered: 'violet',
  'Sample collected': 'teal',
  'In lab': 'blue',
  'Ready to approve': 'amber',
  Abnormal: 'rose',
  Approved: 'green',
  Rejected: 'rose',
}

const TESTS =
  schemaMap.laboratory?.formFields?.find((f) => f.key === 'test')?.options || ['CBC']

const blank = {
  test: 'CBC',
  patient: '',
  lab: LABS[0],
  priority: 'Routine',
  sample: 'Blood',
  clinicalNote: '',
}

export default function DoctorLabs() {
  const { mine, panel, filedAs, me } = useDoctor()
  const { add, patch } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState(null)

  const rows = mine('laboratory')
  const awaiting = rows.filter((l) => l.status === 'Ready to approve' || l.status === 'Abnormal')

  const order = () => {
    if (!draft.patient.trim()) return setError('Choose the patient.')
    const patient = panel.find((p) => p.name === draft.patient)
    const resourceId = newId('LAB')
    add(
      'laboratory',
      {
        ...draft,
        resourceId,
        doctor: filedAs,
        doctorId: me?.resourceId,
        patientId: patient?.resourceId,
        status: 'Ordered',
        result: '',
        analytes: [],
        documents: [],
        orderedAt: Date.now(),
      },
      { title: 'Lab test ordered', sub: `${resourceId} · ${draft.patient} · ${draft.test}` }
    )
    toast.success(`${draft.test} ordered from ${draft.lab}`, { title: draft.patient })
    setDraft(null)
  }

  /* Approving a result is what releases it to the patient's portal, so it is
     the doctor's action and not the lab's — the lab verifies the number, the
     clinician decides the patient should see it. */
  const release = (l) => {
    patch(
      'laboratory',
      l.resourceId,
      { status: 'Approved', reportedAt: l.reportedAt || Date.now(), releasedBy: me?.name },
      { title: 'Result approved & released', sub: `${l.resourceId} · ${l.patient}` }
    )
    toast.success('Released to the patient', { title: `${l.test} · ${l.patient}` })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Lab orders</h1>
          <p className="pf-sub">
            {awaiting.length
              ? `${awaiting.length} result${awaiting.length > 1 ? 's' : ''} waiting on your review.`
              : 'No results waiting on you.'}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('')
            setDraft({ ...blank, patient: panel[0]?.name || '' })
          }}
        >
          <Plus size={16} /> Order a test
        </button>
      </header>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <FlaskConical size={15} /> My orders
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              You have not ordered any tests.
            </p>
          )}
          {rows.map((l) => {
            const flagged = (l.analytes || []).filter((a) => outOfRange(a) === true)
            const tat = turnaround(l.orderedAt, l.reportedAt)
            return (
              <div className="pf-row" key={l.resourceId}>
                <span className={`pf-dot tone-${TONE[l.status] || 'teal'}`} />
                <div>
                  <div className="pf-row-title">
                    {l.test} — {l.patient}
                  </div>
                  <div className="pf-row-sub">
                    {l.lab} · {l.priority}
                    {flagged.length > 0 && ` · ${flagged.length} value(s) out of range`}
                    {tat && ` · turnaround ${tat}`}
                    {!tat && l.orderedAt && ` · ordered ${relTime(l.orderedAt)}`}
                  </div>
                </div>
                <div className="pf-row-actions">
                  {l.priority === 'STAT' && <span className="pill tone-rose">STAT</span>}
                  <span className={`pill tone-${TONE[l.status] || 'teal'}`}>{l.status}</span>
                  {(l.analytes?.length > 0 || l.result) && (
                    <button className="pf-btn" onClick={() => setView(l)}>
                      Report
                    </button>
                  )}
                  {(l.status === 'Ready to approve' || l.status === 'Abnormal') && (
                    <button className="pf-btn ok" onClick={() => release(l)}>
                      <CheckCircle2 size={13} /> Approve &amp; release
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <p className="pf-note">
        <Clock size={14} />
        Turnaround is measured from when you ordered to when the lab reported — not from when the
        sample reached the bench. A slow collection is still a slow result to the patient.
      </p>

      {/* ---- Order form ---- */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Order a test"
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={order}>
              <FlaskConical size={15} /> Send to lab
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="pf-form">
              <label className="pf-field">
                <span>Patient</span>
                <select
                  className="pf-input"
                  value={draft.patient}
                  onChange={(e) => setDraft({ ...draft, patient: e.target.value })}
                >
                  <option value="">Select a patient…</option>
                  {panel.map((p) => (
                    <option key={p.resourceId} value={p.name}>
                      {p.name} · {p.resourceId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Test</span>
                <select
                  className="pf-input"
                  value={draft.test}
                  onChange={(e) => setDraft({ ...draft, test: e.target.value })}
                >
                  {TESTS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Laboratory</span>
                <select
                  className="pf-input"
                  value={draft.lab}
                  onChange={(e) => setDraft({ ...draft, lab: e.target.value })}
                >
                  {LABS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Sample</span>
                <select
                  className="pf-input"
                  value={draft.sample}
                  onChange={(e) => setDraft({ ...draft, sample: e.target.value })}
                >
                  {['Blood', 'Urine', 'Swab', 'Imaging', 'Stool', 'Tissue'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Priority</span>
                <select
                  className="pf-input"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                >
                  {['Routine', 'Urgent', 'STAT'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field full">
                <span>Clinical indication</span>
                <input
                  className="pf-input"
                  value={draft.clinicalNote}
                  placeholder="Why this test is being requested"
                  onChange={(e) => setDraft({ ...draft, clinicalNote: e.target.value })}
                />
              </label>
            </div>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              The indication is not optional in practice — it is what lets the lab flag a wrong test
              and what a reviewing clinician reads first. STAT should mean STAT.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Report viewer ---- */}
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view ? `${view.test} — ${view.patient}` : ''}
        subtitle={view ? `${view.resourceId} · ${view.lab}${view.accession ? ` · ${view.accession}` : ''}` : ''}
        width={640}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setView(null)}>
              Close
            </button>
            {view && (view.status === 'Ready to approve' || view.status === 'Abnormal') && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  release(view)
                  setView(null)
                }}
              >
                <CheckCircle2 size={15} /> Approve &amp; release
              </button>
            )}
          </>
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
                          <td className={`num ${bad === true ? 'out' : ''}`}>
                            {a.value}
                            {bad === true && (
                              <AlertTriangle size={12} style={{ marginLeft: 5, verticalAlign: -2 }} />
                            )}
                          </td>
                          <td>{a.unit}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {a.low || a.high ? `${a.low ?? '—'} – ${a.high ?? '—'}` : 'not recorded'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="pf-empty">No analyte-level results were entered for this order.</p>
            )}
            {view.interpretation && (
              <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.7 }}>
                <strong>Lab interpretation:</strong> {view.interpretation}
              </p>
            )}
            {view.verifiedBy && (
              <p className="pf-hint">Verified in the laboratory by {view.verifiedBy}.</p>
            )}
          </>
        )}
      </Modal>
    </>
  )
}
