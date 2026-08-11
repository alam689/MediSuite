import { useState } from 'react'
import {
  Package,
  Plus,
  Minus,
  RotateCw,
  CalendarX,
  AlertTriangle,
  Search,
} from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { usePharmacy } from './PharmacyContext.jsx'
import { daysUntil } from '../portal/format.js'

const TONE = { 'In stock': 'green', 'Low stock': 'amber', Expiring: 'rose', Delivering: 'blue' }

/* Same rule the dispense path uses — expiry outranks quantity. Kept in step
   with PharmacyQueue deliberately: two different answers to "what status is
   this shelf line" is how a count and its badge drift apart. */
function statusFor(item, qty) {
  const days = daysUntil(item.expiry)
  if (days !== null && days <= 60) return 'Expiring'
  if (qty <= Number(item.reorderLevel || 0)) return 'Low stock'
  return 'In stock'
}

const blank = { name: '', generic: '', batch: '', stock: 100, reorderLevel: 50, price: '', expiry: '' }

export default function PharmacyInventory() {
  const { branch, stock } = usePharmacy()
  const { patch, add } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')

  const needle = q.trim().toLowerCase()
  const rows = needle
    ? stock.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          String(s.generic || '').toLowerCase().includes(needle) ||
          String(s.batch || '').toLowerCase().includes(needle)
      )
    : stock

  const low = stock.filter((s) => s.status === 'Low stock')
  const expiring = stock.filter((s) => {
    const d = daysUntil(s.expiry)
    return d !== null && d <= 60
  })

  const adjust = (item, delta) => {
    const next = Math.max(0, Number(item.stock || 0) + delta)
    patch(
      'pharmacy',
      item.resourceId,
      { stock: next, status: statusFor(item, next) },
      { title: `Stock ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`, sub: `${item.name} · ${next} left` }
    )
  }

  const reorder = (item) => {
    const next = Number(item.stock || 0) + 200
    patch(
      'pharmacy',
      item.resourceId,
      { stock: next, status: statusFor(item, next) },
      { title: 'Reorder received', sub: `${item.name} · +200 units` }
    )
    toast.success('Reorder booked in (+200 units)', { title: item.name })
  }

  const addItem = () => {
    if (!draft.name.trim()) return setError('Give the medicine a name.')
    const resourceId = newId('PH')
    const qty = Number(draft.stock || 0)
    add(
      'pharmacy',
      {
        ...draft,
        resourceId,
        branch,
        stock: qty,
        status: statusFor(draft, qty),
      },
      { title: 'Stock line added', sub: `${resourceId} · ${draft.name}` }
    )
    toast.success('Added to this branch’s shelves', { title: draft.name })
    setDraft(null)
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Inventory</h1>
          <p className="pf-sub">{branch} — {stock.length} stock line(s).</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('')
            setDraft({ ...blank })
          }}
        >
          <Plus size={16} /> Add stock line
        </button>
      </header>

      {(low.length > 0 || expiring.length > 0) && (
        <div className="pf-warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <span>
            {low.length > 0 && (
              <>
                <strong>{low.length}</strong> line(s) at or below reorder level
              </>
            )}
            {low.length > 0 && expiring.length > 0 && ' · '}
            {expiring.length > 0 && (
              <>
                <strong>{expiring.length}</strong> line(s) expiring within 60 days
              </>
            )}
            . Expiring stock still dispenses — check the date before handing it over.
          </span>
        </div>
      )}

      <label style={{ display: 'block', maxWidth: 380, marginBottom: 14, position: 'relative' }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
          }}
        />
        <input
          className="pf-input"
          style={{ paddingLeft: 34 }}
          placeholder="Search medicine, generic or batch"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {rows.length === 0 ? (
        <section className="pf-panel">
          <div className="pf-panel-body">
            <p className="pf-empty">
              {stock.length === 0
                ? 'No stock recorded at this branch.'
                : `Nothing matches "${q}".`}
            </p>
          </div>
        </section>
      ) : (
        <div className="pf-grid">
          {rows.map((s) => {
            const days = daysUntil(s.expiry)
            const soon = days !== null && days <= 60
            const expired = days !== null && days < 0
            return (
              <div
                className="pf-tile"
                key={s.resourceId}
                style={{ '--tc': `var(--tone-${TONE[s.status] || 'teal'})` }}
              >
                <div className="pf-tile-top">
                  <div>
                    <div className="pf-tile-title">{s.name}</div>
                    <div className="pf-tile-sub">
                      {s.generic || 'no generic recorded'} · {s.batch || 'no batch'}
                    </div>
                  </div>
                  <span className={`pill tone-${TONE[s.status] || 'teal'}`}>{s.status}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    margin: '12px 0',
                  }}
                >
                  <button
                    className="pf-btn"
                    onClick={() => adjust(s, -1)}
                    disabled={Number(s.stock || 0) === 0}
                    aria-label={`Reduce ${s.name} by one`}
                  >
                    <Minus size={13} />
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <b
                      style={{
                        display: 'block',
                        fontSize: 25,
                        fontWeight: 800,
                        lineHeight: 1.1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.stock}
                    </b>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      units · reorder at {s.reorderLevel ?? '—'}
                    </span>
                  </div>
                  <button
                    className="pf-btn"
                    onClick={() => adjust(s, 1)}
                    aria-label={`Increase ${s.name} by one`}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <div className="pf-tile-meta">
                  <span>{s.price || 'no price'}</span>
                  <span className={expired || soon ? '' : undefined} style={soon ? { color: 'var(--tone-rose)', fontWeight: 700 } : undefined}>
                    <CalendarX size={12} />
                    {!s.expiry
                      ? 'no expiry recorded'
                      : expired
                        ? `expired ${Math.abs(days)}d ago`
                        : `expires in ${days}d`}
                  </span>
                </div>

                <div className="pf-tile-foot">
                  <button className="pf-btn ok" onClick={() => reorder(s)}>
                    <RotateCw size={13} /> Reorder +200
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Add a stock line"
        subtitle={branch}
        width={560}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={addItem}>
              <Package size={15} /> Add to shelves
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="pf-form">
              <label className="pf-field full">
                <span>Medicine (as it appears on prescriptions)</span>
                <input
                  className="pf-input"
                  value={draft.name}
                  placeholder="e.g. Atorvastatin 20mg"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Generic name</span>
                <input
                  className="pf-input"
                  value={draft.generic}
                  onChange={(e) => setDraft({ ...draft, generic: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Batch no.</span>
                <input
                  className="pf-input"
                  value={draft.batch}
                  onChange={(e) => setDraft({ ...draft, batch: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Opening stock</span>
                <input
                  className="pf-input"
                  type="number"
                  min="0"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                />
              </label>
              <label className="pf-field">
                <span>Reorder level</span>
                <input
                  className="pf-input"
                  type="number"
                  min="0"
                  value={draft.reorderLevel}
                  onChange={(e) => setDraft({ ...draft, reorderLevel: Number(e.target.value) })}
                />
              </label>
              <label className="pf-field">
                <span>Unit price</span>
                <input
                  className="pf-input"
                  value={draft.price}
                  placeholder="BDT 0.35"
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Expiry</span>
                <input
                  className="pf-input"
                  type="date"
                  value={draft.expiry}
                  onChange={(e) => setDraft({ ...draft, expiry: e.target.value })}
                />
              </label>
            </div>
            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              The medicine name is what the dispense screen matches a prescription against, so it
              should read the way prescribers write it. The generic is the fallback match and what
              makes a substitution findable.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
