import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { schemas } from '../data/schemas.js'

/* =====================================================================
   Client-side data store.
   Holds one record collection per module plus a per-module activity log,
   seeded from schemas, with CRUD actions and localStorage persistence.
   Every mutation appends a real activity-log entry — that's what feeds
   each module's Activity panel and the dashboard.
   ===================================================================== */

/* Bump when the seed shape changes: saved records win over the seed, so an
   existing browser would otherwise keep pre-change rows forever. v7 adds
   patient/doctor foreign keys, the pharmacy fulfilment and laboratory
   sample lifecycles, and the Admissions and Departments modules — a
   returning user without a bump would have prescriptions no pharmacy can
   see and lab orders with no sample stage. v8 re-bases every calendar date
   in the seed to the day the demo is opened.

   Note what the bump does *not* do: saved records always win over the seed,
   so a browser that has already stored records keeps the dates it captured.
   That is correct — those are the user's edits — but it does mean the
   relative dates only look fresh on a first load or after a reset.

   v9 adds the ambulance fleet and its trip log: without a bump a returning
   browser has no vehicles, and the patient's Ambulance page — which now
   reads the fleet from here rather than a hard-coded list — would show an
   empty map. */
const STORAGE_KEY = 'medisuite-data-v9'
const DataContext = createContext(null)

let idSeq = Date.now()
export function newId(prefix = 'REC') {
  idSeq += 1
  return `${prefix}-${idSeq.toString(36).toUpperCase().slice(-5)}`
}

function seedRecords() {
  const out = {}
  for (const s of schemas) out[s.key] = s.seed.map((r) => ({ ...r }))
  return out
}

function seedActivity() {
  const now = Date.now()
  const out = {}
  for (const s of schemas) {
    out[s.key] = (s.feed || []).map((f, i) => ({
      id: `SEED-${s.key}-${i}`,
      title: f.title,
      sub: f.sub,
      ts: now - (f.minsAgo || i * 12 + 5) * 60000,
    }))
  }
  return out
}

function seedState() {
  return { records: seedRecords(), activity: seedActivity() }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const seeded = seedState()
      return {
        records: { ...seeded.records, ...(parsed.records || {}) },
        activity: { ...seeded.activity, ...(parsed.activity || {}) },
      }
    }
  } catch {
    /* ignore */
  }
  return seedState()
}

function withLog(activity, module, log) {
  if (!log) return activity
  const entry = { id: newId('LOG'), title: log.title, sub: log.sub, ts: Date.now() }
  return { ...activity, [module]: [entry, ...(activity[module] || [])].slice(0, 40) }
}

function reducer(state, action) {
  const { module } = action
  switch (action.type) {
    case 'add':
      return {
        records: { ...state.records, [module]: [action.record, ...state.records[module]] },
        activity: withLog(state.activity, module, action.log),
      }
    case 'update':
      return {
        records: {
          ...state.records,
          [module]: state.records[module].map((r) =>
            r.resourceId === action.record.resourceId ? { ...r, ...action.record } : r
          ),
        },
        activity: withLog(state.activity, module, action.log),
      }
    case 'patch':
      return {
        records: {
          ...state.records,
          [module]: state.records[module].map((r) =>
            r.resourceId === action.id ? { ...r, ...action.patch } : r
          ),
        },
        activity: withLog(state.activity, module, action.log),
      }
    case 'remove':
      return {
        records: {
          ...state.records,
          [module]: state.records[module].filter((r) => r.resourceId !== action.id),
        },
        activity: withLog(state.activity, module, action.log),
      }
    case 'reset':
      return seedState()
    default:
      return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore quota errors */
    }
  }, [state])

  const api = useMemo(
    () => ({
      state,
      records: (module) => state.records[module] || [],
      activity: (module) => state.activity[module] || [],
      allActivity: () =>
        Object.entries(state.activity)
          .flatMap(([module, list]) => list.map((e) => ({ ...e, module })))
          .sort((a, b) => b.ts - a.ts),
      add: (module, record, log) => dispatch({ type: 'add', module, record, log }),
      update: (module, record, log) => dispatch({ type: 'update', module, record, log }),
      patch: (module, id, patch, log) => dispatch({ type: 'patch', module, id, patch, log }),
      remove: (module, id, log) => dispatch({ type: 'remove', module, id, log }),
      resetAll: () => dispatch({ type: 'reset' }),
    }),
    [state]
  )

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

/* Human-friendly relative time for activity entries. */
export function relTime(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
