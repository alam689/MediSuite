import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import SearchSelect from '../patient/SearchSelect.jsx'
import { parseDays, formatDays, formatClock, parseClock } from '../patient/helpers.js'

/* =====================================================================
   Add or update a practitioner's chamber at this facility.

   What this desk may decide: who sits here, on which days, at what hours,
   and at what address. That is the facility's own roster.

   What it may not: whether someone is licensed to practise. A new
   practitioner is created `In review` and cannot be cleared from here —
   that is the platform admin's call, and a hospital signing off its own
   doctors' credentials is exactly the control this separation exists to
   prevent.

   Days are picked, not typed. The string this writes feeds the patient
   booking calendar through parseDays(), so free text would let a typo
   silently remove a doctor's whole availability.
   ===================================================================== */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SPECIALITIES = [
  'Cardiology', 'Radiology', 'Dermatology', 'Neurology', 'Endocrinology',
  'Pulmonology', 'General Med', 'Paediatrics', 'Orthopaedics', 'Oncology',
]

/* "17:00" for an <input type=time> from whatever the chamber stored. */
const toTimeInput = (v) => {
  const m = parseClock(v)
  if (m == null) return ''
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export default function ChamberForm({
  open,
  onClose,
  onSave,
  facility,
  mode, // 'add' | 'edit'
  doctor, // when editing
  chamber, // when editing
  candidates = [], // doctors not yet at this facility
}) {
  const [tab, setTab] = useState('existing') // add mode only
  const [pick, setPick] = useState('')
  const [nw, setNw] = useState({ name: '', specialization: 'General Med', email: '', phone: '', license: '', fee: '$60' })
  const [days, setDays] = useState(() => new Set(parseDays(chamber?.days) || []))
  const [from, setFrom] = useState(toTimeInput(chamber?.from) || '17:00')
  const [to, setTo] = useState(toTimeInput(chamber?.to) || '21:00')
  const [address, setAddress] = useState(chamber?.address || '')
  const [err, setErr] = useState({})

  const toggle = (i) =>
    setDays((s) => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const candidateNames = useMemo(() => candidates.map((d) => d.name), [candidates])

  const submit = () => {
    const e = {}
    if (mode === 'add' && tab === 'existing' && !pick) e.pick = 'Choose a practitioner'
    if (mode === 'add' && tab === 'new' && !nw.name.trim()) e.name = 'Required'
    if (!days.size) e.days = 'Pick at least one day'
    const f = parseClock(from)
    const t = parseClock(to)
    if (f == null || t == null) e.time = 'Enter opening hours'
    else if (t <= f) e.time = 'Closing time must be after opening time'
    if (Object.keys(e).length) return setErr(e)

    onSave({
      mode,
      tab,
      existingName: pick,
      newDoctor: nw,
      chamber: {
        name: facility,
        address: address.trim() || undefined,
        days: formatDays(days),
        from: formatClock(from),
        to: formatClock(to),
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={mode === 'edit' ? `Update ${doctor?.name}` : `Add a practitioner`}
      subtitle={facility}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit}>
            {mode === 'edit' ? 'Save changes' : 'Add to this facility'}
          </button>
        </>
      }
    >
      {mode === 'add' && (
        <>
          <div className="hs-seg-row">
            <button className={`hs-seg ${tab === 'existing' ? 'on' : ''}`} onClick={() => setTab('existing')}>
              Existing practitioner
            </button>
            <button className={`hs-seg ${tab === 'new' ? 'on' : ''}`} onClick={() => setTab('new')}>
              Register new
            </button>
          </div>

          {tab === 'existing' ? (
            <label className="hs-field">
              <span>Practitioner</span>
              {candidateNames.length === 0 ? (
                <p className="hs-hint">
                  Every registered practitioner already holds a chamber here. Use “Register new” to
                  onboard someone.
                </p>
              ) : (
                <SearchSelect
                  strict
                  value={pick}
                  onChange={setPick}
                  options={candidates.map((d) => ({
                    value: d.name,
                    label: d.name,
                    hint: `${d.specialization} · ${d.status}`,
                  }))}
                  placeholder="Search practitioners…"
                  label="Practitioner"
                  emptyText="No practitioner matches"
                />
              )}
              {err.pick && <em className="hs-err">{err.pick}</em>}
            </label>
          ) : (
            <div className="hs-form">
              <label className="hs-field full">
                <span>Full name</span>
                <input className="hs-input" value={nw.name} onChange={(e) => setNw((s) => ({ ...s, name: e.target.value }))} placeholder="Dr. …" />
                {err.name && <em className="hs-err">{err.name}</em>}
              </label>
              <label className="hs-field">
                <span>Speciality</span>
                <select className="hs-input" value={nw.specialization} onChange={(e) => setNw((s) => ({ ...s, specialization: e.target.value }))}>
                  {SPECIALITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>Consultation fee</span>
                <input className="hs-input" value={nw.fee} onChange={(e) => setNw((s) => ({ ...s, fee: e.target.value }))} />
              </label>
              <label className="hs-field">
                <span>Email</span>
                <input className="hs-input" value={nw.email} onChange={(e) => setNw((s) => ({ ...s, email: e.target.value }))} />
              </label>
              <label className="hs-field">
                <span>Phone</span>
                <input className="hs-input" value={nw.phone} onChange={(e) => setNw((s) => ({ ...s, phone: e.target.value }))} />
              </label>
              <label className="hs-field full">
                <span>Licence / registration no.</span>
                <input className="hs-input" value={nw.license} onChange={(e) => setNw((s) => ({ ...s, license: e.target.value }))} placeholder="MDC-…" />
              </label>
              <p className="hs-warn full">
                <AlertTriangle size={13} />
                <span>
                  New practitioners are created <strong>In review</strong>. You cannot verify a
                  licence from this desk — the platform administrator checks it against the register
                  before they can be booked.
                </span>
              </p>
            </div>
          )}
        </>
      )}

      <label className="hs-field" style={{ marginTop: 14 }}>
        <span>Days at this facility</span>
        <div className="hs-days">
          {DOW.map((d, i) => (
            <button key={d} type="button" className={`hs-day ${days.has(i) ? 'on' : ''}`} onClick={() => toggle(i)}>
              {d}
            </button>
          ))}
        </div>
        {err.days && <em className="hs-err">{err.days}</em>}
        <p className="hs-hint">
          Patients can only pick these days when booking here — {formatDays(days) || 'none selected'}.
        </p>
      </label>

      <div className="hs-form">
        <label className="hs-field">
          <span>Opens</span>
          <input type="time" className="hs-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="hs-field">
          <span>Closes</span>
          <input type="time" className="hs-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {err.time && <em className="hs-err full">{err.time}</em>}
        <label className="hs-field full">
          <span>Address</span>
          <input className="hs-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Area, city" />
        </label>
      </div>

      <p className="hs-hint">
        Appointment slots come from these hours, so a patient can never request a time this chamber
        is shut.
      </p>
    </Modal>
  )
}
