import { useEffect, useState } from 'react'

/* =====================================================================
   Patient documents from the backend API (server/ — NestJS).

   The Vite dev server proxies /api to http://localhost:4000, where the
   backend lists and streams the PDFs sitting in the repo's "Reports/" and
   "Vaccine Card/" folders (interim stand-in for MinIO). The hook reports
   `offline` when the API isn't running so the pages can say exactly how to
   start it instead of showing a broken empty list.
   ===================================================================== */

export function useDocuments(category) {
  const [state, setState] = useState({ status: 'loading', docs: [] })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', docs: [] })
    fetch(`/api/documents/${category}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((docs) => alive && setState({ status: 'ready', docs }))
      .catch(() => alive && setState({ status: 'offline', docs: [] }))
    return () => {
      alive = false
    }
  }, [category, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}

/* Upload one PDF into a category folder; resolves to { ok, file } with the
   name the server actually stored (it de-duplicates rather than overwrite). */
export async function uploadDocument(category, file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`/api/documents/${category}`, { method: 'POST', body: fd })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.message || `Upload failed (HTTP ${r.status})`)
  }
  return r.json()
}

export const docUrl = (category, file) => `/api/documents/${category}/${encodeURIComponent(file)}`

export function fmtSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function fmtAdded(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ---- When was the test actually taken? ---------------------------------
   The scanned files carry their date in the name in several shapes
   ("CBC 2023-04-07", "Fatihaa CVC 20240818", "Lipid Profile of Khorshed
   09 May 2026", "CBC of Khorshed May 2026"). Parse what is there; return
   null rather than guessing so the caller can fall back to "added" —
   a file-copy date must never masquerade as a clinical date. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function takenDate(title) {
  const t = String(title)

  let m = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (m) {
    const [, y, mo, d] = m
    return { iso: `${y}-${mo}-${d}`, label: `${Number(d)} ${MONTH_LABELS[Number(mo) - 1]} ${y}` }
  }

  m = t.match(/\b(20\d{2})(\d{2})(\d{2})\b/) // 20240818, 20260709
  if (m) {
    const mo = Number(m[2])
    const d = Number(m[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return { iso: `${m[1]}-${m[2]}-${m[3]}`, label: `${d} ${MONTH_LABELS[mo - 1]} ${m[1]}` }
    }
  }

  m = t.match(/\b(\d{1,2})\s+([a-z]{3,9})\s+(20\d{2})\b/i) // 09 May 2026
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    if (mo >= 0) {
      const d = Number(m[1])
      return {
        iso: `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        label: `${d} ${MONTH_LABELS[mo]} ${m[3]}`,
      }
    }
  }

  m = t.match(/\b([a-z]{3,9})\s+(20\d{2})\b/i) // May 2026 (day unknown)
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
    if (mo >= 0) {
      return { iso: `${m[2]}-${String(mo + 1).padStart(2, '0')}-00`, label: `${MONTH_LABELS[mo]} ${m[2]}` }
    }
  }

  return null
}
