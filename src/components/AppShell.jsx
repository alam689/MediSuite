import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import './shell.css'

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={`app-grid ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div className="scrim" onClick={() => setMobileOpen(false)} />
      )}
      <div className="app-main">
        <Topbar
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onToggleMobile={() => setMobileOpen((o) => !o)}
        />
        <main className="app-content">
          <div className="content-wrap">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
