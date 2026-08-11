import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  ArrowRight,
  Rss,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { modules, moduleMap } from '../data/modules.js'
import { useTheme } from '../theme/ThemeContext.jsx'
import { useData, relTime } from '../store/DataStore.jsx'
import DeltaBadge from '../components/DeltaBadge.jsx'
import '../components/cards.css'
import './dashboard.css'

export default function Dashboard() {
  const { theme } = useTheme()
  const { records, allActivity } = useData()
  const accentOf = (m) => (theme === 'dark' ? m.accent.dark : m.accent.light)
  const feed = allActivity().slice(0, 8)

  const dateStr = new Date('2026-07-13T09:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Live overview KPIs computed from the data store.
  const patients = records('patients')
  const doctors = records('doctors')
  const consults = records('telemedicine')
  const overviewKpis = [
    { label: 'Total Patients', value: patients.length.toLocaleString(), delta: '+312', up: true },
    { label: 'Active Doctors', value: doctors.filter((d) => d.status === 'Available' || d.status === 'On call').length.toString(), delta: '+18', up: true },
    { label: 'Consultations', value: consults.length.toString(), delta: '+9.2%', up: true },
    { label: 'Revenue (Today)', value: 'BDT 184.2K', delta: '+7.4%', up: true },
  ]

  // Priority worklist — pulled live from the highest-signal records.
  const toneMap = { Critical: 'rose', High: 'amber', Interaction: 'rose', 'Fraud review': 'violet', Live: 'violet' }
  const worklist = [
    ...records('rpm').filter((r) => r.status === 'Critical' || r.status === 'High').slice(0, 2)
      .map((r) => ({ ref: r.resourceId, title: `${r.device} alert`, sub: `${r.patient} · ${r.reading}`, value: r.status, tone: toneMap[r.status] || 'blue', status: 'RPM', link: '/app/m/rpm' })),
    ...records('prescriptions').filter((r) => r.status === 'Interaction').slice(0, 1)
      .map((r) => ({ ref: r.resourceId, title: 'Drug interaction', sub: `${r.drug} · ${r.patient}`, value: 'Alert', tone: 'rose', status: 'Rx', link: '/app/m/prescriptions' })),
    ...records('billing').filter((r) => r.status === 'Fraud review').slice(0, 1)
      .map((r) => ({ ref: r.resourceId, title: 'Claim flagged', sub: `${r.party} · ${r.amount}`, value: 'Review', tone: 'violet', status: 'Billing', link: '/app/m/billing' })),
    ...records('telemedicine').filter((r) => r.status === 'Live').slice(0, 1)
      .map((r) => ({ ref: r.resourceId, title: 'Live consultation', sub: `${r.doctor} · ${r.patient}`, value: 'Live', tone: 'violet', status: 'Video', link: '/app/m/telemedicine' })),
  ]

  return (
    <div className="fade-in">
      {/* Greeting */}
      <div className="greeting">
        <div>
          <h1 className="greet-title">Good day, Dr. Rehana 👋</h1>
          <p className="greet-date">
            <CalendarDays size={15} /> {dateStr}
          </p>
        </div>
        <button className="btn btn-primary">
          Quick Actions <ChevronRight size={16} />
        </button>
      </div>

      {/* Overview KPIs — dashboard variant */}
      <section className="kpi-strip cols-4" style={{ marginTop: 18 }}>
        {overviewKpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{k.value}</span>
              <DeltaBadge delta={k.delta} up={k.up} />
            </div>
          </div>
        ))}
      </section>

      {/* Module grid */}
      <div className="section-label" style={{ margin: '26px 0 12px' }}>
        Modules
      </div>
      <section className="module-grid">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Link
              to={`/app/m/${m.key}`}
              className="mod-card"
              key={m.key}
              style={{ '--accent': accentOf(m) }}
            >
              <span className="mod-card-icon">
                <Icon size={22} />
              </span>
              <div className="mod-card-body">
                <div className="mod-card-title">{m.label}</div>
                <div className="mod-card-desc">{m.tagline}</div>
              </div>
              <ArrowRight size={17} className="mod-card-arrow" />
            </Link>
          )
        })}
      </section>

      {/* Two-column: priority worklist + activity feed */}
      <section className="two-col" style={{ marginTop: 22 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="ph-icon">
              <ListChecks size={17} />
            </span>
            Priority Worklist
            <span className="ph-action">View all</span>
          </div>
          <div className="panel-body">
            {worklist.length === 0 && (
              <p style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-faint)' }}>
                Nothing urgent right now. 🎉
              </p>
            )}
            {worklist.map((r) => (
              <Link className="wl-row" key={r.ref} to={r.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="wl-ref" style={{ '--tc': `var(--tone-${r.tone})` }}>
                  {r.ref}
                </span>
                <div>
                  <div className="wl-title">{r.title}</div>
                  <div className="wl-sub">{r.sub}</div>
                </div>
                <span className="wl-value">{r.value}</span>
                <span className={`pill tone-${r.tone}`}>{r.status}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel" style={{ '--accent': 'var(--primary)' }}>
          <div className="panel-head">
            <span className="ph-icon">
              <Rss size={17} />
            </span>
            Recent Activity
          </div>
          <div className="panel-body">
            {feed.map((f) => {
              const mod = moduleMap[f.module]
              const FIcon = mod?.icon || Sparkles
              const acc = mod ? accentOf(mod) : 'var(--primary)'
              return (
                <div className="feed-row" key={f.id} style={{ '--accent': acc }}>
                  <span className="feed-icon">
                    <FIcon size={15} />
                  </span>
                  <div>
                    <div className="feed-title">{f.title}</div>
                    <div className="feed-sub">{f.sub}</div>
                  </div>
                  <span className="feed-time">{relTime(f.ts)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
