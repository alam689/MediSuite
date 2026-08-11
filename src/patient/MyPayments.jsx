import { useState } from 'react'
import { Wallet, CreditCard, CheckCircle2, Receipt } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { usePatient } from './PatientContext.jsx'

const TONE = { Paid: 'green', Due: 'amber', Submitted: 'blue', Overdue: 'rose', 'Fraud review': 'violet' }

const STATUS_TEXT = {
  Paid: 'Paid',
  Due: 'Due',
  Submitted: 'With your insurer',
  Overdue: 'Overdue',
  'Fraud review': 'Under review',
}

const amountOf = (s) => Number(String(s || '').replace(/[^0-9.]/g, '')) || 0

export default function MyPayments() {
  const { name, mine } = usePatient()
  const { patch } = useData()
  const toast = useToast()
  const [paying, setPaying] = useState(null)

  const invoices = mine('billing')
  const outstanding = invoices.filter((i) => i.status === 'Due' || i.status === 'Overdue')
  const total = outstanding.reduce((sum, i) => sum + amountOf(i.amount), 0)

  const pay = () => {
    const inv = paying
    setPaying(null)
    patch('billing', inv.resourceId, { status: 'Paid' }, {
      title: 'Payment received from patient',
      sub: `${name} · ${inv.amount}`,
    })
    toast.success(`Paid ${inv.amount}`, { title: inv.resourceId })
  }

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Payments</h1>
          <p className="pt-sub">Your invoices and balances.</p>
        </div>
      </header>

      <section className="pt-cards" style={{ marginBottom: 20 }}>
        <div className="pt-card">
          <div className="pt-card-head">
            <Wallet size={16} /> Outstanding
          </div>
          <div className="pt-card-big">BDT {total.toLocaleString()}</div>
          <div className="pt-card-line muted">
            {outstanding.length === 0
              ? 'Nothing to pay right now.'
              : `across ${outstanding.length} invoice${outstanding.length > 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="pt-card">
          <div className="pt-card-head">
            <Receipt size={16} /> Invoices
          </div>
          <div className="pt-card-big">{invoices.length}</div>
          <div className="pt-card-line muted">total on your account</div>
        </div>
        <div className="pt-card">
          <div className="pt-card-head">
            <CheckCircle2 size={16} /> Paid
          </div>
          <div className="pt-card-big">{invoices.filter((i) => i.status === 'Paid').length}</div>
          <div className="pt-card-line muted">settled</div>
        </div>
      </section>

      <section className="pt-panel">
        <div className="pt-panel-head">
          <Receipt size={16} /> My invoices
          <span className="count">{invoices.length}</span>
        </div>
        <div className="pt-panel-body">
          {invoices.length === 0 && <p className="pt-empty">No invoices on your account.</p>}
          {invoices.map((i) => (
            <div className="pt-row" key={i.resourceId}>
              <div>
                <div className="pt-row-title">
                  {i.category} · {i.amount}
                </div>
                <div className="pt-row-sub">{i.resourceId}</div>
              </div>
              <div className="pt-row-right">
                <span className={`pill tone-${TONE[i.status] || 'teal'}`}>
                  {STATUS_TEXT[i.status] || i.status}
                </span>
                {(i.status === 'Due' || i.status === 'Overdue') && (
                  <button className="btn btn-primary" style={{ height: 34 }} onClick={() => setPaying(i)}>
                    Pay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title="Confirm payment"
        subtitle={paying?.resourceId}
        width={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPaying(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={pay}>
              <CreditCard size={15} /> Pay {paying?.amount}
            </button>
          </>
        }
      >
        {paying && (
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <p>
              Paying <strong style={{ color: 'var(--text)' }}>{paying.amount}</strong> for{' '}
              {paying.category.toLowerCase()}.
            </p>
            <p
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 12.5,
                background: 'color-mix(in srgb, var(--tone-amber) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--tone-amber) 24%, transparent)',
              }}
            >
              <strong style={{ color: 'var(--text)' }}>Demo only.</strong> No card is collected and no
              money moves. A real build hands off to a payment provider and only marks the invoice
              paid on a signed server-to-server webhook — never on the browser saying so
              (blueprint §22.2).
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
