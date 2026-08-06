import { LayoutGrid, ClipboardList, Package, Truck, Store, ShieldCheck } from 'lucide-react'
import PortalShell from '../portal/PortalShell.jsx'
import { pharmacyNotifications } from '../portal/notifications.js'
import { usePharmacy } from './PharmacyContext.jsx'

export default function PharmacyShell() {
  const { branch, branches, setBranch, queue, blocked, deliveries, stock, stockFor } = usePharmacy()

  const notifications = pharmacyNotifications({ queue, blocked, deliveries, stock, stockFor })

  const lowStock = stock.filter((s) => s.status === 'Low stock' || s.status === 'Expiring').length
  const outForDelivery = deliveries.filter((d) => d.status === 'Dispensed').length

  const nav = [
    { to: '/pharmacy', end: true, icon: LayoutGrid, label: 'Overview' },
    { to: '/pharmacy/queue', icon: ClipboardList, label: 'Prescriptions', badge: queue.length },
    { to: '/pharmacy/inventory', icon: Package, label: 'Inventory', badge: lowStock },
    { to: '/pharmacy/deliveries', icon: Truck, label: 'Deliveries', badge: outForDelivery },
  ]

  return (
    <PortalShell
      tag="Pharmacy"
      tone="var(--tone-green)"
      nav={nav}
      notifications={notifications}
      scope={
        <label className="pf-scope" title="The dispensary you are working at">
          <Store size={14} />
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Dispensary">
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      }
      footer={
        <>
          <ShieldCheck size={13} />
          <span>
            You are seeing <strong>{branch}</strong> only — its queue and its shelves. A
            prescription is visible here because the prescriber routed it to this dispensary and
            the patient's consent allows it.
          </span>
        </>
      }
    />
  )
}
