import { useState } from 'react'
import { CalendarPlus, Clock, CheckCircle2 } from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { Field, TextInput, Select } from '../components/ui/Field.jsx'
import './features.css'

const DOCTORS = ['Dr. Malik', 'Dr. Bello', 'Dr. Nair', 'Dr. Rossi', 'Dr. Lin Wei']
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '16:00']

export default function AppointmentBooking({ schema }) {
  const { records, add } = useData()
  const toast = useToast()
  const rows = records(schema.key)

  const [f, setF] = useState({
    patient: '',
    doctor: 'Dr. Malik',
    date: '2026-07-14',
    time: '',
    type: 'Video',
  })
  const [err, setErr] = useState({})

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  // slots already taken for the chosen doctor + date
  const taken = new Set(
    rows.filter((r) => r.doctor === f.doctor && r.date === f.date).map((r) => r.time)
  )

  const book = () => {
    const e = {}
    if (!f.patient.trim()) e.patient = 'Required'
    if (!f.time) e.time = 'Pick a time slot'
    if (Object.keys(e).length) return setErr(e)
    setErr({})
    const record = {
      ...f,
      resourceId: newId('AP'),
      status: 'Confirmed',
    }
    add(schema.key, record, { title: 'Appointment booked', sub: `${f.time} · ${f.doctor}` })
    toast.success(`Booked ${f.time} with ${f.doctor}`, { title: record.resourceId })
    setF((s) => ({ ...s, patient: '', time: '' }))
  }

  const dayList = rows
    .filter((r) => r.date === f.date)
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="booking">
      <div className="panel booking-form">
        <div className="panel-head">
          <span className="ph-icon">
            <CalendarPlus size={16} />
          </span>
          Book an Appointment
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          <div className="form-grid">
            <Field label="Patient" required error={err.patient} className="full">
              <TextInput value={f.patient} onChange={(v) => set('patient', v)} placeholder="Patient name" />
            </Field>
            <Field label="Doctor">
              <Select value={f.doctor} onChange={(v) => set('doctor', v)} options={DOCTORS} />
            </Field>
            <Field label="Type">
              <Select value={f.type} onChange={(v) => set('type', v)} options={['Video', 'In-person', 'Emergency']} />
            </Field>
            <Field label="Date" className="full">
              <TextInput type="date" value={f.date} onChange={(v) => set('date', v)} />
            </Field>
          </div>

          <div className="ff-label" style={{ margin: '6px 0 8px' }}>
            Available slots {err.time && <span className="ff-req">· {err.time}</span>}
          </div>
          <div className="slots">
            {SLOTS.map((s) => {
              const isTaken = taken.has(s)
              return (
                <button
                  key={s}
                  className={`slot ${f.time === s ? 'is-sel' : ''} ${isTaken ? 'is-taken' : ''}`}
                  disabled={isTaken}
                  onClick={() => set('time', s)}
                >
                  <Clock size={13} /> {s}
                </button>
              )
            })}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={book}>
            <CheckCircle2 size={16} /> Confirm booking
          </button>
        </div>
      </div>

      <div className="panel booking-day">
        <div className="panel-head">
          <span className="ph-icon">
            <Clock size={16} />
          </span>
          Schedule · {f.date}
          <span className="ph-action">{dayList.length} appts</span>
        </div>
        <div className="panel-body">
          {dayList.length === 0 && <p className="queue-empty">No appointments this day.</p>}
          {dayList.map((r) => (
            <div className="day-row" key={r.resourceId}>
              <span className="day-time">{r.time}</span>
              <div>
                <div className="wl-title">{r.patient}</div>
                <div className="wl-sub">
                  {r.doctor} · {r.type}
                </div>
              </div>
              <span className={`pill tone-${schema.statusTones[r.status] || 'teal'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
