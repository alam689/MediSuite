import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Mail,
  Lock,
  ArrowRight,
  Users,
  Stethoscope,
  Video,
  FlaskConical,
  Pill,
  Sparkles,
  ShieldCheck,
  BarChart3,
  HeartPulse,
  Building2,
  Store,
  Ambulance,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth, ROLES, ROLE_KEYS } from '../auth/AuthContext.jsx'
import './login.css'

const chips = [
  { icon: Users, label: 'Patients' },
  { icon: Stethoscope, label: 'Doctors' },
  { icon: Video, label: 'Telemedicine' },
  { icon: FlaskConical, label: 'Laboratory' },
  { icon: Pill, label: 'Pharmacy' },
  { icon: Sparkles, label: 'AI Assistant' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: ShieldCheck, label: 'Compliance' },
]

/* Icons live here rather than in ROLES: the auth module has no business
   importing a component library. */
const ICONS = {
  patient: HeartPulse,
  doctor: Stethoscope,
  hospital: Building2,
  pharmacy: Store,
  lab: FlaskConical,
  ambulance: Ambulance,
  admin: ShieldCheck,
}

const WORKSPACE = {
  patient: 'patient portal',
  doctor: 'doctor workspace',
  hospital: 'hospital admin desk',
  pharmacy: 'pharmacy dispensary',
  lab: 'laboratory bench',
  ambulance: 'ambulance dispatch desk',
  admin: 'administrator console',
}

const seeded = (address) => ROLE_KEYS.some((k) => ROLES[k].email === address)

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [role, setRole] = useState('patient')
  const [email, setEmail] = useState(ROLES.patient.email)
  const [password, setPassword] = useState('demo-password')

  // Swap the demo address with the role so the prefilled account always
  // matches the workspace you'd land in — unless it's been typed over.
  const pickRole = (next) => {
    setRole(next)
    setEmail((current) => (seeded(current) ? ROLES[next].email : current))
  }

  const submit = (e) => {
    e.preventDefault()
    signIn(role, email)
    navigate(ROLES[role].home)
  }

  return (
    <div className="auth">
      <div className="auth-toggle">
        <ThemeToggle />
      </div>

      {/* Left brand panel */}
      <aside className="auth-brand">
        <div className="ab-wordmark">
          <span className="ab-logo">
            <Activity size={22} />
          </span>
          Medi<strong>Suite</strong>
        </div>

        <div className="ab-hero">
          <h1 className="ab-headline">
            One platform.
            <br />
            Every part of care.
          </h1>
          <p className="ab-lede">
            AI-powered telemedicine, EMR, remote monitoring, and validated
            clinical decision support — a unified digital health infrastructure
            for hospitals, clinics, and care networks.
          </p>

          <div className="ab-chips">
            {chips.map((c) => {
              const Icon = c.icon
              return (
                <span className="ab-chip" key={c.label}>
                  <Icon size={15} />
                  {c.label}
                </span>
              )
            })}
          </div>
        </div>

        <div className="ab-trust">
          HIPAA &amp; GDPR aligned · Role-based access · Full audit trail
        </div>
      </aside>

      {/* Right form panel */}
      <main className="auth-form-panel">
        <form className="auth-card" onSubmit={submit}>
          <span className="auth-mark">
            <Activity size={24} />
          </span>
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-sub">Sign in to your MediSuite workspace</p>

          <div className="role-switch" role="radiogroup" aria-label="Sign in as">
            {ROLE_KEYS.map((key) => {
              const Icon = ICONS[key]
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={role === key}
                  className={`role-opt ${role === key ? 'on' : ''}`}
                  onClick={() => pickRole(key)}
                >
                  <Icon size={15} />
                  {ROLES[key].label}
                </button>
              )
            })}
          </div>

          <label className="field">
            <span className="field-label">Email address</span>
            <span className="field-wrap">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.health"
                autoComplete="username"
              />
            </span>
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <span className="field-wrap">
              <Lock size={17} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </span>
          </label>

          <div className="auth-row">
            <label className="remember">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <a href="#" className="forgot">
              Forgot password?
            </a>
          </div>

          <button type="submit" className="btn btn-primary auth-submit">
            Sign in <ArrowRight size={17} />
          </button>

          <p className="auth-hint">
            Demo build — any credentials continue to the {WORKSPACE[role]}. Each role sees only
            its own workspace.
          </p>
        </form>

        <p className="auth-copy">
          © 2026 MediSuite Health Systems. All rights reserved.
        </p>
      </main>
    </div>
  )
}
