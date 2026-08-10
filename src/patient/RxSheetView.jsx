import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import {
  DEFAULT_LAYOUT,
  DEFAULT_VISIBILITY,
  DEFAULT_SECTIONS,
  sectionStyle,
  medPrefix,
} from '../doctor/pad/padData.js'
import { autoHeaderHtml, sanitizeHeaderHtml } from '../doctor/pad/PadHeader.jsx'
import '../doctor/pad/pad.css'

/* =====================================================================
   The patient's read-only copy of a prescription sheet — the same layout
   engine the doctor's Rx pad prints from, fed from a saved pad record
   instead of the live pad. What the doctor signed is what the patient
   sees, letterhead and all; nothing here can edit it.

   Deliberate cross-portal import: this pulls the pad's layout data and CSS
   into the patient chunk. Duplicating the sheet renderer would let the two
   copies drift, and a prescription that prints differently for the patient
   than for the doctor is worse than a slightly larger bundle.
   ===================================================================== */

export const readPadLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const readLocal = readPadLocal

/* The prescriber's section catalogue as this browser last saved it. */
export function padSections() {
  return readPadLocal('medisuite-rxpad.sections', DEFAULT_SECTIONS)
}

/* The saved pads the doctor filed for this patient, newest first. */
export function padsFor(patientId) {
  if (!patientId) return []
  return readLocal('medisuite-rxpad.saved', [])
    .filter((p) => p.patientId === patientId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

const sheetDate = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function SheetSection({ sec, items }) {
  if (!items?.length) return null
  return (
    <div className="ps-section">
      <span
        className={`sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`}
        style={sectionStyle(sec, 'section')}
      >
        {sec.label}
      </span>
      <ul className={sec.type === 'medicine' ? 'ps-meds' : 'ps-items'} style={sectionStyle(sec, 'list')}>
        {items.map((it) => (
          <li key={it.uid} style={sectionStyle(sec, 'entry')}>
            {sec.type === 'medicine' ? (
              <>
                <div className="med-name" style={sectionStyle(sec, 'name')}>
                  {medPrefix(it.form)} {it.name}
                </div>
                <div className="med-dose" style={sectionStyle(sec, 'note')}>
                  {it.dose} {it.timing ? `--- ${it.timing}` : ''} {it.duration ? `--- ${it.duration}` : ''}
                </div>
              </>
            ) : (
              <>
                <span style={sectionStyle(sec, 'name')}>{it.text}</span>
                {it.note ? <em style={sectionStyle(sec, 'note')}> — {it.note}</em> : ''}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RxSheetView({ pad, onClose, autoPrint = false }) {
  const { records } = useData()

  useEffect(() => {
    if (!autoPrint) return
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [autoPrint])

  /* The prescriber's print configuration, exactly as the pad saved it in
     this browser; factory defaults when they never customised anything. */
  const layout = readLocal('medisuite-rxpad.layout-v2', DEFAULT_LAYOUT)
  const visibility = readLocal('medisuite-rxpad.visibility-v2', DEFAULT_VISIBILITY)
  const sections = readLocal('medisuite-rxpad.sections', DEFAULT_SECTIONS)
  const headerOverride = readLocal('medisuite-rxpad.header', null)

  const { page, body, patient: patientCfg } = layout
  const p = pad.patient
  const printHeader = visibility.headerFooter || page.type === 'blank'

  const doctorRec =
    records('doctors').find((d) => d.resourceId === pad.doctorId) ||
    records('doctors').find((d) => d.name === pad.doctor) ||
    null
  const header = headerOverride
    ? {
        left: sanitizeHeaderHtml(headerOverride.left || ''),
        right: sanitizeHeaderHtml(headerOverride.right || ''),
      }
    : autoHeaderHtml(doctorRec, pad.doctor)

  const value = (key) => (key === 'date' ? sheetDate(pad.date) : p?.[key] || '')

  const leftSections = sections.filter((s) => s.side === 'left')
  const rightSections = sections.filter((s) => s.side !== 'left')
  const contentW = page.width - page.marginLeft - page.marginRight
  const leftPct = (body.leftWidth / contentW) * 100

  return (
    <div className="rxpad">
      <div className="print-overlay rxpad-print">
        <style>{`@page { size: ${page.width}in ${page.height}in; margin: 0; }`}</style>
        <div className="pv-toolbar noprint">
          <span>
            Prescription — {pad.doctor || 'your doctor'} · {sheetDate(pad.date)}
          </span>
          <div>
            <button className="pbtn primary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
            <button className="pbtn ghost" onClick={onClose}>
              <X size={15} /> Close
            </button>
          </div>
        </div>

        <div
          className="print-sheet"
          style={{
            width: `${page.width}in`,
            minHeight: `${page.height}in`,
            paddingLeft: `${page.marginLeft}in`,
            paddingRight: `${page.marginRight}in`,
          }}
        >
          <div className="ps-header" style={{ height: `${page.headerHeight}in` }}>
            {printHeader && (
              <div className="doc-header">
                <div className="doc-id" dangerouslySetInnerHTML={{ __html: header.left }} />
                <div className="doc-org" dangerouslySetInnerHTML={{ __html: header.right }} />
              </div>
            )}
          </div>

          {visibility.patient ? (
            <div className="ps-patient boxed">
              {patientCfg.rows.map((row) => (
                <div className="ps-prow" key={row.id}>
                  {row.fields.map((f) => (
                    <span key={f.key} className="ps-pfield" style={{ width: `${f.width}%` }}>
                      <b>{f.label}:</b> {value(f.key)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            p && (
              <div className="ps-patient plain">
                <span>
                  <b>Name:</b> {p.name}
                </span>
                <span>
                  <b>Age:</b> {p.age}
                </span>
                <span>
                  <b>Date:</b> {sheetDate(pad.date)}
                </span>
              </div>
            )
          )}

          <div
            className={`ps-body ${body.separator ? 'with-sep' : ''}`}
            style={{ minHeight: `${page.height - page.headerHeight - page.footerHeight - 0.6}in` }}
          >
            <div className="ps-col" style={{ width: `${leftPct}%`, paddingTop: `${body.leftTopMargin}in` }}>
              {leftSections
                .filter((s) => visibility.sections[s.key] !== false)
                .map((s) => (
                  <SheetSection key={s.key} sec={s} items={pad.items[s.key]} />
                ))}
            </div>
            <div className="ps-col right" style={{ width: `${100 - leftPct}%`, paddingTop: `${body.rightTopMargin}in` }}>
              {rightSections
                .filter((s) => visibility.sections[s.key] !== false)
                .map((s) => (
                  <SheetSection key={s.key} sec={s} items={pad.items[s.key]} />
                ))}
            </div>
          </div>

          {body.bottomLine && <div className="ps-bottomline" />}
          <div className="ps-footer" style={{ height: `${page.footerHeight}in` }} />
        </div>
      </div>
    </div>
  )
}
