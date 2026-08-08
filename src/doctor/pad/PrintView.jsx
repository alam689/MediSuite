import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { medPrefix, todayStr, sectionStyle } from './padData.js'
import PadHeader from './PadHeader.jsx'

function SheetSection({ sec, items, separator }) {
  if (!items?.length) return null
  return (
    <div className={`ps-section ${separator ? 'sep' : ''}`}>
      <span className={`sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`} style={sectionStyle(sec, 'section')}>
        {sec.label}
      </span>
      <ul className={sec.type === 'medicine' ? 'ps-meds' : 'ps-items'} style={sectionStyle(sec, 'list')}>
        {items.map((it) => (
          <li key={it.uid} style={sectionStyle(sec, 'entry')}>
            {sec.type === 'medicine' ? (
              <>
                <div className="med-name" style={sectionStyle(sec, 'name')}>{medPrefix(it.form)} {it.name}</div>
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

/* The printable sheet, laid out in real inches from the layout config. */
export default function PrintView({ autoPrint, onClose }) {
  const { rx, layout, visibility, leftSections, rightSections } = usePad()
  const { page, body, patient: patientCfg } = layout
  const p = rx.patient

  const printHeader = visibility.headerFooter || page.type === 'blank'

  useEffect(() => {
    if (!autoPrint) return
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [autoPrint])

  const value = (key) => (key === 'date' ? todayStr() : p?.[key] || '')

  const contentW = page.width - page.marginLeft - page.marginRight
  const leftPct = (body.leftWidth / contentW) * 100

  return (
    <div className="print-overlay rxpad-print">
      <style>{`@page { size: ${page.width}in ${page.height}in; margin: 0; }`}</style>
      <div className="pv-toolbar noprint">
        <span>Print Preview — {page.width}″ × {page.height}″ ({page.type === 'pad' ? 'Prescription Pad' : 'Blank Page'})</span>
        <div>
          <button className="pbtn primary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="pbtn ghost" onClick={onClose}><X size={15} /> Close</button>
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
          {printHeader && <PadHeader />}
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
              <span><b>Name:</b> {p.name}</span>
              <span><b>Age:</b> {p.age}</span>
              <span><b>Date:</b> {todayStr()}</span>
            </div>
          )
        )}

        <div
          className={`ps-body ${body.separator ? 'with-sep' : ''}`}
          style={{ minHeight: `${page.height - page.headerHeight - page.footerHeight - 0.6}in` }}
        >
          <div className="ps-col" style={{ width: `${leftPct}%`, paddingTop: `${body.leftTopMargin}in` }}>
            {leftSections.filter((s) => visibility.sections[s.key] !== false).map((s) => (
              <SheetSection key={s.key} sec={s} items={rx.items[s.key]} />
            ))}
          </div>
          <div className="ps-col right" style={{ width: `${100 - leftPct}%`, paddingTop: `${body.rightTopMargin}in` }}>
            {rightSections.filter((s) => visibility.sections[s.key] !== false).map((s) => (
              <SheetSection key={s.key} sec={s} items={rx.items[s.key]} />
            ))}
          </div>
        </div>

        {body.bottomLine && <div className="ps-bottomline" />}
        <div className="ps-footer" style={{ height: `${page.footerHeight}in` }} />
      </div>
    </div>
  )
}
