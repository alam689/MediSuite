import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { useData, newId } from '../../store/DataStore.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

/* Patient selection for the pad. Unlike the standalone app this was ported
   from, patients are NOT a pad-private list: search reads the shared patient
   registry, and Add Patient registers a real Patient record — so a person
   added here immediately exists for appointments, EMR and the pharmacy. */

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function AddPatientModal({ onClose }) {
  const { setPatient } = usePad()
  const { add } = useData()
  const toast = useToast()
  const [f, setF] = useState({ name: '', age: '', gender: 'Male', phone: '', department: 'General Med', allergies: '' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = () => {
    if (!f.name.trim()) return toast.warning('Patient name is required.')
    const record = {
      resourceId: newId('PT'),
      name: f.name.trim(),
      age: f.age ? Number(f.age) : '',
      gender: f.gender,
      department: f.department,
      phone: f.phone.trim(),
      insurance: '',
      communication: 'Standard',
      status: 'Active',
      allergies: f.allergies.trim() || 'None recorded',
      conditions: [],
      visits: [],
      medications: [],
      documents: [],
    }
    add('patients', record, {
      title: 'Patient registered from prescription pad',
      sub: `${record.resourceId} · ${record.name}`,
    })
    setPatient(record)
    toast.success(`Patient ${record.name} added (${record.resourceId}).`)
    onClose()
  }

  return (
    <Modal title="Add Patient" onClose={onClose}>
      <div className="form-grid">
        <label className="full"><span>Name *</span>
          <input autoFocus value={f.name} onChange={set('name')} placeholder="Patient name" />
        </label>
        <label><span>Age</span>
          <input type="number" min="0" value={f.age} onChange={set('age')} />
        </label>
        <label><span>Gender</span>
          <select value={f.gender} onChange={set('gender')}>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </label>
        <label><span>Phone</span>
          <input value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
        </label>
        <label><span>Department</span>
          <select value={f.department} onChange={set('department')}>
            <option>General Med</option><option>Cardiology</option><option>Endocrinology</option>
            <option>Pulmonology</option><option>Neurology</option><option>Dermatology</option>
          </select>
        </label>
        <label className="full"><span>Known allergies</span>
          <input value={f.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin, Aspirin" />
        </label>
      </div>
      <div className="modal-foot">
        <button className="pbtn ghost" onClick={onClose}>Cancel</button>
        <button className="pbtn primary" onClick={save}>Save Patient</button>
      </div>
    </Modal>
  )
}

export function SearchPatientsModal({ onClose, onAddNew }) {
  const { setPatient, savedPads } = usePad()
  const { records } = useData()
  const [q, setQ] = useState('')

  const patients = records('patients')
  const prescriptions = records('prescriptions')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return patients
    return patients.filter((p) => `${p.name} ${p.resourceId} ${p.phone}`.toLowerCase().includes(s))
  }, [q, patients])

  /* Visits = pads written here plus RX records filed anywhere in the system,
     so the count means "how much prescribing history exists", not "how many
     times this browser used the pad". */
  const visits = (p) =>
    savedPads.filter((r) => r.patientId === p.resourceId).length +
    prescriptions.filter((r) => r.patientId === p.resourceId && !r.padRef).length

  return (
    <Modal title="Search Patients" onClose={onClose} width={620}>
      <div className="picker-search big">
        <Search size={16} />
        <input autoFocus value={q} placeholder="Search by name, ID or phone…" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="pt-list">
        {list.map((p) => (
          <button key={p.resourceId} className="pt-row" onClick={() => { setPatient(p); onClose() }}>
            <span className="pt-id">{p.resourceId}</span>
            <span className="pt-name">{p.name}</span>
            <span className="pt-meta">
              {p.age !== '' && p.age != null ? `${p.age}y` : '—'} · {p.gender || '—'} {p.phone ? `· ${p.phone}` : ''}
            </span>
            <span className="pt-visits">{visits(p)} rx</span>
          </button>
        ))}
        {!list.length && <p className="picker-none">No patients match “{q}”.</p>}
      </div>
      <div className="modal-foot">
        <button className="pbtn ghost" onClick={onAddNew}>＋ Add New Patient</button>
      </div>
    </Modal>
  )
}
