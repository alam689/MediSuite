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
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'
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

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('dr.rehana@metrogeneral.health')
  const [password, setPassword] = useState('demo-password')

  const submit = (e) => {
    e.preventDefault()
    navigate('/app')
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
            Demo build — any credentials continue to the dashboard.
          </p>
        </form>

        <p className="auth-copy">
          © 2026 MediSuite Health Systems. All rights reserved.
        </p>
      </main>
    </div>
  )
}
