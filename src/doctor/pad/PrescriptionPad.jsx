import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FilePlus2, Printer, Settings, Search, Save, ShieldAlert, SlidersHorizontal, LayoutPanelTop, X,
  DatabaseZap, BookUser,
} from 'lucide-react'
import { useData, newId } from '../../store/DataStore.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useDoctor } from '../DoctorContext.jsx'
import { safetyCheck } from '../safety.js'
import { PHARMACIES } from '../../data/schemas.js'
import { PadProvider, usePad } from './PadContext.jsx'
import { DURATION_DAYS, dosesPerDay, medPrefix, padId } from './padData.js'
import Pad from './Pad.jsx'
import SettingsModal from './SettingsModal.jsx'
import PrintView from './PrintView.jsx'
import LayoutWizard from './LayoutWizard.jsx'
import LayoutPanel from './LayoutPanel.jsx'
import './pad.css'

/* =====================================================================
   The prescription pad — the full clinical prescription writer ported from
   the standalone TELEMEDIB app, integrated with the rest of the system:

   - patients come from the shared registry (and can be registered here)
   - the letterhead is the signed-in doctor's profile
   - saving files one RX record per medicine into the `prescriptions`
     module, so the pharmacy queue, the patient portal and the admin
     console all see a pad prescription exactly like a quick-issued one
   - the same safety check as the quick-issue form runs per medicine, and
     overriding a finding is an acknowledged, recorded decision

   The quick-issue form (DoctorPrescribe) stays for single-drug refill
   traffic; this screen is for writing the full consultation sheet.
   ===================================================================== */

/* Search/add template box, ported from the TELEMEDIB top bar. Typing
   filters saved templates; Enter with no match saves the current pad. */
function TemplateBox() {
  const { templates, setTemplates, applyTemplate, rx } = usePad()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  /* Most-used templates first — same score ranking as the pickers. */
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const ranked = [...templates].sort((a, b) => (b.score || 0) - (a.score || 0))
    if (!s) return ranked
    return ranked.filter((t) => t.name.toLowerCase().includes(s))
  }, [q, templates])

  const exact = matches.some((t) => t.name.toLowerCase() === q.trim().toLowerCase())
  const hasContent = Object.values(rx.items || {}).some((a) => a && a.length)

  const saveTemplate = () => {
    const name = q.trim()
    if (!name) return
    if (!hasContent) return toast.warning('Pad is empty — nothing to save as a template.')
    /* Type follows what the pad actually holds: medicines make it a
       Medicines template, otherwise it belongs to the busiest section. */
    const keys = Object.keys(rx.items).filter((k) => rx.items[k]?.length)
    const type = keys.includes('rx') || !keys.length ? 'Medicines' : keys[0]
    setTemplates((t) => [...t, { id: padId('tpl'), name, type, score: 0, items: JSON.parse(JSON.stringify(rx.items)) }])
    toast.success(`Template “${name}” saved.`)
    setQ('')
    setOpen(false)
  }

  const use = (tpl) => {
    applyTemplate(tpl)
    setTemplates((t) => t.map((x) => (x.id === tpl.id ? { ...x, score: (x.score || 0) + 1 } : x)))
    toast.success(`Template “${tpl.name}” applied.`)
    setQ('')
    setOpen(false)
  }

  const del = (e, tpl) => {
    e.stopPropagation()
    setTemplates((t) => t.filter((x) => x.id !== tpl.id))
    toast.info(`Template “${tpl.name}” deleted.`)
  }

  return (
    <div className="tpl-box" ref={boxRef}>
      <Search size={15} className="tpl-ico" />
      <input
        value={q}
        placeholder="Search/Add Template..."
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (matches.length === 1 && exact) use(matches[0])
            else if (!exact) saveTemplate()
          }
        }}
      />
      {open && (q.trim() || templates.length > 0) && (
        <div className="tpl-drop">
          {matches.map((t) => (
            <div key={t.id} className="tpl-item" onMouseDown={() => use(t)}>
              <span>{t.name}</span>
              <button className="tpl-del" onMouseDown={(e) => del(e, t)}>✕</button>
            </div>
          ))}
          {q.trim() && !exact && (
            <div className="tpl-item add" onMouseDown={saveTemplate}>
              ＋ Save current pad as “{q.trim()}”
            </div>
          )}
          {!q.trim() && templates.length === 0 && (
            <div className="tpl-empty">No templates yet — type a name and press Enter to save the current pad.</div>
          )}
        </div>
      )}
    </div>
  )
}

function PadWorkbench() {
  const { rx, savePad, newPrescription, setPatient, applyTemplate } = usePad()
  const { records, add } = useData()
  const { me, filedAs } = useDoctor()
  const toast = useToast()
  const location = useLocation()

  const [view, setView] = useState('pad') // 'pad' | 'layout'
  const [showHide, setShowHide] = useState(false)
  const [sectionSetup, setSectionSetup] = useState(false)
  const [preview, setPreview] = useState(false)
  const [autoPrint, setAutoPrint] = useState(false)
  const [confirm, setConfirm] = useState(null) // {findings: [{med, findings}], andPrint}
  const [acknowledged, setAcknowledged] = useState(false)

  /* Hand-off from the Rx patient list: "Write Prescription" arrives with a
     patientId, "Follow Up" / "Print" also carry the previous sheet's items.
     The state is cleared after applying so a refresh starts clean. */
  useEffect(() => {
    const st = location.state
    if (!st?.patientId) return
    const rec = records('patients').find((p) => p.resourceId === st.patientId)
    if (rec) setPatient(rec)
    if (st.items) applyTemplate({ items: st.items })
    if (st.print) {
      setAutoPrint(true)
      setPreview(true)
    }
    window.history.replaceState({}, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const meds = rx.items.rx || []
  const hasContent = Object.values(rx.items || {}).some((a) => a && a.length)

  /* The live registry record — the snapshot on the pad is for display; the
     safety check wants allergies and current medications. */
  const patientRecord = useMemo(
    () => records('patients').find((p) => p.resourceId === rx.patientId) || null,
    [records, rx.patientId]
  )

  /* Brand + generic per medicine: the interaction table speaks generic. */
  const medFindings = useMemo(
    () =>
      meds
        .map((med) => ({ med, findings: safetyCheck(`${med.name} ${med.generic || ''}`, patientRecord) }))
        .filter((f) => f.findings.length),
    [meds, patientRecord]
  )

  /* One RX record per medicine line, so the pharmacy can verify, substitute
     or partially fill each drug independently — exactly like quick-issued
     scripts. `padRef` ties the lines back to the saved pad sheet. */
  const fileToPharmacy = (padRec) => {
    for (const med of meds) {
      const findings = safetyCheck(`${med.name} ${med.generic || ''}`, patientRecord)
      const flagged = findings[0]?.kind
      const days = DURATION_DAYS[med.duration] || 30
      const qty = Math.max(1, Math.ceil((dosesPerDay(med.dose) || 1) * days))
      const resourceId = newId('RX')
      add(
        'prescriptions',
        {
          resourceId,
          drug: `${medPrefix(med.form)} ${med.name}`.trim(),
          generic: med.generic || '',
          patient: patientRecord.name,
          patientId: patientRecord.resourceId,
          doctor: filedAs,
          doctorId: me?.resourceId,
          dosage: med.dose,
          qty,
          days,
          refills: 0,
          pharmacy: PHARMACIES[0],
          fulfilment: 'Collect in store',
          flag: flagged || 'None',
          status: 'Issued',
          instructions: [med.dose, med.timing, med.duration].filter(Boolean).join(' — '),
          overrideNote: flagged ? `${flagged} flag accepted by ${me?.name} (prescription pad)` : '',
          issuedAt: Date.now(),
          dispensedQty: 0,
          padRef: padRec.id,
        },
        {
          title: flagged ? `Pad prescription issued over ${flagged.toLowerCase()} flag` : 'Pad prescription issued',
          sub: `${resourceId} · ${patientRecord.name} · ${med.name}`,
        }
      )
    }
  }

  const finalise = (andPrint) => {
    const padRec = savePad({ doctor: filedAs, doctorId: me?.resourceId })
    if (meds.length && patientRecord) fileToPharmacy(padRec)
    toast.success(
      meds.length
        ? `${meds.length} medicine line${meds.length > 1 ? 's' : ''} sent to ${PHARMACIES[0]}`
        : 'Prescription saved.',
      { title: patientRecord ? patientRecord.name : 'Prescription pad' }
    )
    setConfirm(null)
    setAcknowledged(false)
    if (andPrint) {
      setAutoPrint(true)
      setPreview(true)
    }
  }

  const doSave = (andPrint) => {
    if (!hasContent) return toast.warning(`Nothing to ${andPrint ? 'print' : 'save'} — the prescription is empty.`)
    if (meds.length && !patientRecord) {
      return toast.warning('Select a patient before issuing medicines to the pharmacy.')
    }
    if (medFindings.length) {
      setAcknowledged(false)
      setConfirm({ findings: medFindings, andPrint })
      return
    }
    finalise(andPrint)
  }

  if (view === 'layout') {
    return (
      <div className="rxpad">
        <LayoutWizard onExit={() => setView('pad')} />
      </div>
    )
  }

  return (
    <div className="rxpad">
      <header className="rx-toolbar noprint">
        <div className="rx-toolbar-title">
          <h1>Prescription pad</h1>
          <p>Write the full consultation sheet — medicines are issued straight to the pharmacy.</p>
        </div>
        <div className="rx-toolbar-actions">
          <button
            className="tb-link"
            onClick={() => {
              newPrescription()
              toast.info('New prescription started.')
            }}
          >
            <FilePlus2 size={17} /> New
          </button>
          <button className="tb-link muted" onClick={() => { setAutoPrint(false); setPreview(true) }}>
            <Printer size={17} /> Print Preview
          </button>
          <button className="tb-gear" title="Prescription Section Show / Hide Setting" onClick={() => setShowHide(true)}>
            <Settings size={17} />
          </button>
          <button className="tb-gear" title="Print Layout Configuration" onClick={() => setView('layout')}>
            <SlidersHorizontal size={17} />
          </button>
          <button className="tb-gear" title="Prescription Layout — sections setup" onClick={() => setSectionSetup((o) => !o)}>
            <LayoutPanelTop size={17} />
          </button>
          <Link to="/doctor/presets" className="tb-gear" title="Preset Data settings — templates, medicines, phrases & scores">
            <DatabaseZap size={17} />
          </Link>
          <Link to="/doctor/rx-patients" className="tb-gear" title="Patient list — visit history & follow-ups">
            <BookUser size={17} />
          </Link>
          <TemplateBox />
        </div>
      </header>

      {sectionSetup && <LayoutPanel onClose={() => setSectionSetup(false)} />}

      <Pad />

      <footer className="bottombar noprint">
        <button className="bb-btn" onClick={() => doSave(false)}>
          <Save size={17} /> Save &amp; Issue
        </button>
        <button className="bb-btn" onClick={() => doSave(true)}>
          <Printer size={17} /> Save &amp; Print
        </button>
      </footer>

      {showHide && (
        <SettingsModal
          onClose={() => setShowHide(false)}
          onConfirmPrint={() => { setShowHide(false); doSave(true) }}
        />
      )}

      {preview && <PrintView autoPrint={autoPrint} onClose={() => { setPreview(false); setAutoPrint(false) }} />}

      {confirm && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="modal">
            <div className="modal-head">
              <h3><ShieldAlert size={17} style={{ verticalAlign: -3, color: '#c62828' }} /> Safety findings for {patientRecord?.name}</h3>
              <button className="modal-x" onClick={() => setConfirm(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {confirm.findings.map(({ med, findings }) => (
                <div key={med.uid} className="sf-med">
                  <div className="sf-med-name">{medPrefix(med.form)} {med.name}</div>
                  <ul>
                    {findings.map((f, i) => (
                      <li key={i}><strong>{f.kind}:</strong> {f.text}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <label className="sf-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>I have considered these findings and am prescribing anyway. This override is recorded.</span>
              </label>
              <p className="sf-hint">
                The interaction check covers a short demonstration list only — it is not a drug
                database and will miss real interactions.
              </p>
            </div>
            <div className="modal-foot">
              <button className="pbtn ghost" onClick={() => setConfirm(null)}>Go back &amp; change</button>
              <button
                className="pbtn primary"
                disabled={!acknowledged}
                onClick={() => acknowledged && finalise(confirm.andPrint)}
              >
                Acknowledge &amp; issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrescriptionPad() {
  return (
    <PadProvider>
      <PadWorkbench />
    </PadProvider>
  )
}
