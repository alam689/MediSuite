import { useState } from 'react'
import {
  Network,
  Plus,
  Pencil,
  Trash2,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Tag,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useHospital } from './HospitalContext.jsx'

const TONE = { Open: 'green', 'Limited service': 'amber', Closed: 'rose' }
const STATUSES = ['Open', 'Limited service', 'Closed']

const blank = { name: '', head: '', phone: '', status: 'Open', notes: '', services: [] }

/* Departments and what they charge for.

   The tariff lives here rather than on the invoice because a price is a
   property of the service, not of one bill. Two invoices for the same X-ray
   that disagree is a billing dispute nobody can settle. */
export default function HospitalDepartments() {
  const { facility, facilityLabel, isAll, departments, staff } = useHospital()
  const { add, update, patch } = useData()
  const toast = useToast()

  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')

  const openNew = () => {
    setError('')
    setDraft({ ...blank, services: [{ name: '', code: '', price: '' }] })
  }

  const openEdit = (d) => {
    setError('')
    setDraft({ ...d, services: (d.services || []).map((s) => ({ ...s })) })
  }

  const setService = (i, key, value) =>
    setDraft((d) => ({
      ...d,
      services: d.services.map((s, j) => (j === i ? { ...s, [key]: value } : s)),
    }))

  const save = () => {
    if (!draft.name.trim()) return setError('Give the department a name.')

    /* Drop blank rows rather than storing empty services — an unnamed entry
       in a service catalogue is a price attached to nothing. */
    const services = draft.services.filter((s) => s.name.trim())
    const body = { ...draft, services, hospital: draft.hospital || facility }

    if (draft.resourceId) {
      update('departments', body, {
        title: 'Department updated',
        sub: `${draft.resourceId} · ${draft.name}`,
      })
      toast.success('Department updated', { title: draft.name })
    } else {
      const resourceId = newId('DEP')
      add('departments', { ...body, resourceId }, {
        title: 'Department created',
        sub: `${resourceId} · ${draft.name} · ${facility}`,
      })
      toast.success(`${draft.name} added to ${facility}`, { title: 'Department created' })
    }
    setDraft(null)
  }

  const setStatus = (d, status) => {
    patch('departments', d.resourceId, { status }, {
      title: `Department set to ${status.toLowerCase()}`,
      sub: `${d.resourceId} · ${d.name}`,
    })
    toast.success(`${d.name} — ${status}`, { title: d.hospital })
  }

  return (
    <>
      <header className="hs-head hs-head-row">
        <div>
          <h1 className="hs-title">Departments &amp; services</h1>
          <p className="hs-sub">
            Clinical units at {facilityLabel} and the services they bill for.
          </p>
        </div>
        {!isAll && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Add department
          </button>
        )}
      </header>

      {isAll && (
        <p className="hs-note">
          <AlertTriangle size={13} />
          Choose a single clinic to add a department — a service catalogue belongs to one site.
        </p>
      )}

      {departments.length === 0 ? (
        <div className="hs-panel">
          <p className="hs-empty">No departments recorded at {facilityLabel}.</p>
        </div>
      ) : (
        <div className="hs-staff">
          {departments.map((d) => (
            <article className="hs-doc" key={d.resourceId}>
              <div className="hs-doc-top">
                <div>
                  <div className="hs-row-title">{d.name}</div>
                  <div className="hs-row-sub">
                    {d.head || 'no head of unit'}
                    {isAll && d.hospital && <span className="hs-site"> {d.hospital}</span>}
                  </div>
                </div>
                <span className={`pill tone-${TONE[d.status] || 'teal'}`}>{d.status}</span>
              </div>

              <div className="hs-doc-meta">
                {d.phone && (
                  <span>
                    <Phone size={11} /> {d.phone}
                  </span>
                )}
                <span>
                  <Tag size={11} /> {(d.services || []).length} service(s)
                </span>
              </div>

              {(d.services || []).length > 0 && (
                <div className="hs-panel-body" style={{ padding: 0, marginBottom: 10 }}>
                  {d.services.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontSize: 12.5,
                        padding: '4px 0',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        {s.name}
                        {s.code && (
                          <span style={{ color: 'var(--text-faint)' }}> · {s.code}</span>
                        )}
                      </span>
                      <strong style={{ color: 'var(--text)' }}>{s.price || '—'}</strong>
                    </div>
                  ))}
                </div>
              )}

              {d.notes && <p className="hs-hint" style={{ marginTop: 0 }}>{d.notes}</p>}

              {!isAll && (
                <div className="hs-doc-actions">
                  <button className="hs-btn" onClick={() => openEdit(d)}>
                    <Pencil size={13} /> Edit
                  </button>
                  {STATUSES.filter((s) => s !== d.status).map((s) => (
                    <button
                      key={s}
                      className={`hs-btn ${s === 'Open' ? 'ok' : ''}`}
                      onClick={() => setStatus(d, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {d.status !== 'Open' && (
                <div className="hs-doc-lic warn">
                  <AlertTriangle size={12} />
                  {d.status === 'Closed'
                    ? 'Closed — not bookable and not billable'
                    : 'Limited service — check cover before booking'}
                </div>
              )}
              {d.status === 'Open' && !d.head && (
                <div className="hs-doc-lic warn">
                  <AlertTriangle size={12} />
                  No head of unit — nobody is accountable for this department
                </div>
              )}
              {d.status === 'Open' && d.head && (
                <div className="hs-doc-lic">
                  <CheckCircle2 size={12} />
                  Accountable: {d.head}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.resourceId ? `Edit ${draft.name}` : 'Add a department'}
        subtitle={draft?.hospital || facility}
        width={620}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              <Network size={15} /> Save
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="hs-form">
              <label className="hs-field full">
                <span>Department</span>
                <input
                  className="hs-input"
                  value={draft.name}
                  placeholder="e.g. Cardiology"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="hs-field">
                <span>Head of unit</span>
                <select
                  className="hs-input"
                  value={draft.head}
                  onChange={(e) => setDraft({ ...draft, head: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.resourceId} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {/* Keep an existing head selectable even if they no longer
                      hold a chamber here — losing them silently would blank
                      the accountable clinician on save. */}
                  {draft.head && !staff.some((s) => s.name === draft.head) && (
                    <option value={draft.head}>{draft.head} (no chamber here)</option>
                  )}
                </select>
              </label>
              <label className="hs-field">
                <span>Extension</span>
                <input
                  className="hs-input"
                  value={draft.phone}
                  placeholder="x2201"
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label className="hs-field">
                <span>Status</span>
                <select
                  className="hs-input"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="hs-field full">
                <span>Notes</span>
                <input
                  className="hs-input"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </div>

            <div className="section-label" style={{ margin: '16px 0 8px' }}>
              Service catalogue
            </div>
            {draft.services.map((s, i) => (
              <div
                key={i}
                style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 40px', gap: 8, marginBottom: 8 }}
              >
                <input
                  className="hs-input"
                  value={s.name}
                  placeholder="Service"
                  onChange={(e) => setService(i, 'name', e.target.value)}
                />
                <input
                  className="hs-input"
                  value={s.code}
                  placeholder="Code"
                  onChange={(e) => setService(i, 'code', e.target.value)}
                />
                <input
                  className="hs-input"
                  value={s.price}
                  placeholder="$0"
                  onChange={(e) => setService(i, 'price', e.target.value)}
                />
                <button
                  className="hs-btn danger"
                  onClick={() =>
                    setDraft({ ...draft, services: draft.services.filter((_, j) => j !== i) })
                  }
                  aria-label="Remove service"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              className="hs-btn"
              onClick={() =>
                setDraft({ ...draft, services: [...draft.services, { name: '', code: '', price: '' }] })
              }
            >
              <Plus size={13} /> Add service
            </button>

            {error && <span className="hs-err">{error}</span>}
            <p className="hs-hint">
              Rows with no service name are dropped on save. The tariff here is what billing should
              charge — changing it does not alter invoices already raised.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
