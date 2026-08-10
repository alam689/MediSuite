import { useMemo, useState } from 'react'
import { Syringe, ServerOff, FileText, Upload } from 'lucide-react'
import { useToast } from '../components/ui/Toast.jsx'
import { useDocuments, uploadDocument, docUrl, fmtSize, takenDate } from './useDocuments.js'
import DocumentViewer from './DocumentViewer.jsx'

/* =====================================================================
   Vaccine history, structured the way a patient reads it: which vaccine,
   when it was given, and the card itself behind "View card".

   The card stays the source of truth. Name and holder are parsed from
   the file name; the given-date is only shown when the file name or the
   metadata sidecar carries one — otherwise the row says "date on card"
   instead of promoting a file-copy date to a vaccination date.
   ===================================================================== */

const VACCINE_INFO = [
  { test: /covid/i, name: 'COVID-19 vaccine', desc: 'Coronavirus vaccination card' },
  { test: /typhoid|tcv/i, name: 'Typhoid vaccine (TCV)', desc: 'Typhoid conjugate vaccine card' },
  { test: /vaxepi/i, name: 'Vaxepi registration', desc: 'EPI vaccination registration card' },
]

/* "Deenha - Covid 19 Vaccine Card" → the family member the card belongs to. */
const holderOf = (title) => {
  const m = title.match(/\b(deenha|khorshed|fatihaa?|anika)\b/i)
  if (!m) return null
  const n = m[1].toLowerCase()
  return n[0].toUpperCase() + n.slice(1).replace(/aa$/, 'a')
}

/* A card ID like BDTCV012070426929409 or the Vaxepi serial. */
const cardId = (title) => title.match(/\b([A-Z]{2,}\d{6,}|\d{10,})\b/)?.[1] || null

export default function MyVaccines() {
  const { status, docs, reload } = useDocuments('vaccines')
  const toast = useToast()
  const [viewing, setViewing] = useState(null)

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const saved = await uploadDocument('vaccines', file)
      toast.success('Vaccine card uploaded', { title: saved.file })
      reload()
    } catch (err) {
      toast.warning(String(err.message || err), { title: 'Upload failed' })
    }
  }

  const rows = useMemo(
    () =>
      docs.map((d) => ({
        ...d,
        info: VACCINE_INFO.find((v) => v.test.test(d.title)) || null,
        holder: holderOf(d.title),
        taken: d.takenDate ? takenDate(d.takenDate) || { label: d.takenDate } : takenDate(d.title),
        id: cardId(d.title),
      })),
    [docs]
  )

  return (
    <>
      {status === 'offline' && (
        <div className="pt-callout">
          <span className="pt-callout-icon">
            <ServerOff size={18} />
          </span>
          <div>
            <div className="pt-callout-title">The document server is not running</div>
            <div className="pt-callout-sub">
              Vaccine cards are served by the backend. Start it with <code>cd server</code> then{' '}
              <code>npm run dev</code>, and reload this page.
            </div>
          </div>
        </div>
      )}

      {status !== 'offline' && (
        <>
          <section className="pt-panel">
            <div className="pt-panel-head">
              <Syringe size={16} /> Vaccine list
              <label
                className="btn btn-ghost"
                style={{ cursor: 'pointer', height: 30, marginLeft: 'auto', fontSize: 13 }}
              >
                <Upload size={14} /> Upload card
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: 'none' }}
                  onChange={onUpload}
                />
              </label>
              <span className="count">{rows.length}</span>
            </div>
            <div className="pt-panel-body">
              {status === 'loading' && <p className="pt-empty">Loading your vaccine cards…</p>}
              {status === 'ready' && rows.length === 0 && (
                <p className="pt-empty">No vaccine cards on file yet.</p>
              )}
              {rows.map((d) => (
                <div className="pt-row" key={d.file}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <FileText size={18} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="pt-row-title" title={d.title}>
                        {d.info?.name || d.title}
                      </div>
                      {d.info?.desc && <div className="pt-row-sub">{d.info.desc}</div>}
                      <div className="pt-row-sub">
                        {d.holder && `For ${d.holder} · `}
                        Vaccination date: {d.taken ? d.taken.label : 'see card'}
                        {d.id && ` · Card no. ${d.id}`} · PDF · {fmtSize(d.size)}
                      </div>
                    </div>
                  </div>
                  <div className="pt-row-right">
                    <button className="btn btn-ghost" style={{ height: 34 }} onClick={() => setViewing(d)}>
                      View card
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="pt-privacy" style={{ marginTop: 14 }}>
            Keep the original paper cards safe — these copies are for convenience and travel, and
            some authorities still ask for the original.
          </p>
        </>
      )}

      <DocumentViewer
        doc={viewing ? { ...viewing, title: viewing.info?.name || viewing.title } : null}
        url={viewing ? docUrl('vaccines', viewing.file) : ''}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
