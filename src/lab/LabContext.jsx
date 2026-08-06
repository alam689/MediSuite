import { createContext, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'
import { LABS } from '../data/schemas.js'
import { outOfRange } from '../portal/format.js'

/* =====================================================================
   Which laboratory this technician works at.

   The order's life splits cleanly in two, and the split is the reason this
   portal exists:

     the lab's part      Ordered → Sample collected → In lab → Ready to approve
     the clinician's part                          Ready to approve → Approved

   A lab verifies that a number is correct. It does not decide the patient
   should be told. Releasing a result is the requesting doctor's call, which
   is why nothing here can set "Approved".

   Demo simplification: a client filter, not authorization (§9.3).
   ===================================================================== */

const LabContext = createContext(null)
const DEFAULT_LAB = LABS[0]

export const AWAITING_SAMPLE = 'Ordered'
export const COLLECTED = 'Sample collected'
export const ON_BENCH = 'In lab'
export const AWAITING_CLINICIAN = 'Ready to approve'

export function LabProvider({ children }) {
  const { records } = useData()
  const [lab, setLab] = useScopedIdentity('lab', DEFAULT_LAB)

  const all = records('laboratory')

  const mine = useMemo(() => all.filter((o) => o.lab === lab), [all, lab])

  /* Orders routed nowhere sit in no lab's worklist. Same failure the
     pharmacy has with unrouted scripts, and worth saying out loud. */
  const unrouted = useMemo(() => all.filter((o) => !o.lab), [all])

  const buckets = useMemo(() => {
    const by = (...s) => mine.filter((o) => s.includes(o.status))
    return {
      awaitingSample: by(AWAITING_SAMPLE),
      collected: by(COLLECTED),
      onBench: by(ON_BENCH),
      /* Abnormal is still the lab's output waiting on a clinician — it is a
         property of the result, not a stage of its own. */
      reported: by(AWAITING_CLINICIAN, 'Abnormal'),
      released: by('Approved'),
      rejected: by('Rejected'),
    }
  }, [mine])

  /* STAT and Urgent first, then oldest first. A queue ordered by id hands the
     bench its work in the order it was typed, which is not the order it
     matters in. */
  const prioritised = useMemo(() => {
    const rank = { STAT: 0, Urgent: 1, Routine: 2 }
    return (rows) =>
      [...rows].sort(
        (a, b) =>
          (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3) ||
          Number(a.orderedAt || 0) - Number(b.orderedAt || 0)
      )
  }, [])

  const api = useMemo(
    () => ({ lab, setLab, labs: LABS, orders: mine, unrouted, buckets, prioritised }),
    [lab, setLab, mine, unrouted, buckets, prioritised]
  )

  return <LabContext.Provider value={api}>{children}</LabContext.Provider>
}

export function useLab() {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLab must be used inside <LabProvider>')
  return ctx
}

/* Does this result need a clinician's eye urgently?

   Derived from the analytes rather than typed by hand: a technician marking
   "normal" while a value sits outside its range is exactly the error a
   reference range exists to catch. Returns false when no analyte carries a
   usable range — unknown is not normal, and callers say so separately. */
export function hasAbnormal(analytes = []) {
  return analytes.some((a) => outOfRange(a) === true)
}

/* Analytes entered but with no reference range to check against. Shown to
   the technician so "no flags" never quietly means "nothing was checked". */
export function uncheckable(analytes = []) {
  return analytes.filter((a) => a.name && outOfRange(a) === null)
}
