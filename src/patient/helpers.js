/* Shared patient-portal helpers. */

import { schemaMap } from '../data/schemas.js'

/* The seed data carries two naming conventions for the same person: the
   `doctors` module has full names ("Dr. Sara Malik"), while `appointments`
   and `telemedicine` use a short scheduling name ("Dr. Malik"). Booking under
   the full name would put patient appointments in a different namespace from
   the clinic's — the taken-slot check would miss existing bookings and the
   same slot could be handed out twice.

   So resolve the full name to whatever scheduling name the appointments
   schema already uses, by matching surname tokens. Falls back to the full
   name if there's no match, which is safe: a new doctor simply schedules
   under their own name. */
export function schedulingName(fullName = '') {
  const options = schemaMap.appointments?.formFields?.find((f) => f.key === 'doctor')?.options || []
  const parts = (s) =>
    s.toLowerCase().split(/\s+/).filter((t) => t && t !== 'dr' && t !== 'dr.')
  const full = parts(fullName)
  const hit = options.find((o) => {
    const p = parts(o)
    return p.length > 0 && p.every((t) => full.includes(t))
  })
  return hit || fullName
}

/* Calendar date in the *user's* zone, as YYYY-MM-DD.

   Not `toISOString().slice(0,10)`: that converts to UTC first, so anyone east
   of UTC between midnight and their offset gets yesterday's date. An
   appointment booked "today" would land on the wrong day — and the rest of
   the app reads these strings as local dates (see prettyDate), so the two
   must agree. Appointment dates are calendar days, not instants; the
   blueprint's "store timestamps in UTC" rule is about instants. */
export function localISO(d = new Date()) {
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

/* The next `n` calendar days from today, in the user's zone. */
export function nextDays(n = 7) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    out.push(localISO(d))
  }
  return out
}

/* The demo seed is dated around mid-July 2026, so "upcoming" is measured
   against the real clock and may legitimately be empty on a later date —
   the UI has an empty state for that rather than faking a date. */
export function upcoming(appointments = []) {
  const today = localISO()
  return appointments
    .filter((a) => a.status !== 'Cancelled' && (a.date || '') >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

export function past(appointments = []) {
  const today = localISO()
  return appointments
    .filter((a) => (a.date || '') < today || a.status === 'Cancelled')
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function prettyDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  const same = (a, b) => a.toDateString() === b.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (same(d, today)) return 'Today'
  if (same(d, tomorrow)) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/* ---- Chambers (the hospitals/clinics a doctor sits at) ---------------- */

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/* Turn a chamber's `days` string into a Set of weekday numbers (0=Sun).

   The seed writes these for humans — "Sun–Thu", "Fri", "Mon–Sat" — with an
   en-dash, and a range may wrap the week ("Fri–Mon"). Anything unparseable
   returns null, which callers treat as "no day restriction" rather than
   silently locking every day: failing open on a display hint is right,
   failing closed would hide a doctor's real availability. */
export function parseDays(spec = '') {
  const out = new Set()
  for (const chunk of String(spec).split(/[,/&]| and /i)) {
    const parts = chunk
      .trim()
      .split(/[–—-]/)
      .map((s) => s.trim().slice(0, 3).toLowerCase())
      .filter(Boolean)

    if (parts.length === 1) {
      const i = DOW.indexOf(parts[0])
      if (i >= 0) out.add(i)
    } else if (parts.length === 2) {
      const a = DOW.indexOf(parts[0])
      const b = DOW.indexOf(parts[1])
      if (a >= 0 && b >= 0) {
        // Walk forward from a to b, wrapping at the week boundary.
        for (let i = a; ; i = (i + 1) % 7) {
          out.add(i)
          if (i === b) break
        }
      }
    }
  }
  return out.size ? out : null
}

/* "5:00 PM" → minutes since midnight. Returns null if unparseable. */
export function parseClock(spec) {
  const m = String(spec || '')
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] || 0)
  const ap = (m[3] || '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

const hhmm = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/* Minutes (or a 24h "17:00") → "5:00 PM", the shape chambers are written in.
   Kept as the storage format so hand-written seed rows and rows typed in the
   admin desk read the same. */
export function formatClock(value) {
  const m = typeof value === 'number' ? value : parseClock(value)
  if (m == null) return ''
  const h24 = Math.floor(m / 60)
  const min = m % 60
  const ap = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(min).padStart(2, '0')} ${ap}`
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* A set of weekday numbers → "Sun–Thu, Sat". Runs of three or more compress
   into a range so typed rows match the existing "Sun–Thu" style, and
   parseDays() reads back whatever this writes. */
export function formatDays(set) {
  const idx = [...(set || [])].sort((a, b) => a - b)
  if (!idx.length) return ''
  const runs = []
  let start = idx[0]
  let prev = idx[0]
  for (const i of idx.slice(1)) {
    if (i === prev + 1) {
      prev = i
      continue
    }
    runs.push([start, prev])
    start = i
    prev = i
  }
  runs.push([start, prev])
  return runs
    .map(([a, b]) =>
      a === b
        ? DOW_SHORT[a]
        : b === a + 1
          ? `${DOW_SHORT[a]}, ${DOW_SHORT[b]}`
          : `${DOW_SHORT[a]}–${DOW_SHORT[b]}`
    )
    .join(', ')
}

const FALLBACK_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '16:00']

/* Appointment slots generated from the chamber's own opening hours.

   A fixed 09:00–16:00 list would be wrong here: Dr. Malik sits at Metro
   General 5–9 PM and at HeartCare 10 AM–1 PM. Offering a 15:00 slot at a
   clinic that shuts at 1 PM invites a request nobody can honour. The times
   are in the data, so use them. 24-hour output matches the format the
   appointments module already stores. */
export function slotsFor(chamber, stepMin = 30) {
  const from = parseClock(chamber?.from)
  const to = parseClock(chamber?.to)
  if (from == null || to == null || to <= from) return FALLBACK_SLOTS
  const out = []
  for (let t = from; t + stepMin <= to; t += stepMin) out.push(hhmm(t))
  return out.length ? out : FALLBACK_SLOTS
}

/* A doctor may sit at several chambers, or none recorded. Online-only is a
   real option rather than a gap to paper over. */
export const ONLINE_CHAMBER = {
  name: 'Online consultation',
  address: 'Video call — join from anywhere',
  days: 'Sun–Sat',
  from: '9:00 AM',
  to: '6:00 PM',
  online: true,
}

export function chambersFor(doctor) {
  const list = (doctor?.chambers || []).filter((c) => c && c.name)
  return list.length ? list : [ONLINE_CHAMBER]
}

/* Plain-language wording for statuses a patient sees. Clinician-facing
   status vocabulary ("Ready to approve") means nothing to a patient. */
export const LAB_STATUS_TEXT = {
  Ordered: 'Waiting for your sample',
  'Sample collected': 'Sample taken — on its way to the lab',
  'In lab': 'Being processed',
  'Ready to approve': 'Awaiting doctor review',
  Abnormal: 'Needs discussion with your doctor',
  Approved: 'Reviewed and released',
  Rejected: 'Sample could not be used — a repeat is needed',
}

export const RX_STATUS_TEXT = {
  Issued: 'Sent to your pharmacy',
  Verified: 'Pharmacy is preparing it',
  'Partially dispensed': 'Part collected — remainder to follow',
  Dispensed: 'Ready to collect',
  'Out for delivery': 'On its way to you',
  Delivered: 'Delivered',
  Refill: 'Refill available',
  Allergy: 'On hold — allergy check',
  Interaction: 'On hold — interaction check',
  Rejected: 'Pharmacy could not fill this — contact your doctor',
}
