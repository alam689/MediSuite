/* Form field primitives — used by the auto-generated create/edit forms. */

export function Field({ label, required, error, children, hint, className = '' }) {
  return (
    <label className={`ff ${className}`}>
      {label && (
        <span className="ff-label">
          {label}
          {required && <span className="ff-req"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="ff-error">{error}</span>
      ) : hint ? (
        <span className="ff-hint">{hint}</span>
      ) : null}
    </label>
  )
}

export function TextInput({ value, onChange, ...rest }) {
  return (
    <input
      className="ff-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

export function TextArea({ value, onChange, rows = 3, ...rest }) {
  return (
    <textarea
      className="ff-input ff-textarea"
      rows={rows}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}

export function Select({ value, onChange, options = [], placeholder }) {
  return (
    <select
      className="ff-input ff-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value
        const lab = typeof o === 'string' ? o : o.label
        return (
          <option value={val} key={val}>
            {lab}
          </option>
        )
      })}
    </select>
  )
}
