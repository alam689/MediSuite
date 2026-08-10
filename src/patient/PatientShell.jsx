import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Home,
  Stethoscope,
  Video,
  FileText,
  Ambulance,
  Wallet,
  UserRound,
  LogOut,
  Phone,
  BedDouble,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import NotificationBell from '../portal/NotificationBell.jsx'
import { patientNotifications } from '../portal/notifications.js'
import { usePatient, firstName } from './PatientContext.jsx'
import './patient.css'

/* Patients get a short, plain-language nav — not the clinician's 13-module
   sidebar. Everything here is something a patient does, named the way they
   would name it. */
const NAV = [
  { to: '/patient', end: true, icon: Home, label: 'Home' },
  { to: '/patient/doctors', icon: Stethoscope, label: 'Find a doctor' },
  { to: '/patient/beds', icon: BedDouble, label: 'Critical care' },
  { to: '/patient/ambulance', icon: Ambulance, label: 'Ambulance' },
  { to: '/patient/consult', icon: Video, label: 'Consultation' },
  { to: '/patient/records', icon: FileText, label: 'My records' },
  { to: '/patient/payments', icon: Wallet, label: 'Payments' },
  { to: '/patient/profile', icon: UserRound, label: 'Profile' },
]

export default function PatientShell() {
  const navigate = useNavigate()
  const { signOut, role } = useAuth()
  const { me, name, mine } = usePatient()

  const logout = () => {
    signOut()
    navigate('/', { replace: true })
  }

  /* Same builder the rest of the app uses, so the bell and the home page
     can never disagree about what is waiting. */
  const notifications = patientNotifications({
    appointments: mine('appointments'),
    consults: mine('telemedicine'),
    prescriptions: mine('prescriptions'),
    labs: mine('laboratory'),
    invoices: mine('billing'),
  })

  return (
    <div className="pt-shell">
      <header className="pt-top">
        <div className="pt-top-in">
          <div className="pt-brand">
            <span className="pt-logo">
              <Activity size={19} />
            </span>
            Medi<strong>Suite</strong>
            <span className="pt-brand-tag">Patient</span>
          </div>

          <nav className="pt-nav">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `pt-nav-link ${isActive ? 'on' : ''}`}
                >
                  <Icon size={15} />
                  {n.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="pt-top-right">
            <NotificationBell role={role} items={notifications} />
            <ThemeToggle />
            <span className="pt-who" title={name}>
              <Avatar name={name} size={30} />
              <span className="pt-who-name">{firstName(name)}</span>
            </span>
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-main">
        <div className="pt-wrap fade-in">
          {me ? (
            <Outlet />
          ) : (
            <div className="card pt-empty-card">
              <h2>No patient record found</h2>
              <p>Reset the demo data from the clinician workspace to restore the seeded patients.</p>
            </div>
          )}
        </div>
      </main>

      {/* The blueprint (§18.5) requires this to be unmissable, and to avoid
          inventing a global emergency number for an unknown jurisdiction. */}
      <footer className="pt-emergency">
        <Phone size={14} />
        <span>
          <strong>Not for emergencies.</strong> If this is urgent — chest pain, trouble breathing,
          severe bleeding — stop and contact your local emergency service now.
        </span>
      </footer>
    </div>
  )
}
