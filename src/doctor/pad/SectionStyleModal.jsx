import { useState } from 'react'
import { X, SquarePen, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { FONT_SIZES, EN_FONTS, BN_FONTS, sectionStyle } from './padData.js'

/* =====================================================================
   Per-section style editor — the modal behind the pencil-square icon in
   the original TELEMEDIB "Prescription Layout" panel.

   Five style targets, one per sidebar tab:
     Section — the section label itself
     List    — the whole item list under the label
     Entry   — each item row
     Name    — the item text (medicine name on Rx)
     Note    — the item note (dosage line on Rx)

   Each target takes font size / color / English+Bangla font, plus border
   and padding per side. Everything edits the LayoutPanel draft live (the
   preview at the bottom is the real markup), and persists when the panel
   is saved.
   ===================================================================== */

const TABS = [
  { key: 'section', label: 'Section' },
  { key: 'list', label: 'List' },
  { key: 'entry', label: 'Entry' },
  { key: 'name', label: 'Name' },
  { key: 'note', label: 'Note' },
]

const SIDES = [
  { key: 't', Icon: ArrowUp, title: 'top' },
  { key: 'b', Icon: ArrowDown, title: 'bottom' },
  { key: 'l', Icon: ArrowLeft, title: 'left' },
  { key: 'r', Icon: ArrowRight, title: 'right' },
]

export default function SectionStyleModal({ sec, shown, onPatchStyles, onToggleShow, onClose }) {
  const [tab, setTab] = useState('section')
  const tabLabel = TABS.find((t) => t.key === tab).label
  const st = sec.styles?.[tab] || {}
  const patch = (p) => onPatchStyles({ ...(sec.styles || {}), [tab]: { ...st, ...p } })

  const border = st.border || {}
  const padding = st.padding || {}
  const toggleBorder = (side) => patch({ border: { ...border, [side]: !border[side] } })
  /* Each click grows that side by 2px and wraps back to 0 after 12px. */
  const bumpPadding = (side) => patch({ padding: { ...padding, [side]: ((padding[side] || 0) + 2) % 14 } })

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ss-modal">
        <div className="modal-head">
          <h3><SquarePen size={17} style={{ verticalAlign: -3, marginRight: 8 }} />{sec.label}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ss-body">
          <div className="ss-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`ss-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="ss-content">
            <p className="ss-h">{tabLabel} Font Size</p>
            <div className="ss-sizes">
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs}
                  className={(st.fontSize || 'default') === fs ? 'on' : ''}
                  onClick={() => patch({ fontSize: fs === 'default' ? undefined : fs })}
                >
                  {fs}
                </button>
              ))}
            </div>

            <div className="ss-row">
              <span className="ss-label">Font Color:</span>
              <label className="ss-colorpick">
                <input
                  type="color"
                  value={st.color || '#1f2937'}
                  onChange={(e) => patch({ color: e.target.value })}
                />
                Color Picker
              </label>
              {st.color && (
                <button className="ss-clear" onClick={() => patch({ color: undefined })}>✕ clear</button>
              )}
            </div>

            <p className="ss-h">{tabLabel} Font Style</p>
            <div className="ss-row">
              <select
                className="ss-font"
                value={st.fontEn || ''}
                onChange={(e) => patch({ fontEn: e.target.value || undefined })}
              >
                <option value="">Select English Font style</option>
                {EN_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                className="ss-font"
                value={st.fontBn || ''}
                onChange={(e) => patch({ fontBn: e.target.value || undefined })}
              >
                <option value="">Select Bangla Font style</option>
                {BN_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="ss-row">
              <span className="ss-label">Border</span>
              <div className="ss-arrows">
                {SIDES.map(({ key, Icon, title }) => (
                  <button
                    key={key}
                    className={border[key] ? 'on' : ''}
                    title={`Toggle ${title} border`}
                    onClick={() => toggleBorder(key)}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="ss-row">
              <span className="ss-label">Padding</span>
              <div className="ss-arrows">
                {SIDES.map(({ key, Icon, title }) => (
                  <button
                    key={key}
                    className={padding[key] ? 'on' : ''}
                    title={`${title} padding: ${padding[key] || 0}px — click to increase`}
                    onClick={() => bumpPadding(key)}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
              <small className="ss-padval">
                {`${padding.t || 0} / ${padding.b || 0} / ${padding.l || 0} / ${padding.r || 0} px`}
              </small>
            </div>
          </div>
        </div>

        <div className="ss-preview">
          <label className="ss-show">
            <input type="checkbox" checked={shown} onChange={onToggleShow} />
            Show In Print
          </label>
          <div className="ss-prevpad">
            <span
              className={`sec-label ${sec.style || ''} ${sec.underline ? 'underline' : ''}`}
              style={sectionStyle(sec, 'section')}
            >
              {sec.label}
            </span>
            <ul className="ss-prevlist" style={sectionStyle(sec, 'list')}>
              <li style={sectionStyle(sec, 'entry')}>
                <span style={sectionStyle(sec, 'name')}>Sample item</span>
                <em style={sectionStyle(sec, 'note')}> — sample note</em>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
