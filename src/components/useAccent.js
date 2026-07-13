import { useTheme } from '../theme/ThemeContext.jsx'

/* Resolve a module accent pair { light, dark } to the active theme value. */
export function useAccent(accent) {
  const { theme } = useTheme()
  if (!accent) return 'var(--primary)'
  return theme === 'dark' ? accent.dark : accent.light
}
