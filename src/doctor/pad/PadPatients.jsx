import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Search, PlusCircle, RefreshCw, CircleCheck, CircleMinus, User, Pencil, X,
  BarChart3, Printer, FilePlus2, Info, Activity, CirclePlus,
  FlaskConical, Syringe, Pill, FileText,
} from 'lucide-react'
import { useData } from '../../store/DataStore.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { PadProvider, usePad } from './PadContext.jsx'
import { medPrefix, padId, sectionStyle } from './padData.js'
import { AddPatientModal } from './PatientModals.jsx'
import RecordShelf from './RecordShelf.jsx'
import './pad.css'
import './padpatients.css'

/* =====================================================================
   Rx Patient List — the patient screen from the reference DigitalRX app.

   List: every registered patient with last-visited, phone, serial and
   age; clicking a row opens the patient's visit timeline. Each visit is
   a saved pad sheet: Show Prescription expands the full sheet inline
   (with View Examinations and Create Template beside it), the section
   counters preview their items on hover, and Follow Up / Print reopen
   the sheet on the pad. The Summary tab aggregates every section across
   visits, with a per-visit timeline behind View Details.

   Patients here are the shared registry — the same records the portal's
   "My patients", appointments and pharmacy views read.
   ===================================================================== */

const PAGE = 25

/* The record shelves carried over from the patient portal's My records, in
   the same order the patient sees them. */
const SHELVES = [
  { key: 'reports', label: 'Tests & reports', icon: FlaskConical },
  { key: 'vaccines', label: 'Vaccine history', icon: Syringe },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'notes', label: 'Visit notes', icon: FileText },
]

const pretty = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`
}
const ordinal = (n) => {
  const suf = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suf}`
}
const prettyLong = (iso) => {
  const d = new Date(iso)
  return `${ordinal(d.getDate())} ${d.toLocaleString('en', { month: 'long' })} ${d.getFullYear()}`
}
const ago = (iso) => {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return ''
  const days = Math.floor(ms / 86400000)
  if (days === 0) {
    const hours = Math.floor(ms / 3600000)
    return hours <= 0 ? '(just now)' : `(${hours} hour${hours > 1 ? 's' : ''} ago)`
  }
  if (days < 30) return `(${days} day${days > 1 ? 's' : ''} ago)`
  const months = Math.floor(days / 30)
  return `(${months} month${months > 1 ? 's' : ''} ago)`
}
const ageText = (age) => (age === '' || age == null ? '—' : `${age} years`)
const clean = (label) => String(label).replace(/[:,]\s*$/, '')

/* ------------------------------------------------------------------ */
/* Patient list                                                        */
/* ------------------------------------------------------------------ */

function PatientListInner() {
  const { records, remove } = useData()
  const { savedPads } = usePad()
  const toast = useToast()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState(null) // patient pending delete

  const patients = records('patients')
  const prescriptions = records('prescriptions')

  /* Last visit = most recent pad sheet, falling back to the latest filed
     RX record, so the column works even before this browser used the pad. */
  const lastVisit = useMemo(() => {
    const map = new Map()
    for (const s of savedPads) {
      if (!s.patientId || !s.date) continue
      if (!map.has(s.patientId) || s.date > map.get(s.patientId)) map.set(s.patientId, s.date)
    }
    for (const r of prescriptions) {
      if (!r.patientId || !r.issuedAt) continue
      const iso = new Date(r.issuedAt).toISOString()
      if (!map.has(r.patientId) || iso > map.get(r.patientId)) map.set(r.patientId, iso)
    }
    return map
  }, [savedPads, prescriptions])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s
      ? patients.filter((p) => `${p.name} ${p.phone || ''} ${p.resourceId}`.toLowerCase().includes(s))
      : patients
    /* Most recently seen first — the person you just prescribed for is
       almost always the one you are looking for. */
    return [...list].sort((a, b) =>
      String(lastVisit.get(b.resourceId) || '').localeCompare(String(lastVisit.get(a.resourceId) || ''))
    )
  }, [q, patients, lastVisit])

  const shown = filtered.slice(0, page * PAGE)

  const del = (p) => {
    remove('patients', p.resourceId, {
      title: 'Patient deleted from Rx patient list',
      sub: `${p.resourceId} · ${p.name}`,
    })
    toast.info(`Patient ${p.name} deleted.`)
    setConfirm(null)
  }

  return (
    <div className="rxpad pp-page">
      <div className="pp-card">
        <div className="pp-head">
          <h2>
            Patient List{' '}
            <span className="pp-count">(Showing <b>{shown.length}</b> of <b>{filtered.length}</b> results)</span>
          </h2>
          <div className="pp-head-acts">
            <button className="pp-add" onClick={() => setAdding(true)}>
              <PlusCircle size={17} /> Add Patient
            </button>
            <button className="pp-refresh" title="Refresh" onClick={() => setQ('')}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="pp-search">
          <Search size={17} />
          <input
            value={q}
            placeholder="Search by name/phone/serial no"
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
          />
          <button className="pp-search-btn">Search</button>
          <span className="pp-search-info" title="Search matches patient name, phone number or serial (ID)."><Info size={16} /></span>
        </div>

        <div className="pp-list">
          {shown.length === 0 && (
            <p className="pp-empty">{q ? `No patient matches “${q}”.` : 'No patients registered yet.'}</p>
          )}
          {shown.map((p) => {
            const lv = lastVisit.get(p.resourceId)
            return (
              <div key={p.resourceId} className="pp-row" onClick={() => nav(`/doctor/rx-patients/${p.resourceId}`)}>
                <div className="pp-row-head">
                  <span className="pp-name">{p.name}</span>
                  <span className="pp-lastvisit">
                    {lv ? <>Last Visited: {pretty(lv)} <i>{ago(lv)}</i></> : 'No visits recorded'}
                  </span>
                  <CircleCheck size={19} className="pp-check" />
                </div>
                <div className="pp-row-body">
                  <span><i>Phone:</i> <b>{p.phone || '—'}</b></span>
                  <span><i>Serial #:</i> <b>{p.resourceId}</b></span>
                  <span><i>Age:</i> <b>{ageText(p.age)}</b></span>
                  <button
                    className="pp-del"
                    onClick={(e) => { e.stopPropagation(); setConfirm(p) }}
                  >
                    <CircleMinus size={16} /> Delete
                  </button>
                  <span className="pp-address"><i>Address:</i> {p.address ? <b>{p.address}</b> : ''}</span>
                </div>
              </div>
            )
          })}
        </div>

        {page * PAGE < filtered.length && (
          <div className="pp-loadmore">
            <button onClick={() => setPage((n) => n + 1)}>Load More</button>
          </div>
        )}
      </div>

      {adding && <AddPatientModal onClose={() => setAdding(false)} />}

      {confirm && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="modal">
            <div className="modal-head">
              <h3>Delete patient?</h3>
              <button className="modal-x" onClick={() => setConfirm(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>
                <b>{confirm.name}</b> ({confirm.resourceId}) will be removed from the shared patient
                registry — appointments, notes and pharmacy views all read it. This cannot be undone.
              </p>
            </div>
            <div className="modal-foot">
              <button className="pbtn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="pbtn danger" onClick={() => del(confirm)}>Delete patient</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared item renderers                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Inline expanded prescription sheet                                  */
/* ------------------------------------------------------------------ */

const EXAM_KEYS = ['onexam', 'ecg', 'echo', 'ett', 'lipid', 'cag', 'procedure']

function VisitSheet({ visit }) {
  const { leftSections, rightSections, sections, setTemplates } = usePad()
  const toast = useToast()
  const [view, setView] = useState('rx') // 'rx' | 'exam' | 'template'
  const [tplName, setTplName] = useState('')

  const items = visit.items || {}

  const column = (secs) => (
    <div className="pp-sheet-col">
      {secs.map((sec) => (
        <div key={sec.key} className="pp-sheet-sec">
          <span className={`sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`} style={sectionStyle(sec, 'section')}>
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

  const saveTemplate = () => {
    const name = tplName.trim()
    if (!name) return toast.warning('Give the template a name first.')
    const keys = Object.keys(items).filter((k) => items[k]?.length)
    const type = keys.includes('rx') || !keys.length ? 'Medicines' : keys[0]
    setTemplates((t) => [...t, { id: padId('tpl'), name, type, score: 0, items: JSON.parse(JSON.stringify(items)) }])
    toast.success(`Template “${name}” created from this visit.`)
    setTplName('')
    setView('rx')
  }

  const examSecs = sections.filter((s) => EXAM_KEYS.includes(s.key))
  const examWith = examSecs.filter((s) => items[s.key]?.length)

  return (
    <div className="pp-sheet">
      <div className="pp-sheet-tools">
        <button className={`pp-tool rx ${view === 'rx' ? 'on' : ''}`} onClick={() => setView('rx')}>
          <span className="pp-tab-rx">℞</span> View Prescription
        </button>
        <button className={`pp-tool ${view === 'exam' ? 'on' : ''}`} onClick={() => setView('exam')}>
          <Activity size={15} /> View Examinations
        </button>
        <button className={`pp-tool tpl ${view === 'template' ? 'on' : ''}`} onClick={() => setView('template')}>
          <CirclePlus size={15} /> Create Template
        </button>
      </div>

      {view === 'template' && (
        <div className="pp-tpl-create">
          <input
            autoFocus
            value={tplName}
            placeholder="Template name…"
            onChange={(e) => setTplName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
          />
          <button className="pp-show" onClick={saveTemplate}>Save Template</button>
          <span className="pp-tpl-hint">Saves this visit's whole sheet as a reusable prescription template.</span>
        </div>
      )}

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
          {column(leftSections)}
          {column(rightSections)}
        </div>
      )}
    </div>
  )
}

/* Hover preview for one section's items. */
function SecPopover({ sec, items, date }) {
  return (
    <div className="pp-sec-pop">
      <div className="pp-sec-pop-head">
        <span>{sec.label}</span>
        <span className="pp-sec-pop-date">{prettyLong(date)}</span>
      </div>
      <div className="pp-sec-pop-body">
        {items.map((it, i) =>
          it.name ? <MedLine key={i} it={it} /> : <ItemLine key={i} it={it} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Summary tab                                                         */
/* ------------------------------------------------------------------ */

/* Always-shown clinical cards, then anything else that has data. */
const SUMMARY_ALWAYS = ['presenting', 'known', 'investigation']

function SectionDetailsModal({ sec, visits, onClose }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal pp-details-modal">
        <div className="modal-head">
          <h3>{clean(sec.label)} Details</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="pp-details-secbox">{clean(sec.label)}</div>
          <div className="pp-details-timeline">
            {visits.map((v) => {
              const items = v.items?.[sec.key] || []
              return (
                <div key={v.id} className="pp-details-row">
                  <div className="pp-details-datewrap">
                    <span className="pp-details-date">{prettyLong(v.date)}</span>
                    <span className="pp-details-dot" />
                  </div>
                  <div className="pp-details-items">
                    {items.length === 0 ? (
                      <div className="pp-details-none">No {clean(sec.label)}</div>
                    ) : (
                      items.map((it, i) => (
                        <div key={i} className="pp-details-item">
                          {it.name ? (
                            <>
                              <div>{medPrefix(it.form)} {it.name}</div>
                              <small>{[it.dose, it.timing, it.duration].filter(Boolean).join(' · ')}</small>
                            </>
                          ) : (
                            <>
                              <div>{it.text}</div>
                              {it.note && <small>{it.note}</small>}
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryTab({ visits }) {
  const { sections } = usePad()
  const [detail, setDetail] = useState(null) // section object

  /* Unique items per section across all visits, newest first. */
  const bySection = useMemo(() => {
    const map = new Map()
    for (const sec of sections) {
      const seen = new Set()
      const out = []
      for (const v of visits) {
        for (const it of v.items?.[sec.key] || []) {
          const key = it.name || it.text
          if (!key || seen.has(key)) continue
          seen.add(key)
          out.push(it)
        }
      }
      map.set(sec.key, out)
    }
    return map
  }, [sections, visits])

  const cards = sections.filter(
    (sec) => SUMMARY_ALWAYS.includes(sec.key) || (bySection.get(sec.key) || []).length > 0
  )

  return (
    <div className="pp-summary">
      <h3 className="pp-summary-title">Patient Summary</h3>
      <div className="pp-sum-grid">
        {cards.map((sec) => {
          const items = bySection.get(sec.key) || []
          return (
            <div key={sec.key} className="pp-sum-card">
              <div className="pp-sum-card-head">
                <h4>{clean(sec.label)}</h4>
                <span className="pp-count">(Showing <b>{items.length}</b> of <b>{items.length}</b> results)</span>
              </div>
              <div className="pp-sum-card-body">
                {items.length === 0 ? (
                  <div className="pp-sum-none">No {clean(sec.label)}</div>
                ) : (
                  <ul>
                    {items.slice(0, 6).map((it, i) => (
                      <li key={i}>{it.name ? `${medPrefix(it.form)} ${it.name}` : it.text}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="pp-sum-card-foot">
                <button
                  className="pp-viewdetails"
                  disabled={items.length === 0}
                  onClick={() => setDetail(sec)}
                >
                  View Details
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {detail && <SectionDetailsModal sec={detail} visits={visits} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Patient detail                                                      */
/* ------------------------------------------------------------------ */

function EditPatientModal({ patient, onClose }) {
  const { patch } = useData()
  const toast = useToast()
  const [f, setF] = useState({
    name: patient.name || '',
    age: patient.age ?? '',
    gender: patient.gender || 'Male',
    phone: patient.phone || '',
    weight: patient.weight || '',
    address: patient.address || '',
  })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = () => {
    if (!f.name.trim()) return toast.warning('Patient name is required.')
    patch('patients', patient.resourceId, {
      name: f.name.trim(),
      age: f.age === '' ? '' : Number(f.age),
      gender: f.gender,
      phone: f.phone.trim(),
      weight: f.weight === '' ? '' : Number(f.weight),
      address: f.address.trim(),
      updatedAt: Date.now(),
    }, {
      title: 'Patient details updated',
      sub: `${patient.resourceId} · ${f.name.trim()}`,
    })
    toast.success('Patient updated.')
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Edit {patient.name}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="full"><span>Name *</span><input autoFocus value={f.name} onChange={set('name')} /></label>
            <label><span>Age</span><input type="number" min="0" value={f.age} onChange={set('age')} /></label>
            <label><span>Gender</span>
              <select value={f.gender} onChange={set('gender')}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </label>
            <label><span>Weight (kg)</span><input type="number" min="0" value={f.weight} onChange={set('weight')} /></label>
            <label><span>Phone</span><input value={f.phone} onChange={set('phone')} /></label>
            <label className="full"><span>Address</span><input value={f.address} onChange={set('address')} /></label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="pbtn ghost" onClick={onClose}>Cancel</button>
          <button className="pbtn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

function PatientDetailInner() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { records } = useData()
  const { savedPads, deletePad, sections } = usePad()
  const [tab, setTab] = useState('visits')
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(null) // visit id with inline sheet open

  const patient = records('patients').find((p) => p.resourceId === id)
  const visits = useMemo(
    () => savedPads.filter((s) => s.patientId === id).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [savedPads, id]
  )

  if (!patient) {
    return (
      <div className="rxpad pp-page">
        <div className="pp-card">
          <p className="pp-empty">
            Patient {id} was not found — they may have been deleted.{' '}
            <Link to="/doctor/rx-patients">Back to the patient list</Link>.
          </p>
        </div>
      </div>
    )
  }

  const goPad = (state) => nav('/doctor/pad', { state })

  return (
    <div className="rxpad pp-page">
      <div className="pp-crumb">
        <Link to="/doctor/rx-patients" className="pp-crumb-link"><User size={16} /> Patients</Link>
        <span className="pp-crumb-name">{patient.name}</span>
      </div>

      <div className="pp-detail">
        <aside className="pp-profile">
          <div className="pp-profile-card">
            <div className="pp-profile-head">
              <h3>{patient.name}</h3>
              <button className="pp-edit" onClick={() => setEditing(true)}>Edit <Pencil size={13} /></button>
            </div>
            {patient.updatedAt && <div className="pp-updated">updated: {ago(new Date(patient.updatedAt).toISOString()).replace(/[()]/g, '')}</div>}
            <div className="pp-facts">
              <div><span>ID:</span><b>{patient.resourceId}</b></div>
              <div><span>Age :</span><b>{ageText(patient.age)}</b></div>
              <div><span>Weight :</span><b>{patient.weight ? `${patient.weight} kg` : '—'}</b></div>
              <div><span>Phone:</span><b>{patient.phone || '—'}</b></div>
              {patient.address && <div><span>Address:</span><b>{patient.address}</b></div>}
            </div>
          </div>
          <button className="pp-write" onClick={() => goPad({ patientId: patient.resourceId })}>
            <FilePlus2 size={16} /> Write Prescription
          </button>
        </aside>

        <main className="pp-visits-card">
          <div className="pp-tabs">
            <button className={tab === 'visits' ? 'on' : ''} onClick={() => setTab('visits')}>
              <span className="pp-tab-rx">℞</span> Visits
            </button>
            <button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>
              <BarChart3 size={15} /> Summary
            </button>
            {/* The same shelves the patient sees in My records, so both
                sides of the consultation are looking at one record. */}
            {SHELVES.map((s) => (
              <button key={s.key} className={tab === s.key ? 'on' : ''} onClick={() => setTab(s.key)}>
                <s.icon size={15} /> {s.label}
              </button>
            ))}
          </div>

          {SHELVES.some((s) => s.key === tab) && <RecordShelf patient={patient} shelf={tab} />}

          {tab === 'visits' && (
            <>
              <div className="pp-visits-head">
                <h3>Past Visits</h3>
                <span className="pp-total">Total: {visits.length}</span>
              </div>
              {visits.length === 0 && (
                <p className="pp-empty">
                  No pad prescriptions for this patient yet — press <b>Write Prescription</b> to start one.
                </p>
              )}
              <div className="pp-timeline">
                {visits.map((v) => {
                  const keys = Object.keys(v.items || {}).filter((k) => v.items[k]?.length)
                  const open = expanded === v.id
                  return (
                    <div key={v.id} className="pp-visit">
                      <span className="pp-visit-dot">℞</span>
                      <div className="pp-visit-card">
                        <div className="pp-visit-top">
                          <span className="pp-visit-date">{prettyLong(v.date)}</span>
                          <div className="pp-visit-acts">
                            <button
                              className={`pp-show ${open ? 'hide' : ''}`}
                              onClick={() => setExpanded(open ? null : v.id)}
                            >
                              {open ? 'Hide Prescription' : 'Show Prescription'}
                            </button>
                            <button
                              className="pp-followup"
                              title="Start a follow-up visit with this sheet preloaded"
                              onClick={() => goPad({ patientId: patient.resourceId, items: v.items })}
                            >
                              <FilePlus2 size={15} /> Follow Up
                            </button>
                            <button
                              className="pp-print"
                              title="Open in the pad's print preview"
                              onClick={() => goPad({ patientId: patient.resourceId, items: v.items, print: true })}
                            >
                              <Printer size={15} /> Print
                            </button>
                            <button
                              className="pp-visit-x"
                              title="Delete this visit"
                              onClick={() => { deletePad(v.id); toast.info('Visit deleted.') }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="pp-visit-secs">
                          {keys.map((k) => {
                            const sec = sections.find((s) => s.key === k) || { key: k, label: k }
                            return (
                              <span key={k} className="pp-visit-sec-wrap">
                                <button className="pp-visit-sec" onClick={() => setExpanded(open ? null : v.id)}>
                                  {clean(sec.label)} <span>({v.items[k].length})</span>
                                </button>
                                <SecPopover sec={sec} items={v.items[k]} date={v.date} />
                              </span>
                            )
                          })}
                        </div>
                        {open && <VisitSheet visit={v} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {tab === 'summary' && <SummaryTab visits={visits} />}
        </main>
      </div>

      {editing && <EditPatientModal patient={patient} onClose={() => setEditing(false)} />}
    </div>
  )
}

export function PadPatientDetail() {
  return (
    <PadProvider>
      <PatientDetailInner />
    </PadProvider>
  )
}

export default function PadPatients() {
  return (
    <PadProvider>
      <PatientListInner />
    </PadProvider>
  )
}
