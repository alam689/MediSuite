import { initialsOf } from '../../utils/files.js'

/* Photo if present, otherwise an initials circle. */
export default function Avatar({ src, name, size = 34 }) {
  const style = { width: size, height: size }
  if (src) {
    return <img className="avatar-img" style={style} src={src} alt={name || ''} />
  }
  return (
    <span className="avatar-fallback" style={{ ...style, fontSize: Math.round(size * 0.4) }}>
      {initialsOf(name)}
    </span>
  )
}
