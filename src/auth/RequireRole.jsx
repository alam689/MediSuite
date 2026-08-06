import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, ROLES } from './AuthContext.jsx'

/* Route guard. No session → the login screen. Wrong role → that role's own
   home, not a dead end: a pharmacist who bookmarked /lab should land
   somewhere they can work, not on an error.

   This is navigation, not security. It keeps roles out of each other's
   workspaces; it does not keep data out of the browser. */
export default function RequireRole({ roles, children }) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  const allowed = Array.isArray(roles) ? roles : [roles]
  if (!allowed.includes(session.role)) {
    return <Navigate to={ROLES[session.role]?.home || '/'} replace />
  }

  return children
}
