import { LayoutGrid, TestTube, Microscope, FileCheck, FlaskConical, ShieldCheck } from 'lucide-react'
import PortalShell from '../portal/PortalShell.jsx'
import { labNotifications } from '../portal/notifications.js'
import { useLab } from './LabContext.jsx'

export default function LabShell() {
  const { lab, labs, setLab, buckets } = useLab()

  const notifications = labNotifications(buckets)

  const nav = [
    { to: '/lab', end: true, icon: LayoutGrid, label: 'Overview' },
    {
      to: '/lab/orders',
      icon: TestTube,
      label: 'Intake',
      badge: buckets.awaitingSample.length + buckets.collected.length,
    },
    { to: '/lab/bench', icon: Microscope, label: 'Bench', badge: buckets.onBench.length },
    { to: '/lab/reports', icon: FileCheck, label: 'Reports' },
  ]

  return (
    <PortalShell
      tag="Laboratory"
      tone="var(--tone-violet)"
      nav={nav}
      notifications={notifications}
      scope={
        <label className="pf-scope" title="The laboratory you are working at">
          <FlaskConical size={14} />
          <select value={lab} onChange={(e) => setLab(e.target.value)} aria-label="Laboratory">
            {labs.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      }
      footer={
        <>
          <ShieldCheck size={13} />
          <span>
            You are seeing <strong>{lab}</strong> only. This bench verifies results; the
            <strong> requesting clinician releases them</strong> to the patient — nothing here can
            do that on their behalf.
          </span>
        </>
      }
    />
  )
}
