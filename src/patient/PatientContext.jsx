import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useData } from '../store/DataStore.jsx'

/* =====================================================================
   Who is signed in to the patient portal.

   Records across this app are linked by patient *name* (the seed data has
   no patient foreign key), so identity here is a name plus the matching
   `patients` record. That is a demo simplification: a real portal resolves
   identity from the auth token to a patient id server-side, and never lets
   the client choose whose records to read. See the blueprint §9.3 —
   client-side hiding is not authorization.
   ===================================================================== */

const PatientContext = createContext(null)
const STORAGE_KEY = 'medisuite-patient-identity'
const DEFAULT_PATIENT = 'Anika Rahman'

export function PatientProvider({ children }) {
  const { records } = useData()
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_PATIENT
    } catch {
      return DEFAULT_PATIENT
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, name)
    } catch {
      /* ignore quota errors */
    }
  }, [name])

  const all = records('patients')
  const me = useMemo(
    () => all.find((p) => p.name === name) || all[0] || null,
    [all, name]
  )

  /* Every "my ..." view filters the shared store by this name, so anything a
     patient does here shows up on the clinician side immediately. */
  const mine = useCallback(
    (module) => records(module).filter((r) => r.patient === (me?.name ?? name)),
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
