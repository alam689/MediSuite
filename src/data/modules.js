/* Nav metadata derived from the interactive schemas — single source of
   truth lives in schemas.js. Sidebar and Dashboard consume this slim view. */
import { schemas } from './schemas.js'

export const modules = schemas.map((s) => ({
  key: s.key,
  label: s.label,
  icon: s.icon,
  accent: s.accent,
  tagline: s.tagline,
  desc: s.desc,
}))

export const moduleMap = Object.fromEntries(modules.map((m) => [m.key, m]))
