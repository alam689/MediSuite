/* A deliberately small, visible interaction table.

   This is NOT a drug database and must never be mistaken for one. A real
   build calls a maintained interaction service (blueprint §5.7) and fails
   *closed* — no answer means no prescription. What this does is prove the
   workflow: the check runs before the script is written, its result is
   shown to the prescriber, and overriding it is a recorded decision rather
   than a silent one. Missing pairs are a known limitation, stated in the UI.

   Shared by the quick-issue form (DoctorPrescribe) and the prescription pad,
   so both entry points apply the same rules.
*/
export const INTERACTIONS = [
  { a: 'warfarin', b: 'aspirin', note: 'Markedly increased bleeding risk.' },
  { a: 'warfarin', b: 'ibuprofen', note: 'NSAID with anticoagulant — bleeding risk.' },
  { a: 'warfarin', b: 'amoxicillin', note: 'Antibiotics can potentiate warfarin; monitor INR.' },
  { a: 'metformin', b: 'prednisolone', note: 'Steroid opposes glycaemic control.' },
  { a: 'atorvastatin', b: 'clarithromycin', note: 'Raised statin levels — myopathy risk.' },
  { a: 'levothyroxine', b: 'ferrous', note: 'Iron reduces levothyroxine absorption; separate doses.' },
  { a: 'bisoprolol', b: 'verapamil', note: 'Combined AV nodal blockade — bradycardia risk.' },
]

/* What is unsafe about giving this drug to this patient, on what we hold.
   `drug` should include the generic name when known — brand names alone
   would sail past both the allergy stems and the interaction tokens. */
export function safetyCheck(drug, patient) {
  const name = String(drug || '').toLowerCase()
  const findings = []
  if (!name.trim() || !patient) return findings

  /* Allergies are free text in the patient record, so match on word stems
     rather than equality — "Penicillin" must catch "Amoxicillin" only if the
     record says so, and it doesn't, which is exactly why this is a stub. */
  const allergies = String(patient.allergies || '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'none recorded')

  for (const a of allergies) {
    const stem = a.split(/\s+/)[0]
    if (stem.length > 3 && name.includes(stem)) {
      findings.push({ kind: 'Allergy', text: `Patient is recorded as allergic to ${a}.` })
    }
  }

  const current = (patient.medications || []).map((m) => String(m.name || '').toLowerCase())
  for (const rule of INTERACTIONS) {
    const newIsA = name.includes(rule.a)
    const newIsB = name.includes(rule.b)
    if (!newIsA && !newIsB) continue
    const other = newIsA ? rule.b : rule.a
    if (current.some((c) => c.includes(other))) {
      findings.push({ kind: 'Interaction', text: `With ${other}: ${rule.note}` })
    }
  }
  return findings
}
