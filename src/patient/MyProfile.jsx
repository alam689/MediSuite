import { useState } from 'react'
import { UserRound, Users, ShieldCheck, Plus, Trash2, Save, Eye } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { usePatient } from './PatientContext.jsx'

/* Consent types from the blueprint §16.7. Each is separate on purpose:
   bundling them into one "I agree" is exactly what the section warns against. */
const CONSENT_TYPES = [
  { key: 'telemedicine', label: 'Telemedicine service', desc: 'Receive care through video and messaging on this platform.', required: true },
  { key: 'privacy', label: 'Privacy notice', desc: 'You have read how your health data is handled.', required: true },
  { key: 'recording', label: 'Consultation recording', desc: 'Allow consultations to be recorded. Off by default.' },
  { key: 'lab', label: 'Share with laboratory', desc: 'Send test orders and receive results from partner labs.' },
  { key: 'pharmacy', label: 'Share with pharmacy', desc: 'Send prescriptions to your pharmacy for dispensing.' },
  { key: 'ai', label: 'AI-assisted processing', desc: 'Allow AI tools to help your clinician draft notes and check images. A clinician always reviews.' },
  { key: 'research', label: 'Research use', desc: 'Allow de-identified data to be used for medical research.' },
]

const CONSENT_VERSION = 'v2.1'

export default function MyProfile() {
  const { me, name, roster, setName } = usePatient()
  const { update } = useData()
  const toast = useToast()

  const [form, setForm] = useState({ phone: me?.phone || '', insurance: me?.insurance || '', allergies: me?.allergies || '' })
  const [dep, setDep] = useState({ name: '', relation: '', age: '' })

  const consents = me?.consents || {}
  const dependents = me?.dependents || []

  const saveProfile = () => {
    update('patients', { ...me, ...form }, { title: 'Profile updated by patient', sub: name })
    toast.success('Profile saved', { title: name })
  }

  /* A consent record is not a boolean — it carries the version agreed, when,
     and by whom, and a withdrawal keeps its history (§16.7). */
  const toggleConsent = (type, granted) => {
    const next = {
      ...consents,
      [type.key]: {
        granted,
        version: CONSENT_VERSION,
        at: new Date().toISOString(),
        by: name,
        ...(granted ? {} : { withdrawnAt: new Date().toISOString() }),
      },
    }
    update('patients', { ...me, consents: next }, {
      title: granted ? 'Consent granted' : 'Consent withdrawn',
      sub: `${type.label} · ${name}`,
    })
    toast[granted ? 'success' : 'info'](`${type.label} — ${granted ? 'granted' : 'withdrawn'}`, {
      title: `Consent ${CONSENT_VERSION}`,
    })
  }

  const addDependent = () => {
    if (!dep.name.trim()) return
    const next = [...dependents, { ...dep }]
    update('patients', { ...me, dependents: next }, { title: 'Dependent added', sub: `${dep.name} · ${name}` })
    setDep({ name: '', relation: '', age: '' })
    toast.success('Dependent added', { title: dep.name })
  }

  const removeDependent = (i) => {
    const gone = dependents[i]
    update('patients', { ...me, dependents: dependents.filter((_, x) => x !== i) }, {
      title: 'Dependent removed',
      sub: `${gone.name} · ${name}`,
    })
    toast.info('Dependent removed', { title: gone.name })
  }

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Profile</h1>
          <p className="pt-sub">Your details, the people you care for, and what you've agreed to.</p>
        </div>
      </header>

      <div className="pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          <section className="pt-panel">
            <div className="pt-panel-head">
              <UserRound size={16} /> My details
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px 0' }}>
              <Avatar name={name} size={54} />
              <div>
                <div className="pt-row-title" style={{ fontSize: 16 }}>{name}</div>
                <div className="pt-row-sub">
                  {me?.age} · {me?.gender} · {me?.department} · {me?.resourceId}
                </div>
              </div>
            </div>
            <div className="pt-form">
              <label>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Phone
                </span>
                <input
                  className="pt-search"
                  style={{ width: '100%' }}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Insurer
                </span>
                <input
                  className="pt-search"
                  style={{ width: '100%' }}
                  value={form.insurance}
                  onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.value }))}
                />
              </label>
              <label className="full">
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                  Known allergies
                </span>
                <input
                  className="pt-search"
                  style={{ width: '100%' }}
                  value={form.allergies}
                  onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                />
              </label>
              <div className="full">
                <button className="btn btn-primary" onClick={saveProfile}>
                  <Save size={15} /> Save changes
                </button>
              </div>
            </div>
          </section>

          <section className="pt-panel">
            <div className="pt-panel-head">
              <Users size={16} /> Dependents
              <span className="count">{dependents.length}</span>
            </div>
            <div className="pt-panel-body">
              {dependents.length === 0 && (
                <p className="pt-empty">No dependents. Add a child or someone you care for.</p>
              )}
              {dependents.map((d, i) => (
                <div className="pt-row" key={i}>
                  <Avatar name={d.name} size={34} />
                  <div>
                    <div className="pt-row-title">{d.name}</div>
                    <div className="pt-row-sub">
                      {d.relation || 'Dependent'}
                      {d.age ? ` · ${d.age}` : ''}
                    </div>
                  </div>
                  <div className="pt-row-right">
                    <button className="icon-btn" onClick={() => removeDependent(i)} aria-label={`Remove ${d.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-dep-add">
              <input placeholder="Full name" value={dep.name} onChange={(e) => setDep((d) => ({ ...d, name: e.target.value }))} />
              <input placeholder="Relation" value={dep.relation} onChange={(e) => setDep((d) => ({ ...d, relation: e.target.value }))} />
              <input placeholder="Age" style={{ maxWidth: 70 }} value={dep.age} onChange={(e) => setDep((d) => ({ ...d, age: e.target.value }))} />
              <button className="btn btn-ghost" style={{ height: 38 }} onClick={addDependent}>
                <Plus size={15} /> Add
              </button>
            </div>
          </section>
        </div>

        <section className="pt-panel">
          <div className="pt-panel-head">
            <ShieldCheck size={16} /> Consent &amp; sharing
            <span className="count">{CONSENT_VERSION}</span>
          </div>
          <div>
            {CONSENT_TYPES.map((t) => {
              const c = consents[t.key]
              const granted = c?.granted ?? false
              return (
                <div className="pt-consent" key={t.key}>
                  <div>
                    <div className="pt-consent-title">{t.label}</div>
                    <div className="pt-consent-desc">{t.desc}</div>
                    {c?.at && (
                      <div className="pt-row-sub" style={{ marginTop: 4, fontSize: 11 }}>
                        {granted ? 'Agreed' : 'Withdrawn'} {new Date(c.at).toLocaleDateString()} · {c.version}
                      </div>
                    )}
                  </div>
                  <div className="pt-consent-right">
                    <input
                      type="checkbox"
                      className="pt-switch"
                      checked={granted}
                      onChange={(e) => toggleConsent(t, e.target.checked)}
                      aria-label={t.label}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="pt-empty" style={{ textAlign: 'left', borderTop: '1px solid var(--border)' }}>
            You can withdraw any consent at any time. Withdrawing the required ones may mean we
            can't provide care through this platform — it will never delete records we're legally
            required to keep.
          </p>

          {/* Demo affordance, labelled as such rather than dressed up as a feature. */}
          <div className="pt-identity">
            <Eye size={14} />
            Demo: viewing as
            <select value={name} onChange={(e) => setName(e.target.value)}>
              {roster.map((p) => (
                <option key={p.resourceId} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>
    </>
  )
}
