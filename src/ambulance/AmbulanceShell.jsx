import { LayoutGrid, Ambulance, IdCard, Route, Building2, ShieldCheck } from 'lucide-react'
import PortalShell from '../portal/PortalShell.jsx'
import { ambulanceNotifications } from '../portal/notifications.js'
import { useAmbulance, daysLeft, LICENCE_WARN_DAYS } from './AmbulanceContext.jsx'

export default function AmbulanceShell() {
  const { operator, operators, setOperator, fleet, live } = useAmbulance()

  const notifications = ambulanceNotifications({
    live,
    fleet,
    licenceWarnDays: LICENCE_WARN_DAYS,
    daysLeft,
  })

  const expiring = fleet.filter((a) => {
    const left = daysLeft(a.licenseExpiry)
    return left !== null && left <= LICENCE_WARN_DAYS
  }).length

  const nav = [
    { to: '/ambulance', end: true, icon: LayoutGrid, label: 'Overview' },
    { to: '/ambulance/fleet', icon: Ambulance, label: 'Fleet', badge: fleet.length },
    { to: '/ambulance/drivers', icon: IdCard, label: 'Drivers', badge: expiring },
    { to: '/ambulance/trips', icon: Route, label: 'Trips', badge: live.length },
  ]

  return (
    <PortalShell
      tag="Ambulance operator"
      tone="var(--tone-amber)"
      nav={nav}
      notifications={notifications}
      scope={
        <label className="pf-scope" title="The operator whose fleet you are running">
          <Building2 size={14} />
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            aria-label="Operator"
          >
            {operators.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      }
      footer={
        <>
          <ShieldCheck size={13} />
          <span>
            You are seeing <strong>{operator}</strong>'s vehicles and their trips only. Patients see
            an enlisted vehicle on the map when it is on duty — taking one off duty removes it from
            the list they can request, it does not cancel a trip already under way.
          </span>
        </>
      }
    />
  )
}
