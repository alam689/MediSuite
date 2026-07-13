import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, LogOut, RotateCcw } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import { useData } from '../store/DataStore.jsx'
import { useToast } from './ui/Toast.jsx'

export default function Topbar({ onToggleCollapse, onToggleMobile }) {
  const navigate = useNavigate()
  const { resetAll } = useData()
  const toast = useToast()

  const resetDemo = () => {
    if (window.confirm('Reset all demo data back to the seeded records?')) {
      resetAll()
      toast.info('Demo data reset to defaults')
    }
  }

  const handleToggle = () => {
    if (window.matchMedia('(max-width: 900px)').matches) onToggleMobile()
    else onToggleCollapse()
  }

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={handleToggle} aria-label="Toggle menu">
        <Menu size={18} />
      </button>

      <label className="tb-search">
        <Search size={16} />
        <input placeholder="Search patients, doctors, records…" />
        <kbd>Ctrl K</kbd>
      </label>

      <div className="tb-right">
        <ThemeToggle />
        <button
          className="icon-btn"
          aria-label="Reset demo data"
          title="Reset demo data"
          onClick={resetDemo}
        >
          <RotateCcw size={17} />
        </button>
        <button className="icon-btn tb-bell" aria-label="Notifications">
          <Bell size={18} />
          <span className="tb-dot" />
        </button>
        <div className="tb-profile">
          <div className="tb-avatar">DR</div>
          <div className="tb-meta">
            <span className="tb-name">Dr. Rehana Karim</span>
            <span className="tb-org">Metro General Hospital</span>
          </div>
        </div>
        <button
          className="icon-btn"
          aria-label="Log out"
          title="Log out"
          onClick={() => navigate('/')}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
