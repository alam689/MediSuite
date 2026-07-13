import { useMemo, useState } from 'react'
import { BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useAccent } from '../components/useAccent.js'
import './features.css'

/* Deterministic pseudo-series so charts are stable across renders. */
function series(n, seed, base, amp) {
  const out = []
  for (let i = 0; i < n; i++) {
    const v = base + Math.sin((i + seed) * 0.7) * amp + ((i * 37 + seed * 13) % 11) * (amp / 12)
    out.push(Math.max(1, Math.round(v)))
  }
  return out
}

function BarChart({ data, labels, accent }) {
  const w = 560
  const h = 220
  const pad = 28
  const max = Math.max(...data) * 1.15
  const bw = (w - pad * 2) / data.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" role="img" aria-label="Bar chart">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={h - pad - g * (h - pad * 2)} y2={h - pad - g * (h - pad * 2)} stroke="var(--border)" strokeWidth="1" />
      ))}
      {data.map((v, i) => {
        const bh = (v / max) * (h - pad * 2)
        const x = pad + i * bw + bw * 0.18
        const y = h - pad - bh
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.64} height={bh} rx="4" fill={accent} opacity={0.85}>
              <title>{`${labels[i]}: ${v}`}</title>
            </rect>
            {i % Math.ceil(data.length / 7) === 0 && (
              <text x={x + bw * 0.32} y={h - pad + 14} textAnchor="middle" className="chart-axis">
                {labels[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Donut({ slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  let acc = 0
  const r = 60
  const c = 2 * Math.PI * r
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" className="donut">
        <g transform="translate(80,80) rotate(-90)">
          {slices.map((s) => {
            const frac = s.value / total
            const dash = `${frac * c} ${c}`
            const el = (
              <circle
                key={s.label}
                r={r}
                fill="none"
                stroke={`var(--tone-${s.tone})`}
                strokeWidth="20"
                strokeDasharray={dash}
                strokeDashoffset={-acc * c}
              >
                <title>{`${s.label}: ${Math.round(frac * 100)}%`}</title>
              </circle>
            )
            acc += frac
            return el
          })}
        </g>
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div key={s.label} className="legend-row">
            <span className="legend-dot" style={{ background: `var(--tone-${s.tone})` }} />
            {s.label}
            <span className="legend-val">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsInsights({ schema }) {
  const accent = useAccent(schema.accent)
  const { state } = useData()
  const [range, setRange] = useState(14)

  const volume = useMemo(() => series(range, 3, 1600, 260), [range])
  const labels = useMemo(
    () => Array.from({ length: range }, (_, i) => `D${i + 1}`),
    [range]
  )

  // Revenue mix derived from live billing categories
  const mix = useMemo(() => {
    const bills = state.billing || []
    const cats = ['Consultation', 'Pharmacy', 'Laboratory', 'Insurance', 'Corporate']
    const tones = { Consultation: 'teal', Pharmacy: 'green', Laboratory: 'blue', Insurance: 'violet', Corporate: 'amber' }
    return cats
      .map((c) => ({
        label: c,
        tone: tones[c],
        value: bills.filter((b) => b.category === c).reduce((a, b) => a + (parseFloat(String(b.amount).replace(/[^0-9.]/g, '')) || 0), 0) || 1,
      }))
      .filter((s) => s.value > 0)
  }, [state.billing])

  const totalVol = volume.reduce((a, v) => a + v, 0)

  return (
    <div className="insights">
      <div className="panel insights-main">
        <div className="panel-head">
          <span className="ph-icon">
            <BarChart3 size={16} />
          </span>
          Consultation Volume
          <div className="range-toggle">
            {[7, 14, 30].map((n) => (
              <button key={n} className={`range-btn ${range === n ? 'is-active' : ''}`} onClick={() => setRange(n)}>
                {n}d
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          <div className="insight-metric">
            <TrendingUp size={16} /> {totalVol.toLocaleString()} consultations over {range} days
          </div>
          <BarChart data={volume} labels={labels} accent={accent} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="ph-icon">
            <PieChart size={16} />
          </span>
          Revenue Mix
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          <Donut slices={mix} />
          <p className="result-disclaimer" style={{ marginTop: 12 }}>
            Computed live from Billing records — add invoices to see the mix shift.
          </p>
        </div>
      </div>
    </div>
  )
}
