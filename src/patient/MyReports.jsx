import { useMemo, useState } from 'react'
import { ClipboardList, Search, FileText, ServerOff, Paperclip, FlaskConical, Upload } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { usePatient } from './PatientContext.jsx'
import { LAB_STATUS_TEXT } from './helpers.js'
import { useDocuments, uploadDocument, docUrl, fmtSize, fmtAdded, takenDate } from './useDocuments.js'
import DocumentViewer from './DocumentViewer.jsx'

/* =====================================================================
   Tests & reports — the single shelf for everything test-related, after
   merging the old "Test results" tab in here (two tabs both meaning
   "how did my tests go" made patients guess which one to open).

   Each report row shows what a patient asked for: which test, what it
   measures in plain language, when it was taken (parsed from the report's
   own name — never the file-copy date), its status when one is on file,
   and View. In-flight lab work keeps its own panel below: a test being
   processed is a different thing from a report you can read.
   ===================================================================== */

/* What each test measures, in words a patient can use. Matched against the
   file name; anything unmatched simply shows without a description rather
   than with a guessed one. */
const TEST_INFO = [
  { test: /\b(cbc|cvc)\b/i, name: 'Complete Blood Count (CBC)', desc: 'Red cells, white cells, haemoglobin and platelets' },
  { test: /hb\s?a1c/i, name: 'HbA1c', desc: 'Average blood sugar over the last ~3 months' },
  { test: /fasting plasma glucose/i, name: 'Fasting Plasma Glucose', desc: 'Blood sugar after an overnight fast' },
  { test: /glucose 2\s?hrs?\s?abf/i, name: 'Plasma Glucose (2 hrs after breakfast)', desc: 'Blood sugar two hours after eating' },
  { test: /random plasma glucose/i, name: 'Random Plasma Glucose', desc: 'Blood sugar at a random time of day' },
  { test: /lipid profile/i, name: 'Lipid Profile', desc: 'Cholesterol and triglycerides' },
  { test: /creatinine/i, name: 'Serum Creatinine', desc: 'Kidney function' },
  { test: /ferritin/i, name: 'Ferritin', desc: 'Iron stores in the body' },
  { test: /t\.?\s?i\.?\s?b\.?\s?c/i, name: 'TIBC', desc: 'Iron-binding capacity of the blood' },
  { test: /\biron\b/i, name: 'Serum Iron', desc: 'Iron level in the blood' },
  { test: /free t3/i, name: 'Free T3', desc: 'Thyroid hormone level' },
  { test: /free t4/i, name: 'Free T4', desc: 'Thyroid hormone level' },
  { test: /h?tsh/i, name: 'TSH', desc: 'Thyroid-stimulating hormone' },
  { test: /ige/i, name: 'Serum IgE', desc: 'Allergy-related antibody level' },
  { test: /uric acid/i, name: 'Serum Uric Acid', desc: 'Uric acid — high levels relate to gout' },
  { test: /vitamin b-?12/i, name: 'Vitamin B-12', desc: 'B-12 level — nerves and blood formation' },
  { test: /vitamin d/i, name: 'Vitamin D (25-OH)', desc: 'Vitamin D level — bones and immunity' },
  { test: /urine/i, name: 'Urine Examination', desc: 'Routine and microscopic urine analysis' },
  { test: /stool/i, name: 'Stool Examination', desc: 'Routine stool analysis' },
  { test: /ultras(ound|ono)/i, name: 'Ultrasound Report', desc: 'Ultrasound imaging report' },
  { test: /echocardio|ett/i, name: 'Echocardiography & ETT', desc: 'Heart ultrasound and exercise tolerance test' },
  { test: /film|morphology/i, name: 'Blood Film — Cell Morphology', desc: 'Blood cells examined under the microscope' },
]

const testInfo = (title) => TEST_INFO.find((t) => t.test.test(title)) || null

const GROUPS = [
  { key: 'blood', label: 'Blood & hormones', test: /(cbc|cvc|hb ?a1c|glucose|lipid|creatinine|ferritin|iron|t\.? ?i\.? ?b\.? ?c|free t3|free t4|tsh|ige|vitamin|uric|morphology|film|b-?12)/i },
  { key: 'imaging', label: 'Imaging & cardiology', test: /(ultrasound|ultrasono|echocardio|ett|x-?ray|mri|ct scan)/i },
  { key: 'urine', label: 'Urine & stool', test: /(urine|stool)/i },
]

const groupFor = (title) => GROUPS.find((g) => g.test.test(title))?.key || 'other'

/* Overall status comes from the report's metadata sidecar when the clinic
   has recorded one (server: report-meta.json). Absent metadata renders
   nothing — inventing "all good" for a real medical report is not an
   option. */
const STATUS_PILL = {
  normal: { tone: 'green', text: 'No issues flagged' },
  attention: { tone: 'rose', text: 'Discuss with your doctor' },
}

export default function MyReports({ doctorFilter = '' }) {
  const { me, mine } = usePatient()
  const { status, docs, reload } = useDocuments('reports')
  const toast = useToast()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [viewing, setViewing] = useState(null)
  const [clinicDoc, setClinicDoc] = useState(null)

  /* Files the clinic attached to the patient record (the former Documents
     tab) — same kind of thing as a report, so they live on this shelf. */
  const clinicDocs = me?.documents || []
  /* In-flight lab work — the old Test results tab, now a panel here. */
  const labs = mine('laboratory').filter((l) => !doctorFilter || l.doctor === doctorFilter)

  const enriched = useMemo(
    () =>
      docs
        .map((d) => ({
          ...d,
          info: testInfo(d.title),
          taken: d.takenDate ? takenDate(d.takenDate) || { label: d.takenDate } : takenDate(d.title),
        }))
        .sort((a, b) => String(b.taken?.iso || '').localeCompare(String(a.taken?.iso || ''))),
    [docs]
  )

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return enriched
      .filter((d) => group === 'all' || groupFor(d.title) === group)
      .filter(
        (d) =>
          !s ||
          d.title.toLowerCase().includes(s) ||
          (d.info?.name || '').toLowerCase().includes(s) ||
          (d.info?.desc || '').toLowerCase().includes(s)
      )
  }, [enriched, q, group])

  /* New report PDF → the Reports folder on the server, then re-list. */
  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const saved = await uploadDocument('reports', file)
      toast.success('Report uploaded', { title: saved.file })
      reload()
    } catch (err) {
      toast.warning(String(err.message || err), { title: 'Upload failed' })
    }
  }

  /* Only offer chips for shelves that actually hold something. */
  const chips = useMemo(() => {
    const present = new Set(docs.map((d) => groupFor(d.title)))
    return [
      { key: 'all', label: 'All' },
      ...GROUPS.filter((g) => present.has(g.key)),
      ...(present.has('other') ? [{ key: 'other', label: 'Other' }] : []),
    ]
  }, [docs])

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
              Reports are served by the backend. Start it with <code>cd server</code> then{' '}
              <code>npm run dev</code>, and reload this page.
            </div>
          </div>
        </div>
      )}

      {status !== 'offline' && (
        <>
          <div className="pt-filters" style={{ marginBottom: 14 }}>
            <span style={{ position: 'relative', flex: 1, display: 'flex' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-faint)' }}
              />
              <input
                className="pt-search"
                style={{ paddingLeft: 36 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tests — CBC, thyroid, ultrasound, vitamin…"
              />
            </span>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Upload report
              <input
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={onUpload}
              />
            </label>
          </div>

          <div className="pt-chips">
            {chips.map((c) => (
              <button
                key={c.key}
                className={`pt-chip ${group === c.key ? 'on' : ''}`}
                onClick={() => setGroup(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <section className="pt-panel">
            <div className="pt-panel-head">
              <ClipboardList size={16} /> Test reports
              <span className="count">{rows.length}</span>
            </div>
            <div className="pt-panel-body">
              {status === 'loading' && <p className="pt-empty">Loading your reports…</p>}
              {status === 'ready' && rows.length === 0 && (
                <p className="pt-empty">
                  {docs.length === 0 ? 'No reports on file yet.' : 'Nothing matches that search.'}
                </p>
              )}
              {rows.map((d) => {
                const pill = STATUS_PILL[d.status]
                return (
                  <div className="pt-row" key={d.file}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <FileText size={18} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div className="pt-row-title" title={d.title}>
                          {d.info?.name || d.title}
                        </div>
                        {d.info?.desc && <div className="pt-row-sub">{d.info.desc}</div>}
                        <div className="pt-row-sub">
                          {d.taken ? `Taken ${d.taken.label}` : `Added ${fmtAdded(d.modified)}`} · PDF ·{' '}
                          {fmtSize(d.size)}
                          {d.info && ` · ${d.title}`}
                        </div>
                      </div>
                    </div>
                    <div className="pt-row-right">
                      {pill && <span className={`pill tone-${pill.tone}`}>{pill.text}</span>}
                      <button className="btn btn-ghost" style={{ height: 34 }} onClick={() => setViewing(d)}>
                        View report
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <p className="pt-privacy" style={{ marginTop: 14 }}>
            Reports are shown exactly as issued by the lab or imaging centre. If a value worries
            you, bring it to your doctor — numbers need context.
          </p>
        </>
      )}

      <section className="pt-panel" style={{ marginTop: 14 }}>
        <div className="pt-panel-head">
          <FlaskConical size={16} /> Tests in progress at the lab
          <span className="count">{labs.length}</span>
        </div>
        <div className="pt-panel-body">
          {labs.length === 0 && <p className="pt-empty">No tests being processed right now.</p>}
          {labs.map((l) => (
            <div className="pt-row" key={l.resourceId}>
              <div>
                <div className="pt-row-title">{l.test}</div>
                <div className="pt-row-sub">
                  {l.result} · {l.resourceId}
                </div>
              </div>
              <div className="pt-row-right">
                <span
                  className={`pill tone-${
                    l.status === 'Abnormal' ? 'rose' : l.status === 'Approved' ? 'green' : 'blue'
                  }`}
                >
                  {LAB_STATUS_TEXT[l.status] || l.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        {labs.some((l) => l.status === 'Abnormal') && (
          <p className="pt-empty" style={{ textAlign: 'left', borderTop: '1px solid var(--border)' }}>
            A result outside the usual range doesn't necessarily mean something is wrong. Your
            doctor will go through it with you.
          </p>
        )}
      </section>

      {clinicDocs.length > 0 && (
        <section className="pt-panel" style={{ marginTop: 14 }}>
          <div className="pt-panel-head">
            <Paperclip size={16} /> Attached by your clinic
            <span className="count">{clinicDocs.length}</span>
          </div>
          <div className="pt-docs-grid">
            {clinicDocs.map((d) => (
              <button className="pt-doc-card" key={d.id} onClick={() => setClinicDoc(d)}>
                {d.kind === 'image' ? (
                  <img className="pt-doc-thumb" src={d.dataUrl} alt="" />
                ) : (
                  <div className="pt-doc-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                    <FileText size={26} style={{ color: 'var(--text-faint)' }} />
                  </div>
                )}
                <div className="pt-doc-name-sm">{d.name}</div>
                <div className="pt-row-sub">{d.type}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <DocumentViewer
        doc={viewing ? { ...viewing, title: viewing.info?.name || viewing.title } : null}
        url={viewing ? docUrl('reports', viewing.file) : ''}
        onClose={() => setViewing(null)}
      />

      <Modal
        open={!!clinicDoc}
        onClose={() => setClinicDoc(null)}
        title={clinicDoc?.name}
        subtitle="Document"
        width={720}
      >
        {clinicDoc &&
          (clinicDoc.kind === 'image' ? (
            <img className="pt-view-img" src={clinicDoc.dataUrl} alt={clinicDoc.name} />
          ) : (
            <a className="btn btn-primary" href={clinicDoc.dataUrl} download={clinicDoc.name}>
              Download {clinicDoc.name}
            </a>
          ))}
      </Modal>
    </>
  )
}
