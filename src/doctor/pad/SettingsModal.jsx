import { X, Check, CircleCheck, CircleX } from 'lucide-react'
import { usePad } from './PadContext.jsx'

/* "Prescription Section Show / Hide Setting" — controls what is included when
   printing. Confirm & Print jumps straight into the print flow. */
export default function SettingsModal({ onClose, onConfirmPrint }) {
  const { visibility, setVisibility, layout, setLayout, leftSections, rightSections } = usePad()

  const toggleSec = (key) =>
    setVisibility((v) => ({ ...v, sections: { ...v.sections, [key]: v.sections[key] === false } }))

  const allOn = (list) => list.every((s) => visibility.sections[s.key] !== false)
  const toggleAll = (list) =>
    setVisibility((v) => {
      const on = !allOn(list)
      const sections = { ...v.sections }
      list.forEach((s) => { sections[s.key] = on })
      return { ...v, sections }
    })

  const Row = ({ on, label, onClick, strong }) => (
    <button className={`sh-row ${on ? 'on' : ''} ${strong ? 'strong' : ''}`} onClick={onClick}>
      <Check size={15} className="sh-check" /> <span>{label}</span>
    </button>
  )

  const countOn = (list) => list.filter((s) => visibility.sections[s.key] !== false).length

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-head">
          <h3>⚕ Prescription Section Show / Hide Setting</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <button
            className={`sh-block ${visibility.headerFooter ? 'on' : ''}`}
            onClick={() => setVisibility((v) => ({ ...v, headerFooter: !v.headerFooter }))}
          >
            <span className="sh-box">{visibility.headerFooter && <Check size={13} />}</span>
            <b>Header &amp; Footer Section</b>
          </button>
          <button
            className={`sh-block ${visibility.patient ? 'on' : ''}`}
            onClick={() => setVisibility((v) => ({ ...v, patient: !v.patient }))}
          >
            <span className="sh-box">{visibility.patient && <Check size={13} />}</span>
            <b>Patient Section</b>
          </button>

          <p className="sh-title">Prescription Sections:</p>
          <div className="sh-cols">
            <div>
              <Row strong on={allOn(leftSections)} label={`All (${countOn(leftSections)})`} onClick={() => toggleAll(leftSections)} />
              {leftSections.map((s) => (
                <Row key={s.key} on={visibility.sections[s.key] !== false} label={s.label} onClick={() => toggleSec(s.key)} />
              ))}
            </div>
            <div>
              <Row strong on={allOn(rightSections)} label={`All (${countOn(rightSections)})`} onClick={() => toggleAll(rightSections)} />
              {rightSections.map((s) => (
                <Row key={s.key} on={visibility.sections[s.key] !== false} label={s.label} onClick={() => toggleSec(s.key)} />
              ))}
            </div>
          </div>

          <label className="sh-check-row">
            <input
              type="checkbox"
              checked={!!layout.body.separator}
              onChange={(e) => setLayout((l) => ({ ...l, body: { ...l.body, separator: e.target.checked } }))}
            />
            Seperator Line Between Sections
          </label>
          <label className="sh-check-row">
            <input
              type="checkbox"
              checked={!!layout.body.bottomLine}
              onChange={(e) => setLayout((l) => ({ ...l, body: { ...l.body, bottomLine: e.target.checked } }))}
            />
            Bottom Line
          </label>
        </div>
        <div className="sh-foot">
          <button className="sh-confirm" onClick={onConfirmPrint}><CircleCheck size={17} /> Confirm &amp; Print</button>
          <button className="sh-close" onClick={onClose}><CircleX size={17} /> Close</button>
        </div>
      </div>
    </div>
  )
}
