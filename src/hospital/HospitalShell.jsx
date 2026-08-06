import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  LayoutGrid,
  BedDouble,
  CalendarClock,
  Stethoscope,
  LogOut,
  Building2,
  ShieldCheck,
  Layers,
  ClipboardPlus,
  Network,
  Wallet,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import NotificationBell from '../portal/NotificationBell.jsx'
import { hospitalNotifications } from '../portal/notifications.js'
import { freeBeds } from '../data/schemas.js'
import { useHospital, ALL_FACILITIES } from './HospitalContext.jsx'
import './hospital.css'

const NAV = [
  { to: '/hospital', end: true, icon: LayoutGrid, label: 'Overview' },
  { to: '/hospital/beds', icon: BedDouble, label: 'Beds & units' },
  { to: '/hospital/admissions', icon: ClipboardPlus, label: 'Admissions' },
  { to: '/hospital/appointments', icon: CalendarClock, label: 'Appointments' },
  { to: '/hospital/staff', icon: Stethoscope, label: 'Practitioners' },
  { to: '/hospital/departments', icon: Network, label: 'Departments' },
  { to: '/hospital/revenue', icon: Wallet, label: 'Revenue' },
]

export default function HospitalShell() {
  const navigate = useNavigate()
  const { signOut, role } = useAuth()
  const { facility, facilities, setFacility, isAll, units, appointments, admissions, departments, invoices } =
    useHospital()

  const logout = () => {
    signOut()
    navigate('/', { replace: true })
  }

  const notifications = hospitalNotifications({
    units,
    appointments,
    admissions,
    departments,
    invoices,
    isAll,
    freeBeds,
  })

  return (
    <div className="hs-shell">
      <header className="hs-top">
        <div className="hs-top-in">
          <div className="hs-brand">
            <span className="hs-logo">
              <Activity size={19} />
            </span>
            Medi<strong>Suite</strong>
            <span className="hs-brand-tag">Hospital admin</span>
          </div>

          <nav className="hs-nav">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `hs-nav-link ${isActive ? 'on' : ''}`}
                >
                  <Icon size={15} />
                  {n.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="hs-top-right">
            {/* The facility is shown at all times, not buried in settings:
                every number on every page is scoped to it, and an admin who
                forgets which site they're looking at will misread all of them. */}
            <label className={`hs-facility ${isAll ? 'is-all' : ''}`} title="The facility you are administering">
              {isAll ? <Layers size={14} /> : <Building2 size={14} />}
              <select value={facility} onChange={(e) => setFacility(e.target.value)} aria-label="Facility">
                <option value={ALL_FACILITIES}>All clinics ({facilities.length})</option>
                {facilities.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <NotificationBell role={role} items={notifications} />
            <ThemeToggle />
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="hs-main">
        <div className="hs-wrap fade-in">
          <Outlet />
        </div>
      </main>

      <footer className="hs-foot">
        <ShieldCheck size={13} />
        <span>
          {isAll ? (
            <>
              Group view — <strong>all {facilities.length} clinics</strong>. Every row names its
              facility.
            </>
          ) : (
            <>
              You are seeing <strong>{facility}</strong> only.
            </>
          )}{' '}
          Platform-wide users, roles and audit live in the Administration module.
        </span>
      </footer>
    </div>
  )
}
