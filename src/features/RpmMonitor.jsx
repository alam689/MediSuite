import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Pause, Play, Bell } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import './features.css'

/* Parse a numeric baseline + unit from a reading string. */
function baseOf(reading = '') {
  const m = String(reading).match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : 60
}

function Sparkline({ points, tone }) {
  const w = 120
  const h = 34
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * (h - 6) - 3
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="spark">
      <path d={d} fill="none" stroke={`var(--tone-${tone})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function RpmMonitor({ schema }) {
  const { records, patch } = useData()
  const toast = useToast()
  const rows = records(schema.key)

  const [live, setLive] = useState(true)
  // series per patient
  const [series, setSeries] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.resourceId, Array.from({ length: 16 }, () => baseOf(r.reading))]))
  )
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      setSeries((prev) => {
        const next = { ...prev }
        for (const r of rowsRef.current) {
          const arr = prev[r.resourceId] || Array.from({ length: 16 }, () => baseOf(r.reading))
          const last = arr[arr.length - 1]
          const drift = (Math.random() - 0.5) * (baseOf(r.reading) * 0.06 + 1)
          const val = Math.max(1, last + drift)
          next[r.resourceId] = [...arr.slice(1), val]
        }
        return next
      })
    }, 1500)
    return () => clearInterval(id)
  }, [live])

  const ack = (r) => {
    patch(schema.key, r.resourceId, { status: 'Watch' }, { title: 'Alert acknowledged', sub: `${r.patient} · ${r.reading}` })
    toast.success('Alert acknowledged — care team notified', { title: r.resourceId })
  }

  const critical = useMemo(() => rows.filter((r) => r.status === 'Critical' || r.status === 'High'), [rows])

  return (
    <div>
      <div className="monitor-bar">
        <div className="monitor-status">
          <span className={`live-dot ${live ? 'on' : ''}`} />
          {live ? 'Streaming live' : 'Paused'} · {rows.length} devices
        </div>
        <button className="btn btn-ghost" onClick={() => setLive((l) => !l)}>
          {live ? <Pause size={15} /> : <Play size={15} />} {live ? 'Pause' : 'Resume'}
        </button>
      </div>

      {critical.length > 0 && (
        <div className="alert-banner">
          <Bell size={16} />
          {critical.length} patient{critical.length > 1 ? 's' : ''} need attention
        </div>
      )}

      <div className="vitals-grid">
        {rows.map((r) => {
          const pts = series[r.resourceId] || [baseOf(r.reading)]
          const cur = pts[pts.length - 1]
          const tone = schema.statusTones[r.status] || 'teal'
          // metric prefix (e.g. "SpO₂", "HR") + trailing unit (e.g. "%", "mg/dL")
          const metric = (String(r.reading).match(/^[^\d/]+/) || [''])[0].trim()
          const unit = (String(r.reading).match(/[%a-zA-Z/]+\s*$/) || [''])[0].trim()
          return (
            <div className={`vital-card tone-${tone}`} key={r.resourceId}>
              <div className="vital-top">
                <div>
                  <div className="vital-name">{r.patient}</div>
                  <div className="vital-device">{r.device}</div>
                </div>
                <span className={`pill tone-${tone}`}>{r.status}</span>
              </div>
              {metric && <div className="vital-metric">{metric}</div>}
              <div className="vital-value">
                {Math.round(cur)}
                <span className="vital-unit">{unit}</span>
              </div>
              <Sparkline points={pts} tone={tone} />
              {(r.status === 'Critical' || r.status === 'High') && (
                <button className="btn btn-ghost vital-ack" onClick={() => ack(r)}>
                  Acknowledge
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
