import { createContext, useCallback, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'
import { isDoctorsRecord, shortDoctorName } from '../data/links.js'

/* =====================================================================
   Which doctor is signed in.

   The administrator console shows every module unscoped, which is right for
   an administrator and wrong for a clinician: a doctor opening "patients"
   should see their patients, not the register. Everything here answers
   "mine" — and `mine()` matches on doctorId first, because the seed writes
   the same person as both "Dr. Sara Malik" and "Dr. Malik".

   Demo simplification, same as every other portal: this is a client filter.
   The API refusing to return another clinician's caseload is the real
   control (blueprint §9.3).
   ===================================================================== */

const DoctorContext = createContext(null)
const DEFAULT_DOCTOR = 'Dr. Sara Malik'

export function DoctorProvider({ children }) {
  const { records } = useData()
  const [name, setName] = useScopedIdentity('doctor', DEFAULT_DOCTOR)

  const roster = records('doctors')
  const me = useMemo(
    () => roster.find((d) => d.name === name) || roster[0] || null,
    [roster, name]
  )

  /* The name this doctor's appointments and consultations are filed under.
     Anything created here must use it, or the record lands in a namespace
     the scheduling views never read. */
  const filedAs = useMemo(() => shortDoctorName(me?.name || name), [me, name])

  const mine = useCallback(
    (module) => records(module).filter((r) => isDoctorsRecord(r, me)),
    [records, me]
  )

  /* The patients this doctor actually has a relationship with — anyone
     appearing on their appointments, consultations, notes or admissions.
     Deliberately not "every patient in the system". */
  const panel = useMemo(() => {
    if (!me) return []
    const ids = new Set()
    const names = new Set()
    for (const key of ['appointments', 'telemedicine', 'emr', 'prescriptions', 'laboratory', 'admissions']) {
      for (const r of records(key)) {
        if (!isDoctorsRecord(r, me)) continue
        if (r.patientId) ids.add(r.patientId)
        else if (r.patient) names.add(r.patient)
      }
    }
    return records('patients').filter((p) => ids.has(p.resourceId) || names.has(p.name))
  }, [records, me])

  const chambers = useMemo(() => (me?.chambers || []).filter(Boolean), [me])

  const api = useMemo(
    () => ({ me, name: me?.name ?? name, setName, filedAs, roster, mine, panel, chambers }),
    [me, name, setName, filedAs, roster, mine, panel, chambers]
  )

  return <DoctorContext.Provider value={api}>{children}</DoctorContext.Provider>
}

export function useDoctor() {
  const ctx = useContext(DoctorContext)
  if (!ctx) throw new Error('useDoctor must be used inside <DoctorProvider>')
  return ctx
}
