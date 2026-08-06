import { Link } from 'react-router-dom'
import {
  TestTube,
  Microscope,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { relTime } from '../store/DataStore.jsx'
import { useLab } from './LabContext.jsx'
import { labNotifications } from '../portal/notifications.js'

export default function LabHome() {
  const { lab, buckets, prioritised, unrouted, orders } = useLab()

  const { awaitingSample, collected, onBench, reported, released } = buckets

  /* Same list the bell shows, from the same builder. */
  const attention = labNotifications(buckets)

  const stat = prioritised([...awaitingSample, ...collected, ...onBench]).filter(
    (o) => o.priority === 'STAT' || o.priority === 'Urgent'
  )

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">{lab}</h1>
          <p className="pf-sub">Intake, bench and reporting for this laboratory.</p>
        </div>
        <Link to="/lab/orders" className="btn btn-primary">
          <TestTube size={16} /> Open intake
        </Link>
      </header>

      <section className="pf-cards">
        <div className="pf-card">
          <div className="pf-card-head">
            <TestTube size={15} /> To collect
          </div>
          <div className="pf-card-big">{awaitingSample.length}</div>
          <div className="pf-card-line">{collected.length} in transit to the bench</div>
          <Link to="/lab/orders" className="pf-card-link">
            Intake <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Microscope size={15} /> On the bench
          </div>
          <div className="pf-card-big">{onBench.length}</div>
          <div className="pf-card-line">received, awaiting a result</div>
          <Link to="/lab/bench" className="pf-card-link">
            Run <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <FileCheck size={15} /> With the clinician
          </div>
          <div className="pf-card-big">{reported.length}</div>
          <div className="pf-card-line">reported, awaiting release</div>
          <Link to="/lab/reports" className="pf-card-link">
            Reports <ArrowRight size={13} />
          </Link>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <CheckCircle2 size={15} /> Released
          </div>
          <div className="pf-card-big">{released.length}</div>
          <div className="pf-card-line">of {orders.length} order(s) total</div>
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
                Everything is inside its turnaround target.
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
            <Clock size={15} /> Urgent &amp; STAT in progress
            <span className="count">{stat.length}</span>
          </div>
          <div className="pf-panel-body">
            {stat.length === 0 && <p className="pf-empty">Nothing urgent in progress.</p>}
            {stat.map((o) => (
              <div className="pf-row" key={o.resourceId}>
                <span className={`pf-dot tone-${o.priority === 'STAT' ? 'rose' : 'amber'}`} />
                <div>
                  <div className="pf-row-title">
                    {o.test} — {o.patient}
                  </div>
                  <div className="pf-row-sub">
                    {o.status}
                    {o.orderedAt && ` · ordered ${relTime(o.orderedAt)}`} · {o.doctor}
                  </div>
                </div>
                <span className={`pill tone-${o.priority === 'STAT' ? 'rose' : 'amber'}`}>
                  {o.priority}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {unrouted.length > 0 && (
        <p className="pf-note">
          <AlertTriangle size={14} />
          {unrouted.length} lab order(s) platform-wide name no laboratory. They are on no bench's
          worklist and nobody is running them.
        </p>
      )}
    </>
  )
}
