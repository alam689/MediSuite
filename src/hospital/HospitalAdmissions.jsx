import { useMemo, useState } from 'react'
import {
  ClipboardPlus,
  Plus,
  LogOut,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  BedDouble,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, newId, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useHospital } from './HospitalContext.jsx'
import { CARE_UNITS, freeBeds } from '../data/schemas.js'
import { localISO, prettyDate } from '../patient/helpers.js'

const TONE = {
  Reserved: 'amber',
  Admitted: 'blue',
  Observation: 'amber',
  'For discharge': 'violet',
  Discharged: 'green',
  Transferred: 'teal',
  Declined: 'rose',
  Cancelled: 'rose',
}

/* A patient-side bed booking arrives as Reserved: a request against a unit,
   with nobody in a bed yet. It is deliberately kept off the ward board until
   someone here accepts it and gives it a bed — the board is "who is in the
   building", and a request is not a person on a ward. */
const PENDING = 'Reserved'
const CLOSED = ['Discharged', 'Transferred', 'Declined', 'Cancelled']

const WARDS = [...CARE_UNITS, 'General ward', 'Maternity', 'Surgical ward']

const blank = {
  patient: '',
  unit: 'General ward',
  bed: '',
  doctor: '',
  diagnosis: '',
  payer: 'Self-pay',
  admittedOn: '',
}

/* The ward board: who is in the building, in which bed, under whom.

   Kept separate from Bed Capacity on purpose. Capacity answers "is there
   room" and is a hand-maintained count; this answers "where is Mr Chen".
   Where the two disagree the page says so rather than quietly trusting one —
   an occupancy number nobody can reconcile is worse than two that visibly
   differ. */
export default function HospitalAdmissions() {
  const { facility, facilityLabel, isAll, admissions, units, staff } = useHospital()
  const { records, add, patch, remove } = useData()
  const toast = useToast()

  const [draft, setDraft] = useState(null)
  const [move, setMove] = useState(null)
  const [accept, setAccept] = useState(null)
  const [error, setError] = useState('')

  const patients = records('patients')

  const current = admissions.filter(
    (a) => !CLOSED.includes(a.status) && a.status !== PENDING
  )
  const closed = admissions.filter((a) => CLOSED.includes(a.status))
  const requests = admissions.filter((a) => a.status === PENDING)
  const forDischarge = current.filter((a) => a.status === 'For discharge')

  /* Where the ward board and the capacity count disagree. */
  const mismatches = useMemo(() => {
    const out = []
    for (const u of units) {
      const onBoard = current.filter(
        (a) => a.hospital === u.hospital && a.unit === u.unit
      ).length
      const counted = Number(u.occupied || 0)
      if (onBoard !== counted) {
        out.push({ unit: u, onBoard, counted })
      }
    }
    return out
  }, [units, current])

  const admit = () => {
    if (!draft.patient.trim()) return setError('Choose the patient being admitted.')
    if (!draft.bed.trim()) return setError('Give the bed a number — an admission with no bed is not a location.')

    const patient = patients.find((p) => p.name === draft.patient)
    const resourceId = newId('ADM')
    add(
      'admissions',
      {
        ...draft,
        resourceId,
        hospital: facility,
        patientId: patient?.resourceId,
        admittedOn: draft.admittedOn || localISO(),
        status: 'Admitted',
        admittedAt: Date.now(),
      },
      { title: 'Patient admitted', sub: `${resourceId} · ${draft.patient} · ${draft.unit} ${draft.bed}` }
    )
    toast.success(`Admitted to ${draft.unit} ${draft.bed}`, { title: draft.patient })
    setDraft(null)
  }

  const setStatus = (a, status, message) => {
    patch(
      'admissions',
      a.resourceId,
      { status, ...(status === 'Discharged' ? { dischargedAt: Date.now() } : {}) },
      { title: message, sub: `${a.resourceId} · ${a.patient}` }
    )
    toast.success(message, { title: a.patient })
  }

  /* Accepting a booking is an admission: it needs a bed like any other, so
     the same rule applies — no bed number, no admission. */
  const acceptBooking = () => {
    if (!accept.bed.trim()) return setError('Give the bed a number — a held bed with no number is not a bed.')
    const a = accept.a
    patch(
      'admissions',
      a.resourceId,
      {
        status: 'Admitted',
        unit: accept.unit,
        bed: accept.bed.trim(),
        doctor: accept.doctor,
        admittedOn: localISO(),
        admittedAt: Date.now(),
      },
      { title: 'Bed booking accepted', sub: `${a.resourceId} · ${a.patient} · ${accept.unit} ${accept.bed.trim()}` }
    )
    toast.success(`Bed ${accept.bed.trim()} held for ${a.patient}`, { title: a.resourceId })
    setAccept(null)
  }

  /* Declining voids an unpaid deposit outright; a paid one stays on the
     account so the refund the patient is owed remains visible. */
  const declineBooking = (a) => {
    const invoice = a.depositId
      ? records('billing').find((i) => i.resourceId === a.depositId)
      : null
    patch('admissions', a.resourceId, { status: 'Declined' }, {
      title: 'Bed booking declined',
      sub: `${a.resourceId} · ${a.patient} · ${a.unit}`,
    })
    if (invoice && invoice.status !== 'Paid') {
      remove('billing', invoice.resourceId, {
        title: 'Bed deposit invoice voided',
        sub: `${a.patient} · ${invoice.amount} · booking declined`,
      })
    }
    toast.info(
      invoice?.status === 'Paid'
        ? `Declined — ${invoice.amount} deposit to refund.`
        : 'Declined — the patient owes nothing.',
      { title: a.patient }
    )
  }

  const confirmMove = () => {
    if (!move.bed.trim()) return setError('Give the new bed a number.')
    patch(
      'admissions',
      move.a.resourceId,
      { unit: move.unit, bed: move.bed.trim() },
      {
        title: 'Patient transferred',
        sub: `${move.a.patient} · ${move.a.unit} ${move.a.bed} → ${move.unit} ${move.bed.trim()}`,
      }
    )
    toast.success(`Moved to ${move.unit} ${move.bed.trim()}`, { title: move.a.patient })
    setMove(null)
  }

  return (
    <>
      <header className="hs-head hs-head-row">
        <div>
          <h1 className="hs-title">Admissions</h1>
          <p className="hs-sub">
            {current.length} in-patient(s) at {facilityLabel}
            {forDischarge.length ? ` · ${forDischarge.length} ready to go home.` : '.'}
          </p>
        </div>
        {!isAll && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('')
              setDraft({ ...blank, admittedOn: localISO() })
            }}
          >
            <Plus size={16} /> Admit patient
          </button>
        )}
      </header>

      {isAll && (
        <p className="hs-note">
          <AlertTriangle size={13} />
          Choose a single clinic to admit a patient — a bed number only means something at one
          site.
        </p>
      )}

      {mismatches.length > 0 && (
        <div className="hs-warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <span>
            <strong>
              {mismatches.length} unit(s) disagree with the bed count on Beds &amp; units.
            </strong>{' '}
            {mismatches
              .map(
                (m) =>
                  `${m.unit.unit}${isAll ? ` at ${m.unit.hospital}` : ''}: ${m.onBoard} on the ward board vs ${m.counted} counted occupied`
              )
              .join('; ')}
            . Patients are shown the counted figure, so it is the one to fix.
          </span>
        </div>
      )}

      {/* Patient bed bookings waiting on a human. Above the ward board on
          purpose: someone is asking for a bed and has already paid a
          deposit — leaving that at the bottom of the page is how it gets
          missed. */}
      {requests.length > 0 && (
        <section className="hs-panel" style={{ marginBottom: 14 }}>
          <div className="hs-panel-head">
            <ClipboardPlus size={15} /> Bed booking requests
            <span className="count">{requests.length}</span>
          </div>
          <div className="hs-panel-body">
            {requests.map((a) => {
              const invoice = a.depositId
                ? records('billing').find((i) => i.resourceId === a.depositId)
                : null
              const unit = units.find((u) => u.unit === a.unit && u.hospital === a.hospital)
              const free = unit ? freeBeds(unit) : null
              return (
                <div className="hs-row" key={a.resourceId}>
                  <span className="hs-dot tone-amber" />
                  <div>
                    <div className="hs-row-title">
                      {a.patient} — {a.unit}
                    </div>
                    <div className="hs-row-sub">
                      {a.diagnosis || 'no reason given'} · arriving{' '}
                      {(a.arrival || 'unstated').toLowerCase()} · {a.payer}
                      {a.contactPhone && ` · ${a.contactPhone}`}
                      {invoice && ` · deposit ${invoice.amount} ${invoice.status.toLowerCase()}`}
                      {free !== null && ` · ${free} free by the count`}
                      {isAll && a.hospital && <span className="hs-site"> {a.hospital}</span>}
                    </div>
                  </div>
                  <div className="hs-row-actions">
                    <span className="pill tone-amber">Requested {relTime(a.requestedAt || Date.now())}</span>
                    <button
                      className="hs-btn ok"
                      onClick={() => {
                        setError('')
                        setAccept({ a, unit: a.unit, bed: '', doctor: '' })
                      }}
                    >
                      <CheckCircle2 size={13} /> Accept
                    </button>
                    <button className="hs-btn" onClick={() => declineBooking(a)}>
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="hs-panel" style={{ marginBottom: 14 }}>
        <div className="hs-panel-head">
          <BedDouble size={15} /> On the wards
          <span className="count">{current.length}</span>
        </div>
        <div className="hs-panel-body">
          {current.length === 0 && (
            <p className="hs-empty">
              <CheckCircle2 size={22} />
              No in-patients at {facilityLabel}.
            </p>
          )}
          {current.map((a) => (
            <div className="hs-row" key={a.resourceId}>
              <span className={`hs-dot tone-${TONE[a.status] || 'teal'}`} />
              <div>
                <div className="hs-row-title">
                  {a.patient} — {a.unit} {a.bed}
                </div>
                <div className="hs-row-sub">
                  {a.diagnosis || 'no admitting diagnosis'} · {a.doctor || 'no consultant'} ·{' '}
                  admitted {prettyDate(a.admittedOn)} · {a.payer}
                  {isAll && a.hospital && <span className="hs-site"> {a.hospital}</span>}
                </div>
              </div>
              <div className="hs-row-actions">
                <span className={`pill tone-${TONE[a.status] || 'teal'}`}>{a.status}</span>
                <button
                  className="hs-btn"
                  onClick={() => {
                    setError('')
                    setMove({ a, unit: a.unit, bed: a.bed || '' })
                  }}
                >
                  <ArrowRightLeft size={13} /> Move
                </button>
                {a.status !== 'For discharge' && (
                  <button
                    className="hs-btn"
                    onClick={() => setStatus(a, 'For discharge', 'Flagged for discharge')}
                  >
                    Plan discharge
                  </button>
                )}
                {a.status === 'For discharge' && (
                  <button
                    className="hs-btn ok"
                    onClick={() => setStatus(a, 'Discharged', 'Patient discharged — bed released')}
                  >
                    <LogOut size={13} /> Discharge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="hs-panel">
        <div className="hs-panel-head">
          <CheckCircle2 size={15} /> Discharged, transferred &amp; closed bookings
          <span className="count">{closed.length}</span>
        </div>
        <div className="hs-panel-body">
          {closed.length === 0 && <p className="hs-empty">Nothing closed yet.</p>}
          {closed.map((a) => (
            <div className="hs-row" key={a.resourceId}>
              <div>
                <div className="hs-row-title">{a.patient}</div>
                <div className="hs-row-sub">
                  {a.unit} {a.bed} · {a.diagnosis || '—'}
                  {a.dischargedAt && ` · left ${relTime(a.dischargedAt)}`}
                  {isAll && a.hospital && <span className="hs-site"> {a.hospital}</span>}
                </div>
              </div>
              <span className={`pill tone-${TONE[a.status] || 'teal'}`}>{a.status}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="hs-note">
        <BedDouble size={13} />
        Discharging here frees the ward bed on this board. It does <strong>not</strong> change the
        occupied count on Beds &amp; units — that count is maintained by hand and is what patients
        searching for a bed are shown. Update it there too.
      </p>

      {/* ---- Admit ---- */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Admit a patient"
        subtitle={facility}
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={admit}>
              <ClipboardPlus size={15} /> Admit
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="hs-form">
              <label className="hs-field full">
                <span>Patient</span>
                <select
                  className="hs-input"
                  value={draft.patient}
                  onChange={(e) => setDraft({ ...draft, patient: e.target.value })}
                >
                  <option value="">Select a patient…</option>
                  {patients.map((p) => (
                    <option key={p.resourceId} value={p.name}>
                      {p.name} · {p.resourceId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>Ward / unit</span>
                <select
                  className="hs-input"
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                >
                  {WARDS.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>Bed no.</span>
                <input
                  className="hs-input"
                  value={draft.bed}
                  placeholder="e.g. ICU-04"
                  onChange={(e) => setDraft({ ...draft, bed: e.target.value })}
                />
              </label>
              <label className="hs-field">
                <span>Consultant</span>
                <select
                  className="hs-input"
                  value={draft.doctor}
                  onChange={(e) => setDraft({ ...draft, doctor: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {staff.map((d) => (
                    <option key={d.resourceId} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>Admitted on</span>
                <input
                  className="hs-input"
                  type="date"
                  value={draft.admittedOn}
                  onChange={(e) => setDraft({ ...draft, admittedOn: e.target.value })}
                />
              </label>
              <label className="hs-field full">
                <span>Admitting diagnosis</span>
                <input
                  className="hs-input"
                  value={draft.diagnosis}
                  onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
                />
              </label>
              <label className="hs-field">
                <span>Payer</span>
                <select
                  className="hs-input"
                  value={draft.payer}
                  onChange={(e) => setDraft({ ...draft, payer: e.target.value })}
                >
                  {['Self-pay', 'Insurance', 'Corporate', 'Government scheme'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            {error && <span className="hs-err">{error}</span>}
            {(() => {
              const unit = units.find((u) => u.unit === draft.unit && u.hospital === facility)
              if (!unit) return null
              const free = freeBeds(unit)
              return (
                <p className="hs-hint">
                  {free > 0
                    ? `${free} bed(s) free in ${draft.unit} by the capacity count.`
                    : `${draft.unit} is recorded as full. You can still admit — the ward board and the count are maintained separately — but fix the count afterwards.`}
                </p>
              )
            })()}
          </>
        )}
      </Modal>

      {/* ---- Accept a bed booking ---- */}
      <Modal
        open={!!accept}
        onClose={() => setAccept(null)}
        title="Accept bed booking"
        subtitle={accept ? `${accept.a.patient} · ${accept.a.unit} · ${accept.a.hospital || facility}` : ''}
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAccept(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={acceptBooking}>
              <CheckCircle2 size={15} /> Accept &amp; hold bed
            </button>
          </>
        }
      >
        {accept && (
          <>
            <div className="hs-form">
              <label className="hs-field">
                <span>Ward / unit</span>
                <select
                  className="hs-input"
                  value={accept.unit}
                  onChange={(e) => setAccept({ ...accept, unit: e.target.value })}
                >
                  {WARDS.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>Bed no.</span>
                <input
                  className="hs-input"
                  value={accept.bed}
                  placeholder="e.g. ICU-04"
                  onChange={(e) => setAccept({ ...accept, bed: e.target.value })}
                />
              </label>
              <label className="hs-field full">
                <span>Consultant</span>
                <select
                  className="hs-input"
                  value={accept.doctor}
                  onChange={(e) => setAccept({ ...accept, doctor: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {staff.map((d) => (
                    <option key={d.resourceId} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <span className="hs-err">{error}</span>}
            <p className="hs-hint">
              {accept.a.contactPhone
                ? `Call ${accept.a.contactPhone} to confirm — the patient is told the bed is held as soon as you accept.`
                : 'The patient is told the bed is held as soon as you accept.'}{' '}
              This does not change the occupied count on Beds &amp; units; update it there when they
              arrive.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Transfer ---- */}
      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title="Move patient"
        subtitle={move ? `${move.a.patient} · currently ${move.a.unit} ${move.a.bed}` : ''}
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setMove(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmMove}>
              <ArrowRightLeft size={15} /> Move
            </button>
          </>
        }
      >
        {move && (
          <>
            <div className="hs-form">
              <label className="hs-field">
                <span>New ward / unit</span>
                <select
                  className="hs-input"
                  value={move.unit}
                  onChange={(e) => setMove({ ...move, unit: e.target.value })}
                >
                  {WARDS.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label className="hs-field">
                <span>New bed no.</span>
                <input
                  className="hs-input"
                  value={move.bed}
                  onChange={(e) => setMove({ ...move, bed: e.target.value })}
                />
              </label>
            </div>
            {error && <span className="hs-err">{error}</span>}
            <p className="hs-hint">
              A move inside the building keeps the same admission record, so length of stay and the
              admitting diagnosis carry over.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
