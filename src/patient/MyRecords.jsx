import { useSearchParams } from 'react-router-dom'
import {
  HeartPulse,
  Pill,
  CalendarClock,
  FileText,
  AlertTriangle,
  Stethoscope,
  X,
} from 'lucide-react'
import { usePatient } from './PatientContext.jsx'
import { prettyDate } from './helpers.js'
import MyReports from './MyReports.jsx'
import MyVaccines from './MyVaccines.jsx'
import MyPrescriptions from './MyPrescriptions.jsx'

/* =====================================================================
   My records is the one place for everything the system knows about the
   patient. Reports, vaccine history and prescriptions used to be separate
   top-nav items; they are tabs here now so the nav stays short and a
   patient never has to guess which of two document shelves to open.

   The old Documents tab is gone: it held clinic-issued files (lab report
   images), which is exactly what Reports is — one kind of thing, one
   shelf. Clinic-attached files now show inside the Reports tab.

   The tab lives in the URL (?tab=reports) so notifications and home-page
   tiles can deep-link to a specific shelf.
   ===================================================================== */

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'reports', label: 'Tests & reports' },
  { key: 'vaccines', label: 'Vaccine history' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'notes', label: 'Visit notes' },
]

export default function MyRecords() {
  const { me, mine } = usePatient()
  const [params, setParams] = useSearchParams()
  /* ?tab=results predates the merge of Test results into Tests & reports —
     old links keep landing somewhere sensible. */
  const raw = params.get('tab') === 'results' ? 'reports' : params.get('tab')
  const tab = TABS.some((t) => t.key === raw) ? raw : 'summary'
  /* ?doctor=Dr.%20Malik scopes the whole page to one doctor — this is what
     Find a doctor → My doctors → History opens. */
  const doctor = params.get('doctor') || ''
  const setQuery = (next) => setParams(next, { replace: true })
  const setTab = (key) =>
    setQuery({ ...(key !== 'summary' ? { tab: key } : {}), ...(doctor ? { doctor } : {}) })
  const clearDoctor = () => setQuery(tab !== 'summary' ? { tab } : {})
  const byDoctor = (r) => !doctor || r.doctor === doctor

  /* Only signed notes are shown. A draft or unsigned note is not yet the
     clinician's word — surfacing it to the patient would misrepresent it as
     final. Blueprint §13.5: preserve signed records, amend rather than edit. */
  const notes = mine('emr').filter((n) => n.status === 'Signed' && byDoctor(n))
  const unsigned = mine('emr').filter((n) => n.status !== 'Signed' && byDoctor(n)).length

  const conditions = me?.conditions || []
  const medications = me?.medications || []
  const visits = (me?.visits || []).filter(byDoctor)

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">My records</h1>
          <p className="pt-sub">
            Your history, results, reports, vaccines and prescriptions — all in one place.
          </p>
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

      {doctor && (
        <div className="pt-callout" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span className="pt-callout-icon">
            <Stethoscope size={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="pt-callout-title">Showing your records with {doctor}</div>
            <div className="pt-callout-sub">
              Visits, notes and prescriptions are filtered to this doctor. Reports and vaccine
              cards carry no doctor on them, so they are shown in full.
            </div>
          </div>
          <button className="btn btn-ghost" style={{ height: 34 }} onClick={clearDoctor}>
            <X size={14} /> Show all
          </button>
        </div>
      )}

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

      {tab === 'reports' && <MyReports doctorFilter={doctor} />}
      {tab === 'vaccines' && <MyVaccines />}
      {tab === 'prescriptions' && <MyPrescriptions doctorFilter={doctor} />}

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
    </>
  )
}
