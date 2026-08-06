import { useMemo, useState } from 'react'
import { Pill, Plus, ShieldAlert, Check, CheckCircle2, Store, Truck } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'
import { PHARMACIES } from '../data/schemas.js'

const TONE = {
  Issued: 'green',
  Verified: 'teal',
  'Partially dispensed': 'amber',
  Dispensed: 'blue',
  'Out for delivery': 'violet',
  Delivered: 'green',
  Refill: 'violet',
  Interaction: 'rose',
  Allergy: 'rose',
  Rejected: 'rose',
}

/* A deliberately small, visible interaction table.

   This is NOT a drug database and must never be mistaken for one. A real
   build calls a maintained interaction service (blueprint §5.7) and fails
   *closed* — no answer means no prescription. What this does is prove the
   workflow: the check runs before the script is written, its result is
   shown to the prescriber, and overriding it is a recorded decision rather
   than a silent one. Missing pairs are a known limitation, stated in the UI.
*/
const INTERACTIONS = [
  { a: 'warfarin', b: 'aspirin', note: 'Markedly increased bleeding risk.' },
  { a: 'warfarin', b: 'ibuprofen', note: 'NSAID with anticoagulant — bleeding risk.' },
  { a: 'warfarin', b: 'amoxicillin', note: 'Antibiotics can potentiate warfarin; monitor INR.' },
  { a: 'metformin', b: 'prednisolone', note: 'Steroid opposes glycaemic control.' },
  { a: 'atorvastatin', b: 'clarithromycin', note: 'Raised statin levels — myopathy risk.' },
  { a: 'levothyroxine', b: 'ferrous', note: 'Iron reduces levothyroxine absorption; separate doses.' },
  { a: 'bisoprolol', b: 'verapamil', note: 'Combined AV nodal blockade — bradycardia risk.' },
]

const has = (text, token) => String(text || '').toLowerCase().includes(token)

/* What is unsafe about giving this drug to this patient, on what we hold. */
function safetyCheck(drug, patient) {
  const name = String(drug || '').toLowerCase()
  const findings = []
  if (!name.trim() || !patient) return findings

  /* Allergies are free text in the patient record, so match on word stems
     rather than equality — "Penicillin" must catch "Amoxicillin" only if the
     record says so, and it doesn't, which is exactly why this is a stub. */
  const allergies = String(patient.allergies || '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'none recorded')

  for (const a of allergies) {
    const stem = a.split(/\s+/)[0]
    if (stem.length > 3 && name.includes(stem)) {
      findings.push({ kind: 'Allergy', text: `Patient is recorded as allergic to ${a}.` })
    }
  }

  const current = (patient.medications || []).map((m) => String(m.name || '').toLowerCase())
  for (const rule of INTERACTIONS) {
    const newIsA = name.includes(rule.a)
    const newIsB = name.includes(rule.b)
    if (!newIsA && !newIsB) continue
    const other = newIsA ? rule.b : rule.a
    if (current.some((c) => c.includes(other))) {
      findings.push({ kind: 'Interaction', text: `With ${other}: ${rule.note}` })
    }
  }
  return findings
}

const blank = {
  drug: '',
  patient: '',
  dosage: '',
  qty: 30,
  days: 30,
  refills: 0,
  pharmacy: PHARMACIES[0],
  fulfilment: 'Collect in store',
  instructions: '',
}

export default function DoctorPrescribe() {
  const { mine, panel, filedAs, me } = useDoctor()
  const { add, patch } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [override, setOverride] = useState(false)

  const rows = mine('prescriptions')
  const holds = rows.filter(
    (r) => r.status === 'Interaction' || r.status === 'Allergy' || r.status === 'Refill'
  )

  const patient = useMemo(
    () => panel.find((p) => p.name === draft?.patient) || null,
    [panel, draft]
  )
  const findings = useMemo(() => safetyCheck(draft?.drug, patient), [draft, patient])

  const openNew = () => {
    setError('')
    setOverride(false)
    setDraft({ ...blank, patient: panel[0]?.name || '' })
  }

  const field = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (key === 'drug' || key === 'patient') setOverride(false)
  }

  const issue = () => {
    if (!draft.drug.trim()) return setError('Enter the medication.')
    if (!draft.patient.trim()) return setError('Choose the patient.')
    if (findings.length && !override) {
      return setError('Acknowledge the safety findings below, or change the prescription.')
    }

    /* A flagged script is issued on hold, not blocked outright: the
       prescriber may have a good reason, and the pharmacy must see that the
       flag was raised and consciously accepted. */
    const flagged = findings[0]?.kind
    const resourceId = newId('RX')
    add(
      'prescriptions',
      {
        ...draft,
        resourceId,
        doctor: filedAs,
        doctorId: me?.resourceId,
        patientId: patient?.resourceId,
        flag: flagged || 'None',
        status: 'Issued',
        overrideNote: flagged ? `${flagged} flag accepted by ${me?.name}` : '',
        issuedAt: Date.now(),
        dispensedQty: 0,
      },
      {
        title: flagged ? `Prescription issued over ${flagged.toLowerCase()} flag` : 'Prescription issued',
        sub: `${resourceId} · ${draft.patient} · ${draft.drug}`,
      }
    )
    toast.success(`Sent to ${draft.pharmacy}`, { title: draft.drug })
    setDraft(null)
  }

  const authoriseRefill = (r) => {
    patch(
      'prescriptions',
      r.resourceId,
      { status: 'Issued', flag: 'None', refills: Math.max(0, Number(r.refills || 1) - 1), issuedAt: Date.now() },
      { title: 'Refill authorised', sub: `${r.resourceId} · ${r.patient}` }
    )
    toast.success('Refill authorised and sent to the pharmacy', { title: r.drug })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Prescriptions</h1>
          <p className="pf-sub">
            {holds.length
              ? `${holds.length} need${holds.length > 1 ? '' : 's'} a decision from you.`
              : 'Nothing on hold.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Write prescription
        </button>
      </header>

      {holds.length > 0 && (
        <section className="pf-panel" style={{ marginBottom: 14 }}>
          <div className="pf-panel-head">
            <ShieldAlert size={15} /> Needs a decision
            <span className="count">{holds.length}</span>
          </div>
          <div className="pf-panel-body">
            {holds.map((r) => (
              <div className="pf-row" key={r.resourceId}>
                <span className={`pf-dot tone-${r.status === 'Refill' ? 'violet' : 'rose'}`} />
                <div>
                  <div className="pf-row-title">
                    {r.drug} — {r.patient}
                  </div>
                  <div className="pf-row-sub">
                    {r.status === 'Refill'
                      ? `${r.refills || 0} refill(s) remaining · ${r.dosage}`
                      : `${r.status} flag raised · ${r.dosage}`}
                  </div>
                </div>
                <div className="pf-row-actions">
                  <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
                  {r.status === 'Refill' ? (
                    <button className="pf-btn ok" onClick={() => authoriseRefill(r)}>
                      <Check size={13} /> Authorise
                    </button>
                  ) : (
                    <button
                      className="pf-btn ok"
                      onClick={() => {
                        patch('prescriptions', r.resourceId, {
                          status: 'Issued',
                          flag: 'None',
                          overrideNote: `${r.status} flag accepted by ${me?.name}`,
                        }, { title: 'Safety flag accepted', sub: `${r.resourceId} · ${r.drug}` })
                        toast.success('Flag accepted — released to the pharmacy', { title: r.drug })
                      }}
                    >
                      <Check size={13} /> Accept &amp; release
                    </button>
                  )}
                  <button
                    className="pf-btn danger"
                    onClick={() => {
                      patch('prescriptions', r.resourceId, { status: 'Rejected' }, {
                        title: 'Prescription withdrawn',
                        sub: `${r.resourceId} · ${r.drug}`,
                      })
                      toast.info('Prescription withdrawn', { title: r.drug })
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Pill size={15} /> Everything you have prescribed
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              You have not prescribed anything yet.
            </p>
          )}
          {rows.map((r) => (
            <div className="pf-row" key={r.resourceId}>
              <div>
                <div className="pf-row-title">
                  {r.drug} — {r.patient}
                </div>
                <div className="pf-row-sub">
                  {r.dosage} · {r.qty ? `${r.qty} units · ` : ''}
                  {r.fulfilment === 'Home delivery' ? <Truck size={11} style={{ verticalAlign: -1 }} /> : <Store size={11} style={{ verticalAlign: -1 }} />}{' '}
                  {r.pharmacy || 'no pharmacy set'}
                </div>
              </div>
              <div className="pf-row-actions">
                {r.overrideNote && <span className="pill tone-amber">Flag accepted</span>}
                <span className={`pill tone-${TONE[r.status] || 'teal'}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Write a prescription"
        subtitle={patient ? `${patient.name} · ${patient.resourceId}` : 'Choose a patient'}
        width={620}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={issue}>
              <Pill size={15} /> Issue to pharmacy
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="pf-form">
              <label className="pf-field">
                <span>Patient</span>
                <select
                  className="pf-input"
                  value={draft.patient}
                  onChange={(e) => field('patient', e.target.value)}
                >
                  <option value="">Select a patient…</option>
                  {panel.map((p) => (
                    <option key={p.resourceId} value={p.name}>
                      {p.name} · {p.resourceId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Medication</span>
                <input
                  className="pf-input"
                  value={draft.drug}
                  placeholder="e.g. Warfarin 5mg"
                  onChange={(e) => field('drug', e.target.value)}
                />
              </label>
              <label className="pf-field">
                <span>Dosage</span>
                <input
                  className="pf-input"
                  value={draft.dosage}
                  placeholder="e.g. OD, BD, TDS"
                  onChange={(e) => field('dosage', e.target.value)}
                />
              </label>
              <label className="pf-field">
                <span>Quantity</span>
                <input
                  className="pf-input"
                  type="number"
                  min="1"
                  value={draft.qty}
                  onChange={(e) => field('qty', Number(e.target.value))}
                />
              </label>
              <label className="pf-field">
                <span>Duration (days)</span>
                <input
                  className="pf-input"
                  type="number"
                  min="1"
                  value={draft.days}
                  onChange={(e) => field('days', Number(e.target.value))}
                />
              </label>
              <label className="pf-field">
                <span>Refills allowed</span>
                <input
                  className="pf-input"
                  type="number"
                  min="0"
                  value={draft.refills}
                  onChange={(e) => field('refills', Number(e.target.value))}
                />
              </label>
              <label className="pf-field">
                <span>Dispensing pharmacy</span>
                <select
                  className="pf-input"
                  value={draft.pharmacy}
                  onChange={(e) => field('pharmacy', e.target.value)}
                >
                  {PHARMACIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Fulfilment</span>
                <select
                  className="pf-input"
                  value={draft.fulfilment}
                  onChange={(e) => field('fulfilment', e.target.value)}
                >
                  <option>Collect in store</option>
                  <option>Home delivery</option>
                </select>
              </label>
              <label className="pf-field full">
                <span>Instructions to the patient</span>
                <textarea
                  className="pf-input"
                  rows={3}
                  value={draft.instructions}
                  placeholder="How and when to take it, what to avoid…"
                  onChange={(e) => field('instructions', e.target.value)}
                />
              </label>
            </div>

            {findings.length > 0 && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-rose)', marginTop: 14, display: 'block' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--tone-rose)', flex: 'none', marginTop: 1 }} />
                  <div>
                    <strong>
                      {findings.length} safety finding{findings.length > 1 ? 's' : ''} for{' '}
                      {patient?.name}
                    </strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {findings.map((f, i) => (
                        <li key={i} style={{ marginBottom: 3 }}>
                          <strong>{f.kind}:</strong> {f.text}
                        </li>
                      ))}
                    </ul>
                    <label style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={override}
                        onChange={(e) => setOverride(e.target.checked)}
                      />
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                        I have considered this and am prescribing anyway
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {error && <span className="pf-err">{error}</span>}

            <p className="pf-hint">
              The interaction check here covers a short demonstration list only — it is not a drug
              database and will miss real interactions. A production build must call a maintained
              interaction service and refuse to issue when that service cannot answer.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
