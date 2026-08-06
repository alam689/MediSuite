import { createContext, useCallback, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'
import { PHARMACIES } from '../data/schemas.js'

/* =====================================================================
   Which dispensary this pharmacist works at.

   Scoping is the whole role, exactly as with the hospital admin: a
   prescription routed to City Care is not this branch's work, and its stock
   is not this branch's stock. Everything below filters on `branch`.

   Demo simplification: a client filter, not authorization (blueprint §9.3).
   ===================================================================== */

const PharmacyContext = createContext(null)
const DEFAULT_BRANCH = PHARMACIES[0]

/* Three different kinds of "not finished", and conflating them is a real
   error rather than a tidiness question:

   OPEN      — the pharmacy's work, sitting in this branch's queue.
   BLOCKED   — a clinical hold. The pharmacy cannot act; the prescriber must.
               Filing these as "completed" tells a branch manager the script
               is dealt with when nobody has touched it.
   IN_TRANSIT— filled but not yet with the patient. A bag on a van is not a
               closed prescription.

   Anything outside all three is genuinely closed. */
export const OPEN_STATUSES = ['Issued', 'Verified', 'Partially dispensed']
export const BLOCKED_STATUSES = ['Interaction', 'Allergy', 'Refill']
export const IN_TRANSIT_STATUSES = ['Out for delivery']

export function PharmacyProvider({ children }) {
  const { records } = useData()
  const [branch, setBranch] = useScopedIdentity('pharmacy', DEFAULT_BRANCH)

  const allRx = records('prescriptions')
  const allStock = records('pharmacy')

  /* Only scripts routed here. A prescription with no pharmacy set belongs to
     nobody's queue, which is a real failure mode — surfaced separately
     rather than swept into this branch's list. */
  const queue = useMemo(
    () => allRx.filter((r) => r.pharmacy === branch && OPEN_STATUSES.includes(r.status)),
    [allRx, branch]
  )

  /* Waiting on the prescriber, not on us. Shown so the branch knows why a
     script it can see is not in its queue — and can chase it. */
  const blocked = useMemo(
    () => allRx.filter((r) => r.pharmacy === branch && BLOCKED_STATUSES.includes(r.status)),
    [allRx, branch]
  )

  /* Filled and gone: collected in store, delivered, or refused. A home
     delivery still on the road is deliberately not here. */
  const history = useMemo(
    () =>
      allRx.filter(
        (r) =>
          r.pharmacy === branch &&
          !OPEN_STATUSES.includes(r.status) &&
          !BLOCKED_STATUSES.includes(r.status) &&
          !IN_TRANSIT_STATUSES.includes(r.status) &&
          /* A dispensed home-delivery script is packed, not finished. */
          !(r.status === 'Dispensed' && r.fulfilment === 'Home delivery')
      ),
    [allRx, branch]
  )

  const unrouted = useMemo(
    () => allRx.filter((r) => !r.pharmacy && OPEN_STATUSES.includes(r.status)),
    [allRx]
  )

  const stock = useMemo(() => allStock.filter((s) => s.branch === branch), [allStock, branch])

  const deliveries = useMemo(
    () =>
      allRx.filter(
        (r) =>
          r.pharmacy === branch &&
          r.fulfilment === 'Home delivery' &&
          ['Dispensed', 'Out for delivery', 'Delivered'].includes(r.status)
      ),
    [allRx, branch]
  )

  /* Find the stock line that can fill a prescription.

     Matches the brand string first, then the generic — "Atorvastatin 20mg"
     on the script against "Atorvastatin 20mg" or generic "Atorvastatin" on
     the shelf. Returns null rather than guessing when nothing matches: a
     wrong match here dispenses the wrong drug. */
  const stockFor = useCallback(
    (drug) => {
      const want = String(drug || '').toLowerCase().trim()
      if (!want) return null
      const exact = stock.find((s) => String(s.name).toLowerCase() === want)
      if (exact) return exact
      const head = want.split(/\s+/)[0]
      if (head.length < 4) return null
      return (
        stock.find((s) => String(s.name).toLowerCase().startsWith(head)) ||
        stock.find((s) => String(s.generic || '').toLowerCase().startsWith(head)) ||
        null
      )
    },
    [stock]
  )

  /* Other lines of the same molecule held here — the substitution options a
     pharmacist may legally offer. */
  const alternativesFor = useCallback(
    (drug, exceptId) => {
      const head = String(drug || '').toLowerCase().split(/\s+/)[0]
      if (head.length < 4) return []
      return stock.filter(
        (s) =>
          s.resourceId !== exceptId &&
          (String(s.name).toLowerCase().includes(head) ||
            String(s.generic || '').toLowerCase().includes(head))
      )
    },
    [stock]
  )

  const api = useMemo(
    () => ({
      branch,
      setBranch,
      branches: PHARMACIES,
      queue,
      blocked,
      history,
      unrouted,
      stock,
      deliveries,
      stockFor,
      alternativesFor,
    }),
    [branch, setBranch, queue, blocked, history, unrouted, stock, deliveries, stockFor, alternativesFor]
  )

  return <PharmacyContext.Provider value={api}>{children}</PharmacyContext.Provider>
}

export function usePharmacy() {
  const ctx = useContext(PharmacyContext)
  if (!ctx) throw new Error('usePharmacy must be used inside <PharmacyProvider>')
  return ctx
}
