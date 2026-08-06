import { useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Check,
  ShieldAlert,
} from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useHospital } from './HospitalContext.jsx'
import { money, usd } from '../portal/format.js'
import { prettyDate } from '../patient/helpers.js'

const TONE = {
  Paid: 'green',
  Due: 'amber',
  Submitted: 'blue',
  'Fraud review': 'violet',
  Overdue: 'rose',
}

/* Facility revenue.

   Collected and billed are shown apart, for the same reason as on the
   doctor's earnings page: a single "revenue" number that includes money
   nobody has paid is the most common way this screen lies. */
export default function HospitalRevenue() {
  const { facilityLabel, isAll, invoices, departments } = useHospital()
  const { patch } = useData()
  const toast = useToast()

  const totals = useMemo(() => {
    const sum = (rows) => rows.reduce((n, r) => n + money(r.amount), 0)
    const by = (...s) => invoices.filter((i) => s.includes(i.status))

    const byCategory = new Map()
    for (const i of invoices) {
      byCategory.set(i.category, (byCategory.get(i.category) || 0) + money(i.amount))
    }

    return {
      billed: sum(invoices),
      collected: sum(by('Paid')),
      outstanding: sum(by('Due', 'Overdue')),
      inClaim: sum(by('Submitted')),
      flagged: by('Fraud review'),
      overdue: by('Overdue'),
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [invoices])

  const peak = Math.max(1, ...totals.categories.map(([, v]) => v))

  /* Every tariff the facility publishes, so a biller can see what a service
     should cost next to what was actually charged. */
  const tariffCount = departments.reduce((n, d) => n + (d.services?.length || 0), 0)

  const markPaid = (i) => {
    patch('billing', i.resourceId, { status: 'Paid' }, {
      title: 'Payment recorded',
      sub: `${i.resourceId} · ${i.party} · ${i.amount}`,
    })
    toast.success('Payment recorded', { title: i.party })
  }

  return (
    <>
      <header className="hs-head">
        <div>
          <h1 className="hs-title">Revenue</h1>
          <p className="hs-sub">
            Invoices raised at {facilityLabel} · {tariffCount} published tariff(s).
          </p>
        </div>
      </header>

      <section className="hs-cards">
        <div className="hs-card">
          <div className="hs-card-head">
            <CheckCircle2 size={15} /> Collected
          </div>
          <div className="hs-card-big">{usd(totals.collected)}</div>
          <div className="hs-card-line">settled and banked</div>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Clock size={15} /> Outstanding
          </div>
          <div className="hs-card-big">{usd(totals.outstanding)}</div>
          <div className="hs-card-line">
            {totals.overdue.length} invoice(s) overdue
          </div>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <TrendingUp size={15} /> With insurers
          </div>
          <div className="hs-card-big">{usd(totals.inClaim)}</div>
          <div className="hs-card-line">claims submitted, unpaid</div>
        </div>
        <div className="hs-card">
          <div className="hs-card-head">
            <Wallet size={15} /> Billed total
          </div>
          <div className="hs-card-big">{usd(totals.billed)}</div>
          <div className="hs-card-line">{invoices.length} invoice(s)</div>
        </div>
      </section>

      {totals.categories.length > 0 && (
        <section className="hs-panel" style={{ marginBottom: 14 }}>
          <div className="hs-panel-head">
            <TrendingUp size={15} /> Billed by category
          </div>
          <div className="hs-panel-body" style={{ padding: 16 }}>
            {totals.categories.map(([cat, value]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{cat}</span>
                  <strong>{usd(value)}</strong>
                </div>
                <div
                  style={{
                    height: 7,
                    borderRadius: 999,
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((value / peak) * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'var(--primary)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totals.flagged.length > 0 && (
        <div className="hs-warn" style={{ marginBottom: 14 }}>
          <ShieldAlert size={16} />
          <span>
            <strong>{totals.flagged.length} invoice(s) under fraud review</strong> totalling{' '}
            {usd(totals.flagged.reduce((n, i) => n + money(i.amount), 0))}. These are counted in the
            billed total and excluded from collected. They cannot be settled from this desk — the
            platform administrator clears the flag first.
          </span>
        </div>
      )}

      <section className="hs-panel">
        <div className="hs-panel-head">
          <Wallet size={15} /> Invoices
          <span className="count">{invoices.length}</span>
        </div>
        <div className="hs-panel-body">
          {invoices.length === 0 && (
            <p className="hs-empty">Nothing has been billed at {facilityLabel}.</p>
          )}
          {invoices.map((i) => (
            <div className="hs-row" key={i.resourceId}>
              <span className={`hs-dot tone-${TONE[i.status] || 'teal'}`} />
              <div>
                <div className="hs-row-title">
                  {i.party} — {i.amount}
                </div>
                <div className="hs-row-sub">
                  {i.category}
                  {i.doctor ? ` · ${i.doctor}` : ''}
                  {i.date ? ` · ${prettyDate(i.date)}` : ' · no date'} · {i.resourceId}
                  {isAll && i.hospital && <span className="hs-site"> {i.hospital}</span>}
                </div>
              </div>
              <div className="hs-row-actions">
                <span className={`pill tone-${TONE[i.status] || 'teal'}`}>{i.status}</span>
                {i.status !== 'Paid' && i.status !== 'Fraud review' && (
                  <button className="hs-btn ok" onClick={() => markPaid(i)}>
                    <Check size={13} /> Mark paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="hs-note">
        <AlertTriangle size={13} />
        Only invoices carrying this facility's name appear here. A charge raised without a facility
        belongs to no site's ledger and will not be counted in any of these figures — the
        administrator console lists them.
      </p>
    </>
  )
}
