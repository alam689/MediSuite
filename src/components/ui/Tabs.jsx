export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className={`tab ${active === t.key ? 'is-active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {Icon && <Icon size={16} />}
            {t.label}
            {t.badge != null && <span className="tab-badge">{t.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
