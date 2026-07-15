import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localISO } from './helpers.js'

/* =====================================================================
   Month calendar for picking an appointment date.

   Works in calendar days in the user's own zone (localISO), never UTC —
   an appointment on "the 16th" means the 16th where the patient is.

   `enabledDays` is a Set of weekday numbers (0=Sun) the doctor actually
   sits at the chosen hospital; everything else is shown but not
   selectable, so the patient can see *why* a day is unavailable rather
   than wondering where it went.
   ===================================================================== */

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/* How far ahead a patient may book. */
const HORIZON_DAYS = 90

export default function Calendar({ value, onChange, enabledDays, maxDays = HORIZON_DAYS }) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const selected = value ? new Date(`${value}T00:00:00`) : null
  const [cursor, setCursor] = useState(() => {
    const base = selected || today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const last = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxDays)
    return d
  }, [today, maxDays])

  const days = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const offset = first.getDay() // leading blanks before the 1st
    const inMonth = new Date(year, month + 1, 0).getDate()

    // Only the rows this month needs — a fixed 6 always leaves a dead row.
    const rows = Math.ceil((offset + inMonth) / 7)

    const start = new Date(first)
    start.setDate(1 - offset) // back up to the Sunday of week 1

    return Array.from({ length: rows * 7 }, (_, i) => {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      return day
    })
  }, [cursor])

  const canGoBack = cursor > new Date(today.getFullYear(), today.getMonth(), 1)
  const canGoForward = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) <= last

  const step = (n) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="cal-title" aria-live="polite">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => step(1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="cal-dow">
        {DOW_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-grid" role="grid">
        {days.map((day) => {
          const iso = localISO(day)
          const outside = day.getMonth() !== cursor.getMonth()
          const isPast = day < today
          const beyond = day > last
          const closed = enabledDays ? !enabledDays.has(day.getDay()) : false
          const disabled = isPast || beyond || closed
          const isToday = day.getTime() === today.getTime()
          const isSelected = value === iso

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={[
                'cal-day',
                outside ? 'out' : '',
                isToday ? 'today' : '',
                isSelected ? 'on' : '',
              ].join(' ')}
              disabled={disabled}
              aria-label={day.toDateString()}
              aria-selected={isSelected}
              title={closed && !isPast && !beyond ? 'The doctor does not sit here on this day' : undefined}
              onClick={() => onChange(iso)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
