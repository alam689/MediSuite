import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Settings,
  LifeBuoy,
  Activity as Logo,
} from 'lucide-react'
import { modules } from '../data/modules.js'

export default function Sidebar({ collapsed, mobileOpen, onNavigate }) {
  return (
    <aside className={`sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <div className="sb-brand">
        <span className="sb-logo">
          <Logo size={20} />
        </span>
        {!collapsed && (
          <span className="sb-wordmark">
            Medi<strong>Suite</strong>
          </span>
        )}
      </div>

      <nav className="sb-nav">
        {!collapsed && <div className="sb-section">MENU</div>}
        <NavLink
          to="/app"
          end
          className="sb-link"
          onClick={onNavigate}
          title="Dashboard"
        >
          <LayoutDashboard size={19} />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        {!collapsed && <div className="sb-section">MODULES</div>}
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <NavLink
              key={m.key}
              to={`/app/m/${m.key}`}
              className="sb-link"
              onClick={onNavigate}
              title={m.label}
            >
              <Icon size={19} />
              {!collapsed && <span>{m.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sb-foot">
        <a className="sb-link" href="#" title="Settings">
          <Settings size={19} />
          {!collapsed && <span>Settings</span>}
        </a>
        <a className="sb-link" href="#" title="Help & Support">
          <LifeBuoy size={19} />
          {!collapsed && <span>Help &amp; Support</span>}
        </a>
      </div>
    </aside>
  )
}
