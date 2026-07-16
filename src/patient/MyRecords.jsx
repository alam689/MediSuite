import { useState } from 'react'
import {
  HeartPulse,
  Pill,
  CalendarClock,
  FlaskConical,
  FileText,
  Paperclip,
  AlertTriangle,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { usePatient } from './PatientContext.jsx'
import { prettyDate, LAB_STATUS_TEXT } from './helpers.js'

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'results', label: 'Test results' },
  { key: 'notes', label: 'Visit notes' },
  { key: 'documents', label: 'Documents' },
]

export default function MyRecords() {
  const { me, mine } = usePatient()
  const [tab, setTab] = useState('summary')
  const [viewer, setViewer] = useState(null)

  const labs = mine('laboratory')
  /* Only signed notes are shown. A draft or unsigned note is not yet the
     clinician's word — surfacing it to the patient would misrepresent it as
     final. Blueprint §13.5: preserve signed records, amend rather than edit. */
  const notes = mine('emr').filter((n) => n.status === 'Signed')
  const unsigned = mine('emr').length - notes.length

  const conditions = me?.conditions || []
  const medications = me?.medications || []
  const visits = me?.visits || []
  const documents = me?.documents || []

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">My records</h1>
          <p className="pt-sub">Your history, results and documents — all in one place.</p>
        </div>
      </header>

      <div className="pt-chips">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`pt-chip ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="pt-two">
          <div style={{ display: 'grid', gap: 14 }}>
            <section className="pt-panel">
              <div className="pt-panel-head">
                <HeartPulse size={16} /> Conditions
                <span className="count">{conditions.length}</span>
              </div>
              <div className="pt-panel-body">
                {conditions.length === 0 && <p className="pt-empty">No conditions recorded.</p>}
                {conditions.map((c, i) => (
                  <div className="pt-row" key={i}>
                    <div>
                      <div className="pt-row-title">{c.condition}</div>
                      <div className="pt-row-sub">Since {c.since || '—'}</div>
                    </div>
                    <div className="pt-row-right">
                      <span className={`pill tone-${c.status === 'Resolved' ? 'green' : 'violet'}`}>
                        {c.status || 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pt-panel">
              <div className="pt-panel-head">
                <Pill size={16} /> Current medication
                <span className="count">{medications.length}</span>
              </div>
              <div className="pt-panel-body">
                {medications.length === 0 && <p className="pt-empty">No medication recorded.</p>}
                {medications.map((m, i) => (
                  <div className="pt-row" key={i}>
                    <div>
                      <div className="pt-row-title">{m.name}</div>
                      <div className="pt-row-sub">
                        {m.dosage} · since {m.since || '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <section className="pt-panel">
              <div className="pt-panel-head">
                <AlertTriangle size={16} /> Allergies
              </div>
              <div className="pt-panel-body">
                <div className="pt-row">
                  <div className="pt-row-title" style={{ fontWeight: 600 }}>
                    {me?.allergies || 'None recorded'}
                  </div>
                </div>
              </div>
            </section>

            <section className="pt-panel">
              <div className="pt-panel-head">
                <CalendarClock size={16} /> Past visits
                <span className="count">{visits.length}</span>
              </div>
              <div className="pt-panel-body">
                {visits.length === 0 && <p className="pt-empty">No visits recorded.</p>}
                {visits.map((v, i) => (
                  <div className="pt-row" key={i}>
                    <div>
                      <div className="pt-row-title">{v.reason}</div>
                      <div className="pt-row-sub">
                        {prettyDate(v.date)} · {v.doctor} · {v.outcome}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <section className="pt-panel">
          <div className="pt-panel-head">
            <FlaskConical size={16} /> Test results
            <span className="count">{labs.length}</span>
          </div>
          <div className="pt-panel-body">
            {labs.length === 0 && <p className="pt-empty">No test results yet.</p>}
            {labs.map((l) => (
              <div className="pt-row" key={l.resourceId}>
                <div>
                  <div className="pt-row-title">{l.test}</div>
                  <div className="pt-row-sub">
                    {l.result} · {l.resourceId}
                  </div>
                </div>
                <div className="pt-row-right">
                  <span
                    className={`pill tone-${
                      l.status === 'Abnormal' ? 'rose' : l.status === 'Approved' ? 'green' : 'blue'
                    }`}
                  >
                    {LAB_STATUS_TEXT[l.status] || l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {labs.some((l) => l.status === 'Abnormal') && (
            <p className="pt-empty" style={{ textAlign: 'left', borderTop: '1px solid var(--border)' }}>
              A result outside the usual range doesn't necessarily mean something is wrong. Your
              doctor will go through it with you.
            </p>
          )}
        </section>
      )}

      {tab === 'notes' && (
        <section className="pt-panel">
          <div className="pt-panel-head">
            <FileText size={16} /> Visit notes
            <span className="count">{notes.length}</span>
          </div>
          <div className="pt-panel-body">
            {notes.length === 0 && (
              <p className="pt-empty">
                No signed notes yet. Notes appear here once your doctor has signed them.
              </p>
            )}
            {notes.map((n) => (
              <div className="pt-row" key={n.resourceId} style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="pt-row-title">{n.diagnosis || n.type}</div>
                  <div className="pt-row-sub" style={{ marginBottom: 4 }}>
                    {n.type} · {n.doctor}
                  </div>
                  <div className="pt-row-sub" style={{ color: 'var(--text)' }}>{n.notes}</div>
                </div>
              </div>
            ))}
          </div>
          {unsigned > 0 && (
            <p className="pt-empty" style={{ textAlign: 'left', borderTop: '1px solid var(--border)' }}>
              {unsigned} note{unsigned > 1 ? 's are' : ' is'} still being written by your care team and
              will appear here once signed.
            </p>
          )}
        </section>
      )}

      {tab === 'documents' && (
        <section className="pt-panel">
          <div className="pt-panel-head">
            <Paperclip size={16} /> Documents
            <span className="count">{documents.length}</span>
          </div>
          {documents.length === 0 ? (
            <p className="pt-empty">No documents yet.</p>
          ) : (
            <div className="pt-docs-grid">
              {documents.map((d) => (
                <button className="pt-doc-card" key={d.id} onClick={() => setViewer(d)}>
                  {d.kind === 'image' ? (
                    <img className="pt-doc-thumb" src={d.dataUrl} alt="" />
                  ) : (
                    <div className="pt-doc-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                      <FileText size={26} style={{ color: 'var(--text-faint)' }} />
                    </div>
                  )}
                  <div className="pt-doc-name-sm">{d.name}</div>
                  <div className="pt-row-sub">{d.type}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={!!viewer}
        onClose={() => setViewer(null)}
        title={viewer?.name}
        subtitle="Document"
        width={720}
      >
        {viewer &&
          (viewer.kind === 'image' ? (
            <img className="pt-view-img" src={viewer.dataUrl} alt={viewer.name} />
          ) : (
            <a className="btn btn-primary" href={viewer.dataUrl} download={viewer.name}>
              Download {viewer.name}
            </a>
          ))}
      </Modal>
    </>
  )
}
