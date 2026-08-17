import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, BarChart3, ClipboardList, DollarSign, Clipboard, Send,
  ChevronLeft, ChevronRight, ChevronDown, CalendarDays,
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

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en', { month: 'short', year: 'numeric' })
const prettyFull = (k) => new Date(`${k}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
/* every day key from → to, inclusive (capped so a silly range can't spin) */
const eachDay = (from, to) => {
  const out = []
  const d = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end && out.length < 800) {
    out.push(toKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
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

/* ---- axis charts (Basic report) ------------------------------------
   Small hand-rolled SVG chart set: a y-axis that always lands on whole
   numbers, a multi-series line/area trend, grouped columns and a donut.
   Everything scales through the viewBox, so the cards stay responsive.
   ------------------------------------------------------------------ */
const axisMax = (peak) => {
  const target = Math.max(4, Math.ceil(peak))
  for (const s of [1, 2, 3, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500, 5000]) {
    if (s * 4 >= target) return s * 4
  }
  return Math.ceil(target / 4) * 4
}

function Legend({ series, values }) {
  return (
    <div className="rp-legend center">
      {series.map((s) => (
        <span key={s.key} className="rp-leg">
          <i style={{ background: s.color }} /> {s.label}
          {values && <b>{values[s.key]}</b>}
        </span>
      ))}
    </div>
  )
}

function TrendChart({ id, points, series, height = 240 }) {
  const W = 760
  const padL = 40
  const padR = 14
  const padT = 16
  const padB = 30
  if (!points.length) return <p className="rp-none">No activity in this window.</p>
  const max = axisMax(Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0))))
  const n = points.length
  const X = (i) => (n === 1 ? W / 2 : padL + (i * (W - padL - padR)) / (n - 1))
  const Y = (v) => height - padB - (v / max) * (height - padT - padB)
  const every = Math.max(1, Math.ceil(n / 10))

  return (
    <div className="rp-chart">
      <svg viewBox={`0 0 ${W} ${height}`} className="rp-svg" role="img" aria-label="Trend chart">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (max / 4) * t
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} className="rp-grid" />
              <text x={padL - 8} y={Y(v) + 4} textAnchor="end" className="rp-axis">{v}</text>
            </g>
          )
        })}
        {series.map((s) => {
          const pts = points.map((p, i) => [X(i), Y(p.values[s.key] || 0)])
          const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ')
          const area = `${line} L ${pts[n - 1][0]} ${height - padB} L ${pts[0][0]} ${height - padB} Z`
          return (
            <g key={s.key}>
              <path d={area} fill={`url(#${id}-${s.key})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={n > 45 ? 2 : 3.2} fill="#fff" stroke={s.color} strokeWidth="2">
                  <title>{`${points[i].full} — ${s.label}: ${points[i].values[s.key] || 0}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        {points.map((p, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={X(i)} y={height - 9} textAnchor="middle" className="rp-axis">{p.label}</text>
        ))}
      </svg>
      <Legend series={series} />
    </div>
  )
}

/* `hideZeros` — on a sparse chart a "0" over every empty slot is noise, so
   the caller can drop the label where there is no bar to label. */
function GroupedBars({ groups, series, height = 240, hideZeros = false }) {
  const W = 760
  const padL = 40
  const padR = 14
  const padT = 22
  const padB = 34
  if (!groups.length) return <p className="rp-none">Nothing to plot yet.</p>
  const max = axisMax(Math.max(0, ...groups.flatMap((g) => series.map((s) => g.values[s.key] || 0))))
  const band = (W - padL - padR) / groups.length
  const barW = Math.max(6, Math.min(48, (band * 0.6) / series.length))
  const Y = (v) => height - padB - (v / max) * (height - padT - padB)

  return (
    <div className="rp-chart">
      <svg viewBox={`0 0 ${W} ${height}`} className="rp-svg" role="img" aria-label="Grouped bar chart">
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (max / 4) * t
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} className="rp-grid" />
              <text x={padL - 8} y={Y(v) + 4} textAnchor="end" className="rp-axis">{v}</text>
            </g>
          )
        })}
        {groups.map((g, gi) => {
          const mid = padL + band * gi + band / 2
          const left = mid - (barW * series.length) / 2
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = g.values[s.key] || 0
                const h = Math.max(v > 0 ? 3 : 0, (v / max) * (height - padT - padB))
                return (
                  <g key={s.key}>
                    <rect x={left + si * barW} y={height - padB - h} width={barW - 4} height={h} rx="3" fill={s.color}>
                      <title>{`${g.full || g.label} — ${s.label}: ${v}`}</title>
                    </rect>
                    {groups.length <= 14 && !(hideZeros && v === 0) && (
                      <text x={left + si * barW + (barW - 4) / 2} y={height - padB - h - 6} textAnchor="middle" className="rp-bar-val">{v}</text>
                    )}
                  </g>
                )
              })}
              <text x={mid} y={height - 12} textAnchor="middle" className="rp-axis">{g.label}</text>
              {g.sub && <text x={mid} y={height - 1} textAnchor="middle" className="rp-axis dim">{g.sub}</text>}
            </g>
          )
        })}
      </svg>
      <Legend series={series} />
    </div>
  )
}

function Donut({ data, size = 190, caption, total }) {
  const sum = data.reduce((n, d) => n + d.value, 0)
  const r = size / 2 - 15
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="rp-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth="24" />
          {sum > 0 && data.map((d, i) => {
            const frac = d.value / sum
            const node = (
              <circle
                key={i}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color} strokeWidth="24"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acc * C}
              >
                <title>{`${d.label}: ${d.value} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            )
            acc += frac
            return node
          })}
        </g>
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle" className="rp-donut-val">{total ?? sum}</text>
        <text x={size / 2} y={size / 2 + 20} textAnchor="middle" className="rp-donut-cap">{caption}</text>
      </svg>
      <div className="rp-legend stat">
        {data.map((d, i) => (
          <span key={i} className="rp-leg">
            <i style={{ background: d.color }} /> {d.label}
            <b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/* A single ratio against a limit reads as a meter, not a two-slice pie.
   A used share far below 1% would render as nothing, so the fill keeps a
   hairline once anything at all has been spent. */
function Meter({ value, max, color, ticks }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const width = value > 0 ? Math.max(pct, 0.7) : 0
  return (
    <div className="rp-meter">
      <div className="rp-meter-track" title={`${value.toLocaleString()} of ${max.toLocaleString()} used`}>
        <div className="rp-meter-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <div className="rp-meter-ends">
        {ticks.map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  )
}

/* ---- reference-style trend block (Advanced report) -----------------
   The attached reference: one titled multi-series line chart carrying a
   bold value label on every point, a dashed zero baseline and a legend
   of line swatches, paired with a data table whose column headers are
   tinted to match each line.
   ------------------------------------------------------------------ */
const REF = {
  orange: '#ed7d31', yellow: '#e8a800', blue: '#4472c4', green: '#70ad47',
  red: '#c00000', teal: '#2f9e8f', grey: '#8a95a1',
}

/* Fold a day-indexed map into chart points — daily columns for a short
   window, month columns once the period outgrows them. */
function foldByDay(byDay, from, to, fields) {
  if (!from || !to) return []
  const keys = eachDay(from, to)
  const zero = () => Object.fromEntries(fields.map((f) => [f, 0]))
  if (keys.length <= 31) {
    return keys.map((k) => {
      const d = byDay.get(k) || {}
      const values = zero()
      for (const f of fields) values[f] = d[f] || 0
      return { label: String(Number(k.slice(8))), full: prettyDay(k), values }
    })
  }
  const m = new Map()
  for (const k of keys) {
    const ym = monthKey(k)
    const g = m.get(ym) || zero()
    const d = byDay.get(k)
    if (d) for (const f of fields) g[f] += d[f] || 0
    m.set(ym, g)
  }
  return [...m.entries()].map(([ym, values]) => ({
    label: new Date(`${ym}-01T00:00:00`).toLocaleString('en', { month: 'short' }),
    full: monthName(ym),
    values,
  }))
}

function LabeledLines({ id, title, points, series, height = 300, format = (v) => v }) {
  const W = 900
  const padL = 48
  const padR = 26
  const padT = 30
  const padB = 54
  if (!points.length) return <p className="rp-none">No activity in this window.</p>
  const max = axisMax(Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0))))
  const n = points.length
  const X = (i) => (n === 1 ? W / 2 : padL + (i * (W - padL - padR)) / (n - 1))
  const Y = (v) => height - padB - (v / max) * (height - padT - padB)
  const withLabels = n <= 16
  const every = Math.max(1, Math.ceil(n / 14))

  return (
    <div className="rp-chart">
      {title && <div className="rp-ref-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} className="rp-svg" role="img" aria-label={title || 'Trend chart'}>
        {[1, 2, 3, 4].map((t) => (
          <line key={t} x1={padL} x2={W - padR} y1={Y((max / 4) * t)} y2={Y((max / 4) * t)} className="rp-grid" />
        ))}
        {[0, 1, 2, 3, 4].map((t) => (
          <text key={t} x={padL - 10} y={Y((max / 4) * t) + 4} textAnchor="end" className="rp-axis">
            {format((max / 4) * t)}
          </text>
        ))}
        {/* zero baseline, dashed, as in the reference */}
        <line x1={padL} x2={W - padR} y1={Y(0)} y2={Y(0)} className="rp-zero" />
        {series.map((s) => {
          const pts = points.map((p, i) => [X(i), Y(p.values[s.key] || 0)])
          const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ')
          return (
            <g key={s.key}>
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={n > 30 ? 0 : 2.6} fill={s.color}>
                  <title>{`${points[i].full} — ${s.label}: ${format(points[i].values[s.key] || 0)}`}</title>
                </circle>
              ))}
              {withLabels && pts.map(([x, y], i) => (
                <text key={`l${i}`} x={x} y={y - 9} textAnchor="middle" className="rp-point-val" fill={s.color}>
                  {format(points[i].values[s.key] || 0)}
                </text>
              ))}
            </g>
          )
        })}
        {points.map((p, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={X(i)} y={height - 30} textAnchor="middle" className="rp-axis">{p.label}</text>
        ))}
      </svg>
      <div className="rp-legend center lines">
        {series.map((s) => (
          <span key={`${id}-${s.key}`} className="rp-leg"><i style={{ background: s.color }} /> {s.label}</span>
        ))}
      </div>
    </div>
  )
}

function SeriesTable({ caption, points, series, format = (v) => v, periodHead = 'Period' }) {
  if (!points.length) return null
  return (
    <div className="rp-reftable">
      <div className="rp-reftable-cap">{caption}</div>
      <div className="rp-reftable-scroll">
        <table>
          <thead>
            <tr>
              <th className="k">{periodHead}</th>
              {series.map((s) => (
                <th key={s.key} style={{ background: `color-mix(in srgb, ${s.color} 24%, #fff)` }}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td className="k">{p.full}</td>
                {series.map((s) => <td key={s.key}>{format(p.values[s.key] || 0)}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="k">Total</td>
              {series.map((s) => (
                <td key={s.key}>{format(points.reduce((n, p) => n + (p.values[s.key] || 0), 0))}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function TrendBlock({ id, title, caption, points, series, format, height }) {
  return (
    <div className="rp-refblock">
      <div className="rp-card">
        <LabeledLines id={id} title={title} points={points} series={series} format={format} height={height} />
      </div>
      <SeriesTable caption={caption} points={points} series={series} format={format} />
    </div>
  )
}

/* ---- calendar (Basic report) -------------------------------------- */
function MonthGrid({ ym, range, onPick }) {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startDow = first.getDay()
  const days = new Date(y, m, 0).getDate()
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const now = todayKey()
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
              className={`rp-cal-day ${inRange(k) ? 'in' : ''} ${isEdge(k) ? 'edge' : ''} ${k === now ? 'today' : ''}`}
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

const TREND_VIEWS = { 'Last 30 days': 30, 'Last 90 days': 90, 'Last 12 months': 365 }

function BasicReport({ visits, firstSeen }) {
  const today = todayKey()
  const thisMonth = monthKey(today)
  const lastMonth = addMonths(thisMonth, -1)
  const [anchor, setAnchor] = useState(thisMonth) // right-hand month of the pair
  /* The picker opens on demand; until then the field simply reads today. */
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState({ from: today, to: today })
  const [trendView, setTrendView] = useState('Last 30 days')
  const pickRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => {
      if (pickRef.current && !pickRef.current.contains(e.target)) setOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  /* An in-progress selection (end date not picked yet) reads as a single day. */
  const from = range.from
  const to = range.to || range.from

  /* Day-indexed tallies — every chart below is a different cut of these. */
  const visitByDay = useMemo(() => {
    const m = new Map()
    for (const v of visits) if (v.date) m.set(v.date, (m.get(v.date) || 0) + 1)
    return m
  }, [visits])

  const newByDay = useMemo(() => {
    const m = new Map()
    for (const d of firstSeen.values()) if (d) m.set(d, (m.get(d) || 0) + 1)
    return m
  }, [firstSeen])

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
      if (from && to && v.date >= from && v.date <= to) c.rangeVisit++
    }
    for (const d of firstSeen.values()) {
      if (d === today) c.todayPatient++
      const mk = monthKey(d)
      if (mk === thisMonth) c.monthPatient++
      if (mk === lastMonth) c.lastMonthPatient++
      if (from && to && d >= from && d <= to) c.rangePatient++
    }
    return c
  }, [visits, firstSeen, from, to, today, thisMonth, lastMonth])

  /* points for a run of days — daily when the window is short, rolled up
     into months once it grows past a month's worth of columns. */
  const pointsFor = (a, b, forceMonthly = false) => {
    if (!a || !b) return []
    const keys = eachDay(a, b)
    const daily = keys.map((k) => ({
      label: String(Number(k.slice(8))),
      full: prettyDay(k),
      values: { visits: visitByDay.get(k) || 0, patients: newByDay.get(k) || 0 },
    }))
    if (!forceMonthly && keys.length <= 31) return daily
    const m = new Map()
    for (const k of keys) {
      const ym = monthKey(k)
      const g = m.get(ym) || { visits: 0, patients: 0 }
      g.visits += visitByDay.get(k) || 0
      g.patients += newByDay.get(k) || 0
      m.set(ym, g)
    }
    return [...m.entries()].map(([ym, values]) => ({
      label: new Date(`${ym}-01T00:00:00`).toLocaleString('en', { month: 'short' }),
      full: monthName(ym),
      values,
    }))
  }

  const trendPoints = useMemo(() => {
    if (trendView === 'Last 12 months') return pointsFor(`${addMonths(thisMonth, -11)}-01`, today, true)
    const span = TREND_VIEWS[trendView]
    return pointsFor(toKey(new Date(Date.now() - (span - 1) * DAY_MS)), today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendView, visitByDay, newByDay, today, thisMonth])

  const rangePoints = useMemo(() => pointsFor(from, to), [from, to, visitByDay, newByDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k) => {
    setRange((r) => {
      if (!r.from || (r.from && r.to)) return { from: k, to: null }
      if (k < r.from) return { from: k, to: r.from }
      return { from: r.from, to: k }
    })
  }

  const preset = (a, b) => {
    setRange({ from: a, to: b })
    setAnchor(monthKey(b))
    setOpen(false)
  }

  const PRESETS = [
    ['Today', () => preset(today, today)],
    ['Last 7 days', () => preset(toKey(new Date(Date.now() - 6 * DAY_MS)), today)],
    ['Last 30 days', () => preset(toKey(new Date(Date.now() - 29 * DAY_MS)), today)],
    ['This month', () => preset(`${thisMonth}-01`, today)],
    ['Last month', () => {
      const [y, m] = lastMonth.split('-').map(Number)
      preset(`${lastMonth}-01`, toKey(new Date(y, m, 0)))
    }],
  ]

  const fieldLabel = !range.to
    ? `${prettyFull(range.from)} — pick end date…`
    : range.from === range.to
      ? prettyFull(range.from)
      : `${prettyFull(range.from)} – ${prettyFull(range.to)}`

  const SERIES = [
    { key: 'visits', label: 'Visits', color: '#199a57' },
    { key: 'patients', label: 'New patients', color: '#2e6fd1' },
  ]

  const earlierVisits = Math.max(0, counts.totalVisit - counts.monthVisit - counts.lastMonthVisit)
  const earlierPatients = Math.max(0, counts.totalPatient - counts.monthPatient - counts.lastMonthPatient)

  return (
    <>
      {/* date control — reads today's date until the picker is opened */}
      <div className="rp-daterow">
        <div className="rp-datepick" ref={pickRef}>
          <button
            type="button"
            className={`rp-datefield ${open ? 'on' : ''}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <CalendarDays size={16} />
            <span>{fieldLabel}</span>
            <ChevronDown size={15} className="rp-chev" />
          </button>

          {open && (
            <div className="rp-cal-card rp-cal-pop">
              <div className="rp-cal-presets">
                {PRESETS.map(([label, fn]) => (
                  <button key={label} type="button" onClick={fn}>{label}</button>
                ))}
              </div>
              <div className="rp-cal-nav">
                <button type="button" onClick={() => setAnchor((a) => addMonths(a, -1))}><ChevronLeft size={17} /></button>
                <div className="rp-cal-pair">
                  <MonthGrid ym={addMonths(anchor, -1)} range={range} onPick={pick} />
                  <MonthGrid ym={anchor} range={range} onPick={pick} />
                </div>
                <button type="button" onClick={() => setAnchor((a) => addMonths(a, 1))}><ChevronRight size={17} /></button>
              </div>
              <div className="rp-cal-totals">
                <span>Total Visit: <b className="t-green">{counts.rangeVisit}</b></span>
                <span>Total New Patients: <b className="t-blue">{counts.rangePatient}</b></span>
                {range.from && !range.to && <em>select the end date…</em>}
                <button type="button" className="rp-cal-done" onClick={() => setOpen(false)}>Done</button>
              </div>
            </div>
          )}
        </div>

        <div className="rp-chips">
          <span className="rp-chip green">Visits in range <b>{counts.rangeVisit}</b></span>
          <span className="rp-chip blue">New patients in range <b>{counts.rangePatient}</b></span>
        </div>
      </div>

      {/* trend */}
      <div className="rp-card">
        <div className="rp-card-head">
          <h4>Visit &amp; New Patient Trend</h4>
          <select value={trendView} onChange={(e) => setTrendView(e.target.value)}>
            {Object.keys(TREND_VIEWS).map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <TrendChart id="rp-trend" points={trendPoints} series={SERIES} />
      </div>

      {/* period comparison + visit share */}
      <div className="rp-duo wide">
        <div className="rp-card">
          <h4>Today vs This Month vs Last Month</h4>
          <GroupedBars
            groups={[
              { label: 'Today', sub: prettyDay(today), values: { visits: counts.todayVisit, patients: counts.todayPatient } },
              { label: 'This Month', sub: monthName(thisMonth), values: { visits: counts.monthVisit, patients: counts.monthPatient } },
              { label: 'Last Month', sub: monthName(lastMonth), values: { visits: counts.lastMonthVisit, patients: counts.lastMonthPatient } },
            ]}
            series={SERIES}
          />
        </div>
        <div className="rp-card">
          <h4>Total Visit — where they fall</h4>
          <Donut
            caption="TOTAL VISIT"
            total={counts.totalVisit}
            data={[
              { label: monthName(thisMonth), value: counts.monthVisit, color: '#199a57' },
              { label: monthName(lastMonth), value: counts.lastMonthVisit, color: '#8ec8f6' },
              { label: 'Earlier', value: earlierVisits, color: '#cfd8dc' },
            ]}
          />
        </div>
      </div>

      {/* selected range + patient share */}
      <div className="rp-duo wide">
        <div className="rp-card">
          <div className="rp-card-head">
            <h4>Count by date</h4>
            <span className="rp-card-note">{fieldLabel}</span>
          </div>
          {rangePoints.length <= 14
            ? <GroupedBars groups={rangePoints} series={SERIES} height={220} />
            : <TrendChart id="rp-range" points={rangePoints} series={SERIES} height={220} />}
          <div className="rp-cal-totals">
            <span>Total Visit: <b className="t-green">{counts.rangeVisit}</b></span>
            <span>Total New Patients: <b className="t-blue">{counts.rangePatient}</b></span>
          </div>
        </div>
        <div className="rp-card">
          <h4>Total Patient — where they arrived</h4>
          <Donut
            caption="TOTAL PATIENT"
            total={counts.totalPatient}
            data={[
              { label: monthName(thisMonth), value: counts.monthPatient, color: '#6b4fc9' },
              { label: monthName(lastMonth), value: counts.lastMonthPatient, color: '#b39ddb' },
              { label: 'Earlier', value: earlierPatients, color: '#cfd8dc' },
            ]}
          />
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

function AppointmentsTab({ appts, win }) {
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
  const busiest = [...stats.byDay.entries()].reduce(
    (best, [k, d]) => {
      const n = d.completed + d.noshow + d.cancelled
      return n > best.n ? { k, n } : best
    },
    { k: null, n: 0 }
  )

  const newTotal = appts.filter((a) => a.isNew).length
  const oldTotal = appts.length - newTotal

  const points = useMemo(
    () => foldByDay(stats.byDay, win.from, win.to, ['completed', 'noshow', 'cancelled', 'newP', 'oldP'])
      .map((p) => ({ ...p, values: { ...p.values, total: p.values.completed + p.values.noshow + p.values.cancelled } })),
    [stats.byDay, win]
  )

  const outcomeSeries = [
    { key: 'total', label: 'All appointments', color: REF.blue },
    { key: 'completed', label: 'Completed', color: REF.green },
    { key: 'noshow', label: 'No Show', color: REF.yellow },
    { key: 'cancelled', label: 'Cancelled', color: REF.orange },
  ]

  /* the filter strip below re-points the second chart at one outcome */
  const visitSeries =
    filter === 'ALL'
      ? [
          { key: 'newP', label: 'New', color: REF.blue },
          { key: 'oldP', label: 'Old', color: REF.green },
        ]
      : [{
          key: filter === 'COMPLETED' ? 'completed' : filter === 'NO SHOW' ? 'noshow' : 'cancelled',
          label: filter,
          color: filter === 'COMPLETED' ? REF.green : filter === 'NO SHOW' ? REF.yellow : REF.orange,
        }]

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

      <TrendBlock
        id="ap-outcome"
        title="Appointment Outcomes"
        caption="Appointment outcomes by period"
        points={points}
        series={outcomeSeries}
      />

      <div className="rp-duo">
        <div className="rp-card">
          <h4>Outcome Share</h4>
          <Pie
            data={[
              { label: 'Complete', value: stats.completed, color: COLORS.green },
              { label: 'No Show', value: stats.noshow, color: COLORS.amber },
              { label: 'Cancelled', value: stats.cancelled, color: COLORS.rose },
            ]}
          />
        </div>
        <div className="rp-card">
          <h4>New vs Old Visits</h4>
          <Pie
            data={[
              { label: 'New', value: newTotal, color: COLORS.sky },
              { label: 'Old', value: oldTotal, color: COLORS.green },
              { label: 'Report', value: 0, color: COLORS.violet },
            ]}
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

      <TrendBlock
        id="ap-visits"
        title={filter === 'ALL' ? 'New vs Old Visits' : `${filter} Visits`}
        caption={filter === 'ALL' ? 'New vs old visits by period' : `${filter} visits by period`}
        points={points}
        series={visitSeries}
      />
    </>
  )
}

function AccountsTab({ invoices, appts, win }) {
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

  const bdt = (n) => `৳${Math.round(n).toLocaleString()}`

  const points = useMemo(
    () => foldByDay(stats.byDay, win.from, win.to, ['newAmt', 'oldAmt'])
      .map((p) => ({
        ...p,
        values: {
          newAmt: Math.round(p.values.newAmt),
          oldAmt: Math.round(p.values.oldAmt),
          total: Math.round(p.values.newAmt + p.values.oldAmt),
        },
      })),
    [stats.byDay, win]
  )

  const series = [
    { key: 'total', label: 'Total', color: REF.blue },
    { key: 'newAmt', label: 'New patient', color: REF.teal },
    { key: 'oldAmt', label: 'Old patient', color: REF.green },
  ]

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

      {stats.byDay.size === 0 ? (
        <div className="rp-card"><p className="rp-none">No settled invoices in this period.</p></div>
      ) : (
        <TrendBlock
          id="ac-collect"
          title="Collections — New vs Old Patient"
          caption="Collections by period (৳)"
          points={points}
          series={series}
          format={bdt}
        />
      )}
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
/* Two channels the reader must tell apart, so: categorical, at ink strength
   rather than the pastel fills — the pale set fails contrast against the
   card. The recency ramp is one hue, dark = most recent. */
const SMS_INK = { reminder: '#2e6fd1', followup: '#199a57' }
const RECENCY = ['#0f5f3a', '#199a57', '#6ec59b']
const shortMonth = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en', { month: 'short' })

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
  const remDates = reminders.map((a) => a.date)
  const fuDates = fuTexts.map((s) => String(s.date || '').slice(0, 10))
  const rows = view === 'overall' ? [...remDates, ...fuDates] : fuDates
  const used = rows.length
  const remaining = SMS_QUOTA - used

  const inMonth = (dates, ym) => dates.filter((d) => monthKey(d || '') === ym).length
  const sentToday = rows.filter((d) => d === today).length
  const sentMonth = inMonth(rows, thisMonth)
  const sentLast = inMonth(rows, lastMonth)
  const delta = sentMonth - sentLast

  const pct = (used / SMS_QUOTA) * 100
  const pctText = used === 0 ? '0' : pct < 1 ? pct.toFixed(2) : pct.toFixed(1)

  /* Six months of columns — the month tiles alone can't show whether the
     load is climbing, so the same numbers get a time axis. */
  const months = []
  for (let i = 5; i >= 0; i--) months.push(addMonths(thisMonth, -i))
  const series =
    view === 'overall'
      ? [
          { key: 'reminder', label: 'Reminder texts', color: SMS_INK.reminder },
          { key: 'followup', label: 'Follow-up texts', color: SMS_INK.followup },
        ]
      : [{ key: 'followup', label: 'Follow-up texts', color: SMS_INK.followup }]
  const groups = months.map((ym, i) => ({
    label: shortMonth(ym),
    sub: i === 0 || ym.endsWith('-01') ? ym.slice(0, 4) : '',
    full: monthName(ym),
    values: { reminder: inMonth(remDates, ym), followup: inMonth(fuDates, ym) },
  }))

  /* Overall traffic splits by channel; the follow-up view has only one
     channel, so it splits by recency instead. */
  const split =
    view === 'overall'
      ? [
          { label: 'Reminder texts', value: reminders.length, color: SMS_INK.reminder },
          { label: 'Follow-up texts', value: fuTexts.length, color: SMS_INK.followup },
        ]
      : [
          { label: 'This month', value: sentMonth, color: RECENCY[0] },
          { label: 'Last month', value: sentLast, color: RECENCY[1] },
          { label: 'Earlier', value: Math.max(0, used - sentMonth - sentLast), color: RECENCY[2] },
        ]

  return (
    <>
      <div className="rp-com-bar">
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
      </div>

      <div className="rp-card rp-quota">
        <div className="rp-quota-top">
          <div>
            <div className="rp-quota-cap">SMS REMAINING</div>
            <div className="rp-quota-hero">{remaining.toLocaleString()}</div>
          </div>
          <div className="rp-quota-facts">
            <span><em>Availed</em><b>{SMS_QUOTA.toLocaleString()}</b></span>
            <span><em>Used</em><b>{used.toLocaleString()}</b></span>
            <span><em>Consumed</em><b>{pctText}%</b></span>
          </div>
        </div>
        <Meter value={used} max={SMS_QUOTA} color={SMS_INK.followup} ticks={['0', SMS_QUOTA.toLocaleString()]} />
      </div>

      <div className="rp-duo wide">
        <div className="rp-card">
          <div className="rp-card-head">
            <h4>SMS sent per month</h4>
            <span className="rp-card-note">Last 6 months</span>
          </div>
          <GroupedBars groups={groups} series={series} hideZeros />
        </div>
        <div className="rp-card">
          <div className="rp-card-head">
            <h4>{view === 'overall' ? 'Message mix' : 'When they went out'}</h4>
          </div>
          {used > 0 ? (
            <Donut data={split} total={used} caption="SMS USED" />
          ) : (
            <p className="rp-none">Nothing sent yet in this view.</p>
          )}
        </div>
      </div>

      <div className="rp-kpis three">
        <div className="rp-kpi">
          <div className="rp-kpi-label caps">SMS SENT TODAY</div>
          <div className="rp-kpi-big">{sentToday.toLocaleString()}</div>
          <div className="rp-kpi-sub">{prettyFull(today)}</div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-label caps">SMS SENT THIS MONTH</div>
          <div className="rp-kpi-big">{sentMonth.toLocaleString()}</div>
          <div className={`rp-kpi-sub delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
            {delta === 0 ? 'Level with last month' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last month`}
          </div>
        </div>
        <div className="rp-kpi">
          <div className="rp-kpi-label caps">SMS SENT LAST MONTH</div>
          <div className="rp-kpi-big">{sentLast.toLocaleString()}</div>
          <div className="rp-kpi-sub">{monthName(lastMonth)}</div>
        </div>
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
  const win = useMemo(
    () => ({ from: toKey(new Date(Date.now() - PERIODS[period] * DAY_MS)), to: todayKey() }),
    [period]
  )

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
          {tab === 'appointments' && <AppointmentsTab appts={periodAppts} win={win} />}
          {tab === 'accounts' && <AccountsTab invoices={periodInvoices} appts={periodAppts} win={win} />}
          {tab === 'patients' && (
            <PatientsTab appts={periodAppts} patients={patients} pads={periodPads} rxRecords={rxRecords} />
          )}
          {tab === 'communication' && <CommunicationTab allAppts={allAppts} pads={pads} />}
        </>
      )}
    </div>
  )
}
