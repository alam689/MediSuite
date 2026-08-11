import { useEffect, useState } from 'react'
import {
  UserRound,
  Save,
  MapPin,
  Clock,
  GraduationCap,
  Award,
  BadgeCheck,
  ShieldAlert,
  Users,
} from 'lucide-react'
import Avatar from '../components/ui/Avatar.jsx'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { shortDoctorName } from '../data/links.js'

const AVAILABILITY = [
  { key: 'Available', desc: 'Taking bookings and consultations.' },
  { key: 'On call', desc: 'Reachable for urgent work only.' },
  { key: 'On leave', desc: 'Not bookable. Existing appointments stay.' },
]

export default function DoctorProfile() {
  const { me, name, setName, roster, chambers, panel } = useDoctor()
  const { patch } = useData()
  const toast = useToast()

  const [form, setForm] = useState({ email: '', phone: '', fee: '', education: '' })
  const [dirty, setDirty] = useState(false)

  /* Re-seed the form when the signed-in doctor changes, or the demo switcher
     would leave one person's contact details in another's form. */
  useEffect(() => {
    setForm({
      email: me?.email || '',
      phone: me?.phone || '',
      fee: me?.fee || '',
      education: me?.education || '',
    })
    setDirty(false)
  }, [me?.resourceId])

  if (!me) {
    return (
      <section className="pf-panel">
        <div className="pf-panel-body">
          <p className="pf-empty">No doctor record found for this session.</p>
        </div>
      </section>
    )
  }

  const field = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const save = () => {
    patch('doctors', me.resourceId, form, {
      title: 'Profile updated',
      sub: `${me.resourceId} · ${me.name}`,
    })
    setDirty(false)
    toast.success('Profile saved', { title: me.name })
  }

  const setAvailability = (status) => {
    patch('doctors', me.resourceId, { status }, {
      title: `Availability set to ${status}`,
      sub: `${me.resourceId} · ${me.name}`,
    })
    toast.success(`You are now marked ${status}`, { title: me.name })
  }

  const verified = me.status !== 'In review'

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">My profile</h1>
          <p className="pf-sub">Credentials, availability and the chambers you practise at.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!dirty}>
          <Save size={16} /> Save changes
        </button>
      </header>

      <section className="pf-panel" style={{ marginBottom: 14 }}>
        <div className="pf-panel-body" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <Avatar name={me.name} src={me.photo} size={56} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{me.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {me.specialization} · {me.resourceId} · rated {me.rating}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                Records are filed under <strong>{shortDoctorName(me.name)}</strong>
              </div>
            </div>
            <span
              className={`pill tone-${verified ? 'green' : 'amber'}`}
              style={{ marginLeft: 'auto' }}
            >
              {verified ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />}
              {verified ? 'License verified' : 'Awaiting verification'}
            </span>
          </div>

          {!verified && (
            <div className="pf-warn" style={{ marginBottom: 14 }}>
              <ShieldAlert size={16} />
              <span>
                Your licence <strong>{me.license}</strong> has not been verified by the hospital
                administrator yet. You can prepare your profile, but you will not appear in patient
                search until it is.
              </span>
            </div>
          )}

          <div className="section-label" style={{ marginBottom: 8 }}>
            Availability
          </div>
          <div className="pf-chips">
            {AVAILABILITY.map((a) => (
              <button
                key={a.key}
                className={`pf-chip ${me.status === a.key ? 'on' : ''}`}
                title={a.desc}
                onClick={() => setAvailability(a.key)}
              >
                {a.key}
              </button>
            ))}
          </div>
          <p className="pf-hint" style={{ marginTop: 0 }}>
            {AVAILABILITY.find((a) => a.key === me.status)?.desc ||
              'Your status is set by the administrator while your licence is in review.'}
          </p>
        </div>
      </section>

      <section className="pf-panel" style={{ marginBottom: 14 }}>
        <div className="pf-panel-head">
          <UserRound size={15} /> Contact &amp; fee
        </div>
        <div className="pf-panel-body" style={{ padding: 16 }}>
          <div className="pf-form">
            <label className="pf-field">
              <span>Email</span>
              <input
                className="pf-input"
                value={form.email}
                onChange={(e) => field('email', e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span>Phone</span>
              <input
                className="pf-input"
                value={form.phone}
                onChange={(e) => field('phone', e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span>Consultation fee</span>
              <input
                className="pf-input"
                value={form.fee}
                placeholder="BDT 1,000"
                onChange={(e) => field('fee', e.target.value)}
              />
            </label>
            <label className="pf-field full">
              <span>Professional summary</span>
              <textarea
                className="pf-input"
                rows={3}
                value={form.education}
                onChange={(e) => field('education', e.target.value)}
              />
            </label>
          </div>
          <p className="pf-hint">
            The fee and summary are what patients see when they search for a doctor. Changing the
            fee does not alter invoices already raised.
          </p>
        </div>
      </section>

      <div className="pf-two">
        <section className="pf-panel">
          <div className="pf-panel-head">
            <MapPin size={15} /> Chambers &amp; hours
            <span className="count">{chambers.length}</span>
          </div>
          <div className="pf-panel-body">
            {chambers.length === 0 && (
              <p className="pf-empty">
                No chamber recorded — you appear as online-only in patient search.
              </p>
            )}
            {chambers.map((c, i) => (
              <div className="pf-row" key={i}>
                <div>
                  <div className="pf-row-title">{c.name}</div>
                  <div className="pf-row-sub">
                    {c.address}
                    <br />
                    <Clock size={11} style={{ verticalAlign: -1 }} /> {c.days} · {c.from} – {c.to}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="pf-hint" style={{ padding: '0 16px 14px' }}>
            Chambers are managed by each hospital's administrator, because a clinic's opening hours
            are the clinic's to set. Ask the facility to change them.
          </p>
        </section>

        <div>
          <section className="pf-panel">
            <div className="pf-panel-head">
              <GraduationCap size={15} /> Qualifications
              <span className="count">{me.degrees?.length || 0}</span>
            </div>
            <div className="pf-panel-body">
              {(me.degrees || []).length === 0 && <p className="pf-empty">None recorded.</p>}
              {(me.degrees || []).map((d, i) => (
                <div className="pf-row" key={i}>
                  <div>
                    <div className="pf-row-title">{d.degree}</div>
                    <div className="pf-row-sub">
                      {d.institution} · {d.year}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pf-panel">
            <div className="pf-panel-head">
              <Award size={15} /> Awards
              <span className="count">{me.awards?.length || 0}</span>
            </div>
            <div className="pf-panel-body">
              {(me.awards || []).length === 0 && <p className="pf-empty">None recorded.</p>}
              {(me.awards || []).map((a, i) => (
                <div className="pf-row" key={i}>
                  <div>
                    <div className="pf-row-title">{a.title}</div>
                    <div className="pf-row-sub">
                      {a.org} · {a.year}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pf-panel">
            <div className="pf-panel-head">
              <Users size={15} /> Caseload
            </div>
            <div className="pf-panel-body" style={{ padding: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{panel.length}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                patients currently linked to you
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Demo affordance, labelled as one. */}
      <section className="pf-panel" style={{ marginTop: 14 }}>
        <div className="pf-panel-head">
          <Users size={15} /> Demo — view as another doctor
        </div>
        <div className="pf-panel-body" style={{ padding: 16 }}>
          <label className="pf-field" style={{ maxWidth: 340 }}>
            <span>Signed in as</span>
            <select className="pf-input" value={name} onChange={(e) => setName(e.target.value)}>
              {roster.map((d) => (
                <option key={d.resourceId} value={d.name}>
                  {d.name} — {d.specialization}
                </option>
              ))}
            </select>
          </label>
          <p className="pf-hint">
            This switcher exists so the demo can be explored from more than one clinician's chair.
            A real deployment resolves identity from the auth token server-side and offers nothing
            like it.
          </p>
        </div>
      </section>
    </>
  )
}
