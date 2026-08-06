import { useMemo, useState } from 'react'
import {
  Users,
  Search,
  Phone,
  ShieldAlert,
  FlaskConical,
  Pill,
  FileText,
  Activity,
  Ear,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { prettyDate } from '../patient/helpers.js'

/* Communication needs are not a footnote. A deaf patient booked for an
   audio call is a wasted appointment, so it is shown on the card, before
   anything is scheduled. */
const NEEDS_ATTENTION = new Set(['Non-speaking (mute)', 'Deaf', 'Deaf-mute', 'Hard of hearing'])

export default function DoctorPatients() {
  const { panel, mine } = useDoctor()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return panel
    return panel.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.department || '').toLowerCase().includes(needle) ||
        (p.resourceId || '').toLowerCase().includes(needle)
    )
  }, [panel, q])

  /* Everything this doctor holds on one patient, gathered when the record is
     opened rather than for the whole panel up front. */
  const dossier = useMemo(() => {
    if (!open) return null
    const forPatient = (key) =>
      mine(key).filter((r) =>
        r.patientId && open.resourceId ? r.patientId === open.resourceId : r.patient === open.name
      )
    return {
      labs: forPatient('laboratory'),
      rx: forPatient('prescriptions'),
      notes: forPatient('emr'),
      vitals: forPatient('rpm'),
      appts: forPatient('appointments'),
    }
  }, [open, mine])

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">My patients</h1>
          <p className="pf-sub">
            Everyone you have an appointment, consultation, note or admission with.
          </p>
        </div>
      </header>

      <label className="pf-field full" style={{ marginBottom: 14, display: 'block', maxWidth: 380 }}>
        <span style={{ display: 'none' }}>Search patients</span>
        <span style={{ position: 'relative', display: 'block' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-faint)',
            }}
          />
          <input
            className="pf-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by name, id or department"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </span>
      </label>

      {rows.length === 0 ? (
        <section className="pf-panel">
          <div className="pf-panel-body">
            <p className="pf-empty">
              {panel.length === 0
                ? 'No patients are linked to you yet.'
                : `No patient matches "${q}".`}
            </p>
          </div>
        </section>
      ) : (
        <div className="pf-grid">
          {rows.map((p) => {
            const flagged = NEEDS_ATTENTION.has(p.communication)
            const allergy = p.allergies && p.allergies !== 'None recorded'
            return (
              <button className="pf-tile" key={p.resourceId} onClick={() => setOpen(p)}>
                <div className="pf-tile-top">
                  <Avatar name={p.name} size={38} />
                  <div>
                    <div className="pf-tile-title">{p.name}</div>
                    <div className="pf-tile-sub">
                      {p.age} · {p.gender} · {p.resourceId}
                    </div>
                  </div>
                </div>
                <div className="pf-tile-meta">
                  <span>{p.department}</span>
                  {p.phone && (
                    <span>
                      <Phone size={12} /> {p.phone}
                    </span>
                  )}
                </div>
                <div className="pf-tile-foot">
                  <span className={`pill tone-${p.status === 'Active' ? 'green' : p.status === 'Chronic' ? 'violet' : 'amber'}`}>
                    {p.status}
                  </span>
                  {allergy && (
                    <span className="pill tone-rose">
                      <ShieldAlert size={11} /> {p.allergies}
                    </span>
                  )}
                  {flagged && (
                    <span className="pill tone-blue">
                      <Ear size={11} /> {p.communication}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        subtitle={open ? `${open.resourceId} · ${open.age} · ${open.gender} · ${open.department}` : ''}
        side
        footer={
          <button className="btn btn-ghost" onClick={() => setOpen(null)}>
            Close
          </button>
        }
      >
        {open && dossier && (
          <div style={{ fontSize: 13.5 }}>
            {open.allergies && open.allergies !== 'None recorded' && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-rose)', marginBottom: 14 }}>
                <ShieldAlert size={16} />
                <span>
                  <strong>Allergy:</strong> {open.allergies}. Check before prescribing.
                </span>
              </div>
            )}
            {NEEDS_ATTENTION.has(open.communication) && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-blue)', marginBottom: 14 }}>
                <Ear size={16} />
                <span>
                  <strong>{open.communication}.</strong> Use the accessible consultation mode —
                  captions and text channel — rather than an audio call.
                </span>
              </div>
            )}

            <Section icon={Activity} title="Conditions" count={open.conditions?.length}>
              {(open.conditions || []).map((c, i) => (
                <div className="pf-row" key={i}>
                  <div>
                    <div className="pf-row-title">{c.condition}</div>
                    <div className="pf-row-sub">
                      since {c.since} · {c.status}
                    </div>
                  </div>
                </div>
              ))}
            </Section>

            <Section icon={Pill} title="Current medication" count={open.medications?.length}>
              {(open.medications || []).map((m, i) => (
                <div className="pf-row" key={i}>
                  <div>
                    <div className="pf-row-title">{m.name}</div>
                    <div className="pf-row-sub">
                      {m.dosage} · since {m.since}
                    </div>
                  </div>
                </div>
              ))}
            </Section>

            <Section icon={Pill} title="Prescriptions from you" count={dossier.rx.length}>
              {dossier.rx.map((r) => (
                <div className="pf-row" key={r.resourceId}>
                  <div>
                    <div className="pf-row-title">{r.drug}</div>
                    <div className="pf-row-sub">
                      {r.dosage} · {r.pharmacy || 'no pharmacy set'}
                    </div>
                  </div>
                  <span className="pill tone-teal">{r.status}</span>
                </div>
              ))}
            </Section>

            <Section icon={FlaskConical} title="Lab orders" count={dossier.labs.length}>
              {dossier.labs.map((l) => (
                <div className="pf-row" key={l.resourceId}>
                  <div>
                    <div className="pf-row-title">{l.test}</div>
                    <div className="pf-row-sub">{l.result || l.lab || '—'}</div>
                  </div>
                  <span className={`pill tone-${l.status === 'Abnormal' ? 'rose' : 'teal'}`}>
                    {l.status}
                  </span>
                </div>
              ))}
            </Section>

            <Section icon={FileText} title="Notes" count={dossier.notes.length}>
              {dossier.notes.map((n) => (
                <div className="pf-row" key={n.resourceId}>
                  <div>
                    <div className="pf-row-title">{n.type}</div>
                    <div className="pf-row-sub">{n.diagnosis || '—'}</div>
                  </div>
                  <span className={`pill tone-${n.status === 'Signed' ? 'green' : 'amber'}`}>
                    {n.status}
                  </span>
                </div>
              ))}
            </Section>

            <Section icon={Activity} title="Visit history" count={open.visits?.length}>
              {(open.visits || []).map((v, i) => (
                <div className="pf-row" key={i}>
                  <div>
                    <div className="pf-row-title">{v.reason}</div>
                    <div className="pf-row-sub">
                      {prettyDate(v.date)} · {v.doctor} · {v.outcome}
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          </div>
        )}
      </Modal>
    </>
  )
}

/* An empty section still renders its heading and says so — a missing
   "Allergies" block reads as "none", which is not what an empty list means. */
function Section({ icon: Icon, title, count = 0, children }) {
  return (
    <section className="pf-panel" style={{ marginBottom: 12 }}>
      <div className="pf-panel-head">
        <Icon size={15} /> {title}
        <span className="count">{count}</span>
      </div>
      <div className="pf-panel-body">
        {count === 0 ? <p className="pf-empty">None recorded.</p> : children}
      </div>
    </section>
  )
}
