import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  SEED_MASTER, SEED_GROUPS, SEED_MEDICINES, SEED_MEDICINE_GROUPS,
  DEFAULT_LAYOUT, DEFAULT_VISIBILITY, DEFAULT_SECTIONS, padId,
} from './padData.js'

/* =====================================================================
   State for the prescription pad.

   Two kinds of state live here, deliberately separated from the global
   DataStore:

   - The prescriber's personal catalogue (phrase masters, medicines, groups,
     templates, print layout) — per-browser working material, persisted
     under `medisuite-rxpad.*`. It is not patient data and no other portal
     reads it, so putting it through the shared store would only bloat every
     other role's localStorage snapshot.

   - The pad currently being written (`rx`) — plain component state; a
     half-written prescription should not survive a sign-out.

   What the pad *files* — the per-medicine RX records and the saved pad
   history — goes through the DataStore and this context's `savedPads`
   list respectively; issuing is composed in PrescriptionPad.jsx where the
   doctor identity and toast live.
   ===================================================================== */

/* localStorage-backed useState. */
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* quota */ }
        return v
      }),
    [key]
  )
  return [value, set]
}

const emptyRx = () => ({
  patientId: null,
  patient: null, // snapshot {name, age, ...} so an edited record doesn't rewrite history
  items: {}, // sectionKey -> array of selected items
})

const Ctx = createContext(null)
export function usePad() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePad must be used inside <PadProvider>')
  return ctx
}

export function PadProvider({ children }) {
  const [master, setMaster] = useLocal('medisuite-rxpad.master', SEED_MASTER)
  const [groups, setGroups] = useLocal('medisuite-rxpad.groups', SEED_GROUPS)
  const [medicines, setMedicines] = useLocal('medisuite-rxpad.medicines', SEED_MEDICINES)
  const [medGroups, setMedGroups] = useLocal('medisuite-rxpad.medGroups', SEED_MEDICINE_GROUPS)
  const [templates, setTemplates] = useLocal('medisuite-rxpad.templates', [])
  const [savedPads, setSavedPads] = useLocal('medisuite-rxpad.saved', [])
  /* v2: saved values win over defaults, so the switch to blank-page printing
     (letterhead printed by default) needs a key bump — same migration
     convention as the DataStore's STORAGE_KEY. */
  const [layout, setLayout] = useLocal('medisuite-rxpad.layout-v2', DEFAULT_LAYOUT)
  const [visibility, setVisibility] = useLocal('medisuite-rxpad.visibility-v2', DEFAULT_VISIBILITY)
  /* The section catalogue itself (labels, order, custom sections) — editable
     from the Prescription Layout panel, seeded from the factory defaults. */
  const [sections, setSections] = useLocal('medisuite-rxpad.sections', DEFAULT_SECTIONS)
  /* Letterhead override edited in the layout wizard; null → build the header
     from the doctor's profile. */
  const [headerHtml, setHeaderHtml] = useLocal('medisuite-rxpad.header', null)

  const leftSections = useMemo(() => sections.filter((s) => s.side === 'left'), [sections])
  const rightSections = useMemo(() => sections.filter((s) => s.side !== 'left'), [sections])

  const [rx, setRx] = useState(emptyRx)

  /* ---- current prescription ops ---- */
  const addItem = useCallback((sectionKey, item) => {
    setRx((r) => ({
      ...r,
      items: { ...r.items, [sectionKey]: [...(r.items[sectionKey] || []), { ...item, uid: padId('u') }] },
    }))
  }, [])

  const removeItem = useCallback((sectionKey, uid) => {
    setRx((r) => ({
      ...r,
      items: { ...r.items, [sectionKey]: (r.items[sectionKey] || []).filter((i) => i.uid !== uid) },
    }))
  }, [])

  const patchItem = useCallback((sectionKey, uid, patch) => {
    setRx((r) => ({
      ...r,
      items: {
        ...r.items,
        [sectionKey]: (r.items[sectionKey] || []).map((i) => (i.uid === uid ? { ...i, ...patch } : i)),
      },
    }))
  }, [])

  /* Accepts an AITMS patient record and keeps a display snapshot: the pad
     and print sheet read snapshot fields; the safety check and the filed RX
     records use the live record looked up by `patientId`. */
  const setPatient = useCallback((p) => {
    setRx((r) => ({
      ...r,
      patientId: p?.resourceId || null,
      patient: p
        ? {
            pid: p.resourceId,
            name: p.name,
            age: p.age != null && p.age !== '' ? `${p.age} Years` : '',
            gender: p.gender || '',
            phone: p.phone || '',
            department: p.department || '',
          }
        : null,
    }))
  }, [])

  const newPrescription = useCallback(() => setRx(emptyRx()), [])

  const applyTemplate = useCallback((tpl) => {
    setRx((r) => ({ ...r, items: JSON.parse(JSON.stringify(tpl.items)) }))
  }, [])

  const savePad = useCallback(
    (extra = {}) => {
      const rec = {
        id: padId('rx'),
        date: new Date().toISOString(),
        patientId: rx.patientId,
        patient: rx.patient,
        items: rx.items,
        ...extra,
      }
      setSavedPads((s) => [rec, ...s].slice(0, 200))
      return rec
    },
    [rx, setSavedPads]
  )

  const value = useMemo(
    () => ({
      master, setMaster, groups, setGroups, medicines, setMedicines, medGroups, setMedGroups,
      templates, setTemplates, savedPads, layout, setLayout,
      visibility, setVisibility, sections, setSections, leftSections, rightSections,
      headerHtml, setHeaderHtml,
      rx, addItem, removeItem, patchItem, setPatient,
      newPrescription, applyTemplate, savePad,
    }),
    [master, groups, medicines, medGroups, templates, savedPads, layout, visibility, rx,
     sections, setSections, leftSections, rightSections, headerHtml, setHeaderHtml,
     setMaster, setGroups, setMedicines, setMedGroups, setTemplates,
     setLayout, setVisibility, addItem, removeItem, patchItem, setPatient,
     newPrescription, applyTemplate, savePad]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
