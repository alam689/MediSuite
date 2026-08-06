import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Activity, LogOut } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import './portal.css'

/* =====================================================================
   The frame every stakeholder portal shares: brand, nav, scope selector,
   theme, identity, sign-out, and a footer that states the boundary of what
   this role can see.

   Props:
     tag    — role badge text ("Doctor", "Pharmacy")
     tone   — CSS token name for the badge colour
     nav    — [{ to, end, icon, label, badge }]
     scope  — optional node rendered left of the theme toggle (branch picker)
     who    — optional node for the signed-in identity
     notifications — items from portal/notifications.js for this role
     footer — the boundary statement; every portal owes the user one
   ===================================================================== */
export default function PortalShell({
  tag,
  tone = 'var(--primary)',
  nav = [],
  scope,
  who,
  notifications,
  footer,
}) {
  const navigate = useNavigate()
  const { signOut, role } = useAuth()

  const logout = () => {
    signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="pf-shell">
      <header className="pf-top">
        <div className="pf-top-in">
          <div className="pf-brand">
            <span className="pf-logo">
              <Activity size={19} />
            </span>
            Medi<strong>Suite</strong>
            <span className="pf-tag" style={{ '--tc': tone }}>
              {tag}
            </span>
          </div>

          <nav className="pf-nav">
            {nav.map((n) => {
              const Icon = n.icon
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `pf-nav-link ${isActive ? 'on' : ''}`}
                >
                  <Icon size={15} />
                  {n.label}
                  {/* A count only earns a badge when it is work waiting. */}
                  {n.badge > 0 && <span className="pf-nav-badge">{n.badge}</span>}
                </NavLink>
              )
            })}
          </nav>

          <div className="pf-top-right">
            {scope}
            {notifications && <NotificationBell role={role} items={notifications} />}
            <ThemeToggle />
            {who}
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="pf-main">
        <div className="pf-wrap fade-in">
          <Outlet />
        </div>
      </main>

      {footer && <footer className="pf-foot">{footer}</footer>}
    </div>
  )
}
