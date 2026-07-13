import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight,
  Home,
  Plus,
  Eye,
  Trash2,
  Pencil,
  Table2,
  Video,
  CalendarPlus,
  Activity,
  Sparkles,
  LineChart,
  LayoutGrid,
  ListChecks,
  Rss,
  ArrowRight,
  Accessibility,
} from 'lucide-react'
import { schemaMap } from '../data/schemas.js'
import { useData, newId, relTime } from '../store/DataStore.jsx'
import { useAccent } from './useAccent.js'
import { useToast } from './ui/Toast.jsx'
import DataTable from './ui/DataTable.jsx'
import Modal from './ui/Modal.jsx'
import Tabs from './ui/Tabs.jsx'
import Avatar from './ui/Avatar.jsx'
import ImageInput from './ui/ImageInput.jsx'
import DocumentsPanel from './ui/DocumentsPanel.jsx'
import { Field, TextInput, TextArea, Select } from './ui/Field.jsx'
import { imageToDataUrl, fileToDataUrl, docKind } from '../utils/files.js'
import TelemedicineConsole from '../features/TelemedicineConsole.jsx'
import AccessibleConsult from '../features/AccessibleConsult.jsx'
import AppointmentBooking from '../features/AppointmentBooking.jsx'
import RpmMonitor from '../features/RpmMonitor.jsx'
import AIStudio from '../features/AIStudio.jsx'
import AnalyticsInsights from '../features/AnalyticsInsights.jsx'
import './cards.css'
import './modulehome.css'

const toneVar = (t) => `var(--tone-${t})`

export default function Workspace() {
  const { key } = useParams()
  const schema = schemaMap[key]
  const accent = useAccent(schema?.accent)
  const { records, activity, add, update, remove, patch } = useData()
  const toast = useToast()

  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState(null) // { mode:'create'|'edit', data }
  const [detail, setDetail] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [errors, setErrors] = useState({})
  const [viewer, setViewer] = useState(null) // document being viewed

  const rows = records(key)

  const toneFor = useMemo(
    () => (row, col) => {
      const tones = schema?.statusTones || {}
      if (col.type === 'ref') return tones[row.status] || 'teal'
      return tones[row[col.key]] || 'teal'
    },
    [schema]
  )

  if (!schema) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h2>Module not found</h2>
        <Link to="/app" style={{ color: 'var(--primary)', fontWeight: 700 }}>
          Back to dashboard
        </Link>
      </div>
    )
  }

  const Icon = schema.icon
  const feed = activity(key)

  /* columns used to summarise a record in the compact worklist */
  const refCol = schema.columns.find((c) => c.type === 'ref')
  const strongCol = schema.columns.find((c) => c.type === 'strong' || c.type === 'avatarName')
  const imageField = schema.formFields.find((f) => f.type === 'image')
  const nameKey = strongCol?.key || 'name'
  const subCols = schema.columns
    .filter((c) => c !== refCol && c !== strongCol && c.key !== 'status')
    .slice(0, 2)

  const goTile = (tile) => {
    if (tile.go === 'create') openCreate()
    else setTab(tile.go || 'records')
  }

  /* ---- tabs: Overview + Records + feature tabs ---- */
  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'records', label: 'Records', icon: Table2, badge: rows.length },
  ]
  if (schema.hasConsole)
    tabs.push({ key: 'console', label: 'Live Console', icon: Video, badge: rows.filter((r) => r.status === 'Waiting' || r.status === 'Queued').length })
  if (schema.hasAccessible) tabs.push({ key: 'accessible', label: 'Accessible Care', icon: Accessibility })
  if (schema.hasBooking) tabs.push({ key: 'booking', label: 'Book', icon: CalendarPlus })
  if (schema.hasMonitor) tabs.push({ key: 'monitor', label: 'Live Monitor', icon: Activity })
  if (schema.hasAI) tabs.push({ key: 'ai', label: 'AI Studio', icon: Sparkles })
  if (schema.hasCharts) tabs.push({ key: 'insights', label: 'Insights', icon: LineChart })

  /* ---- create / edit ---- */
  const openCreate = () => {
    setErrors({})
    const data = { ...(schema.defaults || {}) }
    for (const sf of schema.subforms || []) data[sf.key] = data[sf.key] || []
    setForm({ mode: 'create', data })
  }
  const openEdit = (record) => {
    setErrors({})
    setDetail(null)
    const data = { ...record }
    for (const sf of schema.subforms || []) data[sf.key] = [...(record[sf.key] || [])]
    setForm({ mode: 'edit', data })
  }
  const setField = (k, v) =>
    setForm((f) => ({ ...f, data: { ...f.data, [k]: v } }))

  /* ---- repeatable child records (subforms) ---- */
  const addChild = (sf) =>
    setForm((f) => ({
      ...f,
      data: { ...f.data, [sf.key]: [...(f.data[sf.key] || []), {}] },
    }))
  const setChild = (sf, idx, k, v) =>
    setForm((f) => {
      const list = [...(f.data[sf.key] || [])]
      list[idx] = { ...list[idx], [k]: v }
      return { ...f, data: { ...f.data, [sf.key]: list } }
    })
  const removeChild = (sf, idx) =>
    setForm((f) => ({
      ...f,
      data: { ...f.data, [sf.key]: (f.data[sf.key] || []).filter((_, i) => i !== idx) },
    }))

  const submitForm = () => {
    const errs = {}
    for (const f of schema.formFields) {
      if (f.required && !String(form.data[f.key] ?? '').trim())
        errs[f.key] = 'Required'
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    // Drop child rows left entirely blank.
    const data = { ...form.data }
    for (const sf of schema.subforms || []) {
      data[sf.key] = (data[sf.key] || []).filter((row) =>
        sf.fields.some((f) => String(row[f.key] ?? '').trim())
      )
    }
    if (form.mode === 'create') {
      const record = { ...data, resourceId: newId(schema.idPrefix) }
      add(key, record, { title: `${schema.entity} created`, sub: record.resourceId })
      toast.success(`${schema.entity} created`, { title: record.resourceId })
    } else {
      update(key, data, { title: `${schema.entity} updated`, sub: data.resourceId })
      toast.success(`${schema.entity} updated`, { title: data.resourceId })
    }
    setForm(null)
  }

  const doDelete = () => {
    remove(key, confirmDel.resourceId, { title: `${schema.entity} deleted`, sub: confirmDel.resourceId })
    toast.info(`${schema.entity} deleted`, { title: confirmDel.resourceId })
    setConfirmDel(null)
  }

  const runAction = (record, action) => {
    patch(key, record.resourceId, action.patch(record), { title: action.toast, sub: record.resourceId })
    toast.success(action.toast, { title: record.resourceId })
  }

  /* ---- documents ---- */
  const uploadDoc = async (record, file) => {
    const kind = docKind(file)
    if (kind !== 'image' && file.size > 2 * 1024 * 1024) {
      toast.error('File too large — 2 MB max in this demo', { title: file.name })
      return
    }
    const dataUrl = kind === 'image' ? await imageToDataUrl(file, 1000, 0.85) : await fileToDataUrl(file)
    const doc = {
      id: newId('DOC'),
      name: file.name,
      kind,
      type: kind === 'image' ? 'Image' : kind === 'pdf' ? 'PDF' : 'File',
      size: file.size,
      uploadedAt: Date.now(),
      dataUrl,
    }
    const documents = [...(record.documents || []), doc]
    update(key, { ...record, documents }, { title: 'Document uploaded', sub: `${file.name} · ${record.resourceId}` })
    setDetail((d) => (d && d.resourceId === record.resourceId ? { ...d, documents } : d))
    toast.success('Document uploaded', { title: file.name })
  }

  const deleteDoc = (record, doc) => {
    const documents = (record.documents || []).filter((x) => x.id !== doc.id)
    update(key, { ...record, documents }, { title: 'Document removed', sub: `${doc.name} · ${record.resourceId}` })
    setDetail((d) => (d ? { ...d, documents } : d))
    toast.info('Document removed', { title: doc.name })
  }

  /* ---- row action buttons ---- */
  const rowActions = (r) => (
    <>
      {(schema.actions || [])
        .filter((a) => a.when(r))
        .map((a) => (
          <button
            key={a.key}
            className={`dt-row-btn ${a.tone === 'rose' ? 'danger' : 'accent'}`}
            onClick={() => runAction(r, a)}
          >
            {a.label}
          </button>
        ))}
      <button className="dt-row-btn" onClick={() => setDetail(r)}>
        <Eye size={13} /> View
      </button>
      <button className="dt-row-btn danger" onClick={() => setConfirmDel(r)}>
        <Trash2 size={13} />
      </button>
    </>
  )

  return (
    <div className="fade-in" style={{ '--accent': accent }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/app">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={13} />
        <span>{schema.label}</span>
      </nav>

      {/* Header */}
      <header className="mod-head">
        <span className="mod-mark">
          <Icon size={26} />
        </span>
        <div>
          <h1 className="mod-title">{schema.tagline}</h1>
          <p className="mod-desc">{schema.desc}</p>
        </div>
        <button className="btn btn-primary mod-cta" onClick={openCreate}>
          <Plus size={16} /> New {schema.entity}
        </button>
      </header>

      {/* Live KPIs */}
      <section className="kpi-strip cols-4" style={{ marginTop: 20 }}>
        {schema.kpis.map((k) => (
          <div className="kpi module" key={k.label} style={{ '--kpi-tone': toneVar(k.tone) }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{k.compute(rows)}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ marginTop: 22 }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
      )}

      {/* Tab content */}
      <div style={{ marginTop: 16 }}>
        {tab === 'overview' && (
          <>
            {/* Function tiles */}
            <div className="section-label" style={{ margin: '4px 0 12px' }}>
              Functions
            </div>
            <section className="tile-grid">
              {schema.tiles.map((t) => {
                const TIcon = t.icon
                return (
                  <button className="tile" key={t.title} onClick={() => goTile(t)}>
                    <span className="tile-icon">
                      <TIcon size={22} />
                    </span>
                    <div className="tile-title">{t.title}</div>
                    <div className="tile-desc">{t.desc}</div>
                    <div className="tile-foot">
                      <span>{t.count}</span>
                      <ArrowRight size={16} className="arrow" />
                    </div>
                  </button>
                )
              })}
            </section>

            {/* Worklist + activity feed */}
            <section className="two-col" style={{ marginTop: 20 }}>
              <div className="panel">
                <div className="panel-head">
                  <span className="ph-icon">
                    <ListChecks size={17} />
                  </span>
                  Recent {schema.entity}s
                  <span className="ph-action" onClick={() => setTab('records')} style={{ cursor: 'pointer' }}>
                    View all
                  </span>
                </div>
                <div className="panel-body">
                  {rows.length === 0 && (
                    <p style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-faint)' }}>
                      No records yet.
                    </p>
                  )}
                  {rows.slice(0, 6).map((r) => (
                    <div className="wl-row" key={r.resourceId} onClick={() => setDetail(r)} style={{ cursor: 'pointer' }}>
                      <span className="wl-ref" style={{ '--tc': toneVar(schema.statusTones[r.status] || 'teal') }}>
                        {refCol ? r[refCol.key] : r.resourceId}
                      </span>
                      <div>
                        <div className="wl-title">{strongCol ? r[strongCol.key] : r.resourceId}</div>
                        <div className="wl-sub">
                          {subCols.map((c) => r[c.key]).filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className="wl-value" />
                      <span className={`pill tone-${schema.statusTones[r.status] || 'teal'}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ '--accent': accent }}>
                <div className="panel-head">
                  <span className="ph-icon">
                    <Rss size={17} />
                  </span>
                  Activity
                </div>
                <div className="panel-body">
                  {feed.length === 0 && (
                    <p style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-faint)' }}>
                      No activity yet.
                    </p>
                  )}
                  {feed.slice(0, 8).map((f) => (
                    <div className="feed-row" key={f.id}>
                      <span className="feed-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <div className="feed-title">{f.title}</div>
                        <div className="feed-sub">{f.sub}</div>
                      </div>
                      <span className="feed-time">{relTime(f.ts)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
        {tab === 'records' && (
          <DataTable
            columns={schema.columns}
            rows={rows}
            toneFor={toneFor}
            onRowClick={(r) => setDetail(r)}
            rowActions={rowActions}
            emptyLabel={`No ${schema.entity.toLowerCase()} records — click “New ${schema.entity}”.`}
          />
        )}
        {tab === 'console' && <TelemedicineConsole schema={schema} />}
        {tab === 'accessible' && <AccessibleConsult schema={schema} />}
        {tab === 'booking' && <AppointmentBooking schema={schema} />}
        {tab === 'monitor' && <RpmMonitor schema={schema} />}
        {tab === 'ai' && <AIStudio schema={schema} />}
        {tab === 'insights' && <AnalyticsInsights schema={schema} />}
      </div>

      {/* Create / Edit modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        width={schema.subforms ? 680 : undefined}
        title={`${form?.mode === 'edit' ? 'Edit' : 'New'} ${schema.entity}`}
        subtitle={form?.mode === 'edit' ? form.data.resourceId : `Add a new ${schema.entity.toLowerCase()} record`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitForm}>
              {form?.mode === 'edit' ? 'Save changes' : `Create ${schema.entity}`}
            </button>
          </>
        }
      >
        {form && (
          <>
            <div className="form-grid">
              {schema.formFields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  error={errors[f.key]}
                  className={f.full ? 'full' : ''}
                >
                  {f.type === 'image' ? (
                    <ImageInput
                      value={form.data[f.key]}
                      onChange={(v) => setField(f.key, v)}
                      onError={(m) => toast.error(m)}
                    />
                  ) : f.type === 'textarea' ? (
                    <TextArea value={form.data[f.key]} onChange={(v) => setField(f.key, v)} />
                  ) : f.type === 'select' ? (
                    <Select
                      value={form.data[f.key]}
                      onChange={(v) => setField(f.key, v)}
                      options={f.options}
                      placeholder={`Select ${f.label.toLowerCase()}`}
                    />
                  ) : (
                    <TextInput
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={form.data[f.key]}
                      onChange={(v) => setField(f.key, v)}
                    />
                  )}
                </Field>
              ))}
            </div>

            {/* Repeatable child records */}
            {(schema.subforms || []).map((sf) => (
              <div className="subform" key={sf.key}>
                <div className="subform-head">
                  <span className="section-label">{sf.label}</span>
                  <button type="button" className="mini-btn accent" onClick={() => addChild(sf)}>
                    <Plus size={13} /> Add {sf.singular}
                  </button>
                </div>
                {(form.data[sf.key] || []).length === 0 && (
                  <p className="subform-empty">No {sf.singular} added yet.</p>
                )}
                {(form.data[sf.key] || []).map((row, idx) => (
                  <div className="subform-row" key={idx}>
                    {sf.fields.map((cf) => (
                      <input
                        key={cf.key}
                        className="ff-input subform-input"
                        style={cf.width ? { flex: `0 0 ${cf.width}px` } : undefined}
                        type={cf.type === 'number' ? 'number' : 'text'}
                        placeholder={cf.placeholder || cf.label}
                        value={row[cf.key] ?? ''}
                        onChange={(e) => setChild(sf, idx, cf.key, e.target.value)}
                      />
                    ))}
                    <button
                      type="button"
                      className="subform-del"
                      onClick={() => removeChild(sf, idx)}
                      aria-label={`Remove ${sf.singular}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </Modal>

      {/* Detail drawer */}
      <Modal
        open={!!detail}
        side
        onClose={() => setDetail(null)}
        title={detail?.resourceId}
        subtitle={schema.label}
        footer={
          detail && (
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(detail)}>
                <Trash2 size={15} /> Delete
              </button>
              <button className="btn btn-primary" onClick={() => openEdit(detail)}>
                <Pencil size={15} /> Edit
              </button>
            </>
          )
        }
      >
        {detail && (
          <>
            {imageField ? (
              <div className="detail-hero">
                <Avatar src={detail[imageField.key]} name={detail[nameKey]} size={62} />
                <div>
                  <div className="detail-hero-name">{detail[nameKey]}</div>
                  <div className="detail-hero-sub">
                    {detail.specialization || detail.department || schema.label}
                  </div>
                  <span className={`pill tone-${schema.statusTones[detail.status] || 'teal'}`} style={{ marginTop: 6 }}>
                    {detail.status}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <span className={`pill tone-${schema.statusTones[detail.status] || 'teal'}`}>
                  {detail.status}
                </span>
              </div>
            )}
            <div className="detail-grid">
              {schema.formFields
                .filter((f) => f.type !== 'image')
                .map((f) => (
                  <div className={`detail-item ${f.full ? 'full' : ''}`} key={f.key}>
                    <span className="detail-k">{f.label}</span>
                    <span className="detail-v">{detail[f.key] || '—'}</span>
                  </div>
                ))}
            </div>

            {/* Child records */}
            {(schema.subforms || []).map((sf) => {
              const list = detail[sf.key] || []
              return (
                <div className="detail-children" key={sf.key}>
                  <div className="detail-children-head">
                    <span className="section-label">{sf.label}</span>
                    <span className="detail-children-count">{list.length}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="detail-v" style={{ color: 'var(--text-faint)' }}>—</p>
                  ) : (
                    <div className="child-list">
                      {list.map((row, i) => (
                        <div className="child-card" key={i}>
                          <div className="child-title">
                            {row[sf.fields[0].key] || '—'}
                          </div>
                          <div className="child-meta">
                            {sf.fields
                              .slice(1)
                              .map((cf) => row[cf.key])
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Documents */}
            {schema.hasDocuments && (
              <div style={{ marginTop: 20 }}>
                <DocumentsPanel
                  documents={detail.documents || []}
                  onUpload={(file) => uploadDoc(detail, file)}
                  onView={(doc) => setViewer(doc)}
                  onDelete={(doc) => deleteDoc(detail, doc)}
                />
              </div>
            )}

            {(schema.actions || []).filter((a) => a.when(detail)).length > 0 && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {schema.actions
                  .filter((a) => a.when(detail))
                  .map((a) => (
                    <button
                      key={a.key}
                      className="btn btn-ghost"
                      onClick={() => {
                        runAction(detail, a)
                        setDetail((d) => ({ ...d, ...a.patch(d) }))
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Document viewer */}
      <Modal
        open={!!viewer}
        onClose={() => setViewer(null)}
        title={viewer?.name}
        subtitle="Document viewer"
        width={780}
      >
        {viewer &&
          (viewer.kind === 'image' ? (
            <img className="doc-view-img" src={viewer.dataUrl} alt={viewer.name} />
          ) : viewer.kind === 'pdf' ? (
            <iframe className="doc-view-frame" src={viewer.dataUrl} title={viewer.name} />
          ) : (
            <a className="btn btn-primary" href={viewer.dataUrl} download={viewer.name}>
              Download {viewer.name}
            </a>
          ))}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Delete ${schema.entity}?`}
        subtitle={confirmDel?.resourceId}
        width={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--tone-rose)' }}
              onClick={doDelete}
            >
              Delete
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          This will permanently remove <strong>{confirmDel?.resourceId}</strong> from this
          workspace. This action can’t be undone (until you reset demo data).
        </p>
      </Modal>
    </div>
  )
}
