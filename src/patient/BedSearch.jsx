import { useMemo, useState } from 'react'
import {
  BedDouble,
  Building2,
  Phone,
  AlertTriangle,
  MapPin,
  Clock,
  RefreshCw,
  CalendarPlus,
  CreditCard,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useData, newId, relTime } from '../store/DataStore.jsx'
import { CARE_UNITS, freeBeds } from '../data/schemas.js'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { Field, Select, TextInput, TextArea } from '../components/ui/Field.jsx'
import { usePatient } from './PatientContext.jsx'
import SearchSelect from './SearchSelect.jsx'

/* =====================================================================
   Critical-care bed search.

   The most important thing on this page is the warning at the top, not the
   search. Someone looking up ICU beds is often in the worst hour of their
   life, and a bed count is a snapshot that can be wrong by the time they
   read it. So:

   - the emergency notice comes first and cannot be dismissed;
   - every result shows how old its number is, and anything past
     STALE_MINUTES is called out rather than quietly presented as current;
   - "call to confirm" is the primary action on every card, not "reserve".
     This platform cannot hold a critical-care bed, and a button implying it
     could would be a dangerous lie.

   Booking sits *beside* that call, never in front of it. A booking here is
   a request with a deposit: it creates an admissions record the hospital
   has to accept or decline, and it never decrements the bed count — a bed
   this page claimed to hold, and then didn't, is the exact failure the
   warnings above exist to prevent.
   ===================================================================== */

const STALE_MINUTES = 30

/* Deposit per unit, credited against the final bill. Real tariffs come from
   the facility's service catalogue (see the departments module); these are
   seeded so the flow has a number to carry. */
const DEPOSIT = {
  ICU: 400,
  'CCU (cardiac)': 350,
  'HDU (high dependency)': 250,
  'NICU (newborn)': 400,
  'PICU (paediatric)': 350,
  'Ventilator / life support': 450,
  Isolation: 200,
}
const depositFor = (unit) => DEPOSIT[unit] ?? 250
const money = (n) => `$${n.toLocaleString()}`

const ARRIVALS = ['Within the hour', 'Later today', 'Tomorrow', 'Within 3 days']
const PAYERS = ['Self-pay', 'Insurance', 'Corporate', 'Government scheme']

/* Bookings a patient can still act on — anything the hospital has moved on
   from belongs to the admission, not to this page. */
const LIVE_BOOKING = new Set(['Reserved', 'Admitted'])

/* Availability is derived from the counts, never from a stored label, so it
   cannot contradict the numbers next to it. */
function availability(r) {
  if (r.status === 'Closed') return { key: 'closed', label: 'Closed', tone: 'rose' }
  if (r.status === 'Diverting') return { key: 'divert', label: 'Not accepting', tone: 'amber' }
  const free = freeBeds(r)
  if (free === 0) return { key: 'full', label: 'Full', tone: 'rose' }
  if (free <= 2) return { key: 'limited', label: 'Limited', tone: 'amber' }
  return { key: 'open', label: 'Beds available', tone: 'green' }
}

const RANK = { open: 0, limited: 1, divert: 2, full: 3, closed: 4 }

export default function BedSearch() {
  const { records, add, patch, remove } = useData()
  const { me, name, mine } = usePatient()
  const toast = useToast()
  const rows = records('capacity')

  const [hospital, setHospital] = useState('')
  const [unit, setUnit] = useState('All')

  const [booking, setBooking] = useState(null) // capacity row being booked
  const [form, setForm] = useState(null)
  const [done, setDone] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  /* This patient's own bed bookings, keyed by the capacity row they were
     made against so a card can show its own state. */
  const myBookings = mine('admissions').filter((a) => a.capacityId && LIVE_BOOKING.has(a.status))
  const bookingFor = (r) => myBookings.find((a) => a.capacityId === r.resourceId)

  const hospitals = useMemo(
    () => [...new Set(rows.map((r) => r.hospital).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const q = hospital.trim().toLowerCase()
  const results = useMemo(() => {
    return rows
      .filter((r) => {
        if (unit !== 'All' && r.unit !== unit) return false
        if (!q) return true
        return (
          (r.hospital || '').toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const d = RANK[availability(a).key] - RANK[availability(b).key]
        if (d !== 0) return d
        return freeBeds(b) - freeBeds(a)
      })
  }, [rows, unit, q])

  const totalFree = results.reduce(
    (n, r) => n + (availability(r).key === 'open' || availability(r).key === 'limited' ? freeBeds(r) : 0),
    0
  )

  const openBooking = (r) => {
    setBooking(r)
    setForm({
      phone: me?.phone || '',
      arrival: ARRIVALS[0],
      payer: me?.insurance ? 'Insurance' : 'Self-pay',
      reason: '',
      payNow: true,
    })
  }

  /* One booking writes two records, because they answer different
     questions: admissions owns "who is asking for a bed here", billing owns
     "what is owed for it". Both carry the other's id so neither side has to
     guess. */
  const confirmBooking = () => {
    if (!booking || !form) return
    const deposit = depositFor(booking.unit)
    const admissionId = newId('ADM')
    const invoiceId = newId('INV')

    add(
      'admissions',
      {
        resourceId: admissionId,
        patient: name,
        patientId: me?.resourceId,
        hospital: booking.hospital,
        unit: booking.unit,
        bed: 'Not assigned',
        doctor: '',
        diagnosis: form.reason.trim(),
        payer: form.payer,
        // Requested, not held. Admissions confirms or declines it.
        status: 'Reserved',
        capacityId: booking.resourceId,
        contactPhone: form.phone.trim(),
        arrival: form.arrival,
        depositId: invoiceId,
        requestedAt: Date.now(),
      },
      {
        title: 'Bed booking requested by patient',
        sub: `${name} · ${booking.unit} · ${booking.hospital} · arriving ${form.arrival.toLowerCase()}`,
      }
    )

    add(
      'billing',
      {
        resourceId: invoiceId,
        party: name,
        // `party` is what the hospital's billing table shows; `patient` is
        // what the patient portal joins on. Carry both.
        patient: name,
        patientId: me?.resourceId,
        category: 'In-patient',
        hospital: booking.hospital,
        date: new Date().toISOString().slice(0, 10),
        amount: money(deposit),
        status: form.payNow ? 'Paid' : 'Due',
        admissionId,
        note: `Bed booking deposit · ${booking.unit}`,
      },
      {
        title: form.payNow ? 'Bed deposit paid by patient' : 'Bed deposit invoiced',
        sub: `${name} · ${money(deposit)} · ${booking.unit}`,
      }
    )

    toast.success(
      form.payNow
        ? `Booking requested — ${money(deposit)} deposit paid`
        : `Booking requested — ${money(deposit)} due at the hospital`,
      { title: admissionId }
    )
    setDone({
      admissionId,
      invoiceId,
      deposit,
      paid: form.payNow,
      unit: booking.unit,
      hospital: booking.hospital,
      phone: booking.phone,
      arrival: form.arrival,
    })
    setBooking(null)
    setForm(null)
  }

  /* Cancelling drops an unpaid deposit outright — nothing is owed for a
     booking that never happened. A paid one stays on the account as a
     refund line, because money that moved has to remain visible. */
  const cancelBooking = () => {
    const b = cancelling
    if (!b) return
    setCancelling(null)
    const invoice = records('billing').find((i) => i.resourceId === b.depositId)
    patch('admissions', b.resourceId, { status: 'Cancelled' }, {
      title: 'Bed booking cancelled by patient',
      sub: `${name} · ${b.unit} · ${b.hospital}`,
    })
    if (invoice && invoice.status !== 'Paid') {
      remove('billing', invoice.resourceId, {
        title: 'Bed deposit invoice voided',
        sub: `${name} · ${invoice.amount} · booking cancelled`,
      })
      toast.info('Booking cancelled — nothing to pay.')
    } else if (invoice) {
      toast.info(`Booking cancelled — ${invoice.amount} deposit refund is with the hospital.`)
    } else {
      toast.info('Booking cancelled.')
    }
  }

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Critical care beds</h1>
          <p className="pt-sub">ICU, CCU, ventilator and high-dependency availability.</p>
        </div>
      </header>

      {/* Comes first, deliberately. */}
      <div className="bed-emergency">
        <AlertTriangle size={20} />
        <div>
          <strong>If this is an emergency, do not use this page to decide where to go.</strong>
          <span>
            Call your local emergency number or go to the nearest emergency department now. Ambulance
            crews route to the right hospital and can pre-alert them — that is faster and safer than
            searching here. This list is a guide for planning, not a live booking system.
          </span>
        </div>
      </div>

      <div className="pt-filters">
        <SearchSelect
          value={hospital}
          onChange={setHospital}
          options={hospitals}
          icon={Building2}
          label="Search hospital or area"
          placeholder="Any hospital or area — click or type to search…"
          emptyText="No hospital matches"
        />
      </div>

      <div className="pt-chips">
        {['All', ...CARE_UNITS].map((u) => (
          <button key={u} className={`pt-chip ${unit === u ? 'on' : ''}`} onClick={() => setUnit(u)}>
            {u === 'All' ? 'All units' : u}
          </button>
        ))}
      </div>

      <p className="bed-count">
        {results.length === 0
          ? 'No units match your search.'
          : `${results.length} unit${results.length > 1 ? 's' : ''} · ${totalFree} bed${totalFree === 1 ? '' : 's'} reported free`}
      </p>

      <div className="bed-grid">
        {results.map((r) => {
          const av = availability(r)
          const free = freeBeds(r)
          const stale = Date.now() - Number(r.updatedAt || 0) > STALE_MINUTES * 60000
          return (
            <article className={`bed-card tone-${av.tone}`} key={r.resourceId}>
              <div className="bed-top">
                <div>
                  <div className="bed-unit">{r.unit}</div>
                  <div className="bed-hosp">{r.hospital}</div>
                  <div className="bed-addr">
                    <MapPin size={11} /> {r.address}
                  </div>
                </div>
                <span className={`pill tone-${av.tone}`}>{av.label}</span>
              </div>

              <div className="bed-figures">
                <div className="bed-free">
                  <b>{av.key === 'closed' || av.key === 'divert' ? '—' : free}</b>
                  <span>free of {r.total}</span>
                </div>
                <div
                  className="bed-bar"
                  role="img"
                  aria-label={`${free} of ${r.total} beds free`}
                  title={`${r.occupied} occupied · ${free} free`}
                >
                  <span style={{ width: `${r.total ? (Number(r.occupied || 0) / r.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className={`bed-updated ${stale ? 'stale' : ''}`}>
                {stale ? <RefreshCw size={12} /> : <Clock size={12} />}
                {stale
                  ? `Last updated ${relTime(r.updatedAt)} — may be out of date, call first`
                  : `Updated ${relTime(r.updatedAt)}`}
              </div>

              {bookingFor(r) && (
                <div className={`bed-booked ${bookingFor(r).status === 'Admitted' ? 'ok' : ''}`}>
                  <CheckCircle2 size={13} />
                  <span>
                    {bookingFor(r).status === 'Admitted'
                      ? 'Your booking is confirmed'
                      : 'Booking requested — waiting for the hospital'}
                    <em>{bookingFor(r).resourceId}</em>
                  </span>
                </div>
              )}

              <div className="bed-actions">
                {r.phone && (
                  <a className="btn btn-primary bed-call" href={`tel:${r.phone.replace(/\s/g, '')}`}>
                    <Phone size={15} /> Call to confirm
                  </a>
                )}
                {bookingFor(r) ? (
                  <button
                    className="btn btn-ghost bed-book"
                    onClick={() => setCancelling(bookingFor(r))}
                    disabled={bookingFor(r).status === 'Admitted'}
                    title={
                      bookingFor(r).status === 'Admitted'
                        ? 'Confirmed bookings are changed by the hospital'
                        : undefined
                    }
                  >
                    <X size={14} /> Cancel booking
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost bed-book"
                    onClick={() => openBooking(r)}
                    disabled={av.key !== 'open' && av.key !== 'limited'}
                    title={
                      av.key === 'open' || av.key === 'limited'
                        ? `Deposit ${money(depositFor(r.unit))}`
                        : 'This unit is not taking bookings right now'
                    }
                  >
                    <CalendarPlus size={14} /> Book · {money(depositFor(r.unit))}
                  </button>
                )}
              </div>
              <div className="bed-phone">{r.phone}</div>
            </article>
          )
        })}
      </div>

      {results.length === 0 && (
        <div className="pt-panel">
          <p className="pt-empty">
            Nothing matches that search. Try another hospital or area, or clear the unit filter.
          </p>
        </div>
      )}

      <p className="bed-foot">
        <BedDouble size={14} />
        <span>
          Bed numbers are reported by each facility and change minute to minute. A bed shown here may
          be taken by the time you arrive, and a unit shown as full may free one. <strong>Always
          call before travelling</strong> — a booking here is a request the hospital must accept, and
          this platform cannot hold a critical-care bed on its own.
        </span>
      </p>

      {/* Booking request */}
      <Modal
        open={!!booking}
        onClose={() => setBooking(null)}
        title={booking ? `Book a bed — ${booking.unit}` : ''}
        subtitle={booking ? `${booking.hospital} · ${booking.address}` : ''}
        width={520}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setBooking(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmBooking}
              disabled={!form?.phone.trim()}
            >
              {form?.payNow ? <CreditCard size={15} /> : <CalendarPlus size={15} />}
              {form?.payNow
                ? `Pay ${money(depositFor(booking?.unit))} & request`
                : 'Request bed'}
            </button>
          </>
        }
      >
        {booking && form && (
          <>
            <div className="bed-book-sum">
              <div>
                <b>{freeBeds(booking)}</b>
                <span>beds reported free</span>
              </div>
              <div>
                <b>{money(depositFor(booking.unit))}</b>
                <span>booking deposit</span>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="Contact number" required className="full">
                <TextInput
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="The number the hospital should call back on"
                />
              </Field>
              <Field label="Expected arrival">
                <Select
                  value={form.arrival}
                  onChange={(v) => setForm({ ...form, arrival: v })}
                  options={ARRIVALS}
                />
              </Field>
              <Field label="Who is paying">
                <Select
                  value={form.payer}
                  onChange={(v) => setForm({ ...form, payer: v })}
                  options={PAYERS}
                />
              </Field>
              <Field
                label="Reason / referring diagnosis"
                className="full"
                hint="Helps the unit decide whether they are the right place for this patient."
              >
                <TextArea
                  rows={2}
                  value={form.reason}
                  onChange={(v) => setForm({ ...form, reason: v })}
                  placeholder="e.g. post-operative ventilation, referred by Dr. Malik"
                />
              </Field>
            </div>

            <div className="bed-pay">
              <label className={form.payNow ? 'on' : ''}>
                <input
                  type="radio"
                  name="bed-pay"
                  checked={form.payNow}
                  onChange={() => setForm({ ...form, payNow: true })}
                />
                <span>
                  <b>Pay the deposit now</b>
                  <em>Refunded in full if the hospital cannot take the booking.</em>
                </span>
              </label>
              <label className={!form.payNow ? 'on' : ''}>
                <input
                  type="radio"
                  name="bed-pay"
                  checked={!form.payNow}
                  onChange={() => setForm({ ...form, payNow: false })}
                />
                <span>
                  <b>Pay at the hospital</b>
                  <em>The deposit is invoiced to your account and due on arrival.</em>
                </span>
              </label>
            </div>

            <p className="bed-book-note">
              <AlertTriangle size={13} />
              <span>
                This sends a request to {booking.hospital} — the bed is not held until they accept
                it, and the free count above can change in the meantime. If the patient is
                deteriorating now, call {booking.phone} or your emergency number instead.
                <br />
                <strong>Demo only:</strong> no card is collected and no money moves.
              </span>
            </p>
          </>
        )}
      </Modal>

      {/* Booking placed */}
      <Modal
        open={!!done}
        onClose={() => setDone(null)}
        title="Bed booking requested"
        subtitle={done?.admissionId}
        width={440}
        footer={
          <button className="btn btn-primary" onClick={() => setDone(null)}>
            Done
          </button>
        }
      >
        {done && (
          <div style={{ display: 'flex', gap: 12 }}>
            <CheckCircle2 size={22} style={{ color: 'var(--tone-green)', flex: 'none' }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>
                {done.unit} · {done.hospital}
              </strong>
              <br />
              Arriving {done.arrival.toLowerCase()}
              <br />
              Deposit {money(done.deposit)} —{' '}
              {done.paid ? `paid (${done.invoiceId})` : `due on arrival (${done.invoiceId})`}
              <br />
              <br />
              The unit has to accept this before the bed is held. Status stays{' '}
              <strong>Reserved</strong> until they do, and you can cancel it from the card.{' '}
              <strong style={{ color: 'var(--text)' }}>
                Call {done.phone} if you are travelling now.
              </strong>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel confirmation */}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this booking?"
        subtitle={cancelling?.resourceId}
        width={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCancelling(null)}>
              Keep booking
            </button>
            <button className="btn btn-ghost bed-danger" onClick={cancelBooking}>
              Cancel booking
            </button>
          </>
        }
      >
        {cancelling && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {cancelling.unit} at {cancelling.hospital} will be told you no longer need the bed.{' '}
            {records('billing').find((i) => i.resourceId === cancelling.depositId)?.status === 'Paid'
              ? 'Your deposit stays on your account until the hospital refunds it.'
              : 'The unpaid deposit invoice is removed — you will not owe anything.'}
          </p>
        )}
      </Modal>
    </>
  )
}
