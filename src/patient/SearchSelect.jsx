import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

/* =====================================================================
   Searchable dropdown (combobox).

   A native <datalist> isn't good enough: no visible dropdown affordance,
   won't open reliably on click, renders differently in every browser. This
   is the real thing — click to open the full list, type to filter, arrow
   keys and Enter to choose.

   Two modes:
   - free (default): the typed text *is* the value. For filters, where a
     half-typed "metro" should narrow results without picking an option.
   - strict: the value must be one of the options. Typing only searches; the
     input shows the chosen label again when closed. For pickers where an
     unmatched string would be a broken state.

   `options` are strings, or { value, label, hint } when an option needs a
   second line.
   ===================================================================== */

export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  label,
  strict = false,
  emptyText = 'No matches',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const norm = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  )
  const selected = norm.find((o) => o.value === value)

  /* In strict mode the box shows the selection when closed and the search
     text while open; in free mode it always shows the raw value. */
  const text = strict ? (open ? query : selected?.label ?? '') : value || ''
  const q = (strict ? query : value || '').trim().toLowerCase()

  const filtered = useMemo(
    () => norm.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q)),
    [norm, q]
  )

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (opt) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
    setActive(-1)
  }

  const onInput = (v) => {
    if (strict) setQuery(v)
    else onChange(v)
    setOpen(true)
    setActive(-1)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActive((i) => (filtered.length ? Math.min(filtered.length - 1, i + 1) : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && filtered[active]) {
        e.preventDefault()
        choose(filtered[active])
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation() // don't also close a surrounding dialog
      setOpen(false)
      setQuery('')
      setActive(-1)
    }
  }

  const highlight = (s) => {
    if (!q) return s
    const i = s.toLowerCase().indexOf(q)
    if (i < 0) return s
    return (
      <>
        {s.slice(0, i)}
        <mark className="ss-mark">{s.slice(i, i + q.length)}</mark>
        {s.slice(i + q.length)}
      </>
    )
  }

  const showClear = !strict && !!value

  return (
    <span className="ss" ref={rootRef}>
      {Icon && <Icon size={15} className="ss-icon" />}
      <input
        className="ss-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={label}
        placeholder={strict && selected ? selected.label : placeholder}
        value={text}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showClear ? (
        <button
          type="button"
          className="ss-btn"
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
          aria-label="Clear"
        >
          <X size={13} />
        </button>
      ) : (
        <button
          type="button"
          className="ss-btn"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          aria-label="Show options"
        >
          <ChevronDown size={14} className={open ? 'ss-chev open' : 'ss-chev'} />
        </button>
      )}

      {open && (
        <ul className="ss-list" role="listbox" ref={listRef}>
          {filtered.length === 0 && <li className="ss-empty">{emptyText}</li>}
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`ss-opt ${i === active ? 'active' : ''} ${value === opt.value ? 'on' : ''}`}
              onMouseEnter={() => setActive(i)}
              // mousedown, not click: the input's blur would close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                choose(opt)
              }}
            >
              <span className="ss-opt-text">
                {highlight(opt.label)}
                {opt.hint && <span className="ss-opt-hint">{highlight(opt.hint)}</span>}
              </span>
              {value === opt.value && <Check size={13} />}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
