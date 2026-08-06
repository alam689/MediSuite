/* =====================================================================
   Foreign keys for the seed data.

   The seeds are written the way a person would write them — "Anika Rahman",
   "Dr. Malik" — because that is what makes them readable and editable. But
   joining on a display name is wrong in every direction: two patients can
   share a name, a doctor appears as both "Dr. Sara Malik" and "Dr. Malik",
   and renaming anyone silently orphans their history.

   So resolve the names once, at module load, and stamp a real id on every
   record that points at a person. Views prefer the id and fall back to the
   name, which keeps hand-typed rows working.

   This is a build-time convenience for demo data. A real system assigns the
   id at creation and never has a name to resolve.
   ===================================================================== */

/* Name tokens that carry no identity — the honorific varies by row. */
const NOISE = new Set(['dr', 'dr.', 'prof', 'prof.', 'mr', 'mrs', 'ms', 'md'])

const tokens = (name = '') =>
  String(name)
    .toLowerCase()
    .split(/[\s.]+/)
    .filter((t) => t && !NOISE.has(t))

/* Match on shared surname tokens rather than string equality, so
   "Dr. Malik" resolves to "Dr. Sara Malik" but not to "Dr. Nair".

   Ambiguity is a real risk here: if a short name matches two people there is
   no correct answer, and guessing would attach a record to the wrong
   clinician. Return null and let the view fall back to the name — a record
   with no id is visibly unlinked, which is recoverable. A record linked to
   the wrong person is not. */
function resolve(name, index) {
  const want = tokens(name)
  if (!want.length) return null

  const hits = index.filter(({ parts }) => {
    const short = want.length <= parts.length ? want : parts
    const long = want.length <= parts.length ? parts : want
    return short.every((t) => long.includes(t))
  })

  return hits.length === 1 ? hits[0].id : null
}

const buildIndex = (rows) =>
  rows.map((r) => ({ id: r.resourceId, parts: tokens(r.name) }))

/* Modules whose rows point at a patient, a doctor, or both. */
const LINKED = [
  'appointments',
  'telemedicine',
  'emr',
  'prescriptions',
  'laboratory',
  'rpm',
  'admissions',
]

export function linkSeeds(schemas) {
  const byKey = Object.fromEntries(schemas.map((s) => [s.key, s]))
  const patients = buildIndex(byKey.patients?.seed || [])
  const doctors = buildIndex(byKey.doctors?.seed || [])

  for (const key of LINKED) {
    for (const row of byKey[key]?.seed || []) {
      if (row.patient && !row.patientId) {
        const id = resolve(row.patient, patients)
        if (id) row.patientId = id
      }
      if (row.doctor && !row.doctorId) {
        const id = resolve(row.doctor, doctors)
        if (id) row.doctorId = id
      }
    }
  }

  /* Billing bills a person, so its `party` is a patient name for everything
     except corporate invoices — which resolve to nothing, correctly. */
  for (const row of byKey.billing?.seed || []) {
    if (row.party && !row.patientId) {
      const id = resolve(row.party, patients)
      if (id) row.patientId = id
    }
    if (row.doctor && !row.doctorId) {
      const id = resolve(row.doctor, doctors)
      if (id) row.doctorId = id
    }
  }

  /* Departments name a head of unit; the hospital portal links through to
     the practitioner record from there. */
  for (const row of byKey.departments?.seed || []) {
    if (row.head && !row.headId) {
      const id = resolve(row.head, doctors)
      if (id) row.headId = id
    }
  }

  return schemas
}

/* The scheduling name a doctor's records are filed under.

   Appointments and consultations use the short form ("Dr. Malik") while the
   doctors module holds the full one. Anything creating a record on a
   doctor's behalf must use the short form or it lands in a namespace the
   rest of the app never reads. */
export function shortDoctorName(fullName = '') {
  const parts = tokens(fullName)
  if (!parts.length) return fullName
  return `Dr. ${parts[parts.length - 1].replace(/^./, (c) => c.toUpperCase())}`
}

/* Does this record belong to that doctor? Id first, short/full name after. */
export function isDoctorsRecord(row, doctor) {
  if (!doctor) return false
  if (row.doctorId && doctor.resourceId) return row.doctorId === doctor.resourceId
  return resolve(row.doctor || '', [{ id: doctor.resourceId, parts: tokens(doctor.name) }]) !== null
}
