import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext.jsx'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      title="Toggle theme"
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
