import { outOfRange, daysUntil } from './format.js'
import { localISO, prettyDate } from '../patient/helpers.js'

/* =====================================================================
   "What needs you", defined once per role.

   Each portal's home page already computed this, and the notification bell
   needs the same answer on every other page. Two derivations of the same
   list is a bug waiting to be reported as "the badge says 3 but I only see
   2" — so both read from here.

   A builder returns items ordered worst-first:

     { id, tone, title, sub, to }

   `id` must be stable across renders and unique across roles, because it is
   what the bell stores to remember what has been seen. Deriving it from the
   record id rather than an array index means a dismissed item stays
   dismissed when the list around it changes.
   ===================================================================== */

/* Tone is a colour, and colour is a rough proxy for urgency — good enough
   for most rows. Where it is wrong, an item sets `weight` explicitly.

   The case that forced this: a live consultation is violet (it is not an
   error, it is in progress) which sorted it *below* an unsigned note. A
   patient sitting on a call while the page tells the doctor to do paperwork
   is exactly backwards, and no colour choice fixes it — the urgency simply
   isn't the same axis as the colour. Lower sorts first. */
const rank = { rose: 0, amber: 10, violet: 20, blue: 30, teal: 40, green: 50 }
const weightOf = (n) => n.weight ?? rank[n.tone] ?? 90
const bySeverity = (a, b) => weightOf(a) - weightOf(b)

/* ------------------------------------------------------------- Doctor */
export function doctorNotifications({ consults = [], appointments = [], notes = [], prescriptions = [], labs = [], vitals = [] }) {
  const today = localISO()
  const out = []

  for (const c of consults) {
    if (c.status === 'Live') {
      out.push({
        id: `consult-live:${c.resourceId}`,
        tone: 'violet',
        weight: 0, // someone is on the call right now
        title: `${c.patient} is on the call now`,
        sub: `${c.mode} · ${c.reason || 'Consultation'}`,
        to: '/doctor/consults',
      })
    } else if (c.status === 'Waiting') {
      out.push({
        id: `consult-wait:${c.resourceId}`,
        tone: 'amber',
        weight: 5, // a person is sitting there waiting on you
        title: `${c.patient} is in your waiting room`,
        sub: `${c.mode} · ${c.reason || 'Consultation'}`,
        to: '/doctor/consults',
      })
    } else if (c.status === 'Ended' && c.resumeRequested) {
      out.push({
        id: `consult-resume:${c.resourceId}`,
        tone: 'amber',
        title: `${c.patient} asked to resume`,
        sub: 'Consultation ended but not completed',
        to: '/doctor/consults',
      })
    }
  }

  for (const v of vitals) {
    if (v.status !== 'Critical' && v.status !== 'High') continue
    out.push({
      id: `vitals:${v.resourceId}`,
      tone: v.status === 'Critical' ? 'rose' : 'amber',
      title: `${v.status} vitals — ${v.patient}`,
      sub: `${v.device} · ${v.reading}`,
      to: '/doctor/patients',
    })
  }

  for (const a of appointments) {
    if (a.status === 'Urgent') {
      out.push({
        id: `appt-urgent:${a.resourceId}`,
        tone: 'rose',
        title: `Urgent appointment — ${a.patient}`,
        sub: `${prettyDate(a.date)} ${a.time} · ${a.type}`,
        to: '/doctor/schedule',
      })
    } else if (a.status === 'Pending') {
      /* A request whose slot has already passed is not a booking to confirm
         — it is one nobody answered. Saying "request" would invite the
         doctor to confirm a date in the past. */
      const lapsed = (a.date || '') < today
      out.push({
        id: `appt-pending:${a.resourceId}`,
        tone: lapsed ? 'amber' : 'blue',
        title: lapsed ? `Unanswered request — ${a.patient}` : `Appointment request — ${a.patient}`,
        sub: `${prettyDate(a.date)} ${a.time} · ${a.type}${lapsed ? ' · slot has passed' : ''}`,
        to: '/doctor/schedule',
      })
    }
  }

  for (const l of labs) {
    if (l.status === 'Abnormal') {
      out.push({
        id: `lab-abnormal:${l.resourceId}`,
        tone: 'rose',
        title: `Abnormal result — ${l.patient}`,
        sub: `${l.test} · ${l.result || 'see report'}`,
        to: '/doctor/labs',
      })
    } else if (l.status === 'Ready to approve') {
      out.push({
        id: `lab-review:${l.resourceId}`,
        tone: 'blue',
        title: `Result awaiting your review — ${l.patient}`,
        sub: `${l.test} · ${l.lab || 'lab'}`,
        to: '/doctor/labs',
      })
    }
  }

  for (const r of prescriptions) {
    if (r.status === 'Refill') {
      out.push({
        id: `rx-refill:${r.resourceId}`,
        tone: 'amber',
        title: `Refill to authorise — ${r.patient}`,
        sub: `${r.drug} · ${r.refills || 0} remaining`,
        to: '/doctor/prescriptions',
      })
    } else if (r.status === 'Interaction' || r.status === 'Allergy') {
      out.push({
        id: `rx-hold:${r.resourceId}`,
        tone: 'amber',
        title: `Prescription on hold — ${r.patient}`,
        sub: `${r.drug} · ${r.status}`,
        to: '/doctor/prescriptions',
      })
    } else if (r.status === 'Rejected') {
      /* The pharmacy pushed this back. Nobody else will chase it. */
      out.push({
        id: `rx-rejected:${r.resourceId}`,
        tone: 'rose',
        title: `Pharmacy could not fill — ${r.patient}`,
        sub: `${r.drug}${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`,
        to: '/doctor/prescriptions',
      })
    }
  }

  for (const n of notes) {
    if (n.status === 'Signed') continue
    out.push({
      id: `note:${n.resourceId}`,
      tone: 'amber',
      title: `Note unsigned — ${n.patient}`,
      sub: `${n.type} · ${n.status}`,
      to: '/doctor/notes',
    })
  }

  return out.sort(bySeverity)
}

/* ------------------------------------------------------------ Patient */
export function patientNotifications({ appointments = [], consults = [], prescriptions = [], labs = [], invoices = [] }) {
  const out = []

  for (const c of consults) {
    if (c.status === 'Live') {
      out.push({
        id: `p-consult-live:${c.resourceId}`,
        tone: 'violet',
        weight: 0, // the doctor is waiting on the call right now
        title: 'Your doctor is ready — join now',
        sub: `${c.doctor} · ${c.mode}`,
        to: '/patient/consult',
      })
    } else if (c.status === 'Waiting') {
      out.push({
        id: `p-consult-wait:${c.resourceId}`,
        tone: 'amber',
        title: "You're in the waiting room",
        sub: `${c.doctor} · ${c.mode}`,
        to: '/patient/consult',
      })
    }
  }

  for (const r of prescriptions) {
    if (r.status === 'Dispensed') {
      out.push({
        id: `p-rx-ready:${r.resourceId}`,
        tone: 'green',
        title: `${r.drug} is ready to collect`,
        sub: r.pharmacy || 'your pharmacy',
        to: '/patient/prescriptions',
      })
    } else if (r.status === 'Out for delivery') {
      out.push({
        id: `p-rx-out:${r.resourceId}`,
        tone: 'blue',
        title: `${r.drug} is on its way to you`,
        sub: `From ${r.pharmacy || 'your pharmacy'}`,
        to: '/patient/prescriptions',
      })
    } else if (r.status === 'Rejected') {
      out.push({
        id: `p-rx-rejected:${r.resourceId}`,
        tone: 'rose',
        title: `${r.drug} could not be filled`,
        sub: 'Contact your doctor — the pharmacy has sent it back',
        to: '/patient/prescriptions',
      })
    }
  }

  /* Only released results. A result the clinician has not approved is not
     the patient's to read yet, and telling them one exists is the same
     disclosure by another route. */
  for (const l of labs) {
    if (l.status !== 'Approved') continue
    out.push({
      id: `p-lab:${l.resourceId}`,
      tone: 'blue',
      title: `${l.test} result released`,
      sub: 'Reviewed by your doctor and added to your records',
      to: '/patient/records',
    })
  }

  const today = localISO()
  for (const a of appointments) {
    /* Only a cancellation you could still act on. A slot cancelled last
       month is history — telling someone about it invites them to rebook a
       date that has already gone, and buries the things that do need them. */
    if (a.status === 'Cancelled') {
      if ((a.date || '') < today) continue
      out.push({
        id: `p-appt-cancel:${a.resourceId}`,
        tone: 'rose',
        title: 'An appointment was cancelled',
        sub: `${prettyDate(a.date)} ${a.time} · ${a.doctor} — book again when you're ready`,
        to: '/patient/doctors',
      })
    } else if (a.date === today) {
      out.push({
        id: `p-appt-today:${a.resourceId}`,
        tone: 'blue',
        title: `Appointment today at ${a.time}`,
        sub: `${a.doctor} · ${a.type}`,
        to: '/patient/consult',
      })
    }
  }

  for (const i of invoices) {
    if (i.status !== 'Overdue') continue
    out.push({
      id: `p-inv:${i.resourceId}`,
      tone: 'amber',
      title: `Payment overdue — ${i.amount}`,
      sub: i.category,
      to: '/patient/payments',
    })
  }

  return out.sort(bySeverity)
}

/* ----------------------------------------------------------- Pharmacy */
export function pharmacyNotifications({ queue = [], blocked = [], deliveries = [], stock = [], stockFor }) {
  const out = []

  for (const r of queue) {
    const item = stockFor?.(r.drug)
    const remaining = Math.max(0, Number(r.qty || 0) - Number(r.dispensedQty || 0))
    if (!item || Number(item.stock || 0) < remaining) {
      out.push({
        id: `ph-short:${r.resourceId}`,
        tone: 'rose',
        title: `Cannot fill — ${r.drug}`,
        sub: `${r.patient} · ${item ? `only ${item.stock} of ${remaining} in stock` : 'not stocked here'}`,
        to: '/pharmacy/queue',
      })
    }
    if (r.flag === 'Interaction' || r.flag === 'Allergy') {
      out.push({
        id: `ph-released:${r.resourceId}`,
        tone: 'amber',
        title: `${r.flag} flag accepted — ${r.drug}`,
        sub: r.overrideNote || 'Released by the prescriber — check before handing over',
        to: '/pharmacy/queue',
      })
    }
    if (r.status === 'Issued') {
      out.push({
        id: `ph-new:${r.resourceId}`,
        tone: 'blue',
        title: `New prescription — ${r.drug}`,
        sub: `${r.patient} · from ${r.doctor}`,
        to: '/pharmacy/queue',
      })
    }
  }

  for (const r of blocked) {
    out.push({
      id: `ph-blocked:${r.resourceId}`,
      tone: 'rose',
      title: `Held with prescriber — ${r.drug}`,
      sub: `${r.patient} · ${r.status} · waiting on ${r.doctor}`,
      to: '/pharmacy/queue',
    })
  }

  for (const d of deliveries) {
    if (d.status !== 'Dispensed') continue
    out.push({
      id: `ph-dispatch:${d.resourceId}`,
      tone: 'blue',
      title: `Packed, not yet dispatched — ${d.drug}`,
      sub: `${d.patient} · home delivery`,
      to: '/pharmacy/deliveries',
    })
  }

  for (const s of stock) {
    const days = daysUntil(s.expiry)
    if (days !== null && days <= 60) {
      out.push({
        id: `ph-expiry:${s.resourceId}`,
        tone: 'rose',
        title: `${days < 0 ? 'Expired' : 'Expiring'} — ${s.name}`,
        sub: `${s.batch || 'no batch'} · ${days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`} · ${s.stock} units`,
        to: '/pharmacy/inventory',
      })
    } else if (s.status === 'Low stock') {
      out.push({
        id: `ph-low:${s.resourceId}`,
        tone: 'amber',
        title: `Low stock — ${s.name}`,
        sub: `${s.stock} left · reorder level ${s.reorderLevel}`,
        to: '/pharmacy/inventory',
      })
    }
  }

  return out.sort(bySeverity)
}

/* -------------------------------------------------------- Laboratory */
/* How long a request may sit before it is chased, by priority. One
   threshold for everything treats a STAT potassium like a routine lipid
   panel, which is how STAT stops meaning anything. */
export const BREACH_MINUTES = { STAT: 60, Urgent: 240, Routine: 1440 }

export function labNotifications({ awaitingSample = [], collected = [], onBench = [] }) {
  const out = []
  const inProgress = [...awaitingSample, ...collected, ...onBench]

  for (const o of inProgress) {
    const limit = BREACH_MINUTES[o.priority] ?? BREACH_MINUTES.Routine
    const breached = o.orderedAt && Date.now() - o.orderedAt > limit * 60000
    if (breached) {
      out.push({
        id: `lab-breach:${o.resourceId}`,
        tone: o.priority === 'STAT' ? 'rose' : 'amber',
        title: `Past its clock — ${o.test}`,
        sub: `${o.patient} · ${o.priority} · ${o.status} · ${limit}m target`,
        to: o.status === 'In lab' ? '/lab/bench' : '/lab/orders',
      })
    } else if (o.priority === 'STAT' || o.priority === 'Urgent') {
      out.push({
        id: `lab-urgent:${o.resourceId}`,
        tone: o.priority === 'STAT' ? 'rose' : 'amber',
        title: `${o.priority} — ${o.test}`,
        sub: `${o.patient} · ${o.status}`,
        to: o.status === 'In lab' ? '/lab/bench' : '/lab/orders',
      })
    }
  }

  for (const o of awaitingSample) {
    if (o.priority === 'STAT' || o.priority === 'Urgent') continue
    out.push({
      id: `lab-new:${o.resourceId}`,
      tone: 'blue',
      title: `New request — ${o.test}`,
      sub: `${o.patient} · from ${o.doctor || 'unknown requester'}`,
      to: '/lab/orders',
    })
  }

  for (const o of onBench) {
    const flagged = (o.analytes || []).filter((a) => outOfRange(a) === true)
    if (flagged.length === 0) continue
    out.push({
      id: `lab-flag:${o.resourceId}`,
      tone: 'amber',
      title: `${flagged.length} value(s) out of range — ${o.test}`,
      sub: `${o.patient} · not yet reported`,
      to: '/lab/bench',
    })
  }

  return out.sort(bySeverity)
}

/* ----------------------------------------------------------- Hospital */
export function hospitalNotifications({
  units = [],
  appointments = [],
  admissions = [],
  departments = [],
  invoices = [],
  isAll = false,
  staleMinutes = 30,
  freeBeds,
}) {
  const out = []
  /* In group view every item must name its site — "CCU is full" means
     nothing when you run seven clinics. */
  const at = (site) => (isAll && site ? ` · ${site}` : '')

  for (const a of appointments) {
    if (a.status === 'Urgent') {
      out.push({
        id: `h-appt-urgent:${a.resourceId}`,
        tone: 'rose',
        title: `Urgent appointment — ${a.patient}`,
        sub: `${a.time} · ${a.doctor}${at(a.hospital)}`,
        to: '/hospital/appointments',
      })
    } else if (a.status === 'Pending') {
      out.push({
        id: `h-appt-pending:${a.resourceId}`,
        tone: 'blue',
        title: `Appointment request — ${a.patient}`,
        sub: `${prettyDate(a.date)} ${a.time} · ${a.doctor}${at(a.hospital)}`,
        to: '/hospital/appointments',
      })
    }
  }

  for (const u of units) {
    if (u.status !== 'Open') continue
    if (freeBeds?.(u) === 0) {
      out.push({
        id: `h-full:${u.resourceId}`,
        tone: 'rose',
        title: `${u.unit} is full${at(u.hospital)}`,
        sub: `0 of ${u.total} free — patients are being told this`,
        to: '/hospital/beds',
      })
    }
  }

  for (const u of units) {
    if (Date.now() - Number(u.updatedAt || 0) <= staleMinutes * 60000) continue
    out.push({
      id: `h-stale:${u.resourceId}`,
      tone: 'amber',
      title: `${u.unit} count is out of date${at(u.hospital)}`,
      sub: `Patients see this as possibly stale`,
      to: '/hospital/beds',
    })
  }

  for (const a of admissions) {
    if (a.status !== 'For discharge') continue
    out.push({
      id: `h-discharge:${a.resourceId}`,
      tone: 'violet',
      title: `Ready for discharge — ${a.patient}`,
      sub: `${a.unit} ${a.bed} · ${a.doctor || 'no consultant'}${at(a.hospital)}`,
      to: '/hospital/admissions',
    })
  }

  for (const d of departments) {
    if (d.status !== 'Open' || d.head) continue
    out.push({
      id: `h-headless:${d.resourceId}`,
      tone: 'amber',
      title: `${d.name} has no head of unit`,
      sub: `Open, but nobody is accountable for it${at(d.hospital)}`,
      to: '/hospital/departments',
    })
  }

  for (const i of invoices) {
    if (i.status !== 'Overdue') continue
    out.push({
      id: `h-inv:${i.resourceId}`,
      tone: 'amber',
      title: `Invoice overdue — ${i.party}`,
      sub: `${i.amount} · ${i.category}${at(i.hospital)}`,
      to: '/hospital/revenue',
    })
  }

  return out.sort(bySeverity)
}
