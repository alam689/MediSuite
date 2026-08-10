import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* =====================================================================
   Who is signed in, and as what.

   Before this existed every portal was reachable by typing its URL: the
   role picker on the login screen only chose where `navigate()` went. A
   session object plus <RequireRole> closes that door.

   Demo simplification, stated plainly: this is a *client* session with no
   token, no server, and no password check. It stops a user wandering into
   the wrong workspace; it is not authorization. Real authorization is the
   API refusing to answer — blueprint §9.3 and §15.2. Every portal below
   also filters records client-side, which means the data was already sent.
   Both facts stay true until there is a backend.
   ===================================================================== */

const AuthContext = createContext(null)
const STORAGE_KEY = 'medisuite-session'

/* One entry per stakeholder that can sign in. `identity` is the scoping
   value the portal filters by — a patient name, a doctor name, a facility.
   It is the single source of truth for "whose records am I looking at",
   so the per-portal switchers write here rather than keeping their own. */
export const ROLES = {
  patient: {
    label: 'Patient',
    home: '/patient',
    email: 'anika.rahman@mail.health',
    identity: 'Anika Rahman',
    tag: 'Patient',
  },
  doctor: {
    label: 'Doctor',
    home: '/doctor',
    email: 'sara.malik@metrogeneral.health',
    identity: 'Dr. Sara Malik',
    tag: 'Doctor',
  },
  hospital: {
    label: 'Hospital',
    home: '/hospital',
    email: 'admin@metrogeneral.health',
    identity: 'Metro General Hospital',
    tag: 'Hospital admin',
  },
  pharmacy: {
    label: 'Pharmacy',
    home: '/pharmacy',
    email: 'dispensary@metrogeneral.health',
    identity: 'Metro General Pharmacy',
    tag: 'Pharmacy',
  },
  lab: {
    label: 'Laboratory',
    home: '/lab',
    email: 'lab@metrodiagnostics.health',
    identity: 'Metro Diagnostics Lab',
    tag: 'Laboratory',
  },
  ambulance: {
    label: 'Ambulance owner',
    home: '/ambulance',
    email: 'dispatch@cityemergency.health',
    identity: 'City Emergency Service',
    tag: 'Ambulance operator',
  },
  admin: {
    label: 'Administrator',
    home: '/app',
    email: 'ops@medisuite.health',
    identity: null,
    tag: 'Administrator',
  },
}

export const ROLE_KEYS = Object.keys(ROLES)

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // A role that no longer exists (renamed between builds) must not grant
    // access to a route that no longer matches it.
    return parsed && ROLES[parsed.role] ? parsed : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore quota errors */
    }
  }, [session])

  const signIn = useCallback((role, email) => {
    const def = ROLES[role]
    if (!def) return null
    const next = {
      role,
      email: email || def.email,
      identity: def.identity,
      signedInAt: Date.now(),
    }
    setSession(next)
    return next
  }, [])

  const signOut = useCallback(() => setSession(null), [])

  /* Change who this session is scoped to — the facility switcher, the demo
     identity picker. Never changes the role: a pharmacist switching branch
     is still a pharmacist. */
  const setIdentity = useCallback((identity) => {
    setSession((s) => (s ? { ...s, identity } : s))
  }, [])

  const api = useMemo(
    () => ({
      session,
      role: session?.role || null,
      identity: session?.identity ?? null,
      roleDef: session ? ROLES[session.role] : null,
      signIn,
      signOut,
      setIdentity,
    }),
    [session, signIn, signOut, setIdentity]
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/* Scoping value for a portal, read from the session when the signed-in role
   owns that portal and held locally otherwise.

   The fallback branch matters: the clinician/admin workspace mounts some of
   the same views, and an administrator has no patient identity. Without it
   those views would render against `null` and blank out. */
export function useScopedIdentity(role, fallback) {
  const { session, setIdentity } = useAuth()
  const [local, setLocal] = useState(fallback)
  const owns = session?.role === role

  const value = owns ? (session.identity ?? fallback) : local
  const set = useCallback(
    (next) => (owns ? setIdentity(next) : setLocal(next)),
    [owns, setIdentity]
  )

  return [value, set]
}
