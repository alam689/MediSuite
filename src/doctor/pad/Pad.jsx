import { useState } from 'react'
import { Plus, Search, CirclePlus } from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { medPrefix, todayStr, sectionStyle } from './padData.js'
import PadHeader from './PadHeader.jsx'
import Picker from './Picker.jsx'
import { AddPatientModal, SearchPatientsModal } from './PatientModals.jsx'

/* One pad section: label, "+" opener, and the items already on the pad. */
function Section({ sec, onOpen }) {
  const { rx, removeItem, visibility } = usePad()
  const items = rx.items[sec.key] || []
  if (visibility.sections[sec.key] === false) return null

  const labelClass = `sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`

  return (
    <div className={`section ${sec.key === 'rx' ? 'sec-rx' : ''}`}>
      <div className="sec-head">
        <span className={labelClass} style={sectionStyle(sec, 'section')}>{sec.label}</span>
        <button className="sec-add" onClick={(e) => onOpen(sec, e)} title={`Add ${sec.label}`}>
          <Plus size={15} strokeWidth={2.6} />
        </button>
      </div>
      {items.length > 0 && (
        <ul className={`sec-items ${sec.type === 'medicine' ? 'med-items' : ''}`} style={sectionStyle(sec, 'list')}>
          {items.map((it) => (
            <li key={it.uid} className="sec-item" style={sectionStyle(sec, 'entry')}>
              {sec.type === 'medicine' ? (
                <div className="med-line">
                  <div className="med-name" style={sectionStyle(sec, 'name')}>
                    {medPrefix(it.form)} {it.name}
                  </div>
                  <div className="med-dose" style={sectionStyle(sec, 'note')}>
                    {it.dose} {it.timing ? `--- ${it.timing}` : ''} {it.duration ? `--- ${it.duration}` : ''}
                  </div>
                </div>
              ) : (
                <span className="item-text" style={sectionStyle(sec, 'name')}>
                  {it.text}
                  {it.note ? <em className="item-note" style={sectionStyle(sec, 'note')}> — {it.note}</em> : null}
                </span>
              )}
              <button className="item-x" title="Remove" onClick={() => removeItem(sec.key, it.uid)}>⊗</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Pad() {
  const { rx, leftSections, rightSections } = usePad()
  const [picker, setPicker] = useState(null) // {sec, x, y}
  const [addPatient, setAddPatient] = useState(false)
  const [searchPatient, setSearchPatient] = useState(false)

  const openPicker = (sec, e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPicker({ sec, x: r.left, y: r.bottom + 4 })
  }

  const p = rx.patient

  return (
    <div className="pad-wrap noprint">
      <div className="sheet">
        <PadHeader />

        <div className="patient-bar">
          <span className="pb-label">Name:</span>
          {p ? (
            <button className="pb-name" title="Change patient" onClick={() => setSearchPatient(true)}>
              {p.name} <small className="pb-pid">({p.pid})</small>
            </button>
          ) : (
            <button className="pb-add" onClick={() => setAddPatient(true)}>
              <CirclePlus size={16} /> Add Patient
            </button>
          )}
          <span className="pb-label">Age:</span>
          <span className="pb-val">{p?.age || ''}</span>
          <span className="pb-label">Date: {todayStr()}</span>
          <button className="pb-search" onClick={() => setSearchPatient(true)}>
            <Search size={15} /> Search Patients
          </button>
        </div>

        <div className="pad-body">
          <div className="pad-col pad-left">
            {leftSections.map((s) => (
              <Section key={s.key} sec={s} onOpen={openPicker} />
            ))}
          </div>
          <div className="pad-col pad-right">
            {rightSections.map((s) => (
              <Section key={s.key} sec={s} onOpen={openPicker} />
            ))}
          </div>
        </div>
      </div>

      {picker && <Picker sec={picker.sec} x={picker.x} y={picker.y} onClose={() => setPicker(null)} />}
      {addPatient && <AddPatientModal onClose={() => setAddPatient(false)} />}
      {searchPatient && (
        <SearchPatientsModal
          onClose={() => setSearchPatient(false)}
          onAddNew={() => { setSearchPatient(false); setAddPatient(true) }}
        />
      )}
    </div>
  )
}
