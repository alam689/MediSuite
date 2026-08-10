import { FileText } from 'lucide-react'
import { useData } from '../../store/DataStore.jsx'
import { PatientProvider } from '../../patient/PatientContext.jsx'
import MyReports from '../../patient/MyReports.jsx'
import MyVaccines from '../../patient/MyVaccines.jsx'
import MyPrescriptions from '../../patient/MyPrescriptions.jsx'
import { prettyDate } from '../../patient/helpers.js'
import '../../patient/patient.css'

/* =====================================================================
   The patient portal's record shelves — tests & reports, vaccine history,
   prescriptions, visit notes — rendered inside the doctor's patient page.

   These are the patient portal's own components, pinned to this patient by
   PatientProvider's `subject`, not re-implementations. A second copy would
   drift: the day someone fixes a report grouping rule for patients, the
   clinician's view would quietly keep the old one, and the two would
   disagree about the same record.

   Visit notes are the exception and are written here. The patient's shelf
   deliberately shows signed notes only — an unsigned note is not yet the
   clinician's word. A clinician needs the opposite: the drafts are theirs
   to finish, so they are shown, labelled for what they are.
   ===================================================================== */

export default function RecordShelf({ patient, shelf }) {
  return (
    <div className="pp-shelf">
      <PatientProvider subject={patient}>
        {shelf === 'reports' && <MyReports />}
        {shelf === 'vaccines' && <MyVaccines />}
        {shelf === 'prescriptions' && <MyPrescriptions clinician />}
      </PatientProvider>
      {shelf === 'notes' && <ClinicalNotes patient={patient} />}
    </div>
  )
}

const NOTE_TONE = {
  Signed: 'green',
  'Ready for sign-off': 'violet',
  Editing: 'amber',
  'AI draft': 'blue',
}

function ClinicalNotes({ patient }) {
  const { records } = useData()
  const notes = records('emr').filter((n) =>
    n.patientId && patient.resourceId ? n.patientId === patient.resourceId : n.patient === patient.name
  )
  const unsigned = notes.filter((n) => n.status !== 'Signed').length

  return (
    <section className="pt-panel">
      <div className="pt-panel-head">
        <FileText size={16} /> Visit notes
        <span className="count">{notes.length}</span>
      </div>
      <div className="pt-panel-body">
        {notes.length === 0 && <p className="pt-empty">No notes recorded for this patient.</p>}
        {notes.map((n) => (
          <div className="pt-row" key={n.resourceId} style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="pt-row-title">{n.diagnosis || n.type}</div>
              <div className="pt-row-sub" style={{ marginBottom: 4 }}>
                {n.type} · {n.doctor}
                {n.date ? ` · ${prettyDate(n.date)}` : ''} · {n.resourceId}
              </div>
              <div className="pt-row-sub" style={{ color: 'var(--text)' }}>{n.notes}</div>
            </div>
            <div className="pt-row-right">
              <span className={`pill tone-${NOTE_TONE[n.status] || 'teal'}`}>{n.status}</span>
            </div>
          </div>
        ))}
      </div>
      {unsigned > 0 && (
        <p className="pt-empty" style={{ textAlign: 'left', borderTop: '1px solid var(--border)' }}>
          {unsigned} note{unsigned > 1 ? 's are' : ' is'} unsigned and not visible to the patient
          yet. Sign them off in <b>Notes</b>.
        </p>
      )}
    </section>
  )
}
