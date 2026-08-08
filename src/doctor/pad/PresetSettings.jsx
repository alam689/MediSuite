import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, Pencil, X, ChevronDown, ChevronRight, Save, Info,
} from 'lucide-react'
import { PadProvider, usePad } from './PadContext.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { DOSES, DURATIONS, medPrefix, padId } from './padData.js'
import './pad.css'
import './presets.css'

/* =====================================================================
   Preset Data settings — the management console behind the prescription
   pad, ported from the reference DigitalRX "Preset Data settings" screen.

   Left: Prescription Template plus every pad section. Right: the master
   list behind the selected entry — searchable, score-ranked, paged 25 at
   a time, with Edit / Hide / Add. Medicines additionally carry per-drug
   dosage suggestion presets ("User Suggestion") with a default; phrase
   items can carry nested suggestion notes (the ADVICE "Add Notes" flow).

   Everything edits the same `medisuite-rxpad.*` catalogue the pad's
   pickers read, so a score edited here reorders the picker immediately.
   ===================================================================== */

const PAGE = 25

/* Search bar + "(Showing X of Y results)" head shared by every panel. */
function PanelHead({ title, shown, total, action }) {
  return (
    <div className="ps-panel-head">
      <h2>
        {title}{' '}
        <span className="ps-count">
          (Showing <b>{shown}</b> of <b>{total}</b> results)
        </span>
      </h2>
      {action}
    </div>
  )
}

function SearchBar({ q, setQ, placeholder }) {
  return (
    <div className="ps-search">
      <Search size={17} />
      <input value={q} placeholder={placeholder || ''} onChange={(e) => setQ(e.target.value)} />
      <button className="ps-search-btn">Search</button>
    </div>
  )
}

function LoadMore({ page, setPage, total }) {
  if (page * PAGE >= total) return null
  return (
    <div className="ps-loadmore">
      <button onClick={() => setPage((p) => p + 1)}>Load More</button>
    </div>
  )
}

const secName = (label) => String(label).replace(/[:,]\s*$/, '')

/* ------------------------------------------------------------------ */
/* Prescription templates                                             */
/* ------------------------------------------------------------------ */

function TemplateModal({ tpl, sections, onSave, onClose }) {
  const { medicines, remarks } = usePad()
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(tpl)))
  const [medQ, setMedQ] = useState('')
  const [text, setText] = useState('')
  const toast = useToast()

  const isMed = draft.type === 'Medicines'
  const listKey = isMed ? 'rx' : draft.type
  const rows = draft.items[listKey] || []

  const timingOptions = useMemo(
    () => remarks.filter((r) => !r.hidden).map((r) => r.text),
    [remarks]
  )

  const medMatches = useMemo(() => {
    const s = medQ.trim().toLowerCase()
    if (!s) return []
    return medicines
      .filter((m) => !m.hidden && `${m.brand} ${m.generic} ${m.strength}`.toLowerCase().includes(s))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 8)
  }, [medQ, medicines])

  const setRows = (next) =>
    setDraft((d) => ({ ...d, items: { ...d.items, [listKey]: next } }))

  const addMed = (m) => {
    setRows([
      ...rows,
      {
        uid: padId('u'),
        medId: m.id,
        name: `${m.brand} ${m.strength}`.trim(),
        generic: m.generic || '',
        form: m.form,
        dose: m.dose || '১+০+১',
        timing: m.timing || 'খাবার পরে',
        duration: m.duration || 'চলবে',
      },
    ])
    setMedQ('')
  }

  const addText = () => {
    const t = text.trim()
    if (!t) return
    setRows([...rows, { uid: padId('u'), text: t }])
    setText('')
  }

  const patchRow = (uid, patch) => setRows(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)))

  const save = () => {
    if (!String(draft.name).trim()) return toast.warning('Give the template a name.')
    onSave({ ...draft, score: Number(draft.score) || 0 })
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-head">
          <h3>Prescription Template: {draft.name || 'new'}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="ps-tpl-grid">
            <label>
              Name
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
            <label>
              Score
              <input
                type="number"
                value={draft.score}
                onChange={(e) => setDraft((d) => ({ ...d, score: e.target.value }))}
              />
            </label>
            <label>
              Type
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
              >
                <option value="Medicines">Medicines</option>
                {sections
                  .filter((s) => s.key !== 'rx')
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.custom ? `customSection_${s.label}` : secName(s.label)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="ps-tpl-rx">
            {isMed ? <span className="ps-rx-label">Rx,</span> : <span className="ps-rx-label plain">{secName(sections.find((s) => s.key === draft.type)?.label || draft.type)}</span>}
          </div>

          <div className="ps-tpl-rows">
            {rows.length === 0 && <p className="ps-empty">Nothing in this template yet — add below.</p>}
            {rows.map((r) =>
              isMed ? (
                <div key={r.uid} className="ps-tpl-row">
                  <div className="ps-tpl-med">
                    <div className="ps-tpl-med-name">{medPrefix(r.form)} {r.name}</div>
                    <div className="ps-tpl-med-dose">
                      <select value={r.dose} onChange={(e) => patchRow(r.uid, { dose: e.target.value })}>
                        {(DOSES.includes(r.dose) ? DOSES : [r.dose, ...DOSES]).map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <select value={r.duration} onChange={(e) => patchRow(r.uid, { duration: e.target.value })}>
                        {(DURATIONS.includes(r.duration) ? DURATIONS : [r.duration, ...DURATIONS]).map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <select value={r.timing} onChange={(e) => patchRow(r.uid, { timing: e.target.value })}>
                        {(timingOptions.includes(r.timing) ? timingOptions : [r.timing, ...timingOptions]).map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="ps-row-x" title="Remove" onClick={() => setRows(rows.filter((x) => x.uid !== r.uid))}>⊗</button>
                </div>
              ) : (
                <div key={r.uid} className="ps-tpl-row">
                  <div className="ps-tpl-med"><div className="ps-tpl-med-name plain">{r.text}</div></div>
                  <button className="ps-row-x" title="Remove" onClick={() => setRows(rows.filter((x) => x.uid !== r.uid))}>⊗</button>
                </div>
              )
            )}
          </div>

          {isMed ? (
            <div className="ps-tpl-add">
              <Plus size={16} />
              <input
                value={medQ}
                placeholder="Search medicine to add…"
                onChange={(e) => setMedQ(e.target.value)}
              />
              {medMatches.length > 0 && (
                <div className="ps-tpl-drop">
                  {medMatches.map((m) => (
                    <button key={m.id} onMouseDown={() => addMed(m)}>
                      <b>{m.brand} {m.strength}</b> <small>{m.generic}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ps-tpl-add">
              <Plus size={16} />
              <input
                value={text}
                placeholder="Add a line…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addText()}
              />
              <button className="ps-add-line" onClick={addText}>Add</button>
            </div>
          )}
        </div>
        <div className="modal-foot ps-savebar">
          <button className="ps-save" onClick={save}><Save size={16} /> Save</button>
        </div>
      </div>
    </div>
  )
}

function TemplatesPanel() {
  const { templates, setTemplates, sections } = usePad()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null) // template draft or null

  const typeLabel = (t) => {
    if (!t.type || t.type === 'Medicines') return 'Medicines'
    const sec = sections.find((s) => s.key === t.type)
    if (!sec) return t.type
    return sec.custom ? `customSection_${sec.label}` : secName(sec.label)
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const ranked = [...templates].sort((a, b) => (b.score || 0) - (a.score || 0))
    return s ? ranked.filter((t) => t.name.toLowerCase().includes(s)) : ranked
  }, [q, templates])

  const shown = filtered.slice(0, page * PAGE)

  const save = (draft) => {
    setTemplates((ts) => {
      const exists = ts.some((t) => t.id === draft.id)
      return exists ? ts.map((t) => (t.id === draft.id ? draft : t)) : [...ts, draft]
    })
    toast.success(`Template “${draft.name}” saved.`)
    setEditing(null)
  }

  const del = (t) => {
    setTemplates((ts) => ts.filter((x) => x.id !== t.id))
    toast.info(`Template “${t.name}” deleted.`)
  }

  const create = () =>
    setEditing({ id: padId('tpl'), name: '', type: 'Medicines', score: 0, items: {} })

  return (
    <>
      <PanelHead
        title="Prescription Template"
        shown={shown.length}
        total={filtered.length}
        action={
          <button className="ps-create" onClick={create}>
            Create <Plus size={16} className="ps-create-ico" />
          </button>
        }
      />
      <SearchBar q={q} setQ={(v) => { setQ(v); setPage(1) }} />
      <div className="ps-list">
        {shown.length === 0 && (
          <p className="ps-empty">
            No templates yet — press <b>Create</b>, or save the current pad from the
            prescription screen's template box.
          </p>
        )}
        {shown.map((t) => (
          <div key={t.id} className="ps-row ps-tpl">
            <div className="ps-row-main">
              <div className="ps-row-title">{t.name}</div>
              <div className="ps-row-sub">Type: {typeLabel(t)}</div>
              <div className="ps-row-score">Score: {t.score || 0}</div>
            </div>
            <div className="ps-row-acts">
              <button className="ps-edit" onClick={() => setEditing(JSON.parse(JSON.stringify(t)))}>
                Edit <Pencil size={14} />
              </button>
              <button className="ps-del" title="Delete template" onClick={() => del(t)}><X size={17} /></button>
            </div>
          </div>
        ))}
      </div>
      <LoadMore page={page} setPage={setPage} total={filtered.length} />
      {editing && (
        <TemplateModal
          tpl={editing}
          sections={sections}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Medicine master (the Rx section)                                   */
/* ------------------------------------------------------------------ */

function MedicineModal({ med, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...med }))
  const toast = useToast()
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const save = () => {
    if (!String(draft.brand).trim()) return toast.warning('Brand name is required.')
    onSave({ ...draft, score: Number(draft.score) || 0 })
  }
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{med.brand ? `Edit ${med.brand}` : 'Add medicine'}</h3>
          <button className="modal-x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label>Brand name<input value={draft.brand} onChange={set('brand')} /></label>
            <label>Strength<input value={draft.strength} onChange={set('strength')} /></label>
            <label>
              Form
              <select value={draft.form} onChange={set('form')}>
                {['Tablet', 'Tablet (Enteric Coated)', 'Tablet (Extended Release)', 'Tablet (Modified Release)', 'Tablet (Sustained Release)', 'Capsule', 'Capsule (Delayed Release)', 'Syrup', 'Injection', 'Insulin', 'Drop'].map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Generic<input value={draft.generic} onChange={set('generic')} /></label>
            <label className="full">Company<input value={draft.company || ''} onChange={set('company')} /></label>
            <label>Score<input type="number" value={draft.score} onChange={set('score')} /></label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="pbtn ghost" onClick={onClose}>Cancel</button>
          <button className="pbtn primary" onClick={save}><Save size={15} /> Save</button>
        </div>
      </div>
    </div>
  )
}

function PresetRow({ p, isDefault, onMakeDefault, onRemoveDefault, onDelete }) {
  return (
    <div className="ps-preset-row">
      <div>
        <div className="ps-preset-dose">
          {p.dose.split('+').join(' + ')} টি {p.duration && p.duration !== 'চলবে' ? `(${p.duration})` : '(চলবে)'}
        </div>
        <div className="ps-preset-timing">{p.timing}</div>
      </div>
      <div className="ps-preset-acts">
        {isDefault ? (
          <button className="ps-default on" onClick={onRemoveDefault}>Remove Default</button>
        ) : (
          <button className="ps-default" onClick={onMakeDefault}>Make Default</button>
        )}
        <button className="ps-del small" title="Delete preset" onClick={onDelete}><X size={15} /></button>
      </div>
    </div>
  )
}

function MedicinesPanel() {
  const { medicines, setMedicines, remarks } = usePad()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [scoreEdit, setScoreEdit] = useState(null) // {id, value}
  const [presetDraft, setPresetDraft] = useState(null) // {medId, dose, timing, duration}

  const timingOptions = useMemo(
    () => remarks.filter((r) => !r.hidden).sort((a, b) => (b.score || 0) - (a.score || 0)).map((r) => r.text),
    [remarks]
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = medicines
    if (s) list = list.filter((m) => `${m.brand} ${m.generic} ${m.strength} ${m.company || ''}`.toLowerCase().includes(s))
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [q, medicines])

  const shown = filtered.slice(0, page * PAGE)

  const patch = (id, p) => setMedicines((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))

  const saveScore = () => {
    if (!scoreEdit) return
    patch(scoreEdit.id, { score: Number(scoreEdit.value) || 0 })
    setScoreEdit(null)
  }

  const addPreset = () => {
    const d = presetDraft
    if (!d) return
    const preset = { id: padId('p'), dose: d.dose, timing: d.timing, duration: d.duration }
    setMedicines((ms) => ms.map((m) => (m.id === d.medId ? { ...m, presets: [...(m.presets || []), preset] } : m)))
    setPresetDraft(null)
    toast.success('Preset added.')
  }

  const makeDefault = (m, p) =>
    patch(m.id, { defaultPresetId: p.id, dose: p.dose, timing: p.timing, duration: p.duration })

  const saveMed = (draft) => {
    setMedicines((ms) => {
      const exists = ms.some((m) => m.id === draft.id)
      return exists ? ms.map((m) => (m.id === draft.id ? draft : m)) : [...ms, draft]
    })
    toast.success(`“${draft.brand}” saved.`)
    setEditing(null)
  }

  return (
    <>
      <PanelHead
        title="Medicine"
        shown={shown.length}
        total={filtered.length}
        action={
          <button
            className="ps-create"
            onClick={() =>
              setEditing({ id: padId('m'), brand: '', strength: '', form: 'Tablet', generic: '', company: '', score: 0, hidden: false, presets: [], dose: '১+০+১', timing: 'খাবার পরে', duration: 'চলবে' })
            }
          >
            <Plus size={16} className="ps-create-ico" /> Add
          </button>
        }
      />
      <SearchBar q={q} setQ={(v) => { setQ(v); setPage(1) }} />
      <div className="ps-list">
        {shown.map((m) => {
          const open = openId === m.id
          return (
            <div key={m.id} className={`ps-med ${m.hidden ? 'off' : ''}`}>
              <div className="ps-med-head">
                <button className="ps-chevron" onClick={() => setOpenId(open ? null : m.id)}>
                  {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>
                <div className="ps-med-id">
                  <div className="ps-row-title">{m.brand} {m.strength}</div>
                  <div className="ps-row-sub">{m.company || m.generic || '—'}</div>
                </div>
                <span className="ps-med-form" title={m.generic}>
                  {m.form} <Info size={13} />
                </span>
                {scoreEdit?.id === m.id ? (
                  <span className="ps-score-edit">
                    <input
                      autoFocus
                      type="number"
                      value={scoreEdit.value}
                      onChange={(e) => setScoreEdit({ id: m.id, value: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && saveScore()}
                      onBlur={saveScore}
                    />
                  </span>
                ) : (
                  <button className="ps-score" onClick={() => setScoreEdit({ id: m.id, value: m.score || 0 })}>
                    Score: {m.score || 0} <Pencil size={13} />
                  </button>
                )}
                <button className="ps-edit" onClick={() => setEditing({ ...m })}>Edit <Pencil size={14} /></button>
                <button
                  className={`ps-hide ${m.hidden ? 'on' : ''}`}
                  onClick={() => patch(m.id, { hidden: !m.hidden })}
                >
                  <X size={15} /> {m.hidden ? 'Show' : 'Hide'}
                </button>
              </div>

              {open && (
                <div className="ps-med-body">
                  <div className="ps-sugg-title">User Suggestion</div>
                  {/* The medicine's own default dosage always shows as the first
                      suggestion; stored presets follow. */}
                  {!(m.presets || []).some((p) => p.id === m.defaultPresetId) && (
                    <PresetRow
                      p={{ id: '__self', dose: m.dose, timing: m.timing, duration: m.duration }}
                      isDefault
                      onRemoveDefault={() => {}}
                      onDelete={() => toast.info('The default dosage cannot be deleted — make another preset default first.')}
                    />
                  )}
                  {(m.presets || []).map((p) => (
                    <PresetRow
                      key={p.id}
                      p={p}
                      isDefault={p.id === m.defaultPresetId}
                      onMakeDefault={() => makeDefault(m, p)}
                      onRemoveDefault={() => patch(m.id, { defaultPresetId: null })}
                      onDelete={() =>
                        patch(m.id, {
                          presets: (m.presets || []).filter((x) => x.id !== p.id),
                          defaultPresetId: m.defaultPresetId === p.id ? null : m.defaultPresetId,
                        })
                      }
                    />
                  ))}

                  {presetDraft?.medId === m.id ? (
                    <div className="ps-preset-new">
                      <select value={presetDraft.dose} onChange={(e) => setPresetDraft((d) => ({ ...d, dose: e.target.value }))}>
                        {DOSES.map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <select value={presetDraft.duration} onChange={(e) => setPresetDraft((d) => ({ ...d, duration: e.target.value }))}>
                        {DURATIONS.map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <select value={presetDraft.timing} onChange={(e) => setPresetDraft((d) => ({ ...d, timing: e.target.value }))}>
                        {timingOptions.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <button className="ps-add-line" onClick={addPreset}>Add</button>
                      <button className="ps-cancel" onClick={() => setPresetDraft(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className="ps-addpreset"
                      onClick={() => setPresetDraft({ medId: m.id, dose: '১+০+১', timing: timingOptions[0] || 'খাবার পরে', duration: 'চলবে' })}
                    >
                      <Plus size={15} /> Add New Preset
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <LoadMore page={page} setPage={setPage} total={filtered.length} />
      {editing && <MedicineModal med={editing} onSave={saveMed} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Phrase master (generic sections, followup, custom sections)        */
/* ------------------------------------------------------------------ */

function PhrasesPanel({ sec }) {
  const { master, setMaster } = usePad()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null) // {id, text, score}
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [noteFor, setNoteFor] = useState(null) // item id receiving a new note
  const [noteText, setNoteText] = useState('')

  const items = master[sec.key] || []

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? items.filter((i) => i.text.toLowerCase().includes(s)) : items
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [q, items])

  const shown = filtered.slice(0, page * PAGE)

  const patch = (id, p) =>
    setMaster((m) => ({ ...m, [sec.key]: (m[sec.key] || []).map((i) => (i.id === id ? { ...i, ...p } : i)) }))

  const saveEdit = () => {
    if (!editing) return
    if (!String(editing.text).trim()) return toast.warning('The text cannot be empty.')
    patch(editing.id, { text: editing.text.trim(), score: Number(editing.score) || 0 })
    setEditing(null)
  }

  const addNew = () => {
    const text = newText.trim()
    if (!text) return
    setMaster((m) => ({ ...m, [sec.key]: [{ id: padId('i'), text, subs: [], score: 0 }, ...(m[sec.key] || [])] }))
    setNewText('')
    setAdding(false)
    toast.success('Added.')
  }

  const addNote = (item) => {
    const t = noteText.trim()
    if (!t) return
    patch(item.id, { subs: [...(item.subs || []), t] })
    setNoteText('')
    setNoteFor(null)
  }

  return (
    <>
      <PanelHead
        title={sec.label}
        shown={shown.length}
        total={filtered.length}
        action={
          <button className="ps-create" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} className="ps-create-ico" /> Add
          </button>
        }
      />
      <SearchBar q={q} setQ={(v) => { setQ(v); setPage(1) }} />

      {adding && (
        <div className="ps-addrow">
          <input
            autoFocus
            value={newText}
            placeholder={`New ${secName(sec.label)} entry…`}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNew()}
          />
          <button className="ps-add-line" onClick={addNew}>Add</button>
        </div>
      )}

      <div className="ps-list">
        {shown.length === 0 && <p className="ps-empty">No entries{q ? ' match this search' : ' yet'}.</p>}
        {shown.map((item) => {
          const open = openId === item.id
          return (
            <div key={item.id} className={`ps-phrase ${item.hidden ? 'off' : ''}`}>
              <div className="ps-row">
                <button className="ps-chevron" onClick={() => setOpenId(open ? null : item.id)}>
                  {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>
                <div className="ps-row-main">
                  {editing?.id === item.id ? (
                    <div className="ps-editrow">
                      <textarea
                        autoFocus
                        rows={2}
                        value={editing.text}
                        onChange={(e) => setEditing((ed) => ({ ...ed, text: e.target.value }))}
                      />
                      <label>
                        Score
                        <input
                          type="number"
                          value={editing.score}
                          onChange={(e) => setEditing((ed) => ({ ...ed, score: e.target.value }))}
                        />
                      </label>
                      <button className="ps-add-line" onClick={saveEdit}>Save</button>
                      <button className="ps-cancel" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="ps-row-title">{item.text}</div>
                      <div className="ps-row-score">Score: {item.score || 0}</div>
                    </>
                  )}
                </div>
                <div className="ps-row-acts">
                  <button className="ps-edit" onClick={() => setEditing({ id: item.id, text: item.text, score: item.score || 0 })}>
                    Edit <Pencil size={14} />
                  </button>
                  <button
                    className={`ps-hide ${item.hidden ? 'on' : ''}`}
                    onClick={() => patch(item.id, { hidden: !item.hidden })}
                  >
                    <X size={15} /> {item.hidden ? 'Show' : 'Hide'}
                  </button>
                </div>
              </div>

              {open && (
                <div className="ps-phrase-body">
                  <div className="ps-sugg-title">Suggestion</div>
                  {(item.subs || []).length === 0 && <div className="ps-nosugg">No Suggestion</div>}
                  {(item.subs || []).map((s, i) => (
                    <div key={i} className="ps-sugg-row">
                      <span>{s}</span>
                      <button
                        className="ps-del small"
                        title="Remove note"
                        onClick={() => patch(item.id, { subs: (item.subs || []).filter((_, j) => j !== i) })}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {noteFor === item.id ? (
                    <div className="ps-addrow tight">
                      <input
                        autoFocus
                        value={noteText}
                        placeholder="Note…"
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addNote(item)}
                      />
                      <button className="ps-add-line" onClick={() => addNote(item)}>Add</button>
                      <button className="ps-cancel" onClick={() => setNoteFor(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="ps-addpreset" onClick={() => { setNoteFor(item.id); setNoteText('') }}>
                      <Plus size={15} /> Add Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <LoadMore page={page} setPage={setPage} total={filtered.length} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Medicine Remarks (the scored timing/instruction phrases)           */
/* ------------------------------------------------------------------ */

function RemarksPanel() {
  const { remarks, setRemarks } = usePad()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? remarks.filter((r) => r.text.toLowerCase().includes(s)) : remarks
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [q, remarks])

  const shown = filtered.slice(0, page * PAGE)

  const patch = (id, p) => setRemarks((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const saveEdit = () => {
    if (!editing) return
    if (!String(editing.text).trim()) return toast.warning('The remark cannot be empty.')
    patch(editing.id, { text: editing.text.trim(), score: Number(editing.score) || 0 })
    setEditing(null)
  }

  const addNew = () => {
    const text = newText.trim()
    if (!text) return
    setRemarks((rs) => [{ id: padId('r'), text, score: 0 }, ...rs])
    setNewText('')
    setAdding(false)
    toast.success('Remark added.')
  }

  return (
    <>
      <PanelHead
        title="Medicine Remark"
        shown={shown.length}
        total={filtered.length}
        action={
          <button className="ps-create" onClick={() => setAdding((a) => !a)}>
            <Plus size={16} className="ps-create-ico" /> Add
          </button>
        }
      />
      <SearchBar q={q} setQ={(v) => { setQ(v); setPage(1) }} />

      {adding && (
        <div className="ps-addrow">
          <input
            autoFocus
            value={newText}
            placeholder="New remark…"
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNew()}
          />
          <button className="ps-add-line" onClick={addNew}>Add</button>
        </div>
      )}

      <div className="ps-list">
        {shown.map((r) => (
          <div key={r.id} className={`ps-row ${r.hidden ? 'off' : ''}`}>
            <div className="ps-row-main">
              {editing?.id === r.id ? (
                <div className="ps-editrow">
                  <textarea
                    autoFocus
                    rows={1}
                    value={editing.text}
                    onChange={(e) => setEditing((ed) => ({ ...ed, text: e.target.value }))}
                  />
                  <label>
                    Score
                    <input
                      type="number"
                      value={editing.score}
                      onChange={(e) => setEditing((ed) => ({ ...ed, score: e.target.value }))}
                    />
                  </label>
                  <button className="ps-add-line" onClick={saveEdit}>Save</button>
                  <button className="ps-cancel" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="ps-row-title">{r.text}</div>
                  <div className="ps-row-score">Score: {r.score || 0}</div>
                </>
              )}
            </div>
            <div className="ps-row-acts">
              <button className="ps-edit" onClick={() => setEditing({ id: r.id, text: r.text, score: r.score || 0 })}>
                Edit <Pencil size={14} />
              </button>
              <button className={`ps-hide ${r.hidden ? 'on' : ''}`} onClick={() => patch(r.id, { hidden: !r.hidden })}>
                <X size={15} /> {r.hidden ? 'Show' : 'Hide'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <LoadMore page={page} setPage={setPage} total={filtered.length} />
    </>
  )
}

/* ------------------------------------------------------------------ */

function PresetWorkbench() {
  const { sections } = usePad()
  const [active, setActive] = useState('__templates')

  /* Sidebar order mirrors the reference: templates first, then every pad
     section, with Medicine Remarks slotted right after Rx. */
  const entries = useMemo(() => {
    const out = [{ key: '__templates', label: 'Prescription Template' }]
    for (const s of sections) {
      out.push({ key: s.key, label: s.label })
      if (s.key === 'rx') out.push({ key: '__remarks', label: 'Medicine Remarks' })
    }
    return out
  }, [sections])

  const activeSec = sections.find((s) => s.key === active)

  return (
    <div className="rxpad preset-page">
      <header className="ps-topbar noprint">
        <Link to="/doctor/pad" className="ps-tab">Settings</Link>
        <span className="ps-tab on">Preset Data settings</span>
      </header>

      <div className="ps-body">
        <nav className="ps-side">
          {entries.map((e) => (
            <button
              key={e.key}
              className={`ps-side-item ${active === e.key ? 'on' : ''}`}
              onClick={() => setActive(e.key)}
            >
              {e.label}
            </button>
          ))}
        </nav>

        <main className="ps-main">
          {active === '__templates' ? (
            <TemplatesPanel />
          ) : active === '__remarks' ? (
            <RemarksPanel />
          ) : active === 'rx' ? (
            <MedicinesPanel />
          ) : activeSec ? (
            <PhrasesPanel sec={activeSec} key={activeSec.key} />
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default function PresetSettings() {
  return (
    <PadProvider>
      <PresetWorkbench />
    </PadProvider>
  )
}
