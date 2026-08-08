import { Link } from 'react-router-dom'
import {
  LayoutGrid,
  CalendarClock,
  Video,
  FileText,
  Pill,
  FlaskConical,
  Wallet,
  BarChart3,
  BookUser,
  ShieldCheck,
} from 'lucide-react'
import PortalShell from '../portal/PortalShell.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { firstName } from '../portal/format.js'
import { doctorNotifications } from '../portal/notifications.js'

/* A clinician's nav is their working day in order — what is happening now,
   what is booked, who they look after, then the paperwork each of those
   generates. Not the administrator's module list. */
export default function DoctorShell() {
  const { me, name, mine } = useDoctor()

  const consults = mine('telemedicine')
  const notes = mine('emr')
  const prescriptions = mine('prescriptions')
  const labs = mine('laboratory')

  /* Badges count work that is waiting on this doctor specifically. Anything
     else would train people to ignore them. */
  const waiting = consults.filter((c) => c.status === 'Waiting' || c.status === 'Live').length
  const unsigned = notes.filter((r) => r.status !== 'Signed').length
  const refills = prescriptions.filter(
    (r) => r.status === 'Refill' || r.status === 'Interaction' || r.status === 'Allergy'
  ).length
  const results = labs.filter(
    (l) => l.status === 'Abnormal' || l.status === 'Ready to approve'
  ).length

  const notifications = doctorNotifications({
    consults,
    appointments: mine('appointments'),
    notes,
    prescriptions,
    labs,
    vitals: mine('rpm'),
  })

  const nav = [
    { to: '/doctor', end: true, icon: LayoutGrid, label: 'Today' },
    { to: '/doctor/schedule', icon: CalendarClock, label: 'Schedule' },
    { to: '/doctor/rx-patients', icon: BookUser, label: 'Patient list' },
    { to: '/doctor/consults', icon: Video, label: 'Consults', badge: waiting },
    { to: '/doctor/notes', icon: FileText, label: 'Notes', badge: unsigned },
    { to: '/doctor/prescriptions', icon: Pill, label: 'Prescriptions', badge: refills },
    { to: '/doctor/labs', icon: FlaskConical, label: 'Lab orders', badge: results },
    { to: '/doctor/earnings', icon: Wallet, label: 'Earnings' },
    { to: '/doctor/reports', icon: BarChart3, label: 'Reports' },
  ]

  return (
    <PortalShell
      tag="Doctor"
      tone="var(--tone-teal)"
      nav={nav}
      notifications={notifications}
      who={
        <Link to="/doctor/profile" className="pf-who" title={`${name} — profile & availability`}>
          <Avatar name={name} src={me?.photo} size={30} />
          <span className="pf-who-name">{firstName(name)}</span>
        </Link>
      }
      footer={
        <>
          <ShieldCheck size={13} />
          <span>
            You are seeing <strong>your own caseload</strong> — patients you have an appointment,
            consultation, note or admission with. Opening a record you are not treating is a
            break-glass action and is audited.
          </span>
        </>
      }
    />
  )
}
