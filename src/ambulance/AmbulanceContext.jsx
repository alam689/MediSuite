import { createContext, useContext, useMemo } from 'react'
import { useData } from '../store/DataStore.jsx'
import { useScopedIdentity } from '../auth/AuthContext.jsx'
import { AMBULANCE_OPERATORS } from '../data/schemas.js'

/* =====================================================================
   Which operator's fleet this is.

   Same scoping rule as the pharmacy branch and the hospital facility: a
   vehicle belonging to another service is not this operator's to dispatch,
   take off duty or read a driver's licence number from. Everything below
   filters on `operator`.

   Demo simplification, stated as everywhere else: a client-side filter, not
   authorization (blueprint §9.3). The records were already sent.
   ===================================================================== */

const AmbulanceContext = createContext(null)
const DEFAULT_OPERATOR = AMBULANCE_OPERATORS[0]

/* A trip that is still happening. "Live" is the operator's working set:
   somebody is in a vehicle, or waiting for one. */
export const LIVE_TRIP = ['Dispatched', 'Arrived']

/* Licences inside this window are flagged before they lapse rather than
   after — a driver whose licence expired yesterday should not have been
   dispatched this morning. */
export const LICENCE_WARN_DAYS = 45

export function AmbulanceProvider({ children }) {
  const { records } = useData()
  const [operator, setOperator] = useScopedIdentity('ambulance', DEFAULT_OPERATOR)

  const allFleet = records('ambulances')
  const allTrips = records('ambulanceTrips')

  const api = useMemo(() => {
    const fleet = allFleet.filter((a) => a.operator === operator)
    const ids = new Set(fleet.map((a) => a.resourceId))
    /* Trips are matched on the vehicle, not on the operator name stored on
       the trip: if a vehicle is re-enlisted under a different operator its
       history follows the vehicle, and a stale name on an old trip can
       never leak another service's job into this queue. */
    const trips = allTrips.filter((t) => ids.has(t.ambulanceId))

    return {
      operator,
      setOperator,
      operators: AMBULANCE_OPERATORS,
      fleet,
      trips,
      live: trips.filter((t) => LIVE_TRIP.includes(t.status)),
      vehicle: (id) => fleet.find((a) => a.resourceId === id) || null,
    }
  }, [allFleet, allTrips, operator, setOperator])

  return <AmbulanceContext.Provider value={api}>{children}</AmbulanceContext.Provider>
}

export function useAmbulance() {
  const ctx = useContext(AmbulanceContext)
  if (!ctx) throw new Error('useAmbulance must be used inside <AmbulanceProvider>')
  return ctx
}

/* Whole days until a date string, or null when there isn't one. Negative
   means it has already passed. */
export function daysLeft(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
