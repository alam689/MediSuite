import { useMemo, useState } from 'react'
import {
  LineChart, BarChart3, ClipboardList, DollarSign, Clipboard, Send,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useDoctor } from './DoctorContext.jsx'
import { useData } from '../store/DataStore.jsx'
import { money } from '../portal/format.js'
import './reports.css'

/* =====================================================================
   Doctor reports — the Basic / Advanced reporting screens from the
   reference DigitalRX app, computed from this doctor's own records:

   - visits are the doctor's appointments (a cancelled booking is not a
     visit); a patient is "new" on the day of their first booking with
     this doctor and "old" (follow-up) afterwards
   - accounts read the doctor's invoices; communication counts one
     reminder SMS per confirmed appointment against a demo quota
   - the clinical Top-5s (complaints, diagnoses, investigations,
     generics) come from the prescription pad's saved sheets and the
     filed RX records

   All derivations are client-side over the demo store — the numbers are
   as real as the seed data, no more.
   ===================================================================== */

/* ---- small date helpers ------------------------------------------- */
const DAY_MS = 86400000
const toKey = (d) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}
const todayKey = () => toKey(new Date())
const monthKey = (k) => String(k).slice(0, 7)
const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const prettyDay = (k) => {
  const d = new Date(`${k}T00:00:00`)
  const n = d.getDate()
  const suf = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${d.toLocaleString('en', { month: 'short' })} ${n}${suf}`
}

const PERIODS = { 'Last Week': 7, 'Last Month': 30, 'Last 3 Months': 90, 'Last 6 Months': 180 }

/* Visit status buckets: a past Confirmed/Checked-in booking happened, a
   past Pending/Urgent one was never honoured, Cancelled is explicit. */
const bucket = (a, today) => {
  if (a.status === 'Cancelled') return 'cancelled'
  if (a.date && a.date <= today && (a.status === 'Confirmed' || a.status === 'Checked-in')) return 'completed'
  if (a.date && a.date < today) return 'noshow'
  return 'upcoming'
}

/* ---- chart primitives --------------------------------------------- */
const COLORS = {
  green: '#a8d5a2', blue: '#8ec8f6', amber: '#ffcc80', rose: '#ef9a9a',
  violet: '#b39ddb', teal: '#4db6ac', grey: '#cfd8dc', orange: '#ffab91',
  sky: '#81d4fa', lime: '#c5e1a5',
}
const PIE_SET = [COLORS.green, COLORS.blue, COLORS.orange, '#66bb6a', COLORS.violet, COLORS.teal, COLORS.grey, COLORS.rose]

function Pie({ data, size = 190 }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  if (!total) {
    return (
      <div className="rp-pie">
        <svg width={size} height={size} role="img" aria-label="No data">
          <circle cx={cx} cy={cy} r={r} fill="#fbe4cf" />
          <text x={cx} y={cy + 4} textAnchor="middle" className="rp-pie-pct" fill="#c9a284">100%</text>
        </svg>
        <div className="rp-legend">
          <span className="rp-leg"><i style={{ background: '#fbe4cf' }} /> No Data Found</span>
        </div>
      </div>
    )
  }
  let angle = -Math.PI / 2
  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const frac = d.value / total
      const a0 = angle
      const a1 = (angle += frac * Math.PI * 2)
      const large = frac > 0.5 ? 1 : 0
      const x0 = cx + r * Math.cos(a0)
      const y0 = cy + r * Math.sin(a0)
      const x1 = cx + r * Math.cos(a1)
      const y1 = cy + r * Math.sin(a1)
      const mid = (a0 + a1) / 2
      const lx = cx + r * 0.6 * Math.cos(mid)
      const ly = cy + r * 0.6 * Math.sin(mid)
      const path =
        frac >= 0.999
          ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
          : `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
      return { d, path, lx, ly, pct: Math.round(frac * 100), key: i }
    })
  return (
    <div className="rp-pie">
      <svg width={size} height={size} role="img" aria-label="Pie chart">
        {slices.map((s) => (
          <path key={s.key} d={s.path} fill={s.d.color} stroke="#fff" strokeWidth="1" />
        ))}
        {slices.map((s) => s.pct >= 3 && (
          <text key={`t${s.key}`} x={s.lx} y={s.ly} textAnchor="middle" className="rp-pie-pct">
            {s.pct}%
          </text>
        ))}
      </svg>
      <div className="rp-legend">
        {data.map((d, i) => (
          <span key={i} className="rp-leg"><i style={{ background: d.color }} /> {d.label}</span>
        ))}
      </div>
    </div>
  )
}

function StackedBars({ cols, height = 210 }) {
  const peak = Math.max(1, ...cols.map((c) => c.parts.reduce((n, p) => n + p.value, 0)))
  return (
    <div className="rp-bars" style={{ height: height + 34 }}>
      {cols.map((c, i) => {
        const total = c.parts.reduce((n, p) => n + p.value, 0)
        return (
          <div key={i} className="rp-bar-col" title={`${c.label}: ${c.parts.map((p) => `${p.name} ${p.value}`).join(', ')}`}>
            <div className="rp-bar-stack" style={{ height }}>
              {c.parts.map((p, j) => p.value > 0 && (
                <div
                  key={j}
                  style={{ height: `${Math.round((p.value / peak) * height)}px`, background: p.color }}
                />
              ))}
              {total === 0 && <div className="rp-bar-zero" />}
            </div>
            <div className="rp-bar-label">{c.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function HBars({ rows, color, legend }) {
  const peak = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="rp-hbars">
      {rows.map((r, i) => (
        <div key={i} className="rp-hbar-row">
          <span className="rp-hbar-label" title={r.label}>{r.label}</span>
          <div className="rp-hbar-track">
            <div className="rp-hbar-fill" style={{ width: `${Math.max(2, Math.round((r.value / peak) * 100))}%`, background: color }} />
          </div>
          <span className="rp-hbar-val">{r.value}</span>
        </div>
      ))}
      {legend && <div className="rp-legend center"><span className="rp-leg"><i style={{ background: color }} /> {legend}</span></div>}
    </div>
  )
}

const topN = (texts, n = 5) => {
  const map = new Map()
  for (const t of texts) {
    const k = String(t || '').trim()
    if (!k) continue
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

/* ---- calendar (Basic report) -------------------------------------- */
function MonthGrid({ ym, range, onPick }) {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startDow = first.getDay()
  const days = new Date(y, m, 0).getDate()
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const inRange = (k) => range.from && range.to && k >= range.from && k <= range.to
  const isEdge = (k) => k === range.from || k === range.to
  return (
    <div className="rp-cal-month">
      <div className="rp-cal-title">
        {first.toLocaleString('en', { month: 'long' })} <b>{y}</b>
      </div>
      <div className="rp-cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="rp-cal-dow">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const k = `${ym}-${String(d).padStart(2, '0')}`
          return (
            <button
              key={k}
              className={`rp-cal-day ${inRange(k) ? 'in' : ''} ${isEdge(k) ? 'edge' : ''}`}
              onClick={() => onPick(k)}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BasicReport({ visits, firstSeen }) {
  const today = todayKey()
  const thisMonth = monthKey(today)
  const lastMonth = addMonths(thisMonth, -1)
  const [anchor, setAnchor] = useState(thisMonth) // right-hand month of the pair
  const [range, setRange] = useState({ from: toKey(new Date(Date.now() - 6 * DAY_MS)), to: today })

  const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en', { month: 'short', year: 'numeric' })

  const counts = useMemo(() => {
    const c = {
      totalVisit: visits.length,
      todayVisit: 0, monthVisit: 0, lastMonthVisit: 0,
      totalPatient: firstSeen.size,
      todayPatient: 0, monthPatient: 0, lastMonthPatient: 0,
      rangeVisit: 0, rangePatient: 0,
    }
    for (const v of visits) {
      if (!v.date) continue
      if (v.date === today) c.todayVisit++
      const mk = monthKey(v.date)
      if (mk === thisMonth) c.monthVisit++
      if (mk === lastMonth) c.lastMonthVisit++
      if (range.from && range.to && v.date >= range.from && v.date <= range.to) c.rangeVisit++
    }
    for (const d of firstSeen.values()) {
      if (d === today) c.todayPatient++
      const mk = monthKey(d)
      if (mk === thisMonth) c.monthPatient++
      if (mk === lastMonth) c.lastMonthPatient++
      if (range.from && range.to && d >= range.from && d <= range.to) c.rangePatient++
    }
    return c
  }, [visits, firstSeen, range, today, thisMonth, lastMonth])

  const pick = (k) => {
    setRange((r) => {
      if (!r.from || (r.from && r.to)) return { from: k, to: null }
      if (k < r.from) return { from: k, to: r.from }
      return { from: r.from, to: k }
    })
  }

  const cards = [
    { label: 'Total Visit', value: counts.totalVisit, tone: 'green' },
    { label: "Today's Visit", value: counts.todayVisit, tone: 'blue' },
    { label: "This Month's Visit", value: counts.monthVisit, sub: `(${monthName(thisMonth)})`, tone: 'violet' },
    { label: "Last Month's Visit", value: counts.lastMonthVisit, sub: `(${monthName(lastMonth)})`, tone: 'rose' },
    { label: 'Total Patient', value: counts.totalPatient, tone: 'green' },
    { label: "Today's Patient", value: counts.todayPatient, tone: 'blue' },
    { label: "This Month's Patient", value: counts.monthPatient, sub: `(${monthName(thisMonth)})`, tone: 'violet' },
    { label: "Last Month's Patient", value: counts.lastMonthPatient, sub: `(${monthName(lastMonth)})`, tone: 'rose' },
  ]

  return (
    <>
      <div className="rp-kpis">
        {cards.map((c) => (
          <div key={c.label} className="rp-kpi">
            <div className="rp-kpi-label">
              {c.label}
              {c.sub && <em>{c.sub}</em>}
            </div>
            <div className={`rp-kpi-big t-${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rp-cal-card">
        <h3>Count by date</h3>
        <div className="rp-cal-nav">
          <button onClick={() => setAnchor((a) => addMonths(a, -1))}><ChevronLeft size={17} /></button>
          <div className="rp-cal-pair">
            <MonthGrid ym={addMonths(anchor, -1)} range={range} onPick={pick} />
            <MonthGrid ym={anchor} range={range} onPick={pick} />
          </div>
          <button onClick={() => setAnchor((a) => addMonths(a, 1))}><ChevronRight size={17} /></button>
        </div>
        <div className="rp-cal-totals">
          <span>Total Visit: <b className="t-green">{counts.rangeVisit}</b></span>
          <span>Total New Patients: <b className="t-blue">{counts.rangePatient}</b></span>
          {range.from && !range.to && <em>select the end date…</em>}
        </div>
      </div>
    </>
  )
}

/* ---- advanced report ---------------------------------------------- */

function PeriodBar({ period, setPeriod }) {
  return (
    <div className="rp-periodbar">
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        {Object.keys(PERIODS).map((p) => <option key={p}>{p}</option>)}
      </select>
    </div>
  )
}

function AppointmentsTab({ appts }) {
  const today = todayKey()
  const [filter, setFilter] = useState('ALL')

  const stats = useMemo(() => {
    const s = { total: appts.length, completed: 0, noshow: 0, cancelled: 0, byDay: new Map() }
    for (const a of appts) {
      const b = bucket(a, today)
      if (b === 'completed') s.completed++
      else if (b === 'noshow') s.noshow++
      else if (b === 'cancelled') s.cancelled++
      if (!a.date) continue
      const d = s.byDay.get(a.date) || { completed: 0, noshow: 0, cancelled: 0, newP: 0, oldP: 0 }
      d[b === 'completed' ? 'completed' : b === 'noshow' ? 'noshow' : b === 'cancelled' ? 'cancelled' : 'completed'] += b === 'upcoming' ? 0 : 1
      if (a.isNew) d.newP++
      else d.oldP++
      s.byDay.set(a.date, d)
    }
    return s
  }, [appts, today])

  const pct = (n) => (stats.total ? `${((n / stats.total) * 100).toFixed(2)}%` : '0%')
  const days = [...stats.byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  const busiest = days.reduce(
    (best, [k, d]) => {
      const n = d.completed + d.noshow + d.cancelled
      return n > best.n ? { k, n } : best
    },
    { k: null, n: 0 }
  )

  const newTotal = appts.filter((a) => a.isNew).length
  const oldTotal = appts.length - newTotal

  const visitParts = (d) =>
    filter === 'ALL'
      ? [
          { name: 'New', value: d.newP, color: COLORS.sky },
          { name: 'Old', value: d.oldP, color: COLORS.green },
        ]
      : [
          { name: filter, value: d[filter === 'COMPLETED' ? 'completed' : filter === 'NO SHOW' ? 'noshow' : 'cancelled'], color: filter === 'COMPLETED' ? COLORS.green : filter === 'NO SHOW' ? COLORS.amber : COLORS.rose },
        ]

  return (
    <>
      <div className="rp-kpis five">
        <div className="rp-kpi head-tinted" style={{ '--tint': '#bfe3dc' }}>
          <div className="rp-kpi-label">Total Appointments</div>
          <div className="rp-kpi-big">{stats.total}</div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-label">Busiest day</div>
          <div className="rp-kpi-big t-blue">{busiest.k ? busiest.n : 0}</div>
          <div className="rp-kpi-sub">{busiest.k ? `${prettyDay(busiest.k)} appointments` : 'no visits in period'}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.green }}>
          <div className="rp-kpi-label">Completed</div>
          <div className="rp-kpi-big">{stats.completed}</div>
          <div className="rp-kpi-sub">{pct(stats.completed)}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.amber }}>
          <div className="rp-kpi-label">No Show</div>
          <div className="rp-kpi-big">{stats.noshow}</div>
          <div className="rp-kpi-sub">{pct(stats.noshow)}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.rose }}>
          <div className="rp-kpi-label">Cancelled</div>
          <div className="rp-kpi-big">{stats.cancelled}</div>
          <div className="rp-kpi-sub">{pct(stats.cancelled)}</div>
        </div>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <Pie
            data={[
              { label: 'Complete', value: stats.completed, color: COLORS.green },
              { label: 'No Show', value: stats.noshow, color: COLORS.amber },
              { label: 'Cancelled', value: stats.cancelled, color: COLORS.rose },
            ]}
          />
        </div>
        <div className="rp-card grow">
          <StackedBars
            cols={days.map(([k, d]) => ({
              label: prettyDay(k),
              parts: [
                { name: 'Completed', value: d.completed, color: COLORS.green },
                { name: 'No Show', value: d.noshow, color: COLORS.amber },
                { name: 'Cancelled', value: d.cancelled, color: COLORS.rose },
              ],
            }))}
          />
        </div>
      </div>

      <div className="rp-filters">
        {['ALL', 'COMPLETED', 'NO SHOW', 'CANCELLED'].map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="rp-strip green">All Visits</div>
      <div className="rp-splitbar">
        <span style={{ flex: Math.max(1, newTotal), background: COLORS.sky }}>New: {newTotal}</span>
        <span style={{ flex: Math.max(1, oldTotal), background: COLORS.green }}>Old: {oldTotal}</span>
        <span style={{ flex: 1, background: COLORS.violet }}>Report: 0</span>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <Pie
            data={[
              { label: 'New', value: newTotal, color: COLORS.sky },
              { label: 'Old', value: oldTotal, color: COLORS.green },
              { label: 'Report', value: 0, color: COLORS.violet },
            ]}
          />
        </div>
        <div className="rp-card grow">
          <StackedBars cols={days.map(([k, d]) => ({ label: prettyDay(k), parts: visitParts(d) }))} />
        </div>
      </div>
    </>
  )
}

function AccountsTab({ invoices, appts }) {
  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'Paid')
    const total = paid.reduce((n, i) => n + money(i.amount), 0)
    /* Split collections by whether the payer was new to the doctor that
       day — same new/old notion as the visits report. */
    const newNames = new Set(appts.filter((a) => a.isNew).map((a) => a.patient))
    let newAmt = 0
    let oldAmt = 0
    for (const i of paid) {
      if (newNames.has(i.party)) newAmt += money(i.amount)
      else oldAmt += money(i.amount)
    }
    const byDay = new Map()
    for (const i of paid) {
      if (!i.date) continue
      const d = byDay.get(i.date) || { newAmt: 0, oldAmt: 0 }
      if (newNames.has(i.party)) d.newAmt += money(i.amount)
      else d.oldAmt += money(i.amount)
      byDay.set(i.date, d)
    }
    return { total, newAmt, oldAmt, byDay }
  }, [invoices, appts])

  const days = [...stats.byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  const bdt = (n) => `৳${Math.round(n).toLocaleString()}`

  return (
    <>
      <div className="rp-kpis four">
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.green }}>
          <div className="rp-kpi-label">Total Collections</div>
          <div className="rp-kpi-big">{bdt(stats.total)}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.teal }}>
          <div className="rp-kpi-label">New Patient</div>
          <div className="rp-kpi-big">{bdt(stats.newAmt)}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.blue }}>
          <div className="rp-kpi-label">Old Patient</div>
          <div className="rp-kpi-big">{bdt(stats.oldAmt)}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.violet }}>
          <div className="rp-kpi-label">Report Patient</div>
          <div className="rp-kpi-big">৳0</div>
        </div>
      </div>

      <div className="rp-card grow">
        {days.length === 0 ? (
          <p className="rp-none">No settled invoices in this period.</p>
        ) : (
          <StackedBars
            cols={days.map(([k, d]) => ({
              label: prettyDay(k),
              parts: [
                { name: 'New', value: Math.round(d.newAmt), color: COLORS.teal },
                { name: 'Old', value: Math.round(d.oldAmt), color: COLORS.blue },
              ],
            }))}
          />
        )}
        <div className="rp-legend center">
          <span className="rp-leg"><i style={{ background: COLORS.teal }} /> New</span>
          <span className="rp-leg"><i style={{ background: COLORS.blue }} /> Old</span>
          <span className="rp-leg"><i style={{ background: COLORS.violet }} /> Report</span>
        </div>
      </div>
    </>
  )
}

function PatientsTab({ appts, patients, pads, rxRecords }) {
  const [showDist, setShowDist] = useState(false)
  const [complaintView, setComplaintView] = useState('Top Chief Complaints')

  const stats = useMemo(() => {
    const seen = new Set(appts.map((a) => a.patient))
    const newP = new Set(appts.filter((a) => a.isNew).map((a) => a.patient))
    const followup = [...seen].filter((p) => !newP.has(p))

    const inPeriod = patients.filter((p) => seen.has(p.name))
    const gender = topN(inPeriod.map((p) => p.gender)).map(([label, value]) => ({ label, value }))
    const ageBands = [
      ['0-9', 0, 9], ['10-19', 10, 19], ['20-29', 20, 29], ['30-39', 30, 39],
      ['40-49', 40, 49], ['50-59', 50, 59], ['60-150', 60, 150],
    ].map(([label, lo, hi]) => ({
      label,
      value: inPeriod.filter((p) => Number(p.age) >= lo && Number(p.age) <= hi).length,
    }))

    const complaints = topN(pads.flatMap((s) => (s.items?.presenting || []).map((i) => i.text)))
    const diagnoses = topN(pads.flatMap((s) => (s.items?.diagnosis || []).map((i) => i.text)))
    const investigations = topN(pads.flatMap((s) => (s.items?.investigation || []).map((i) => i.text)))
    const generics = topN(rxRecords.map((r) => r.generic).filter(Boolean))

    /* patients vs prescriptions per complaint: unique patients naming it
       vs pad sheets carrying it. */
    const byComplaint = complaints.map(([label]) => {
      const sheets = pads.filter((s) => (s.items?.presenting || []).some((i) => i.text === label))
      return { label, patients: new Set(sheets.map((s) => s.patient?.name || s.patientId)).size, sheets: sheets.length }
    })

    return { total: seen.size, newCount: newP.size, followupCount: followup.length, gender, ageBands, complaints, diagnoses, investigations, generics, byComplaint }
  }, [appts, patients, pads, rxRecords])

  const pieify = (pairs) => pairs.map(([label, value], i) => ({ label, value, color: PIE_SET[i % PIE_SET.length] }))
  const dist = stats.ageBands.map((b, i) => ({ label: b.label, parts: [{ name: b.label, value: b.value, color: COLORS.teal }] }))

  return (
    <>
      <div className="rp-kpis three">
        <div className="rp-kpi head-tinted" style={{ '--tint': '#bfe3dc' }}>
          <div className="rp-kpi-label">Total Patients</div>
          <div className="rp-kpi-big">{stats.total}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.green }}>
          <div className="rp-kpi-label">New Patients</div>
          <div className="rp-kpi-big">{stats.newCount}</div>
        </div>
        <div className="rp-kpi head-tinted" style={{ '--tint': COLORS.violet }}>
          <div className="rp-kpi-label">Followup Patients</div>
          <div className="rp-kpi-big">{stats.followupCount}</div>
        </div>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <h4>New &amp; Follow up Patient Ratios</h4>
          <Pie
            data={[
              { label: 'New Patients', value: stats.newCount, color: COLORS.green },
              { label: 'Followup Patients', value: stats.followupCount, color: COLORS.violet },
            ]}
          />
        </div>
        <div className="rp-card grow">
          <label className="rp-toggle">
            <input type="checkbox" checked={showDist} onChange={(e) => setShowDist(e.target.checked)} />
            Show New &amp; Followup Patient Distribution
          </label>
          {showDist ? (
            <StackedBars
              cols={[
                { label: 'New', parts: [{ name: 'New', value: stats.newCount, color: COLORS.green }] },
                { label: 'Followup', parts: [{ name: 'Followup', value: stats.followupCount, color: COLORS.violet }] },
              ]}
              height={170}
            />
          ) : (
            <StackedBars cols={dist} height={170} />
          )}
        </div>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <h4>Gender Group</h4>
          <Pie data={stats.gender.map((g, i) => ({ ...g, color: [COLORS.orange, COLORS.sky, COLORS.lime][i % 3] }))} />
        </div>
        <div className="rp-card">
          <h4>Age Group</h4>
          <Pie data={stats.ageBands.map((b, i) => ({ label: b.label, value: b.value, color: [COLORS.violet, COLORS.sky, COLORS.lime, COLORS.blue, COLORS.teal, COLORS.grey, COLORS.orange][i] }))} />
        </div>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <h4>Top 5 Diagnoses</h4>
          <Pie data={pieify(stats.diagnoses)} />
        </div>
        <div className="rp-card">
          <h4>Top 5 Complaints</h4>
          <Pie data={pieify(stats.complaints)} />
        </div>
      </div>

      <div className="rp-duo">
        <div className="rp-card">
          <h4>Top 5 Investigations</h4>
          <Pie data={pieify(stats.investigations)} />
        </div>
        <div className="rp-card">
          <h4>Top 5 Medicine Generics</h4>
          <Pie data={pieify(stats.generics)} />
        </div>
      </div>

      <div className="rp-card">
        <div className="rp-card-head">
          <h4>Top Chief Complaints</h4>
          <select value={complaintView} onChange={(e) => setComplaintView(e.target.value)}>
            <option>Top Chief Complaints</option>
            <option>Top Diagnoses</option>
          </select>
        </div>
        {(() => {
          const source =
            complaintView === 'Top Chief Complaints'
              ? stats.byComplaint
              : stats.diagnoses.map(([label, value]) => ({ label, patients: value, sheets: value }))
          if (!source.length) return <p className="rp-none">Write some pad prescriptions to populate this chart.</p>
          return (
            <div className="rp-duo">
              <HBars rows={source.map((c) => ({ label: c.label, value: c.patients }))} color={COLORS.blue} legend="Patients" />
              <HBars rows={source.map((c) => ({ label: c.label, value: c.sheets }))} color={COLORS.green} legend="Prescriptions" />
            </div>
          )
        })()}
      </div>
    </>
  )
}

const SMS_QUOTA = 23000

function CommunicationTab({ allAppts, pads }) {
  const [view, setView] = useState('overall')
  const today = todayKey()
  const thisMonth = monthKey(today)
  const lastMonth = addMonths(thisMonth, -1)

  /* One reminder SMS per confirmed/checked-in booking; a follow-up text
     per saved pad sheet that carries a follow-up line. Demo arithmetic
     against a fixed quota — there is no SMS gateway behind this. */
  const reminders = allAppts.filter((a) => a.status === 'Confirmed' || a.status === 'Checked-in')
  const fuTexts = pads.filter((s) => (s.items?.followup || []).length > 0)
  const rows = view === 'overall' ? reminders.map((a) => a.date) : fuTexts.map((s) => String(s.date || '').slice(0, 10))
  const used = view === 'overall' ? reminders.length + fuTexts.length : fuTexts.length

  const sentToday = rows.filter((d) => d === today).length
  const sentMonth = rows.filter((d) => monthKey(d || '') === thisMonth).length
  const sentLast = rows.filter((d) => monthKey(d || '') === lastMonth).length

  const cards = [
    ['TOTAL AVAILED SMS', SMS_QUOTA],
    ['TOTAL SMS USED', used],
    ['REMAINING SMS', SMS_QUOTA - used],
    ['SMS SENT TODAY', sentToday],
    ['SMS SENT THIS MONTH', sentMonth],
    ['SMS SENT LAST MONTH', sentLast],
  ]

  return (
    <>
      <div className="rp-com-toggle">
        <button className={view === 'overall' ? 'on' : ''} onClick={() => setView('overall')}>Overall Usage</button>
        <button className={view === 'followup' ? 'on' : ''} onClick={() => setView('followup')}>Follow up Text Usage</button>
      </div>
      <div className="rp-com-type">
        <select defaultValue="NONMASKING">
          <option>NONMASKING</option>
          <option>MASKING</option>
        </select>
      </div>
      <div className="rp-kpis four">
        {cards.map(([label, value]) => (
          <div key={label} className="rp-kpi head-tinted" style={{ '--tint': COLORS.green }}>
            <div className="rp-kpi-label caps">{label}</div>
            <div className="rp-kpi-big">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="rp-none">
        Reminder texts are counted per confirmed booking and follow-up texts per saved pad sheet —
        demo figures, not a live SMS gateway.
      </p>
    </>
  )
}

/* ---- page ---------------------------------------------------------- */

export default function DoctorReports() {
  const { mine, name } = useDoctor()
  const { records } = useData()

  const [mode, setMode] = useState('basic')
  const [tab, setTab] = useState('appointments')
  const [period, setPeriod] = useState('Last Week')

  const allAppts = mine('appointments')
  const invoices = mine('billing')
  const patients = records('patients')
  const rxRecords = mine('prescriptions')

  /* Saved pad sheets persist under the pad's own key; read them directly —
     mounting the whole PadProvider just for this list would be noise. */
  const pads = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('medisuite-rxpad.saved') || '[]')
    } catch {
      return []
    }
  }, [])

  /* First booking date per patient — the "new vs old" line every tab uses. */
  const firstSeen = useMemo(() => {
    const map = new Map()
    for (const a of allAppts) {
      if (!a.date || a.status === 'Cancelled') continue
      const k = a.patientId || a.patient
      if (!map.has(k) || a.date < map.get(k)) map.set(k, a.date)
    }
    return map
  }, [allAppts])

  const visits = useMemo(
    () => allAppts.filter((a) => a.status !== 'Cancelled' && a.date && a.date <= todayKey()),
    [allAppts]
  )

  /* The advanced tabs work over the selected look-back window, each
     appointment tagged new/old against the doctor's whole history. */
  const periodAppts = useMemo(() => {
    const from = toKey(new Date(Date.now() - PERIODS[period] * DAY_MS))
    const to = todayKey()
    return allAppts
      .filter((a) => a.date && a.date >= from && a.date <= to)
      .map((a) => ({ ...a, isNew: firstSeen.get(a.patientId || a.patient) === a.date }))
  }, [allAppts, firstSeen, period])

  const periodInvoices = useMemo(() => {
    const from = toKey(new Date(Date.now() - PERIODS[period] * DAY_MS))
    return invoices.filter((i) => i.date && i.date >= from)
  }, [invoices, period])

  const periodPads = useMemo(() => {
    const from = Date.now() - PERIODS[period] * DAY_MS
    return pads.filter((s) => !s.date || new Date(s.date).getTime() >= from)
  }, [pads, period])

  const TABS = [
    { key: 'appointments', label: 'Appointments', icon: ClipboardList },
    { key: 'accounts', label: 'Accounts', icon: DollarSign },
    { key: 'patients', label: 'Patients', icon: Clipboard },
    { key: 'communication', label: 'Communication', icon: Send },
  ]

  return (
    <div className="rp-page">
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Reports</h1>
          <p className="pf-sub">Visits, collections and patient analytics for {name}.</p>
        </div>
      </header>

      <div className="rp-mode">
        <button className={mode === 'basic' ? 'on' : ''} onClick={() => setMode('basic')}>
          <LineChart size={15} /> Basic Report
        </button>
        <button className={mode === 'advanced' ? 'on' : ''} onClick={() => setMode('advanced')}>
          <BarChart3 size={15} /> Advanced Report
        </button>
      </div>

      {mode === 'basic' ? (
        <BasicReport visits={visits} firstSeen={firstSeen} />
      ) : (
        <>
          <div className="rp-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
          {tab !== 'communication' && <PeriodBar period={period} setPeriod={setPeriod} />}
          {tab === 'appointments' && <AppointmentsTab appts={periodAppts} />}
          {tab === 'accounts' && <AccountsTab invoices={periodInvoices} appts={periodAppts} />}
          {tab === 'patients' && (
            <PatientsTab appts={periodAppts} patients={patients} pads={periodPads} rxRecords={rxRecords} />
          )}
          {tab === 'communication' && <CommunicationTab allAppts={allAppts} pads={pads} />}
        </>
      )}
    </div>
  )
}
