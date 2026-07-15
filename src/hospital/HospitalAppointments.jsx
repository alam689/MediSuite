import { useMemo, useState } from 'react'
import { CalendarClock, Check, X, UserCheck } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useHospital } from './HospitalContext.jsx'
import { prettyDate, upcoming, past } from '../patient/helpers.js'

const TONE = { Confirmed: 'green', Pending: 'amber', 'Checked-in': 'blue', Urgent: 'rose', Cancelled: 'rose' }
const FILTERS = ['Needs action', 'Upcoming', 'Past', 'All']

export default function HospitalAppointments() {
  const { facility, facilityLabel, isAll, appointments } = useHospital()
  const { patch } = useData()
  const toast = useToast()
  const [filter, setFilter] = useState('Needs action')

  const rows = useMemo(() => {
    if (filter === 'Needs action')
      return appointments
        .filter((a) => a.status === 'Pending' || a.status === 'Urgent')
        .sort((a, b) => (a.status === 'Urgent' ? -1 : 1))
    if (filter === 'Upcoming') return upcoming(appointments)
    if (filter === 'Past') return past(appointments)
    return [...appointments].sort((a, b) => `${b.date}`.localeCompare(`${a.date}`))
  }, [appointments, filter])

  const act = (a, status, msg) => {
    patch('appointments', a.resourceId, { status }, {
      title: msg,
      sub: `${a.patient} · ${a.time} · ${a.hospital || facilityLabel}`,
    })
    toast.success(msg, { title: a.resourceId })
  }

  const pendingCount = appointments.filter((a) => a.status === 'Pending').length

  return (
    <>
      <header className="hs-head">
        <div>
          <h1 className="hs-title">Appointments</h1>
          <p className="hs-sub">
            {isAll ? 'Across all clinics' : `Booked at ${facilityLabel}`}
            {pendingCount > 0 && ` · ${pendingCount} request${pendingCount > 1 ? 's' : ''} awaiting confirmation`}
          </p>
        </div>
      </header>

      <div className="hs-chips">
        {FILTERS.map((f) => (
          <button key={f} className={`hs-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
            {f === 'Needs action' && pendingCount > 0 && <span className="hs-chip-badge">{pendingCount}</span>}
          </button>
        ))}
      </div>

      <section className="hs-panel">
        <div className="hs-panel-head">
          <CalendarClock size={15} /> {filter}
          <span className="count">{rows.length}</span>
        </div>
        <div className="hs-panel-body">
          {rows.length === 0 && (
            <p className="hs-empty">
              {filter === 'Needs action'
                ? 'Nothing waiting on you.'
                : 'No appointments in this view.'}
            </p>
          )}
          {rows.map((a) => (
            <div className="hs-row" key={a.resourceId}>
              <span className="hs-time">{a.time}</span>
              <div>
                <div className="hs-row-title">{a.patient}</div>
                <div className="hs-row-sub">
                  {prettyDate(a.date)} · {a.doctor} · {a.type} · {a.resourceId}
                  {/* In group view the site is not implied by the page, so it
                      has to be on the row. */}
                  {isAll && <span className="hs-site"> {a.hospital || 'No facility set'}</span>}
                </div>
              </div>
              <div className="hs-row-actions">
                <span className={`pill tone-${TONE[a.status] || 'teal'}`}>{a.status}</span>
                {/* A patient's booking arrives as a request; confirming it is
                    this desk's decision, which is why the button lives here
                    and not in the portal. */}
                {a.status === 'Pending' && (
                  <button className="hs-btn ok" onClick={() => act(a, 'Confirmed', 'Appointment confirmed')}>
                    <Check size={13} /> Confirm
                  </button>
                )}
                {a.status === 'Urgent' && (
                  <button className="hs-btn ok" onClick={() => act(a, 'Confirmed', 'Urgent appointment confirmed')}>
                    <Check size={13} /> Confirm
                  </button>
                )}
                {(a.status === 'Confirmed' || a.status === 'Urgent') && (
                  <button className="hs-btn" onClick={() => act(a, 'Checked-in', 'Patient checked in')}>
                    <UserCheck size={13} /> Check in
                  </button>
                )}
                {a.status !== 'Cancelled' && (
                  <button className="hs-btn danger" onClick={() => act(a, 'Cancelled', 'Appointment cancelled')}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
