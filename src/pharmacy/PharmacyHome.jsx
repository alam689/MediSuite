import { Link } from 'react-router-dom'
import {
  ClipboardList,
  Package,
  Truck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { usePharmacy } from './PharmacyContext.jsx'
import { money, usd } from '../portal/format.js'
import { pharmacyNotifications } from '../portal/notifications.js'

export default function PharmacyHome() {
  const { branch, queue, blocked, history, unrouted, stock, deliveries, stockFor } = usePharmacy()

  const toVerify = queue.filter((r) => r.status === 'Issued')
  const toFill = queue.filter((r) => r.status === 'Verified' || r.status === 'Partially dispensed')
  const readyToDispatch = deliveries.filter((d) => d.status === 'Dispensed')

  /* Shelf value, so a branch manager has one number for what is sitting
     there. Lines with no price contribute nothing and are called out below
     rather than silently treated as free. */
  const unpriced = stock.filter((s) => !s.price).length
  const shelfValue = stock.reduce((n, s) => n + money(s.price) * Number(s.stock || 0), 0)

  /* Same list the bell shows, from the same builder — a shortfall that turns
     into a phone call must not appear in one place and not the other. */
  const attention = pharmacyNotifications({ queue, blocked, deliveries, stock, stockFor })

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">{branch}</h1>
          <p className="pf-sub">Dispensing queue, shelves and deliveries for this branch.</p>
        </div>
        <Link to="/pharmacy/queue" className="btn btn-primary">
          <ClipboardList size={16} /> Open queue
        </Link>
      </header>

      <section className="pf-cards">
        <div className="pf-card">
          <div className="pf-card-head">
            <ClipboardList size={15} /> To verify
          </div>
          <div className="pf-card-big">{toVerify.length}</div>
          <div className="pf-card-line">new scripts arrived</div>
          <Link to="/pharmacy/queue" className="pf-card-link">
            Verify <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Package size={15} /> To fill
          </div>
          <div className="pf-card-big">{toFill.length}</div>
          <div className="pf-card-line">verified and waiting</div>
          <Link to="/pharmacy/queue" className="pf-card-link">
            Dispense <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Truck size={15} /> To dispatch
          </div>
          <div className="pf-card-big">{readyToDispatch.length}</div>
          <div className="pf-card-line">packed home deliveries</div>
          <Link to="/pharmacy/deliveries" className="pf-card-link">
            Dispatch <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Package size={15} /> Shelf value
          </div>
          <div className="pf-card-big">{usd(shelfValue)}</div>
          <div className="pf-card-line">
            {stock.length} line(s)
            {unpriced > 0 ? ` · ${unpriced} unpriced` : ''}
          </div>
          <Link to="/pharmacy/inventory" className="pf-card-link">
            Inventory <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      <div className="pf-two">
        <section className="pf-panel">
          <div className="pf-panel-head">
            <AlertTriangle size={15} /> Needs attention
            <span className="count">{attention.length}</span>
          </div>
          <div className="pf-panel-body">
            {attention.length === 0 && (
              <p className="pf-empty">
                <CheckCircle2 size={22} />
                Nothing needs you right now.
              </p>
            )}
            {attention.map((n) => (
              <Link className="pf-row" key={n.id} to={n.to}>
                <span className={`pf-dot tone-${n.tone}`} />
                <div>
                  <div className="pf-row-title">{n.title}</div>
                  <div className="pf-row-sub">{n.sub}</div>
                </div>
                <ArrowRight size={15} className="pf-row-go" />
              </Link>
            ))}
          </div>
        </section>

        <section className="pf-panel">
          <div className="pf-panel-head">
            <CheckCircle2 size={15} /> Recently completed
            <span className="count">{history.length}</span>
          </div>
          <div className="pf-panel-body">
            {history.length === 0 && <p className="pf-empty">Nothing dispensed here yet.</p>}
            {history.slice(0, 8).map((r) => (
              <div className="pf-row" key={r.resourceId}>
                <div>
                  <div className="pf-row-title">
                    {r.drug} — {r.patient}
                  </div>
                  <div className="pf-row-sub">
                    {r.dispensedQty || 0} of {r.qty} unit(s) · {r.fulfilment}
                  </div>
                </div>
                <span className={`pill tone-${r.status === 'Rejected' ? 'rose' : 'green'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {unrouted.length > 0 && (
        <p className="pf-note">
          <AlertTriangle size={14} />
          {unrouted.length} prescription(s) platform-wide have no dispensary set. They are in
          nobody's queue — not this branch's to fix, but worth telling an administrator about.
        </p>
      )}
    </>
  )
}
