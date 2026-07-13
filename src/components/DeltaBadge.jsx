import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

/* Small pill next to a metric. up = green fill, down = rose fill. */
export default function DeltaBadge({ delta, up = true }) {
  const tone = up ? 'var(--tone-green)' : 'var(--tone-rose)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: tone,
        background: `color-mix(in srgb, ${tone} 14%, transparent)`,
      }}
    >
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {delta}
    </span>
  )
}
