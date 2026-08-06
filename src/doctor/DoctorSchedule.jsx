import { useState } from 'react'
import {
  CalendarClock,
  Check,
  X,
  Video,
  MapPin,
  CalendarX,
  CheckCircle2,
} from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { prettyDate, upcoming, past, localISO } from '../patient/helpers.js'

const TONE = {
  Confirmed: 'green',
  Pending: 'amber',
  'Checked-in': 'blue',
  Urgent: 'rose',
  Cancelled: 'rose',
}

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Awaiting me' },
  { key: 'past', label: 'Past' },
]

/* The doctor's own booking list. A clinician confirms or declines their own
   appointments here — the hospital desk can do it too, and both write the
   same record, which is the point of a shared store. */
export default function DoctorSchedule() {
  const { mine, filedAs } = useDoctor()
  const { patch, add } = useData()
  const toast = useToast()
  const [tab, setTab] = useState('today')

  const all = mine('appointments')
  const today = all.filter((a) => a.date === localISO() && a.status !== 'Cancelled')
  const pending = all.filter((a) => a.status === 'Pending' || a.status === 'Urgent')

  const rows =
    tab === 'today' ? today : tab === 'upcoming' ? upcoming(all) : tab === 'pending' ? pending : past(all)

  const counts = { today: today.length, upcoming: upcoming(all).length, pending: pending.length, past: past(all).length }

  const setStatus = (a, status, message) => {
    patch('appointments', a.resourceId, { status }, { title: message, sub: `${a.resourceId} · ${a.patient}` })
    toast.success(message, { title: a.patient })
  }

  /* Starting a consultation creates the telemedicine record the console and
     the patient's portal both read. Filed under the scheduling name, not the
     full name, or it lands where nothing looks for it. */
  const startConsult = (a) => {
    add(
      'telemedicine',
      {
        resourceId: `CS-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        patient: a.patient,
        patientId: a.patientId,
        doctor: filedAs,
        doctorId: a.doctorId,
        mode: a.type === 'In-person' ? 'Audio' : 'Video',
        date: a.date,
        time: a.time,
        reason: a.reason || 'Scheduled consultation',
        status: 'Waiting',
      },
      { title: 'Consultation opened', sub: `${a.patient} · from ${a.resourceId}` }
    )
    patch('appointments', a.resourceId, { status: 'Checked-in' })
    toast.success('Patient moved to your waiting room', { title: a.patient })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Schedule</h1>
          <p className="pf-sub">Your bookings across every chamber you sit at.</p>
        </div>
      </header>

      <div className="pf-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`pf-chip ${tab === f.key ? 'on' : ''}`}
            onClick={() => setTab(f.key)}
          >
            {f.label}
            {f.key === 'pending' && counts.pending > 0 && (
              <span className="pf-chip-badge">{counts.pending}</span>
            )}
            {f.key !== 'pending' && <span style={{ opacity: 0.6 }}>{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <CalendarClock size={15} /> {FILTERS.find((f) => f.key === tab)?.label}
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              Nothing here.
            </p>
          )}
          {rows.map((a) => (
            <div className="pf-row" key={a.resourceId}>
              <span className="pf-time">{a.time}</span>
              <div>
                <div className="pf-row-title">{a.patient}</div>
                <div className="pf-row-sub">
                  {prettyDate(a.date)} · {a.type}
                  {a.hospital && (
                    <>
                      {' · '}
                      <MapPin size={11} style={{ verticalAlign: -1 }} /> {a.hospital}
                    </>
                  )}
                </div>
              </div>
              <div className="pf-row-actions">
                <span className={`pill tone-${TONE[a.status] || 'teal'}`}>{a.status}</span>
                {a.status === 'Pending' && (
                  <button className="pf-btn ok" onClick={() => setStatus(a, 'Confirmed', 'Appointment confirmed')}>
                    <Check size={13} /> Confirm
                  </button>
                )}
                {(a.status === 'Confirmed' || a.status === 'Urgent') && (
                  <button className="pf-btn go" onClick={() => startConsult(a)}>
                    <Video size={13} /> Start consult
                  </button>
                )}
                {a.status !== 'Cancelled' && (
                  <button
                    className="pf-btn danger"
                    onClick={() => setStatus(a, 'Cancelled', 'Appointment cancelled')}
                  >
                    <X size={13} /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="pf-note">
        <CalendarX size={14} />
        Cancelling here tells the patient's portal immediately. It does not offer them an
        alternative slot — rebooking is theirs to choose, from your published chamber hours.
      </p>
    </>
  )
}
