import { useRef, useState } from 'react'
import {
  FileText, LayoutPanelTop, UserRound, Columns2, PanelBottom,
  ChevronLeft, ChevronRight, Save, X, Plus, Settings, RotateCcw,
} from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { useDoctor } from '../DoctorContext.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import PadHeader, { autoHeaderHtml, sanitizeHeaderHtml } from './PadHeader.jsx'
import { padId, todayStr } from './padData.js'

const STEPS = [
  { key: 'page', title: 'Page Setup', icon: FileText },
  { key: 'header', title: 'Header Section', icon: LayoutPanelTop },
  { key: 'patient', title: 'Patient Section', icon: UserRound },
  { key: 'body', title: 'Body Section', icon: Columns2 },
  { key: 'footer', title: 'Footer Section', icon: PanelBottom },
]

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

function Num({ label, value, onChange, step = 0.05 }) {
  return (
    <label className="lw-num">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  )
}

/* Column count picker with per-column width % steppers, used by both the
   header and footer steps. */
function ColumnConfig({ cfg, onChange }) {
  const setCols = (n) => {
    const widths =
      n === 1 ? [100] : n === 2 ? [50, 50] : [40, 20, 40]
    onChange({ ...cfg, columns: n, widths })
  }
  const nudge = (i, d) => {
    const w = [...cfg.widths]
    if (w.length < 2) return
    const j = (i + 1) % w.length
    if (w[i] + d < 5 || w[j] - d < 5) return
    w[i] += d
    w[j] -= d
    onChange({ ...cfg, widths: w })
  }
  return (
    <>
      <div className="lw-coltabs">
        {[3, 2, 1].map((n) => (
          <button key={n} className={cfg.columns === n ? 'on' : ''} onClick={() => setCols(n)}>
            {cfg.columns === n && <span className="dot">✔</span>} {n} Column
          </button>
        ))}
      </div>
      <div className="lw-widths">
        {cfg.widths.map((w, i) => (
          <div key={i} className="lw-width">
            <button onClick={() => nudge(i, -5)}>◀</button>
            <span>width: {w}%</span>
            <button onClick={() => nudge(i, 5)}>▶</button>
          </div>
        ))}
      </div>
    </>
  )
}

export default function LayoutWizard({ onExit }) {
  const { layout, setLayout, headerHtml, setHeaderHtml } = usePad()
  const { me, name } = useDoctor()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(layout)))

  /* Letterhead text draft: starts from the saved override (or the profile-
     derived header), accumulates contentEditable edits, commits on Save. */
  const autoHeader = autoHeaderHtml(me, name)
  const headerDraft = useRef({
    left: headerHtml?.left ?? autoHeader.left,
    right: headerHtml?.right ?? autoHeader.right,
  })
  const [headerKey, setHeaderKey] = useState(0) // bump to re-seed the editable columns

  const resetHeader = () => {
    headerDraft.current = { ...autoHeader }
    setHeaderHtml(null)
    setHeaderKey((k) => k + 1)
    toast.info('Letterhead reset to the profile.')
  }

  const save = (finish = false) => {
    setLayout(draft)
    const hd = headerDraft.current
    if (hd.left !== autoHeader.left || hd.right !== autoHeader.right) {
      setHeaderHtml({ left: sanitizeHeaderHtml(hd.left), right: sanitizeHeaderHtml(hd.right) })
    } else {
      setHeaderHtml(null)
    }
    toast.success('Print layout saved.')
    if (finish) onExit()
  }

  const page = draft.page
  const setPage = (patch) => setDraft((d) => ({ ...d, page: { ...d.page, ...patch } }))
  const setBody = (patch) => setDraft((d) => ({ ...d, body: { ...d.body, ...patch } }))

  const contentW = page.width - page.marginLeft - page.marginRight
  const bodyH = page.height - page.headerHeight - page.footerHeight

  /* ---- step renderers ---- */
  const renderPage = () => (
    <div className="lw-page">
      <div className="lw-diagram">
        <p className="lwd-top">Total Width: {page.width} inch</p>
        <div className="lwd-outer">
          <p className="lwd-mt">Margin Top: {page.headerHeight} inch</p>
          <div className="lwd-inner">Prescription Area</div>
          <p className="lwd-mb">Margin Bottom: {page.footerHeight} inch</p>
        </div>
        <p className="lwd-left">Total Height: {page.height} inch</p>
        <p className="lwd-ml">Margin Left: {page.marginLeft} inch</p>
        <p className="lwd-mr">Margin Right: {page.marginRight} inch</p>
      </div>
      <div className="lw-form">
        <h3>Page Type</h3>
        <div className="lw-pagetype">
          <button className={page.type === 'blank' ? 'on' : ''} onClick={() => setPage({ type: 'blank' })}>
            <FileText size={38} />
            <span>{page.type === 'blank' && '✔ '}Blank Page</span>
            <small>Header &amp; footer are printed</small>
          </button>
          <button className={page.type === 'pad' ? 'on' : ''} onClick={() => setPage({ type: 'pad' })}>
            <LayoutPanelTop size={38} />
            <span>{page.type === 'pad' && '✔ '}Prescription Pad</span>
            <small>Pre-printed pad — space is left blank</small>
          </button>
        </div>
        <h3>Page Size</h3>
        <div className="lw-grid3">
          <Num label="Total Height (inches)" value={page.height} onChange={(v) => setPage({ height: clamp(v, 3, 20) })} />
          <Num label="Left Margin (inches)" value={page.marginLeft} onChange={(v) => setPage({ marginLeft: clamp(v, 0, 3) })} />
          <Num label="Header Height (inches)" value={page.headerHeight} onChange={(v) => setPage({ headerHeight: clamp(v, 0, 6) })} />
          <Num label="Total Width (inches)" value={page.width} onChange={(v) => setPage({ width: clamp(v, 3, 15) })} />
          <Num label="Right Margin (inches)" value={page.marginRight} onChange={(v) => setPage({ marginRight: clamp(v, 0, 3) })} />
          <Num label="Footer Height (inches)" value={page.footerHeight} onChange={(v) => setPage({ footerHeight: clamp(v, 0, 4) })} />
        </div>
      </div>
    </div>
  )

  const renderHeader = () => (
    <div className="lw-center">
      <h3>Header Columns</h3>
      <ColumnConfig cfg={draft.header} onChange={(header) => setDraft((d) => ({ ...d, header }))} />
      <div className="lw-preview">
        <PadHeader key={headerKey} editable seed={headerDraft.current} editRef={headerDraft} />
      </div>
      <div className="lw-headtools">
        <span className="lw-edit-hint">✎ Click into the letterhead above to edit the printed text.</span>
        <button className="lw-reset-header" onClick={resetHeader}>
          <RotateCcw size={14} /> Reset to profile
        </button>
      </div>
      <p className="lw-hint">
        The doctor header prints only when Page Type is “Blank Page” (or Header &amp; Footer is
        enabled in the show/hide settings). On a pre-printed pad this space stays empty.
      </p>
    </div>
  )

  const renderPatient = () => {
    const rows = draft.patient.rows
    const setRows = (rows) => setDraft((d) => ({ ...d, patient: { ...d.patient, rows } }))
    const patchField = (ri, fi, patch) =>
      setRows(rows.map((r, i) =>
        i !== ri ? r : { ...r, fields: r.fields.map((f, j) => (j !== fi ? f : { ...f, ...patch })) }
      ))
    const removeField = (ri, fi) =>
      setRows(rows.map((r, i) => (i !== ri ? r : { ...r, fields: r.fields.filter((_, j) => j !== fi) })))
    const addField = (ri) =>
      setRows(rows.map((r, i) =>
        i !== ri ? r : { ...r, fields: [...r.fields, { key: 'custom', label: 'Field', width: 20 }] }
      ))
    const addRow = () => setRows([...rows, { id: padId('r'), fields: [{ key: 'custom', label: 'Field', width: 100 }] }])
    const removeRow = (ri) => setRows(rows.filter((_, i) => i !== ri))

    /* Field keys line up with the patient snapshot kept by PadContext. */
    const FIELD_KEYS = ['pid', 'name', 'age', 'gender', 'phone', 'department', 'date', 'custom']

    return (
      <div className="lw-center">
        <h3>Patient Section</h3>
        <div className="lw-meta">
          <span>Total Page Width {page.width}in</span>
          <span>Maximum Width {Number((contentW).toFixed(2))}in</span>
          <span>margin {page.marginLeft}in / {page.marginRight}in</span>
        </div>
        <div className="lw-preview patient-bar-preview">
          <span><b>Name:</b> ＋ Add Patient</span>
          <span><b>Age:</b></span>
          <span><b>Date:</b> {todayStr()}</span>
          <span>🔍 Search Patients</span>
        </div>
        {rows.map((row, ri) => (
          <div className="lw-prow" key={row.id}>
            <button className="lw-prow-gear" title="Remove row" onClick={() => removeRow(ri)}><Settings size={15} /></button>
            <div className="lw-prow-fields">
              {row.fields.map((f, fi) => (
                <div className="lw-pfield" key={fi} style={{ flexGrow: f.width }}>
                  <select
                    value={f.key}
                    onChange={(e) => {
                      const key = e.target.value
                      const label = { pid: 'ID', name: 'Name', age: 'Age', gender: 'Gender', phone: 'Phone', department: 'Department', date: 'Date', custom: f.label }[key]
                      patchField(ri, fi, { key, label })
                    }}
                  >
                    {FIELD_KEYS.map((k) => <option key={k} value={k}>{k === 'pid' ? 'ID' : k}</option>)}
                  </select>
                  <input
                    className="lw-pw"
                    type="number"
                    value={f.width}
                    title="width %"
                    onChange={(e) => patchField(ri, fi, { width: clamp(parseInt(e.target.value) || 0, 5, 100) })}
                  />
                  <span>%</span>
                  <button className="item-x" onClick={() => removeField(ri, fi)}>⊗</button>
                </div>
              ))}
            </div>
            <button className="lw-prow-add" onClick={() => addField(ri)}><Plus size={15} /></button>
          </div>
        ))}
        <button className="pbtn primary" style={{ margin: '14px auto 0', display: 'flex' }} onClick={addRow}>
          ⊞ Add Row
        </button>
      </div>
    )
  }

  const renderBody = () => {
    const leftPct = ((draft.body.leftWidth / contentW) * 100).toFixed(2)
    return (
      <div className="lw-center">
        <h3>Prescription Body Section</h3>
        <div className="lw-bodygrid">
          <div className="lw-vslider">
            <span>Left top: {draft.body.leftTopMargin.toFixed(2)}in</span>
            <input
              type="range" min="0" max={Math.max(1, bodyH / 2)} step="0.05"
              value={draft.body.leftTopMargin}
              onChange={(e) => setBody({ leftTopMargin: parseFloat(e.target.value) })}
            />
          </div>
          <div className="lw-bodyprev">
            <div className="lwb-col" style={{ width: `${leftPct}%` }}>
              <b>Left Section</b>
              <p>Width: {draft.body.leftWidth.toFixed(2)}in ({leftPct}%)</p>
              <p>Top Margin: {draft.body.leftTopMargin.toFixed(2)}in</p>
            </div>
            <div className="lwb-col" style={{ width: `${100 - leftPct}%` }}>
              <b>Right Section</b>
              <p>Width: {(contentW - draft.body.leftWidth).toFixed(2)}in ({(100 - leftPct).toFixed(2)}%)</p>
              <p>Top Margin: {draft.body.rightTopMargin.toFixed(2)}in</p>
            </div>
          </div>
          <div className="lw-vslider">
            <span>Right top: {draft.body.rightTopMargin.toFixed(2)}in</span>
            <input
              type="range" min="0" max={Math.max(1, bodyH / 2)} step="0.05"
              value={draft.body.rightTopMargin}
              onChange={(e) => setBody({ rightTopMargin: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div className="lw-hslider">
          <input
            type="range" min="0.5" max={contentW - 0.5} step="0.05"
            value={draft.body.leftWidth}
            onChange={(e) => setBody({ leftWidth: parseFloat(e.target.value) })}
          />
          <span className="lw-hval">{draft.body.leftWidth.toFixed(2)}</span>
        </div>
        <label className="sh-check-row">
          <input type="checkbox" checked={!!draft.body.separator} onChange={(e) => setBody({ separator: e.target.checked })} />
          Seperator Line Between Sections
        </label>
        <label className="sh-check-row">
          <input type="checkbox" checked={!!draft.body.bottomLine} onChange={(e) => setBody({ bottomLine: e.target.checked })} />
          Bottom Line
        </label>
      </div>
    )
  }

  const renderFooter = () => (
    <div className="lw-center">
      <h3>Footer Columns</h3>
      <ColumnConfig cfg={draft.footer} onChange={(footer) => setDraft((d) => ({ ...d, footer }))} />
      <div className="lw-preview lw-footprev">
        {draft.footer.widths.map((w, i) => (
          <div key={i} style={{ width: `${w}%` }} className="lwf-col" />
        ))}
      </div>
      <p className="lw-hint">Footer height: {page.footerHeight}in — reserved at the bottom of every page.</p>
    </div>
  )

  const renderers = [renderPage, renderHeader, renderPatient, renderBody, renderFooter]

  return (
    <div className="lw-app">
      <header className="lw-top noprint">
        <span className="lw-crumb">Settings</span>
        <span className="lw-crumb strong">Print Layout Configuration</span>
        <button className="lw-exit" onClick={onExit}><X size={16} /> Exit</button>
      </header>

      <div className="lw-steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <button key={s.key} className={`lw-step ${i === step ? 'on' : ''}`} onClick={() => setStep(i)}>
              <Icon size={26} />
              <span>
                <b>{s.title}</b>
                <small>Prescription</small>
              </span>
            </button>
          )
        })}
      </div>

      <div className="lw-body">{renderers[step]()}</div>

      <footer className="lw-foot">
        {step > 0 ? (
          <button className="pbtn nav" onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> Previous</button>
        ) : <span />}
        <button className="pbtn save" onClick={() => save(false)}><Save size={16} /> Save</button>
        {step < STEPS.length - 1 ? (
          <button className="pbtn nav" onClick={() => setStep(step + 1)}>Next <ChevronRight size={16} /></button>
        ) : (
          <button className="pbtn nav" onClick={() => save(true)}>Save &amp; Finish <ChevronRight size={16} /></button>
        )}
      </footer>
    </div>
  )
}
