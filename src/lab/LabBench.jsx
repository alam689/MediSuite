import { useState } from 'react'
import {
  Microscope,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'
import { useData, relTime } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useLab, hasAbnormal, uncheckable, AWAITING_CLINICIAN } from './LabContext.jsx'
import { outOfRange, turnaround } from '../portal/format.js'

const PRIORITY_TONE = { STAT: 'rose', Urgent: 'amber', Routine: 'blue' }

const emptyAnalyte = { name: '', value: '', unit: '', low: '', high: '' }

/* Common panels, so a technician is not retyping the same five analyte names
   and ranges every time. Ranges here are illustrative adult reference
   intervals for the demo — a real LIS takes them from the analyser and the
   population the lab serves, and they differ by age, sex and method. */
const PANELS = {
  CBC: [
    { name: 'Haemoglobin', unit: 'g/dL', low: '12.0', high: '15.5' },
    { name: 'WBC', unit: '×10⁹/L', low: '4.0', high: '11.0' },
    { name: 'Platelets', unit: '×10⁹/L', low: '150', high: '400' },
  ],
  'Lipid Profile': [
    { name: 'Total cholesterol', unit: 'mmol/L', low: '0', high: '5.2' },
    { name: 'LDL', unit: 'mmol/L', low: '0', high: '3.4' },
    { name: 'HDL', unit: 'mmol/L', low: '1.0', high: '2.2' },
    { name: 'Triglycerides', unit: 'mmol/L', low: '0', high: '1.7' },
  ],
  HbA1c: [{ name: 'HbA1c', unit: '%', low: '4.0', high: '5.6' }],
  'Thyroid Panel': [
    { name: 'TSH', unit: 'mIU/L', low: '0.4', high: '4.0' },
    { name: 'Free T4', unit: 'pmol/L', low: '9.0', high: '19.0' },
  ],
  'Kidney Function': [
    { name: 'Creatinine', unit: 'µmol/L', low: '60', high: '110' },
    { name: 'Urea', unit: 'mmol/L', low: '2.5', high: '7.8' },
    { name: 'eGFR', unit: 'mL/min', low: '90', high: '' },
  ],
  'Liver Function': [
    { name: 'ALT', unit: 'U/L', low: '0', high: '41' },
    { name: 'Bilirubin', unit: 'µmol/L', low: '0', high: '21' },
  ],
}

export default function LabBench() {
  const { lab, buckets, prioritised } = useLab()
  const { patch } = useData()
  const toast = useToast()

  const [entry, setEntry] = useState(null)
  const [error, setError] = useState('')

  const rows = prioritised(buckets.onBench)

  const open = (o) => {
    setError('')
    const seeded =
      (o.analytes || []).length > 0
        ? o.analytes.map((a) => ({ ...a }))
        : (PANELS[o.test] || []).map((a) => ({ ...emptyAnalyte, ...a }))
    setEntry({
      order: o,
      analytes: seeded.length ? seeded : [{ ...emptyAnalyte }],
      summary: o.result || '',
      interpretation: o.interpretation || '',
      verifiedBy: o.verifiedBy || '',
    })
  }

  const setAnalyte = (i, key, value) =>
    setEntry((e) => ({
      ...e,
      analytes: e.analytes.map((a, j) => (j === i ? { ...a, [key]: value } : a)),
    }))

  const addRow = () => setEntry((e) => ({ ...e, analytes: [...e.analytes, { ...emptyAnalyte }] }))
  const removeRow = (i) =>
    setEntry((e) => ({ ...e, analytes: e.analytes.filter((_, j) => j !== i) }))

  const report = () => {
    const filled = entry.analytes.filter((a) => a.name.trim() && String(a.value).trim())
    if (filled.length === 0 && !entry.summary.trim()) {
      return setError('Enter at least one result, or a summary for a narrative report.')
    }
    if (!entry.verifiedBy.trim()) {
      return setError('Name the person verifying this result — an unsigned result is not a result.')
    }

    const abnormal = hasAbnormal(filled)

    patch(
      'laboratory',
      entry.order.resourceId,
      {
        analytes: filled,
        result:
          entry.summary.trim() ||
          (abnormal
            ? `${filled.filter((a) => outOfRange(a) === true).length} value(s) outside reference range`
            : 'Within reference range'),
        interpretation: entry.interpretation.trim(),
        verifiedBy: entry.verifiedBy.trim(),
        /* Abnormal is derived, never typed. A technician who marks a result
           normal while a value sits outside its range is the exact error a
           reference range exists to catch. */
        status: abnormal ? 'Abnormal' : AWAITING_CLINICIAN,
        reportedAt: Date.now(),
      },
      {
        title: abnormal ? 'Result reported — abnormal' : 'Result reported',
        sub: `${entry.order.resourceId} · ${entry.order.test} · ${entry.order.patient}`,
      }
    )

    toast.success(
      abnormal
        ? 'Reported and flagged abnormal — sent to the requesting clinician'
        : 'Reported — sent to the requesting clinician for release',
      { title: `${entry.order.test} · ${entry.order.patient}` }
    )
    setEntry(null)
  }

  const live = entry?.analytes.filter((a) => a.name.trim() && String(a.value).trim()) || []
  const liveAbnormal = hasAbnormal(live)
  const liveUnchecked = uncheckable(live)

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Bench worklist</h1>
          <p className="pf-sub">
            {rows.length
              ? `${rows.length} sample${rows.length > 1 ? 's' : ''} to run at ${lab}.`
              : `Nothing on the bench at ${lab}.`}
          </p>
        </div>
      </header>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Microscope size={15} /> On the bench
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              Everything received has been reported.
            </p>
          )}
          {rows.map((o) => (
            <div className="pf-row" key={o.resourceId}>
              <span className={`pf-dot tone-${PRIORITY_TONE[o.priority] || 'blue'}`} />
              <div>
                <div className="pf-row-title">
                  {o.test} — {o.patient}
                </div>
                <div className="pf-row-sub">
                  {o.accession || 'no accession'} · {o.sample} · {o.doctor}
                  {o.receivedAt && ` · on the bench ${relTime(o.receivedAt)}`}
                  {o.orderedAt && ` · waiting ${turnaround(o.orderedAt)}`}
                </div>
              </div>
              <div className="pf-row-actions">
                {o.priority !== 'Routine' && (
                  <span className={`pill tone-${PRIORITY_TONE[o.priority]}`}>{o.priority}</span>
                )}
                <button className="pf-btn go" onClick={() => open(o)}>
                  <Send size={13} /> Enter result
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="pf-note">
        <AlertTriangle size={14} />
        A result is flagged abnormal from the reference ranges you enter, not by hand. If a range is
        left blank the value cannot be checked at all — the form says so before you report.
      </p>

      <Modal
        open={!!entry}
        onClose={() => setEntry(null)}
        title={entry ? `Enter result — ${entry.order.test}` : ''}
        subtitle={
          entry ? `${entry.order.patient} · ${entry.order.accession || 'no accession'}` : ''
        }
        width={720}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEntry(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={report}>
              <Send size={15} /> Report to clinician
            </button>
          </>
        }
      >
        {entry && (
          <>
            <div className="pf-scroll">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Analyte</th>
                    <th style={{ width: 110 }}>Value</th>
                    <th style={{ width: 100 }}>Unit</th>
                    <th style={{ width: 90 }}>Low</th>
                    <th style={{ width: 90 }}>High</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {entry.analytes.map((a, i) => {
                    const bad = outOfRange(a)
                    return (
                      <tr key={i}>
                        <td>
                          <input
                            className="pf-input"
                            style={{ minHeight: 34 }}
                            value={a.name}
                            placeholder="Analyte"
                            onChange={(e) => setAnalyte(i, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="pf-input"
                            style={{
                              minHeight: 34,
                              borderColor:
                                bad === true
                                  ? 'color-mix(in srgb, var(--tone-rose) 55%, transparent)'
                                  : undefined,
                            }}
                            value={a.value}
                            onChange={(e) => setAnalyte(i, 'value', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="pf-input"
                            style={{ minHeight: 34 }}
                            value={a.unit}
                            onChange={(e) => setAnalyte(i, 'unit', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="pf-input"
                            style={{ minHeight: 34 }}
                            value={a.low}
                            onChange={(e) => setAnalyte(i, 'low', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="pf-input"
                            style={{ minHeight: 34 }}
                            value={a.high}
                            onChange={(e) => setAnalyte(i, 'high', e.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            className="pf-btn danger"
                            onClick={() => removeRow(i)}
                            aria-label={`Remove ${a.name || 'row'}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button className="pf-btn" style={{ marginTop: 10 }} onClick={addRow}>
              <Plus size={13} /> Add analyte
            </button>

            {liveAbnormal && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-rose)', marginTop: 14 }}>
                <AlertTriangle size={16} />
                <span>
                  <strong>
                    {live.filter((a) => outOfRange(a) === true).length} value(s) outside range.
                  </strong>{' '}
                  This report will be flagged abnormal and pushed to {entry.order.doctor} for
                  review.
                </span>
              </div>
            )}
            {liveUnchecked.length > 0 && (
              <div className="pf-warn" style={{ '--tc': 'var(--tone-amber)', marginTop: 10 }}>
                <HelpCircle size={16} />
                <span>
                  <strong>{liveUnchecked.length} value(s) have no usable reference range</strong> (
                  {liveUnchecked.map((a) => a.name).join(', ')}). They cannot be checked, so they
                  will not raise a flag — that is not the same as being normal.
                </span>
              </div>
            )}

            <div className="pf-form" style={{ marginTop: 14 }}>
              <label className="pf-field full">
                <span>Summary (optional — derived from the ranges if left blank)</span>
                <input
                  className="pf-input"
                  value={entry.summary}
                  onChange={(e) => setEntry({ ...entry, summary: e.target.value })}
                />
              </label>
              <label className="pf-field full">
                <span>Interpretation</span>
                <textarea
                  className="pf-input"
                  rows={3}
                  value={entry.interpretation}
                  placeholder="Anything the requesting clinician should read alongside the numbers"
                  onChange={(e) => setEntry({ ...entry, interpretation: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Verified by</span>
                <input
                  className="pf-input"
                  value={entry.verifiedBy}
                  placeholder="Name of the verifying scientist"
                  onChange={(e) => setEntry({ ...entry, verifiedBy: e.target.value })}
                />
              </label>
            </div>

            {error && <span className="pf-err">{error}</span>}

            <p className="pf-hint">
              Reporting sends this to {entry.order.doctor} for review. It does <strong>not</strong>{' '}
              release it to the patient — that is the clinician's decision, taken in their own
              portal.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
