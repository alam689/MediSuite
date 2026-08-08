import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, CalendarDays } from 'lucide-react'
import { usePad } from './PadContext.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { DOSES, DURATIONS, medPrefix, padId, toBn } from './padData.js'

/* Floating picker panel, positioned near the "+" that opened it and clamped
   to the viewport. Click outside closes. */
function usePanelPos(x, y, w = 640, h = 430) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    left: Math.max(8, Math.min(x, vw - w - 16)),
    top: Math.max(8, Math.min(y, vh - h - 16)),
    width: Math.min(w, vw - 24),
  }
}

function Panel({ x, y, w, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const key = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  const pos = usePanelPos(x, y, w)
  return (
    <div className="picker" style={pos} ref={ref}>
      {children}
    </div>
  )
}

/* A chip with an optional chevron dropdown (variants / delete). */
function Chip({ label, menu, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  return (
    <div className="chip-wrap" ref={ref}>
      <button className="chip" onClick={onPick}>
        <span className="chip-label">{label}</span>
        {menu && (
          <span
            className="chip-caret"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          >
            <ChevronDown size={14} />
          </span>
        )}
      </button>
      {open && menu && <div className="chip-menu">{menu(() => setOpen(false))}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Generic section picker: search/add, item chips + variants, groups. */
/* ------------------------------------------------------------------ */
function GenericPicker({ sec }) {
  const toast = useToast()
  const { master, setMaster, groups, setGroups, rx, addItem, removeItem, patchItem } = usePad()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('items')
  const [groupName, setGroupName] = useState('')

  const items = master[sec.key] || []
  const secGroups = groups[sec.key] || []
  const selected = rx.items[sec.key] || []

  /* Hidden items stay in the master (the settings page can unhide them) but
     never appear here; the rest rank by usage score, most-used first. */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const visible = items.filter((i) => !i.hidden)
    const list = s ? visible.filter((i) => i.text.toLowerCase().includes(s)) : visible
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [q, items])

  /* Every pick counts toward the item's score — that is what keeps the
     frequently used phrases at the top of the list. */
  const bump = (item) =>
    setMaster((m) => ({
      ...m,
      [sec.key]: (m[sec.key] || []).map((i) => (i.id === item.id ? { ...i, score: (i.score || 0) + 1 } : i)),
    }))

  const addMaster = () => {
    const text = q.trim()
    if (!text) return
    const item = { id: padId('i'), text, subs: [], score: 1 }
    setMaster((m) => ({ ...m, [sec.key]: [...(m[sec.key] || []), item] }))
    addItem(sec.key, { text })
    setQ('')
  }

  const deleteMaster = (item) => {
    setMaster((m) => ({ ...m, [sec.key]: (m[sec.key] || []).filter((i) => i.id !== item.id) }))
    toast.info(`“${item.text}” deleted from ${sec.label} list.`)
  }

  const saveGroup = () => {
    const name = groupName.trim()
    if (!name) return
    if (!selected.length) return toast.warning('Select some items first, then save them as a group.')
    const itemIds = selected
      .map((s) => items.find((i) => i.text === s.text)?.id)
      .filter(Boolean)
    setGroups((g) => ({ ...g, [sec.key]: [...(g[sec.key] || []), { id: padId('g'), name, itemIds }] }))
    setGroupName('')
    toast.success(`Group “${name}” saved.`)
  }

  const applyGroup = (grp) => {
    const members = items.filter((i) => grp.itemIds.includes(i.id))
    members.forEach((m) => addItem(sec.key, { text: m.text }))
    if (!members.length) toast.warning('This group has no items.')
  }

  return (
    <>
      <div className="picker-head">
        <span className="picker-title">{sec.label}</span>
        <div className="picker-search">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            placeholder={`Search/Add ${sec.label.replace(/[:,]$/, '')}...`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMaster()}
          />
        </div>
      </div>

      <div className="picker-tabs">
        <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>{sec.label.replace(/[:,]$/, '')}</button>
        <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>{sec.label.replace(/[:,]$/, '')} Group</button>
      </div>

      {tab === 'items' ? (
        <div className="picker-list">
          {filtered.map((item) => (
            <Chip
              key={item.id}
              label={item.text}
              onPick={() => { addItem(sec.key, { text: item.text }); bump(item) }}
              menu={(close) => (
                <>
                  {item.subs?.map((s) => (
                    <button
                      key={s}
                      className="cm-item"
                      onClick={() => { addItem(sec.key, { text: item.text, note: s }); bump(item); close() }}
                    >
                      {item.text} — {s}
                    </button>
                  ))}
                  <button className="cm-item danger" onClick={() => { deleteMaster(item); close() }}>
                    ✕ Delete from list
                  </button>
                </>
              )}
            />
          ))}
          {q.trim() && !filtered.some((i) => i.text.toLowerCase() === q.trim().toLowerCase()) && (
            <button className="chip add-chip" onClick={addMaster}>＋ Add “{q.trim()}”</button>
          )}
          {!filtered.length && !q.trim() && <p className="picker-none">No items yet — type above and press Enter to add.</p>}
        </div>
      ) : (
        <div className="picker-list">
          {secGroups.map((g) => (
            <Chip
              key={g.id}
              label={`${g.name} (${g.itemIds.length})`}
              onPick={() => applyGroup(g)}
              menu={(close) => (
                <button
                  className="cm-item danger"
                  onClick={() => {
                    setGroups((gs) => ({ ...gs, [sec.key]: (gs[sec.key] || []).filter((x) => x.id !== g.id) }))
                    close()
                  }}
                >
                  ✕ Delete group
                </button>
              )}
            />
          ))}
          <div className="group-save">
            <input
              value={groupName}
              placeholder="Group name…"
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGroup()}
            />
            <button onClick={saveGroup}>Save selected as group</button>
          </div>
        </div>
      )}

      <div className="picker-selected">
        {selected.length === 0 ? (
          <div className="sel-empty">No {sec.label.replace(/[:,]$/, '')} Selected</div>
        ) : (
          selected.map((s) => (
            <div key={s.uid} className="sel-row">
              <span>{s.text}</span>
              <input
                className="sel-note"
                value={s.note || ''}
                placeholder="note…"
                onChange={(e) => patchItem(sec.key, s.uid, { note: e.target.value })}
              />
              <button className="item-x" onClick={() => removeItem(sec.key, s.uid)}>⊗</button>
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Medicine picker: brand/generic sort, dose presets, dosage editing. */
/* ------------------------------------------------------------------ */
function MedicinePicker({ sec }) {
  const toast = useToast()
  const { medicines, setMedicines, medGroups, setMedGroups, remarks, rx, addItem, removeItem, patchItem } = usePad()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('meds')
  const [sort, setSort] = useState('brand')
  const [groupName, setGroupName] = useState('')

  const selected = rx.items[sec.key] || []

  /* Usage score ranks first (the working formulary floats to the top); the
     brand/generic select only breaks ties. Hidden medicines never appear. */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = medicines.filter((m) => !m.hidden)
    if (s) list = list.filter((m) => `${m.brand} ${m.generic} ${m.strength}`.toLowerCase().includes(s))
    return [...list].sort((a, b) =>
      (b.score || 0) - (a.score || 0) ||
      (sort === 'brand' ? a.brand.localeCompare(b.brand) : (a.generic || '').localeCompare(b.generic || ''))
    )
  }, [q, medicines, sort])

  /* Timing options come from the scored Medicine Remarks master. */
  const timingOptions = useMemo(
    () => remarks.filter((r) => !r.hidden).sort((a, b) => (b.score || 0) - (a.score || 0)).map((r) => r.text),
    [remarks]
  )

  const bump = (m) =>
    setMedicines((ms) => ms.map((x) => (x.id === m.id ? { ...x, score: (x.score || 0) + 1 } : x)))

  /* `generic` rides along on the pad item: the safety check matches on
     generic names (aspirin, warfarin…), and brand names alone would sail
     straight past it. A preset overrides the medicine's default dosage. */
  const pick = (m, preset) => {
    addItem(sec.key, {
      medId: m.id,
      name: `${m.brand} ${m.strength}`.trim(),
      generic: m.generic || '',
      form: m.form,
      dose: preset?.dose || m.dose || '১+০+১',
      timing: preset?.timing || m.timing || 'খাবার পরে',
      duration: preset?.duration || m.duration || 'চলবে',
    })
    bump(m)
  }

  const addNewMedicine = () => {
    const name = q.trim()
    if (!name) return
    const m = { id: padId('m'), brand: name, strength: '', form: 'Tablet', generic: '', company: '', score: 1, hidden: false, presets: [], dose: '১+০+১', timing: 'খাবার পরে', duration: 'চলবে' }
    setMedicines((ms) => [...ms, m])
    pick(m)
    setQ('')
  }

  const saveGroup = () => {
    const name = groupName.trim()
    if (!name) return
    if (!selected.length) return toast.warning('Select medicines first, then save them as a group.')
    const medIds = selected.map((s) => s.medId).filter(Boolean)
    setMedGroups((g) => [...g, { id: padId('mg'), name, medIds }])
    setGroupName('')
    toast.success(`Medicine group “${name}” saved.`)
  }

  return (
    <>
      <div className="picker-head">
        <span className="picker-title rx-title">Rx,</span>
        <div className="picker-search">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            placeholder="Search/Add Medicine..."
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNewMedicine()}
          />
        </div>
        <select className="sort-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="brand">Brand Name</option>
          <option value="generic">Generic Name</option>
        </select>
      </div>

      <div className="picker-tabs">
        <button className={tab === 'meds' ? 'on' : ''} onClick={() => setTab('meds')}>Medicines</button>
        <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>Medicine Groups</button>
      </div>

      {tab === 'meds' ? (
        <div className="picker-list">
          {filtered.map((m) => (
            <Chip
              key={m.id}
              label={
                <>
                  <b>{m.brand} {m.strength}</b> <small>({m.form})</small>
                </>
              }
              onPick={() => pick(m)}
              menu={(close) => (
                <>
                  {m.generic && <div className="cm-note">{m.generic}</div>}
                  {(m.presets || []).map((p) => (
                    <button key={p.id} className="cm-item" onClick={() => { pick(m, p); close() }}>
                      {p.dose} ({p.duration}) — {p.timing}
                    </button>
                  ))}
                  {DOSES.map((d) => (
                    <button key={d} className="cm-item" onClick={() => { pick(m, { dose: d }); close() }}>
                      {d}
                    </button>
                  ))}
                  <button
                    className="cm-item danger"
                    onClick={() => { setMedicines((ms) => ms.filter((x) => x.id !== m.id)); close() }}
                  >
                    ✕ Delete medicine
                  </button>
                </>
              )}
            />
          ))}
          {q.trim() && !filtered.length && (
            <button className="chip add-chip" onClick={addNewMedicine}>＋ Add medicine “{q.trim()}”</button>
          )}
        </div>
      ) : (
        <div className="picker-list">
          {medGroups.map((g) => (
            <Chip
              key={g.id}
              label={`${g.name} (${g.medIds.length})`}
              onPick={() => {
                const members = medicines.filter((m) => g.medIds.includes(m.id))
                members.forEach((m) => pick(m))
                if (!members.length) toast.warning('This group has no medicines.')
              }}
              menu={(close) => (
                <button className="cm-item danger" onClick={() => { setMedGroups((gs) => gs.filter((x) => x.id !== g.id)); close() }}>
                  ✕ Delete group
                </button>
              )}
            />
          ))}
          <div className="group-save">
            <input
              value={groupName}
              placeholder="Group name…"
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGroup()}
            />
            <button onClick={saveGroup}>Save selected as group</button>
          </div>
        </div>
      )}

      <div className="picker-selected">
        {selected.length === 0 ? (
          <div className="sel-empty">No Rx, Selected</div>
        ) : (
          selected.map((s) => (
            <div key={s.uid} className="sel-row med">
              <span className="sel-med-name">{medPrefix(s.form)} {s.name}</span>
              <select value={s.dose} onChange={(e) => patchItem(sec.key, s.uid, { dose: e.target.value })}>
                {DOSES.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select value={s.timing} onChange={(e) => patchItem(sec.key, s.uid, { timing: e.target.value })}>
                {(timingOptions.includes(s.timing) ? timingOptions : [s.timing, ...timingOptions]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select value={s.duration} onChange={(e) => patchItem(sec.key, s.uid, { duration: e.target.value })}>
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <button className="item-x" onClick={() => removeItem(sec.key, s.uid)}>⊗</button>
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Follow-up picker: N + unit + পর, Add Date, preset chips.           */
/* ------------------------------------------------------------------ */
function FollowupPicker({ sec }) {
  const toast = useToast()
  const { master, setMaster, rx, addItem, removeItem } = usePad()
  const [q, setQ] = useState('')
  const [n, setN] = useState('')
  const [unit, setUnit] = useState('দিন')
  const [showDate, setShowDate] = useState(false)
  const [date, setDate] = useState('')

  const items = master[sec.key] || []
  const selected = rx.items[sec.key] || []
  const visible = items.filter((i) => !i.hidden).sort((a, b) => (b.score || 0) - (a.score || 0))
  const filtered = q.trim() ? visible.filter((i) => i.text.toLowerCase().includes(q.trim().toLowerCase())) : visible

  const bump = (item) =>
    setMaster((ms) => ({
      ...ms,
      [sec.key]: (ms[sec.key] || []).map((i) => (i.id === item.id ? { ...i, score: (i.score || 0) + 1 } : i)),
    }))

  const addInterval = () => {
    const num = parseInt(n, 10)
    if (!num) return toast.warning('Enter a number first.')
    addItem(sec.key, { text: `${toBn(num)} ${unit} পর দেখা করবেন।` })
    setN('')
  }

  const addDate = () => {
    if (!date) return
    const [y, m, d] = date.split('-')
    addItem(sec.key, { text: `${toBn(d)}/${toBn(m)}/${toBn(y)} তারিখে দেখা করবেন।` })
    setShowDate(false)
    setDate('')
  }

  const addMaster = () => {
    const text = q.trim()
    if (!text) return
    setMaster((ms) => ({ ...ms, [sec.key]: [...(ms[sec.key] || []), { id: padId('i'), text, subs: [], score: 1 }] }))
    addItem(sec.key, { text })
    setQ('')
  }

  return (
    <>
      <div className="picker-head">
        <span className="picker-title">{sec.label}</span>
        <div className="picker-search">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            placeholder="Search/Add Followup..."
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMaster()}
          />
        </div>
      </div>

      <div className="fu-row">
        <input
          className="fu-num"
          type="number"
          min="1"
          value={n}
          onChange={(e) => setN(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addInterval()}
        />
        <select className="fu-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option>দিন</option>
          <option>সপ্তাহ</option>
          <option>মাস</option>
          <option>বছর</option>
        </select>
        <span className="fu-por">পর</span>
        <button className="fu-add" onClick={addInterval}>Add</button>
        <span className="fu-spacer" />
        {showDate ? (
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="fu-add" onClick={addDate}>OK</button>
          </>
        ) : (
          <button className="fu-date" onClick={() => setShowDate(true)}>
            <CalendarDays size={15} /> Add Date
          </button>
        )}
      </div>

      <div className="picker-tabs">
        <button className="on">Follow-up</button>
        <button disabled>Follow-up Groups</button>
      </div>

      <div className="picker-list">
        {filtered.map((item) => (
          <Chip
            key={item.id}
            label={item.text}
            onPick={() => { addItem(sec.key, { text: item.text }); bump(item) }}
            menu={(close) => (
              <button
                className="cm-item danger"
                onClick={() => {
                  setMaster((ms) => ({ ...ms, [sec.key]: (ms[sec.key] || []).filter((i) => i.id !== item.id) }))
                  close()
                }}
              >
                ✕ Delete from list
              </button>
            )}
          />
        ))}
        {q.trim() && !filtered.some((i) => i.text === q.trim()) && (
          <button className="chip add-chip" onClick={addMaster}>＋ Add “{q.trim()}”</button>
        )}
      </div>

      <div className="picker-selected">
        {selected.length === 0 ? (
          <div className="sel-empty">No পরবর্তী সাক্ষাতঃ Selected</div>
        ) : (
          selected.map((s) => (
            <div key={s.uid} className="sel-row">
              <span>{s.text}</span>
              <button className="item-x" onClick={() => removeItem(sec.key, s.uid)}>⊗</button>
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default function Picker({ sec, x, y, onClose }) {
  const w = sec.type === 'medicine' ? 760 : 640
  return (
    <Panel x={x} y={y} w={w} onClose={onClose}>
      {sec.type === 'medicine' ? (
        <MedicinePicker sec={sec} />
      ) : sec.type === 'followup' ? (
        <FollowupPicker sec={sec} />
      ) : (
        <GenericPicker sec={sec} />
      )}
    </Panel>
  )
}
