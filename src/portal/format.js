/* Shared formatting for the doctor, pharmacy and laboratory portals. */

/* "Dr. Sara Malik" → "Sara". Honorifics are chrome, not a name. */
export function firstName(full = '') {
  const parts = String(full)
    .split(/\s+/)
    .filter((t) => t && !/^(dr|dr\.|prof|prof\.|mr|mrs|ms)$/i.test(t))
  return parts[0] || full
}

/* Amounts are stored as display strings ("$12,400") because that is how the
   seed and every form writes them. Anything that adds them up has to parse
   first — and has to fail to 0 rather than NaN, or one bad row blanks a
   whole total. */
export function money(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function usd(n) {
  return `$${Math.round(n).toLocaleString()}`
}

/* Turnaround time between two timestamps, as a human would say it. Returns
   null when either end is missing — an unknown TAT must read as unknown,
   not as zero. */
export function turnaround(from, to = Date.now()) {
  if (!from || !to) return null
  const mins = Math.max(0, Math.round((to - from) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/* Is an analyte value outside its reference range?

   Returns null — not false — when the range or value is missing or
   non-numeric. "No range recorded" and "within range" are different facts,
   and colouring the second onto the first would quietly assert a normal
   result nobody checked. */
export function outOfRange(analyte) {
  const v = Number(analyte?.value)
  if (!Number.isFinite(v)) return null
  const low = Number(analyte?.low)
  const high = Number(analyte?.high)
  const hasLow = Number.isFinite(low)
  const hasHigh = Number.isFinite(high)
  if (!hasLow && !hasHigh) return null
  if (hasLow && v < low) return true
  if (hasHigh && v > high) return true
  return false
}

/* Days until a date string, negative when already past. */
export function daysUntil(iso) {
  if (!iso) return null
  const then = new Date(`${iso}T00:00:00`).getTime()
  if (Number.isNaN(then)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((then - today.getTime()) / 86400000)
}
