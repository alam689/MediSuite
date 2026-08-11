import { Link } from 'react-router-dom'
import {
  BedDouble,
  CalendarClock,
  Stethoscope,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  ClipboardPlus,
  Network,
  Wallet,
} from 'lucide-react'
import { freeBeds } from '../data/schemas.js'
import { useHospital } from './HospitalContext.jsx'
import { prettyDate, upcoming } from '../patient/helpers.js'
import { money, bdt } from '../portal/format.js'
import { hospitalNotifications } from '../portal/notifications.js'

const STALE_MINUTES = 30

export default function HospitalHome() {
  const {
    facilityLabel,
    isAll,
    facilities,
    units,
    staff,
    appointments,
    unassigned,
    admissions,
    departments,
    invoices,
  } = useHospital()

  const openUnits = units.filter((u) => u.status === 'Open')
  const freeTotal = openUnits.reduce((n, u) => n + freeBeds(u), 0)
  const bedTotal = units.reduce((n, u) => n + Number(u.total || 0), 0)
  const stale = units.filter((u) => Date.now() - Number(u.updatedAt || 0) > STALE_MINUTES * 60000)

  const pending = appointments.filter((a) => a.status === 'Pending')
  const next = upcoming(appointments).slice(0, 5)

  const inPatients = admissions.filter(
    (a) => !['Discharged', 'Transferred'].includes(a.status)
  )
  const forDischarge = inPatients.filter((a) => a.status === 'For discharge')
  const limited = departments.filter((d) => d.status !== 'Open')

  /* Same list the bell shows, from the same builder. Ordering by severity
     is the page's actual job — anything below the fold is a thing that
     didn't get done — and the builder does it once for both. */
  const attention = hospitalNotifications({
    units,
    appointments,
    admissions,
    departments,
    invoices,
    isAll,
    staleMinutes: STALE_MINUTES,
    freeBeds,
  })

  return (
    <>
      <header className="hs-head">
        <div>
          <h1 className="hs-title">{facilityLabel}</h1>
          <p className="hs-sub">
            {isAll
              ? `Capacity, bookings and practitioners across ${facilities.length} clinics.`
              : 'Capacity, bookings and practitioners at this facility.'}
          </p>
        </div>
      </header>

      <section className="hs-cards">
        <div className="hs-card">
          <div className="hs-card-head">
            <BedDouble size={15} /> Beds free
          </div>
          <div className="hs-card-big">{freeTotal}</div>
          <div className="hs-card-line">
            of {bedTotal} across {units.length} unit(s){isAll ? ` · ${facilities.length} clinics` : ''}
          </div>
          <Link to="/hospital/beds" className="hs-card-link">
            Manage beds <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <CalendarClock size={15} /> Appointments
          </div>
          <div className="hs-card-big">{appointments.length}</div>
          <div className="hs-card-line">
            {pending.length} awaiting confirmation
          </div>
          <Link to="/hospital/appointments" className="hs-card-link">
            Review <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Stethoscope size={15} /> Practitioners
          </div>
          <div className="hs-card-big">{staff.length}</div>
          <div className="hs-card-line">{isAll ? 'across all clinics' : 'hold a chamber here'}</div>
          <Link to="/hospital/staff" className="hs-card-link">
            View <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <ClipboardPlus size={15} /> In-patients
          </div>
          <div className="hs-card-big">{inPatients.length}</div>
          <div className="hs-card-line">
            {forDischarge.length} ready for discharge
          </div>
          <Link to="/hospital/admissions" className="hs-card-link">
            Ward board <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Network size={15} /> Departments
          </div>
          <div className="hs-card-big">{departments.length}</div>
          <div className="hs-card-line">
            {limited.length ? `${limited.length} not fully open` : 'all open'}
          </div>
          <Link to="/hospital/departments" className="hs-card-link">
            Manage <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Wallet size={15} /> Collected
          </div>
          <div className="hs-card-big">
            {bdt(invoices.filter((i) => i.status === 'Paid').reduce((n, i) => n + money(i.amount), 0))}
          </div>
          <div className="hs-card-line">
            {bdt(
              invoices
                .filter((i) => i.status === 'Due' || i.status === 'Overdue')
                .reduce((n, i) => n + money(i.amount), 0)
            )}{' '}
            outstanding
          </div>
          <Link to="/hospital/revenue" className="hs-card-link">
            Revenue <ArrowRight size={13} />
          </Link>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Clock size={15} /> Stale counts
          </div>
          <div className="hs-card-big">{stale.length}</div>
          <div className="hs-card-line">unit(s) over {STALE_MINUTES} min old</div>
        </div>
      </section>

      <div className="hs-two">
        <section className="hs-panel">
          <div className="hs-panel-head">
            <AlertTriangle size={15} /> Needs attention
            <span className="count">{attention.length}</span>
          </div>
          <div className="hs-panel-body">
            {attention.length === 0 && (
              <p className="hs-empty">
                <CheckCircle2 size={22} />
                Nothing needs you right now.
              </p>
            )}
            {attention.map((a) => (
              <Link className="hs-row" key={a.id} to={a.to}>
                <span className={`hs-dot tone-${a.tone}`} />
                <div>
                  <div className="hs-row-title">{a.title}</div>
                  <div className="hs-row-sub">{a.sub}</div>
                </div>
                <ArrowRight size={15} className="hs-row-go" />
              </Link>
            ))}
          </div>
        </section>

        <section className="hs-panel">
          <div className="hs-panel-head">
            <CalendarClock size={15} /> Next in
            <span className="count">{next.length}</span>
          </div>
          <div className="hs-panel-body">
            {next.length === 0 && <p className="hs-empty">No upcoming appointments booked here.</p>}
            {next.map((a) => (
              <div className="hs-row" key={a.resourceId}>
                <span className="hs-time">{a.time}</span>
                <div>
                  <div className="hs-row-title">{a.patient}</div>
                  <div className="hs-row-sub">
                    {prettyDate(a.date)} · {a.doctor} · {a.type}
                    {isAll && a.hospital && <span className="hs-site"> {a.hospital}</span>}
                  </div>
                </div>
                <span className={`pill tone-${a.status === 'Confirmed' ? 'green' : a.status === 'Urgent' ? 'rose' : 'amber'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {unassigned.length > 0 && (
        <p className="hs-note">
          {unassigned.length} appointment{unassigned.length > 1 ? 's have' : ' has'} no facility
          recorded, so {unassigned.length > 1 ? 'they' : 'it'} won't appear on any hospital's list.
          Set a facility on the record in the clinician workspace.
        </p>
      )}
    </>
  )
}
