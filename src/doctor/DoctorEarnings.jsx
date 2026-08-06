import { useMemo } from 'react'
import { Wallet, TrendingUp, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useDoctor } from './DoctorContext.jsx'
import { money, usd } from '../portal/format.js'
import { prettyDate } from '../patient/helpers.js'

const TONE = {
  Paid: 'green',
  Due: 'amber',
  Submitted: 'blue',
  'Fraud review': 'violet',
  Overdue: 'rose',
}

/* What this doctor has actually billed, and what has actually landed.

   Collected and billed are shown apart on purpose. A single "revenue"
   figure that quietly includes unpaid invoices is the most common way a
   practice earnings screen misleads the person reading it. */
export default function DoctorEarnings() {
  const { mine, name } = useDoctor()

  const invoices = mine('billing')

  const totals = useMemo(() => {
    const sum = (rows) => rows.reduce((n, r) => n + money(r.amount), 0)
    const paid = invoices.filter((i) => i.status === 'Paid')
    const outstanding = invoices.filter((i) => i.status === 'Due' || i.status === 'Overdue')
    const submitted = invoices.filter((i) => i.status === 'Submitted')
    const flagged = invoices.filter((i) => i.status === 'Fraud review')

    /* Group by month for the trend strip. Invoices with no date can't be
       placed on a timeline — they are counted in the totals and shown in a
       note, never silently dropped into the current month. */
    const byMonth = new Map()
    let undated = 0
    for (const i of invoices) {
      if (!i.date) {
        undated += 1
        continue
      }
      const key = String(i.date).slice(0, 7)
      byMonth.set(key, (byMonth.get(key) || 0) + money(i.amount))
    }

    return {
      collected: sum(paid),
      outstanding: sum(outstanding),
      inClaim: sum(submitted),
      flagged: flagged.length,
      billed: sum(invoices),
      months: [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6),
      undated,
      counts: { paid: paid.length, outstanding: outstanding.length, submitted: submitted.length },
    }
  }, [invoices])

  const peak = Math.max(1, ...totals.months.map(([, v]) => v))

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Earnings</h1>
          <p className="pf-sub">Invoices attributed to {name}.</p>
        </div>
      </header>

      <section className="pf-cards">
        <div className="pf-card">
          <div className="pf-card-head">
            <CheckCircle2 size={15} /> Collected
          </div>
          <div className="pf-card-big">{usd(totals.collected)}</div>
          <div className="pf-card-line">{totals.counts.paid} invoice(s) settled</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Clock size={15} /> Outstanding
          </div>
          <div className="pf-card-big">{usd(totals.outstanding)}</div>
          <div className="pf-card-line">{totals.counts.outstanding} due or overdue</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <TrendingUp size={15} /> In claim
          </div>
          <div className="pf-card-big">{usd(totals.inClaim)}</div>
          <div className="pf-card-line">{totals.counts.submitted} with insurers</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <Wallet size={15} /> Billed total
          </div>
          <div className="pf-card-big">{usd(totals.billed)}</div>
          <div className="pf-card-line">across {invoices.length} invoice(s)</div>
        </div>
      </section>

      {totals.months.length > 0 && (
        <section className="pf-panel" style={{ marginBottom: 14 }}>
          <div className="pf-panel-head">
            <TrendingUp size={15} /> Billed by month
            <span className="count">last {totals.months.length}</span>
          </div>
          <div className="pf-panel-body" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
              {totals.months.map(([month, value]) => (
                <div key={month} style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      height: `${Math.round((value / peak) * 96)}px`,
                      minHeight: 4,
                      borderRadius: '6px 6px 0 0',
                      background: 'var(--primary)',
                      opacity: 0.85,
                    }}
                    title={`${month}: ${usd(value)}`}
                  />
                  <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
                    {month.slice(5)}/{month.slice(2, 4)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{usd(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Wallet size={15} /> Invoices
          <span className="count">{invoices.length}</span>
        </div>
        <div className="pf-panel-body">
          {invoices.length === 0 && (
            <p className="pf-empty">Nothing has been billed against your name yet.</p>
          )}
          {invoices.map((i) => (
            <div className="pf-row" key={i.resourceId}>
              <div>
                <div className="pf-row-title">
                  {i.party} — {i.amount}
                </div>
                <div className="pf-row-sub">
                  {i.category}
                  {i.hospital ? ` · ${i.hospital}` : ''}
                  {i.date ? ` · ${prettyDate(i.date)}` : ' · no date recorded'} · {i.resourceId}
                </div>
              </div>
              <span className={`pill tone-${TONE[i.status] || 'teal'}`}>{i.status}</span>
            </div>
          ))}
        </div>
      </section>

      {totals.flagged > 0 && (
        <p className="pf-note">
          <AlertTriangle size={14} />
          {totals.flagged} invoice(s) attributed to you are under fraud review. They are counted in
          the billed total but not in collected, and finance will contact you before anything is
          paid out.
        </p>
      )}
      {totals.undated > 0 && (
        <p className="pf-note">
          <Clock size={14} />
          {totals.undated} invoice(s) have no issue date, so they appear in the totals but not in the
          monthly chart. That is a data gap, not a zero month.
        </p>
      )}
    </>
  )
}
