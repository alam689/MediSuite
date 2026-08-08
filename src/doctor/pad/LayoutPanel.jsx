import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Check, SquarePen, Paintbrush, RotateCcw, CircleX,
  Layers, Save, X, Plus,
} from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { DEFAULT_SECTIONS, padId } from './padData.js'
import SectionStyleModal from './SectionStyleModal.jsx'

/* =====================================================================
   "Prescription Layout" setup — the section-list editor from the original
   TELEMEDIB top bar. Per section: an include checkbox, inline rename,
   reset-to-default, and (for custom sections) delete. "Add New Section"
   creates a custom section in either pad column; Save commits the draft
   to the persisted catalogue, Reset restores the factory list.

   This edits *what sections exist and what they're called*; the print
   page geometry lives in LayoutWizard, and per-print show/hide also
   remains available in SettingsModal — both read the catalogue saved
   here.
   ===================================================================== */

function Row({ sec, on, editing, onToggle, onEdit, onRename, onEditDone, onStyle, onReset, onDelete }) {
  return (
    <div className="pl-row">
      <button className={`pl-check ${on ? 'on' : ''}`} onClick={onToggle} title={on ? 'Included on the pad' : 'Hidden from the pad'}>
        {on ? <Check size={15} strokeWidth={3} /> : <span className="pl-box" />}
      </button>
      {editing ? (
        <input
          className="pl-edit"
          autoFocus
          value={sec.label}
          onChange={(e) => onRename(e.target.value)}
          onBlur={onEditDone}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && onEditDone()}
        />
      ) : (
        <span className={`pl-label ${sec.custom ? 'custom' : ''}`}>{sec.label}</span>
      )}
      <span className="pl-icons">
        <button className="pl-ico edit" title="Rename section" onClick={onEdit}><SquarePen size={16} /></button>
        <button className="pl-ico style" title="Section style (font, border, padding)" onClick={onStyle}><Paintbrush size={16} /></button>
        <button className="pl-ico reset" title="Reset to default" onClick={onReset}><RotateCcw size={16} /></button>
        <button className="pl-ico del" title="Remove section" onClick={onDelete}><CircleX size={16} /></button>
      </span>
    </div>
  )
}

export default function LayoutPanel({ onClose }) {
  const { sections, setSections, visibility, setVisibility } = usePad()
  const toast = useToast()
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(sections)))
  const [vis, setVis] = useState(() => ({ ...visibility.sections }))
  const [editKey, setEditKey] = useState(null)
  const [styleKey, setStyleKey] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newSide, setNewSide] = useState('left')

  const patch = (key, p) => setDraft((ds) => ds.map((s) => (s.key === key ? { ...s, ...p } : s)))

  const toggleRow = (key) => setVis((v) => ({ ...v, [key]: v[key] === false }))

  const resetRow = (sec) => {
    const def = DEFAULT_SECTIONS.find((d) => d.key === sec.key)
    patch(sec.key, { label: def ? def.label : sec.label, styles: undefined })
    setVis((v) => ({ ...v, [sec.key]: true }))
    setEditKey(null)
  }

  const deleteRow = (sec) => {
    setDraft((ds) => ds.filter((s) => s.key !== sec.key))
    toast.info(`Section “${sec.label}” removed — press Save to apply.`)
  }

  const addSection = () => {
    const label = newLabel.trim()
    if (!label) return toast.warning('Give the new section a name first.')
    const key = padId('sec')
    setDraft((ds) => [...ds, { key, label, side: newSide, custom: true }])
    setVis((v) => ({ ...v, [key]: true }))
    setNewLabel('')
    setAdding(false)
  }

  const save = () => {
    setSections(draft)
    setVisibility((v) => ({ ...v, sections: vis }))
    toast.success('Prescription layout saved.')
  }

  const resetAll = () => {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)))
    setVis(Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.key, true])))
    setEditKey(null)
    toast.info('Layout reset to defaults — press Save to apply.')
  }

  const group = (side) =>
    draft
      .filter((s) => (side === 'left' ? s.side === 'left' : s.side !== 'left'))
      .map((sec) => (
        <Row
          key={sec.key}
          sec={sec}
          on={vis[sec.key] !== false}
          editing={editKey === sec.key}
          onToggle={() => toggleRow(sec.key)}
          onEdit={() => setEditKey(sec.key)}
          onRename={(label) => patch(sec.key, { label })}
          onEditDone={() => {
            if (!String(sec.label).trim()) resetRow(sec)
            setEditKey(null)
          }}
          onStyle={() => setStyleKey(sec.key)}
          onReset={() => resetRow(sec)}
          onDelete={() => deleteRow(sec)}
        />
      ))

  const styleSec = styleKey ? draft.find((s) => s.key === styleKey) : null

  return (
    <div className="pl-panel noprint">
      <button className="pl-head" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <b>Prescription Layout</b>
        <span
          className="pl-x"
          title="Close"
          onClick={(e) => { e.stopPropagation(); onClose() }}
        >
          <X size={16} />
        </span>
      </button>

      {open && (
        <div className="pl-body">
          <div className="pl-toolbar">
            <span className="pl-title">Layout</span>
            <button className="pl-act add" onClick={() => setAdding((a) => !a)}>
              <Layers size={16} /> Add New Section
            </button>
            <button className="pl-act save" onClick={save}><Save size={16} /> Save</button>
            <button className="pl-act reset" onClick={resetAll}><X size={16} /> Reset</button>
          </div>

          {adding && (
            <div className="pl-addrow">
              <input
                autoFocus
                value={newLabel}
                placeholder="New section name…"
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSection()}
              />
              <select value={newSide} onChange={(e) => setNewSide(e.target.value)}>
                <option value="left">Left column</option>
                <option value="right">Right column</option>
              </select>
              <button className="pl-act add" onClick={addSection}><Plus size={15} /> Add</button>
            </div>
          )}

          <div className="pl-list">
            <div className="pl-group">{group('left')}</div>
            <div className="pl-group">{group('right')}</div>
          </div>
        </div>
      )}

      {styleSec && (
        <SectionStyleModal
          sec={styleSec}
          shown={vis[styleSec.key] !== false}
          onPatchStyles={(styles) => patch(styleSec.key, { styles })}
          onToggleShow={() => toggleRow(styleSec.key)}
          onClose={() => setStyleKey(null)}
        />
      )}
    </div>
  )
}
