import { createContext, useCallback, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'

/* =====================================================================
   Which facility this hospital admin runs.

   A hospital admin is not the platform administrator. The Administration
   module is tenant-wide — users, roles, security, every organisation. This
   role sees exactly one facility: its beds, its appointments, its
   practitioners. That scoping is the whole point of the role, and it maps
   to the blueprint's ABAC dimension (§15.2: organization).

   Demo simplification, and an important one: the scoping below is a client
   filter. Real ABAC is a server decision — the API must refuse to return
   another facility's records, because filtering in the browser means the
   data was already sent (§9.3: client-side hiding is not authorization).
   ===================================================================== */

const HospitalContext = createContext(null)
const DEFAULT_FACILITY = 'Metro General Hospital'

/* Group view: every facility at once, for an admin who runs more than one
   site. Not a way around the scoping — which facilities you may see is the
   server's decision in a real build (§15.2). Here it is a demo affordance,
   like the facility switcher itself. Aggregated views must always name the
   site each row belongs to; a bed count with no hospital on it is worse than
   no bed count. */
export const ALL_FACILITIES = '__all__'

export function HospitalProvider({ children }) {
  const { records } = useData()

  /* The facility lives on the session: it is which organisation this admin
     is acting for, which is an attribute of who they are signed in as. */
  const [facility, setFacility] = useScopedIdentity('hospital', DEFAULT_FACILITY)

  const capacity = records('capacity')
  const doctors = records('doctors')
  const appointments = records('appointments')
  const admissionRows = records('admissions')
  const departmentRows = records('departments')
  const invoiceRows = records('billing')

  /* Every facility known to the platform — a hospital is anywhere that has
     either critical-care units or a doctor's chamber. */
  const facilities = useMemo(() => {
    const names = new Set()
    for (const c of capacity) if (c.hospital) names.add(c.hospital)
    for (const d of doctors) for (const c of d.chambers || []) if (c?.name) names.add(c.name)
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [capacity, doctors])

  const isAll = facility === ALL_FACILITIES

  const units = useMemo(
    () => (isAll ? capacity : capacity.filter((c) => c.hospital === facility)),
    [capacity, facility, isAll]
  )

  /* Practitioners who hold a chamber here (or anywhere, in group view). */
  const staff = useMemo(
    () =>
      isAll
        ? doctors.filter((d) => (d.chambers || []).length > 0)
        : doctors.filter((d) => (d.chambers || []).some((c) => c?.name === facility)),
    [doctors, facility, isAll]
  )

  /* The chambers relevant to the current scope: all of a doctor's sites in
     group view, otherwise just the one at this facility. */
  const chambersOf = useCallback(
    (doctor) =>
      isAll
        ? (doctor.chambers || []).filter(Boolean)
        : (doctor.chambers || []).filter((c) => c?.name === facility),
    [facility, isAll]
  )

  const facilityAppointments = useMemo(
    () => (isAll ? appointments : appointments.filter((a) => a.hospital === facility)),
    [appointments, facility, isAll]
  )

  /* Appointments with no facility recorded — clinician-created records can
     leave it blank. Surfaced rather than silently dropped: an appointment
     that belongs to nobody's list is one nobody prepares for. */
  const unassigned = useMemo(() => appointments.filter((a) => !a.hospital), [appointments])

  /* In-patients, departments and invoices, scoped the same way. Each keeps
     the facility on the row so a group view can still name where a bed,
     a department or a charge belongs. */
  const admissions = useMemo(
    () => (isAll ? admissionRows : admissionRows.filter((a) => a.hospital === facility)),
    [admissionRows, facility, isAll]
  )

  const departments = useMemo(
    () => (isAll ? departmentRows : departmentRows.filter((d) => d.hospital === facility)),
    [departmentRows, facility, isAll]
  )

  const invoices = useMemo(
    () => (isAll ? invoiceRows : invoiceRows.filter((i) => i.hospital === facility)),
    [invoiceRows, facility, isAll]
  )

  /* Beds currently occupied by a named in-patient, per unit. The capacity
     module counts beds; this says who is in them. They are allowed to
     disagree — capacity is edited by hand — and the Admissions page shows
     the discrepancy rather than papering over it. */
  const occupancyByUnit = useMemo(() => {
    const map = new Map()
    for (const a of admissions) {
      if (a.status === 'Discharged' || a.status === 'Transferred') continue
      const key = `${a.hospital}|${a.unit}`
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [admissions])

  const api = useMemo(
    () => ({
      facility,
      setFacility,
      facilities,
      isAll,
      /* What to print as the scope. */
      facilityLabel: isAll ? 'All facilities' : facility,
      units,
      staff,
      chambersOf,
      appointments: facilityAppointments,
      unassigned,
      admissions,
      departments,
      invoices,
      occupancyByUnit,
    }),
    [
      facility,
      setFacility,
      facilities,
      isAll,
      units,
      staff,
      chambersOf,
      facilityAppointments,
      unassigned,
      admissions,
      departments,
      invoices,
      occupancyByUnit,
    ]
  )

  return <HospitalContext.Provider value={api}>{children}</HospitalContext.Provider>
}

export function useHospital() {
  const ctx = useContext(HospitalContext)
  if (!ctx) throw new Error('useHospital must be used inside <HospitalProvider>')
  return ctx
}
