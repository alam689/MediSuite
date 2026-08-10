import { useState } from 'react'
import { Printer, Activity, Eye } from 'lucide-react'
import { sectionStyle, medPrefix } from '../doctor/pad/padData.js'
import RxSheetView, { padSections } from './RxSheetView.jsx'
import '../doctor/pad/pad.css'
import '../doctor/pad/padpatients.css'

/* =====================================================================
   The patient's copy of the doctor's visit timeline (Rx Patient List →
   Visits): one card per saved pad sheet with the date, the section
   counters (hover to preview), Show Prescription expanding the sheet
   inline, and Print opening the exact printable sheet.

   Read-only on purpose: no Follow Up (that starts a new prescription —
   a doctor's action) and no delete (a patient must not be able to erase
   the clinical record). Same CSS as the doctor's screen so the two views
   can never drift apart.
   ===================================================================== */

const ordinal = (n) => {
  const suf =
    n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suf}`
}
const prettyLong = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${ordinal(d.getDate())} ${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`
}
const clean = (label) => String(label).replace(/[:,]\s*$/, '')

function MedLine({ it }) {
  return (
    <div className="pp-med-line">
      <div className="pp-med-name">{medPrefix(it.form)} {it.name}</div>
      <div className="pp-med-dose">
        <span>{it.dose} টি</span>
        <span>{it.duration}</span>
        <span>{it.timing}</span>
      </div>
    </div>
  )
}

function ItemLine({ it }) {
  return (
    <div className="pp-item-line">
      {it.text}
      {it.note && <small> {it.note}</small>}
    </div>
  )
}

/* Hover preview for one section's items — same as the doctor's screen. */
function SecPopover({ sec, items, date }) {
  return (
    <div className="pp-sec-pop">
      <div className="pp-sec-pop-head">
        <span>{sec.label}</span>
        <span className="pp-sec-pop-date">{prettyLong(date)}</span>
      </div>
      <div className="pp-sec-pop-body">
        {items.map((it, i) => (it.name ? <MedLine key={i} it={it} /> : <ItemLine key={i} it={it} />))}
      </div>
    </div>
  )
}

/* The popover is position:fixed in the patient portal (see patient.css) so
   the records panel's overflow:hidden and the panels below can neither
   clip it nor paint over it. That means it must be placed by hand on every
   hover: below the chip, clamped to the viewport, flipped above when the
   space below is too short. */
const placePop = (e) => {
  const wrap = e.currentTarget
  const pop = wrap.querySelector('.pp-sec-pop')
  if (!pop) return
  const r = wrap.getBoundingClientRect()
  const width = Math.min(480, window.innerWidth * 0.74)
  const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 16)
  pop.style.left = `${left}px`
  const h = pop.offsetHeight || 320
  if (r.bottom + 10 + h > window.innerHeight - 8 && r.top - h - 10 > 8) {
    pop.style.top = `${r.top - h - 10}px`
    pop.classList.add('above')
  } else {
    pop.style.top = `${r.bottom + 10}px`
    pop.classList.remove('above')
  }
}

const EXAM_KEYS = ['onexam', 'ecg', 'echo', 'ett', 'lipid', 'cag', 'procedure']

/* The inline expanded sheet: prescription columns plus an Examinations
   view. No Create Template here — that is prescriber tooling. */
function VisitSheet({ visit, sections }) {
  const [view, setView] = useState('rx') // 'rx' | 'exam'
  const items = visit.items || {}

  const column = (secs) => (
    <div className="pp-sheet-col">
      {secs
        .filter((sec) => items[sec.key]?.length)
        .map((sec) => (
          <div key={sec.key} className="pp-sheet-sec">
            <span
              className={`sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`}
              style={sectionStyle(sec, 'section')}
            >
              {sec.label}
            </span>
            <div className="pp-sheet-items">
              {(items[sec.key] || []).map((it, i) =>
                it.name ? <MedLine key={i} it={it} /> : <ItemLine key={i} it={it} />
              )}
            </div>
          </div>
        ))}
    </div>
  )

  const examWith = sections.filter((s) => EXAM_KEYS.includes(s.key) && items[s.key]?.length)

  return (
    <div className="pp-sheet">
      <div className="pp-sheet-tools">
        <button className={`pp-tool rx ${view === 'rx' ? 'on' : ''}`} onClick={() => setView('rx')}>
          <span className="pp-tab-rx">℞</span> View Prescription
        </button>
        <button className={`pp-tool ${view === 'exam' ? 'on' : ''}`} onClick={() => setView('exam')}>
          <Activity size={15} /> View Examinations
        </button>
      </div>

      {view === 'exam' ? (
        <div className="pp-exam">
          {examWith.length === 0 && <p className="pp-empty">No examinations were recorded on this visit.</p>}
          {examWith.map((sec) => (
            <div key={sec.key} className="pp-sheet-sec">
              <span className="sec-label">{sec.label}</span>
              <div className="pp-sheet-items">
                {(items[sec.key] || []).map((it, i) => <ItemLine key={i} it={it} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pp-sheet-body">
          {column(sections.filter((s) => s.side === 'left'))}
          {column(sections.filter((s) => s.side !== 'left'))}
        </div>
      )}
    </div>
  )
}

export default function PrescriptionVisits({ pads }) {
  const [expanded, setExpanded] = useState(null) // visit id with inline sheet open
  const [overlay, setOverlay] = useState(null) // { pad, print }
  const sections = padSections()

  return (
    <div className="rxpad pt-rx-visits" style={{ minHeight: 0 }}>
      <div className="pp-visits-head" style={{ marginTop: 2 }}>
        <h3>Past Visits</h3>
        <span className="pp-total">Total: {pads.length}</span>
      </div>

      <div className="pp-timeline">
        {pads.map((v) => {
          const keys = Object.keys(v.items || {}).filter((k) => v.items[k]?.length)
          const open = expanded === v.id
          return (
            <div key={v.id} className="pp-visit">
              <span className="pp-visit-dot">℞</span>
              <div className="pp-visit-card" style={{ background: '#fff', color: '#1f2937' }}>
                <div className="pp-visit-top">
                  <span className="pp-visit-date">
                    {prettyLong(v.date)}
                    {v.doctor ? <small style={{ fontWeight: 400, color: '#55636f' }}> · {v.doctor}</small> : null}
                  </span>
                  <div className="pp-visit-acts">
                    <button
                      className={`pp-show ${open ? 'hide' : ''}`}
                      onClick={() => setExpanded(open ? null : v.id)}
                    >
                      {open ? 'Hide Prescription' : 'Show Prescription'}
                    </button>
                    <button
                      className="pp-print"
                      title="See the sheet exactly as printed"
                      onClick={() => setOverlay({ pad: v, print: false })}
                    >
                      <Eye size={15} /> Full sheet
                    </button>
                    <button
                      className="pp-print"
                      title="Print this prescription"
                      onClick={() => setOverlay({ pad: v, print: true })}
                    >
                      <Printer size={15} /> Print
                    </button>
                  </div>
                </div>
                <div className="pp-visit-secs">
                  {keys.map((k) => {
                    const sec = sections.find((s) => s.key === k) || { key: k, label: k }
                    return (
                      <span key={k} className="pp-visit-sec-wrap" onMouseEnter={placePop}>
                        <button className="pp-visit-sec" onClick={() => setExpanded(open ? null : v.id)}>
                          {clean(sec.label)} <span>({v.items[k].length})</span>
                        </button>
                        <SecPopover sec={sec} items={v.items[k]} date={v.date} />
                      </span>
                    )
                  })}
                </div>
                {open && <VisitSheet visit={v} sections={sections} />}
              </div>
            </div>
          )
        })}
      </div>

      {overlay && (
        <RxSheetView pad={overlay.pad} autoPrint={overlay.print} onClose={() => setOverlay(null)} />
      )}
    </div>
  )
}
