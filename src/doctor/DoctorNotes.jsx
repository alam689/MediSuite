import { useState } from 'react'
import { FileText, Plus, PenLine, Lock, CheckCircle2, Sparkles } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'

const TONE = { 'AI draft': 'violet', Editing: 'amber', 'Ready for sign-off': 'blue', Signed: 'green' }
const TYPES = ['Consult note', 'SOAP note', 'Progress note', 'Discharge summary', 'Procedure note']

const blank = { patient: '', type: 'Consult note', diagnosis: '', notes: '', status: 'Editing' }

export default function DoctorNotes() {
  const { mine, panel, filedAs, me } = useDoctor()
  const { add, update, patch } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')

  const rows = mine('emr')
  const unsigned = rows.filter((r) => r.status !== 'Signed')

  const openNew = () => {
    setError('')
    setDraft({ ...blank, patient: panel[0]?.name || '' })
  }

  const openEdit = (r) => {
    setError('')
    setDraft({ ...r })
  }

  const field = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  const save = (sign = false) => {
    if (!draft.patient.trim()) return setError('Choose the patient this note belongs to.')
    if (!draft.diagnosis.trim() && sign) {
      return setError('A note cannot be signed without a diagnosis.')
    }

    const patient = panel.find((p) => p.name === draft.patient)
    const body = {
      ...draft,
      doctor: filedAs,
      doctorId: me?.resourceId,
      patientId: patient?.resourceId,
      status: sign ? 'Signed' : draft.status === 'Signed' ? 'Signed' : draft.status,
      ...(sign ? { signedAt: Date.now(), signedBy: me?.name } : {}),
    }

    if (draft.resourceId) {
      update('emr', body, {
        title: sign ? 'Note signed off' : 'Note updated',
        sub: `${draft.resourceId} · ${draft.patient}`,
      })
    } else {
      const resourceId = newId('EMR')
      add('emr', { ...body, resourceId }, {
        title: sign ? 'Note written & signed' : 'Note started',
        sub: `${resourceId} · ${draft.patient}`,
      })
    }
    toast.success(sign ? 'Note signed — the record is now locked' : 'Note saved', {
      title: draft.patient,
    })
    setDraft(null)
  }

  const signRow = (r) => {
    if (!r.diagnosis) {
      toast.warning('Add a diagnosis before signing', { title: r.resourceId })
      return openEdit(r)
    }
    patch('emr', r.resourceId, { status: 'Signed', signedAt: Date.now(), signedBy: me?.name }, {
      title: 'Note signed off',
      sub: `${r.resourceId} · ${r.patient}`,
    })
    toast.success('Note signed — the record is now locked', { title: r.patient })
  }

  const locked = draft?.status === 'Signed'

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Clinical notes</h1>
          <p className="pf-sub">
            {unsigned.length
              ? `${unsigned.length} note${unsigned.length > 1 ? 's' : ''} awaiting your signature.`
              : 'Everything is signed.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> New note
        </button>
      </header>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <FileText size={15} /> My notes
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              You have not written any notes yet.
            </p>
          )}
          {rows.map((r) => (
            <div className="pf-row" key={r.resourceId}>
              <div>
                <div className="pf-row-title">
                  {r.patient} · {r.type}
                </div>
                <div className="pf-row-sub">
                  {r.diagnosis || 'No diagnosis recorded'} · {r.resourceId}
                </div>
              </div>
              <div className="pf-row-actions">
                {r.status === 'AI draft' && (
                  <span className="pill tone-violet">
                    <Sparkles size={11} /> AI draft
                  </span>
                )}
                {r.status !== 'AI draft' && (
                  <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
                )}
                <button className="pf-btn" onClick={() => openEdit(r)}>
                  {r.status === 'Signed' ? <Lock size={13} /> : <PenLine size={13} />}
                  {r.status === 'Signed' ? 'View' : 'Edit'}
                </button>
                {r.status !== 'Signed' && (
                  <button className="pf-btn ok" onClick={() => signRow(r)}>
                    <CheckCircle2 size={13} /> Sign
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.resourceId ? `${draft.type} — ${draft.patient}` : 'New clinical note'}
        subtitle={draft?.resourceId || 'Filed under your name once saved'}
        width={620}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              {locked ? 'Close' : 'Cancel'}
            </button>
            {!locked && (
              <>
                <button className="btn btn-ghost" onClick={() => save(false)}>
                  Save draft
                </button>
                <button className="btn btn-primary" onClick={() => save(true)}>
                  <CheckCircle2 size={15} /> Sign &amp; lock
                </button>
              </>
            )}
          </>
        }
      >
        {draft && (
          <>
            {locked && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-green)', marginBottom: 14 }}>
                <Lock size={16} />
                <span>
                  <strong>Signed{draft.signedBy ? ` by ${draft.signedBy}` : ''}.</strong> A signed
                  note is the legal record of the encounter and cannot be edited. Write an
                  addendum as a new progress note instead.
                </span>
              </div>
            )}
            <div className="pf-form">
              <label className="pf-field">
                <span>Patient</span>
                <select
                  className="pf-input"
                  value={draft.patient}
                  disabled={locked}
                  onChange={(e) => field('patient', e.target.value)}
                >
                  <option value="">Select a patient…</option>
                  {panel.map((p) => (
                    <option key={p.resourceId} value={p.name}>
                      {p.name} · {p.resourceId}
                    </option>
                  ))}
                  {/* A note may pre-date the panel; keep its patient selectable. */}
                  {draft.patient && !panel.some((p) => p.name === draft.patient) && (
                    <option value={draft.patient}>{draft.patient}</option>
                  )}
                </select>
              </label>
              <label className="pf-field">
                <span>Note type</span>
                <select
                  className="pf-input"
                  value={draft.type}
                  disabled={locked}
                  onChange={(e) => field('type', e.target.value)}
                >
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field full">
                <span>Diagnosis</span>
                <input
                  className="pf-input"
                  value={draft.diagnosis || ''}
                  disabled={locked}
                  placeholder="e.g. Stable angina"
                  onChange={(e) => field('diagnosis', e.target.value)}
                />
              </label>
              <label className="pf-field full">
                <span>Clinical notes</span>
                <textarea
                  className="pf-input"
                  rows={7}
                  value={draft.notes || ''}
                  disabled={locked}
                  placeholder="Subjective, objective, assessment, plan…"
                  onChange={(e) => field('notes', e.target.value)}
                />
              </label>
            </div>
            {error && <span className="pf-err">{error}</span>}
            {!locked && (
              <p className="pf-hint">
                Signing locks this note and stamps it with your name. Everything above becomes part
                of the patient's permanent record and is visible in their portal.
              </p>
            )}
          </>
        )}
      </Modal>
    </>
  )
}
