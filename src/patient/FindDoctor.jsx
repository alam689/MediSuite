import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, CalendarPlus, CheckCircle2, Search, MapPin, Video, Building2, History } from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Calendar from './Calendar.jsx'
import SearchSelect from './SearchSelect.jsx'
import { usePatient } from './PatientContext.jsx'
import { prettyDate, schedulingName, parseDays, chambersFor, slotsFor, localISO } from './helpers.js'

export default function FindDoctor() {
  const { records, add } = useData()
  const { name, me, mine } = usePatient()
  const toast = useToast()
  const navigate = useNavigate()

  const doctors = records('doctors')
  const appointments = records('appointments')

  const [part, setPart] = useState('all') // 'all' registered | 'mine' visited earlier
  const [q, setQ] = useState('')
  const [spec, setSpec] = useState('All')
  const [hospital, setHospital] = useState('') // free text: '' means any
  const [booking, setBooking] = useState(null) // the doctor being booked
  const [chamber, setChamber] = useState(null) // the chosen hospital/clinic
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('Video')
  const [done, setDone] = useState(null)

  const specialities = useMemo(
    () => ['All', ...new Set(doctors.map((d) => d.specialization).filter(Boolean))],
    [doctors]
  )

  /* "My doctors": everyone this patient has actually seen — past (not
     cancelled) appointments, consults, prescriptions written for them and
     visits on the record. Those records store the short scheduling name
     ("Dr. Malik"), so registry entries are matched via schedulingName().
     The value is the most recent contact date, for the "last visit" line. */
  const myDoctors = useMemo(() => {
    const seen = new Map()
    const note = (doctor, dateIso) => {
      if (!doctor) return
      const prev = seen.get(doctor) || ''
      if (String(dateIso || '') >= prev) seen.set(doctor, dateIso || prev)
    }
    const today = localISO()
    for (const a of mine('appointments'))
      if (a.status !== 'Cancelled' && (a.date || '') < today) note(a.doctor, a.date)
    for (const c of mine('telemedicine')) if (c.status !== 'Cancelled') note(c.doctor, c.date)
    for (const r of mine('prescriptions'))
      note(r.doctor, r.issuedAt ? new Date(r.issuedAt).toISOString().slice(0, 10) : '')
    for (const v of me?.visits || []) note(v.doctor, v.date)
    return seen
  }, [mine, me])

  const lastSeen = (d) => myDoctors.get(schedulingName(d.name))
  const myCount = useMemo(
    () => doctors.filter((d) => d.status !== 'On leave' && myDoctors.has(schedulingName(d.name))).length,
    [doctors, myDoctors]
  )

  /* "History" opens My records scoped to this doctor — one place for the
     whole shared record, same page the patient already knows. */
  const openHistory = (d) =>
    navigate(`/patient/records?doctor=${encodeURIComponent(schedulingName(d.name))}`)

  /* Every hospital any bookable doctor sits at — the suggestion list. */
  const hospitals = useMemo(
    () =>
      [
        ...new Set(
          doctors
            .filter((d) => d.status !== 'On leave')
            .flatMap((d) => (d.chambers || []).map((c) => c?.name).filter(Boolean))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [doctors]
  )

  /* Substring match, not an exact one: typing "metro" should find both Metro
     General and Metro Imaging without knowing either full name. */
  const hospitalQ = hospital.trim().toLowerCase()
  const matchesHospital = (d) =>
    !hospitalQ ||
    (d.chambers || []).some((c) => (c?.name || '').toLowerCase().includes(hospitalQ)) ||
    (d.chambers || []).some((c) => (c?.address || '').toLowerCase().includes(hospitalQ))

  const list = useMemo(
    () =>
      doctors.filter((d) => {
        if (d.status === 'On leave') return false // don't offer someone who can't be booked
        if (part === 'mine' && !myDoctors.has(schedulingName(d.name))) return false
        if (spec !== 'All' && d.specialization !== spec) return false
        if (!matchesHospital(d)) return false
        const hay = `${d.name} ${d.specialization || ''}`.toLowerCase()
        return hay.includes(q.trim().toLowerCase())
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doctors, q, spec, hospitalQ, part, myDoctors]
  )

  /* How many hospitals the current text matches — shown so a typo reads as
     "no match" rather than an empty doctor list with no explanation. */
  const hospitalMatches = useMemo(
    () => (hospitalQ ? hospitals.filter((h) => h.toLowerCase().includes(hospitalQ)) : hospitals),
    [hospitals, hospitalQ]
  )

  /* Which weekdays this doctor actually sits at the chosen chamber. The
     calendar greys out the rest — a patient shouldn't be able to request a
     day the doctor is demonstrably somewhere else. */
  const openDays = useMemo(() => (chamber ? parseDays(chamber.days) : null), [chamber])

  /* Slots come from the chosen chamber's opening hours, not a fixed list. */
  const slots = useMemo(() => (chamber ? slotsFor(chamber) : []), [chamber])

  /* The chambers offered for the doctor currently being booked. */
  const bookingRooms = useMemo(() => (booking ? chambersFor(booking) : []), [booking])

  /* Slots already taken for this doctor on this date — the same rule the
     clinician-side booking uses, reading the same records. */
  const taken = useMemo(() => {
    if (!booking) return new Set()
    const scheduling = schedulingName(booking.name)
    return new Set(
      appointments
        .filter((a) => a.doctor === scheduling && a.date === date && a.status !== 'Cancelled')
        .map((a) => a.time)
    )
  }, [appointments, booking, date])

  const openBooking = (doc) => {
    const rooms = chambersFor(doc)
    // Open on the hospital they searched for, if that's why this doctor is on
    // screen — matching the same substring rule the filter used.
    const preferred =
      (hospitalQ && rooms.find((c) => (c.name || '').toLowerCase().includes(hospitalQ))) || rooms[0]
    setBooking(doc)
    setChamber(preferred)
    setDate('')
    setTime('')
    setType(preferred.online ? 'Video' : 'In-person')
  }

  const pickChamber = (c) => {
    setChamber(c)
    // The new hospital may not open on the day already chosen, so clear it
    // rather than silently keep an impossible date.
    setDate('')
    setTime('')
    if (c.online) setType('Video')
  }

  const confirm = () => {
    if (!time || !date || !booking) return
    const record = {
      resourceId: newId('AP'),
      patient: name,
      // Book under the clinic's scheduling name, not the display name — see
      // schedulingName(). Otherwise this appointment is invisible to the
      // clinic's own conflict checks.
      doctor: schedulingName(booking.name),
      hospital: chamber?.online ? 'Online consultation' : chamber?.name,
      date,
      time,
      type,
      // Patient-initiated bookings are requests: a clinician confirms them.
      // Self-confirming would misrepresent who holds the decision.
      status: 'Pending',
    }
    add('appointments', record, {
      title: 'Appointment requested by patient',
      sub: `${name} · ${time} · ${booking.name} · ${record.hospital}`,
    })
    toast.success(`Requested ${time} with ${booking.name}`, { title: record.resourceId })
    setDone({ ...record, fee: booking.fee })
    setBooking(null)
  }

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Find a doctor</h1>
          <p className="pt-sub">Search by name or speciality, then pick a time that suits you.</p>
        </div>
      </header>

      <div className="pt-chips" style={{ marginBottom: 12 }}>
        <button className={`pt-chip ${part === 'all' ? 'on' : ''}`} onClick={() => setPart('all')}>
          All doctors
        </button>
        <button className={`pt-chip ${part === 'mine' ? 'on' : ''}`} onClick={() => setPart('mine')}>
          My doctors{myCount ? ` (${myCount})` : ''}
        </button>
      </div>

      <div className="pt-filters">
        <span style={{ position: 'relative', flex: 1, display: 'flex' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-faint)' }}
          />
          <input
            className="pt-search"
            style={{ paddingLeft: 36 }}
            placeholder="Search doctors or specialities…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </span>
        <select className="pt-select" value={spec} onChange={(e) => setSpec(e.target.value)}>
          {specialities.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All specialities' : s}
            </option>
          ))}
        </select>
        <SearchSelect
          value={hospital}
          onChange={setHospital}
          options={hospitals}
          icon={Building2}
          label="Filter by hospital"
          placeholder="Any hospital — click or type to search…"
          emptyText="No hospital matches"
        />
      </div>

      {hospitalQ && hospitalMatches.length === 0 && (
        <p className="pt-filter-note">
          No hospital matches “{hospital}”. Try{' '}
          {hospitals.slice(0, 3).map((h, i) => (
            <span key={h}>
              {i > 0 && ', '}
              <button type="button" className="pt-link-btn" onClick={() => setHospital(h)}>
                {h}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      {list.length === 0 ? (
        <div className="pt-panel">
          <p className="pt-empty">
            {part === 'mine' && !myCount
              ? 'No doctors here yet — once you have a consultation or a prescription, that doctor appears in this list.'
              : 'No doctors match that search.'}
          </p>
        </div>
      ) : (
        <div className="pt-docs">
          {list.map((d) => (
            <article className="pt-doc" key={d.resourceId}>
              <div className="pt-doc-top">
                <Avatar src={d.photo} name={d.name} size={46} />
                <div>
                  <div className="pt-doc-name">{d.name}</div>
                  <div className="pt-doc-spec">{d.specialization}</div>
                </div>
              </div>
              <div className="pt-doc-meta">
                <span>
                  <Star size={12} style={{ verticalAlign: -1 }} /> <b>{d.rating || '—'}</b>
                </span>
                <span>
                  Fee <b>{d.fee || '—'}</b>
                </span>
                <span className={`pill tone-${d.status === 'Available' ? 'green' : 'blue'}`}>
                  {d.status}
                </span>
              </div>
              {part === 'mine' && lastSeen(d) && (
                <div className="pt-row-sub" style={{ marginTop: 6 }}>
                  Last visit: {prettyDate(lastSeen(d))}
                </div>
              )}
              <div className="pt-doc-places">
                {chambersFor(d).map((c) => (
                  <span className="pt-doc-place" key={c.name} title={`${c.address} · ${c.days}`}>
                    {c.online ? <Video size={11} /> : <Building2 size={11} />}
                    {c.name}
                  </span>
                ))}
              </div>
              {part === 'mine' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => openHistory(d)}>
                    <History size={15} /> History
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openBooking(d)}>
                    <CalendarPlus size={15} /> Book
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={() => openBooking(d)}>
                  <CalendarPlus size={15} /> Book
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Slot picker */}
      <Modal
        open={!!booking}
        onClose={() => setBooking(null)}
        title={booking ? `Book with ${booking.name}` : ''}
        subtitle={booking ? `${booking.specialization} · ${booking.fee || ''}` : ''}
        width={760}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setBooking(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirm} disabled={!time || !date}>
              {date && time ? `Request ${prettyDate(date)}, ${time}` : 'Pick a date and time'}
            </button>
          </>
        }
      >
        {/* Where on the left, when on the right — the calendar sits beside the
            hospital list instead of pushing it off-screen. */}
        <div className="pt-book">
        <div className="pt-book-left">
        {/* 1 — where */}
        <span className="pt-step-label">
          Choose hospital / chamber
          {bookingRooms.length > 1 && (
            <em className="pt-step-hint">{bookingRooms.length} locations</em>
          )}
        </span>
        <SearchSelect
          strict
          value={chamber?.name || ''}
          onChange={(nextName) => {
            const next = bookingRooms.find((c) => c.name === nextName)
            if (next) pickChamber(next)
          }}
          options={bookingRooms.map((c) => ({
            value: c.name,
            label: c.name,
            // The days sit in the option itself, so two chambers can be
            // compared without selecting each one to find out.
            hint: `${c.address} · ${c.days}`,
          }))}
          icon={chamber?.online ? Video : Building2}
          label="Hospital or chamber"
          placeholder="Search hospitals…"
          emptyText="No chamber matches"
        />

        {/* The chosen chamber's detail stays on screen — the calendar's day
            and time limits come from exactly these two lines. */}
        {chamber && (
          <div className="pt-chamber-detail">
            <span className="pt-chamber-sub">
              <MapPin size={11} /> {chamber.address}
            </span>
            <span className="pt-chamber-days">
              {chamber.days} · {chamber.from}–{chamber.to}
            </span>
          </div>
        )}

        {/* 2 — how */}
        <span className="pt-step-label">Consultation type</span>
        <select
          className="pt-select"
          style={{ width: '100%' }}
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={chamber?.online}
        >
          <option>Video</option>
          <option>In-person</option>
        </select>
        {chamber?.online && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-faint)' }}>
            This doctor has no chamber listed, so the consultation is by video.
          </p>
        )}
        </div>

        <div className="pt-book-right">
          {/* 3 — when */}
          <span className="pt-step-label">
            Choose a date
            {chamber && <em className="pt-step-hint">{chamber.days}</em>}
          </span>
          <Calendar
            value={date}
            onChange={(d) => {
              setDate(d)
              setTime('')
            }}
            enabledDays={openDays}
          />

          {/* 4 — what time */}
          <span className="pt-step-label">
            Available times
            {date && chamber && (
              <em className="pt-step-hint">
                {prettyDate(date)} · {chamber.from}–{chamber.to}
              </em>
            )}
          </span>
          {!date ? (
            <p className="pt-slot-empty">Pick a date to see available times.</p>
          ) : (
            <>
              <div className="pt-slots">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pt-slot ${time === s ? 'on' : ''}`}
                    disabled={taken.has(s)}
                    title={taken.has(s) ? 'Already booked' : undefined}
                    onClick={() => setTime(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="pt-slot-note">
                Crossed-out times are already taken. Your request goes to the clinic — you'll get a
                confirmation once it's accepted.
              </p>
            </>
          )}
        </div>
        </div>
      </Modal>

      {/* Confirmation */}
      <Modal
        open={!!done}
        onClose={() => setDone(null)}
        title="Appointment requested"
        subtitle={done?.resourceId}
        width={440}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDone(null)}>
              Book another
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/patient')}>
              Done
            </button>
          </>
        }
      >
        {done && (
          <div style={{ display: 'flex', gap: 12 }}>
            <CheckCircle2 size={22} style={{ color: 'var(--tone-green)', flex: 'none' }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>
                {prettyDate(done.date)} at {done.time}
              </strong>
              <br />
              {done.doctor} · {done.type}
              <br />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <MapPin size={12} /> {done.hospital}
              </span>
              {done.fee && (
                <>
                  <br />
                  Fee {done.fee} — payable after the clinic confirms.
                </>
              )}
              <br />
              <br />
              Status is <strong>Pending</strong> until the clinic confirms it. You'll see it on your
              home screen either way.
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
