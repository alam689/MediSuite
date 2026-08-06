import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, ArrowRight } from 'lucide-react'
/* The patient and hospital shells predate the shared frame and keep their
   own stylesheets, so the bell brings its own styles with it. */
import './portal.css'

/* =====================================================================
   The bell.

   Each portal's home page says what needs you; this says it on every other
   page. Both read the same builder (portal/notifications.js) so the count
   and the list can never disagree.

   "Unread" is tracked by item id rather than by a last-seen timestamp.
   Timestamps are wrong here: most of these items are derived from record
   *state*, not events, so they have no moment of creation. A prescription
   that has been on hold for a week is not new, and would light up the bell
   every session under a timestamp scheme. Storing seen ids means an item
   goes quiet once looked at and stays quiet until it changes.
   ===================================================================== */

const KEY = (role) => `medisuite-seen-${role}`

function loadSeen(role) {
  try {
    const raw = localStorage.getItem(KEY(role))
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export default function NotificationBell({ role, items = [] }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => loadSeen(role))
  const wrap = useRef(null)

  /* A different role signed in — start from that role's own seen list. */
  useEffect(() => {
    setSeen(loadSeen(role))
    setOpen(false)
  }, [role])

  const unread = useMemo(() => items.filter((i) => !seen.has(i.id)), [items, seen])

  const markSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev)
      for (const i of items) next.add(i.id)
      /* Drop ids that no longer correspond to anything, so the store does
         not grow forever as records come and go. */
      const live = new Set(items.map((i) => i.id))
      const pruned = new Set([...next].filter((id) => live.has(id)))
      try {
        localStorage.setItem(KEY(role), JSON.stringify([...pruned]))
      } catch {
        /* ignore quota errors */
      }
      return pruned
    })
  }, [items, role])

  const toggle = () => {
    setOpen((was) => {
      if (!was) markSeen()
      return !was
    })
  }

  /* Close on an outside click or Escape — a panel that traps you is worse
     than no panel. */
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="pf-bell-wrap" ref={wrap}>
      <button
        className="icon-btn pf-bell"
        onClick={toggle}
        aria-label={
          unread.length
            ? `Notifications — ${unread.length} unread of ${items.length}`
            : `Notifications — ${items.length}`
        }
        aria-expanded={open}
        title="What needs you"
      >
        <Bell size={17} />
        {unread.length > 0 && (
          <span className="pf-bell-dot">{unread.length > 9 ? '9+' : unread.length}</span>
        )}
      </button>

      {open && (
        <div className="pf-bell-panel" role="dialog" aria-label="Notifications">
          <div className="pf-bell-head">
            What needs you
            <span className="count">{items.length}</span>
          </div>
          <div className="pf-bell-body">
            {items.length === 0 && (
              <p className="pf-empty">
                <CheckCircle2 size={22} />
                Nothing is waiting on you.
              </p>
            )}
            {items.map((n) => (
              <Link className="pf-row" key={n.id} to={n.to} onClick={() => setOpen(false)}>
                <span className={`pf-dot tone-${n.tone}`} />
                <div>
                  <div className="pf-row-title">{n.title}</div>
                  <div className="pf-row-sub">{n.sub}</div>
                </div>
                <ArrowRight size={15} className="pf-row-go" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
