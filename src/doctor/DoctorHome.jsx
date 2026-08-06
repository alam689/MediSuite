import { Link } from 'react-router-dom'
import {
  Video,
  CalendarClock,
  FileText,
  FlaskConical,
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Users,
} from 'lucide-react'
import { useDoctor } from './DoctorContext.jsx'
import { greeting, prettyDate, upcoming, localISO } from '../patient/helpers.js'
import { firstName } from '../portal/format.js'
import { doctorNotifications } from '../portal/notifications.js'

/* The clinician's landing page answers one question: what needs me now.
   Ordered by how much it costs to be late — a patient already waiting on a
   call outranks a note that can be signed this evening. */
export default function DoctorHome() {
  const { name, mine, panel } = useDoctor()

  const consults = mine('telemedicine')
  const live = consults.find((c) => c.status === 'Live')
  const waiting = consults.filter((c) => c.status === 'Waiting')
  const queued = consults.filter((c) => c.status === 'Queued')

  const appts = mine('appointments')
  const today = appts.filter((a) => a.date === localISO() && a.status !== 'Cancelled')
  const next = upcoming(appts).slice(0, 6)
  const pending = appts.filter((a) => a.status === 'Pending')

  const notes = mine('emr')
  const unsigned = notes.filter((r) => r.status !== 'Signed')
  const labs = mine('laboratory')
  const vitals = mine('rpm')

  /* Same list the bell shows, from the same builder. Two derivations of
     "what needs you" is how a badge count and a page end up disagreeing. */
  const attention = doctorNotifications({
    consults,
    appointments: appts,
    notes,
    prescriptions: mine('prescriptions'),
    labs,
    vitals,
  })

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">
            {greeting()}, {firstName(name)}
          </h1>
          <p className="pf-sub">
            {today.length
              ? `${today.length} appointment${today.length > 1 ? 's' : ''} booked today.`
              : 'Nothing booked for today.'}
          </p>
        </div>
        <Link to="/doctor/consults" className="btn btn-primary">
          <Video size={16} /> Open consult queue
        </Link>
      </header>

      {/* A patient already on the call, or already waiting, outranks the page. */}
      {(live || waiting.length > 0) && (
        <Link
          to="/doctor/consults"
          className="pf-warn"
          style={{ '--tc': live ? 'var(--tone-violet)' : 'var(--tone-amber)', marginBottom: 18 }}
        >
          <Video size={17} />
          <span>
            {live ? (
              <>
                <strong>{live.patient}</strong> is on the call now — {live.mode.toLowerCase()},{' '}
                {live.reason || 'consultation'}.
              </>
            ) : (
              <>
                <strong>
                  {waiting.length} patient{waiting.length > 1 ? 's are' : ' is'} in the waiting room
                </strong>{' '}
                — {waiting.map((w) => w.patient).join(', ')}.
              </>
            )}
          </span>
        </Link>
      )}

      <section className="pf-cards">
        <div className="pf-card">
          <div className="pf-card-head">
            <CalendarClock size={15} /> Today
          </div>
          <div className="pf-card-big">{today.length}</div>
          <div className="pf-card-line">{pending.length} awaiting confirmation</div>
          <Link to="/doctor/schedule" className="pf-card-link">
            Open schedule <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Video size={15} /> In queue
          </div>
          <div className="pf-card-big">{waiting.length + queued.length}</div>
          <div className="pf-card-line">
            {waiting.length} waiting · {queued.length} queued
          </div>
          <Link to="/doctor/consults" className="pf-card-link">
            Admit next <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <FileText size={15} /> Unsigned notes
          </div>
          <div className="pf-card-big">{unsigned.length}</div>
          <div className="pf-card-line">
            {unsigned.length === 0 ? 'Nothing outstanding' : 'awaiting your signature'}
          </div>
          {unsigned.length > 0 && (
            <Link to="/doctor/notes" className="pf-card-link">
              Sign off <ArrowRight size={13} />
            </Link>
          )}
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Users size={15} /> My panel
          </div>
          <div className="pf-card-big">{panel.length}</div>
          <div className="pf-card-line">patients under your care</div>
          <Link to="/doctor/patients" className="pf-card-link">
            View <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <div className="pf-two">
        <section className="pf-panel">
          <div className="pf-panel-head">
            <AlertTriangle size={15} /> Needs you
            <span className="count">{attention.length}</span>
          </div>
          <div className="pf-panel-body">
            {attention.length === 0 && (
              <p className="pf-empty">
                <CheckCircle2 size={22} />
                Nothing is waiting on you.
              </p>
            )}
            {attention.map((a) => (
              <Link className="pf-row" key={a.id} to={a.to}>
                <span className={`pf-dot tone-${a.tone}`} />
                <div>
                  <div className="pf-row-title">{a.title}</div>
                  <div className="pf-row-sub">{a.sub}</div>
                </div>
                <ArrowRight size={15} className="pf-row-go" />
              </Link>
            ))}
          </div>
        </section>

        <div>
          <section className="pf-panel">
            <div className="pf-panel-head">
              <CalendarClock size={15} /> Next appointments
              <span className="count">{next.length}</span>
            </div>
            <div className="pf-panel-body">
              {next.length === 0 && <p className="pf-empty">Nothing booked ahead.</p>}
              {next.map((a) => (
                <Link className="pf-row" key={a.resourceId} to="/doctor/schedule">
                  <span className="pf-time">{a.time}</span>
                  <div>
                    <div className="pf-row-title">{a.patient}</div>
                    <div className="pf-row-sub">
                      {prettyDate(a.date)} · {a.type}
                      {a.hospital ? ` · ${a.hospital}` : ''}
                    </div>
                  </div>
                  <span
                    className={`pill tone-${
                      a.status === 'Confirmed' ? 'green' : a.status === 'Urgent' ? 'rose' : 'amber'
                    }`}
                  >
                    {a.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="pf-panel">
            <div className="pf-panel-head">
              <Activity size={15} /> Remote monitoring
              <span className="count">{vitals.length}</span>
            </div>
            <div className="pf-panel-body">
              {vitals.length === 0 && (
                <p className="pf-empty">No patients on remote monitoring.</p>
              )}
              {vitals.map((v) => (
                <div className="pf-row" key={v.resourceId}>
                  <span
                    className={`pf-dot tone-${
                      v.status === 'Critical' ? 'rose' : v.status === 'High' ? 'amber' : 'green'
                    }`}
                  />
                  <div>
                    <div className="pf-row-title">{v.patient}</div>
                    <div className="pf-row-sub">
                      {v.device} · {v.reading}
                    </div>
                  </div>
                  <span
                    className={`pill tone-${
                      v.status === 'Critical' ? 'rose' : v.status === 'High' ? 'amber' : 'green'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {labs.length === 0 && panel.length === 0 && (
        <p className="pf-note">
          <FlaskConical size={14} />
          Nothing is linked to you yet. Records are matched by doctor id — if you expect to see a
          caseload here, check the records name you under the scheduling name shown on your profile.
        </p>
      )}
    </>
  )
}
