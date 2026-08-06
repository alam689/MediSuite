import { createContext, useCallback, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'

/* =====================================================================
   Who is signed in to the patient portal.

   The name comes from the session (see auth/AuthContext) so there is one
   answer to "who am I" across the app, not one per portal. Records are
   still joined on the patient *name* in places the seed predates foreign
   keys, but `patientId` is now carried on every linked record and is what
   `mine()` matches on when present.

   Demo simplification, unchanged: a real portal resolves identity from the
   auth token server-side and never lets the client choose whose records to
   read. Blueprint §9.3 — client-side hiding is not authorization.
   ===================================================================== */

const PatientContext = createContext(null)
const DEFAULT_PATIENT = 'Anika Rahman'

export function PatientProvider({ children }) {
  const { records } = useData()
  const [name, setName] = useScopedIdentity('patient', DEFAULT_PATIENT)

  const all = records('patients')
  const me = useMemo(
    () => all.find((p) => p.name === name) || all[0] || null,
    [all, name]
  )

  /* Every "my ..." view filters the shared store by this identity, so
     anything a patient does here shows up on the clinician side
     immediately. Prefer the id — two people can share a name, and a rename
     must not orphan a record — and fall back to the name for any row that
     predates the key. */
  const mine = useCallback(
    (module) =>
      records(module).filter((r) =>
        r.patientId && me?.resourceId ? r.patientId === me.resourceId : r.patient === (me?.name ?? name)
      ),
    [records, me, name]
  )

  const api = useMemo(
    () => ({ me, name: me?.name ?? name, setName, roster: all, mine }),
    [me, name, all, mine]
  )

  return <PatientContext.Provider value={api}>{children}</PatientContext.Provider>
}

export function usePatient() {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('usePatient must be used inside <PatientProvider>')
  return ctx
}

/* First name, for greetings. */
export const firstName = (n = '') => n.split(' ')[0] || n
