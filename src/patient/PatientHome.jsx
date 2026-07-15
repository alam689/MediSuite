import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  Video,
  FileText,
  Pill,
  Wallet,
  ArrowRight,
  CalendarClock,
  FlaskConical,
  ShieldCheck,
  BedDouble,
} from 'lucide-react'
import { usePatient, firstName } from './PatientContext.jsx'
import { upcoming, greeting, prettyDate } from './helpers.js'

const QUICK = [
  { to: '/patient/doctors', icon: CalendarPlus, title: 'Book an appointment', desc: 'Find a doctor and pick a time.' },
  { to: '/patient/beds', icon: BedDouble, title: 'Critical care beds', desc: 'ICU, CCU and ventilator availability.' },
  { to: '/patient/records', icon: FileText, title: 'My records', desc: 'History, results and documents.' },
  { to: '/patient/prescriptions', icon: Pill, title: 'Prescriptions', desc: 'Current and past medication.' },
]

export default function PatientHome() {
  const { name, mine } = usePatient()

  const appts = mine('appointments')
  const next = upcoming(appts)[0] || null
  const consults = mine('telemedicine')
  const liveNow = consults.find((c) => c.status === 'Live')
  const waiting = consults.find((c) => c.status === 'Waiting' || c.status === 'Queued')
  const labs = mine('laboratory')
  const newResults = labs.filter((l) => l.status === 'Approved' || l.status === 'Abnormal')
  const dueInvoices = mine('billing').filter((b) => b.status !== 'Paid')

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">
            {greeting()}, {firstName(name)}
          </h1>
          <p className="pt-sub">Here's what needs your attention today.</p>
        </div>
        <Link to="/patient/doctors" className="btn btn-primary">
          <CalendarPlus size={16} /> Book appointment
        </Link>
      </header>

      {/* A consultation you can act on right now outranks everything else. */}
      {(liveNow || waiting) && (
        <Link to="/patient/consult" className={`pt-callout ${liveNow ? 'live' : ''}`}>
          <span className="pt-callout-icon">
            <Video size={19} />
          </span>
          <div>
            <div className="pt-callout-title">
              {liveNow
                ? `Your doctor is ready — join now`
                : `You're in the waiting room`}
            </div>
            <div className="pt-callout-sub">
              {(liveNow || waiting).doctor} · {(liveNow || waiting).mode} ·{' '}
              {(liveNow || waiting).reason || 'Consultation'}
            </div>
          </div>
          <ArrowRight size={18} />
        </Link>
      )}

      <section className="pt-cards">
        <div className="pt-card">
          <div className="pt-card-head">
            <CalendarClock size={16} /> Next appointment
          </div>
          {next ? (
            <>
              <div className="pt-card-big">{next.time}</div>
              <div className="pt-card-line">{prettyDate(next.date)}</div>
              <div className="pt-card-line muted">
                {next.doctor} · {next.type}
              </div>
              <span className={`pill tone-${next.status === 'Confirmed' ? 'green' : 'amber'}`}>
                {next.status}
              </span>
            </>
          ) : (
            <>
              <p className="pt-card-line muted">No upcoming appointment.</p>
              <Link to="/patient/doctors" className="pt-card-link">
                Book one <ArrowRight size={13} />
              </Link>
            </>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <FlaskConical size={16} /> Test results
          </div>
          <div className="pt-card-big">{newResults.length}</div>
          <div className="pt-card-line muted">
            {newResults.length === 0
              ? 'Nothing new.'
              : `${newResults.length} result${newResults.length > 1 ? 's' : ''} in your records`}
          </div>
          {newResults.length > 0 && (
            <Link to="/patient/records" className="pt-card-link">
              View results <ArrowRight size={13} />
            </Link>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <Wallet size={16} /> Balance
          </div>
          <div className="pt-card-big">{dueInvoices.length}</div>
          <div className="pt-card-line muted">
            {dueInvoices.length === 0 ? 'Nothing to pay.' : 'invoice(s) outstanding'}
          </div>
          {dueInvoices.length > 0 && (
            <Link to="/patient/payments" className="pt-card-link">
              Pay now <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </section>

      <div className="section-label pt-section">Quick actions</div>
      <section className="pt-quick">
        {QUICK.map((q) => {
          const Icon = q.icon
          return (
            <Link className="pt-quick-tile" key={q.to} to={q.to}>
              <span className="pt-quick-icon">
                <Icon size={20} />
              </span>
              <div className="pt-quick-title">{q.title}</div>
              <div className="pt-quick-desc">{q.desc}</div>
            </Link>
          )
        })}
      </section>

      <p className="pt-privacy">
        <ShieldCheck size={14} />
        You control who sees your records. Review sharing and consent in your{' '}
        <Link to="/patient/profile">profile</Link>.
      </p>
    </>
  )
}
