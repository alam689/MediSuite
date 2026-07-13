import { useEffect, useRef, useState } from 'react'
import { Sparkles, Stethoscope, MessageSquare, RotateCcw, Send, ArrowRight } from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Tabs from '../components/ui/Tabs.jsx'
import './features.css'

/* ---- rule-based symptom knowledge ---- */
const SYMPTOMS = ['Chest pain', 'Shortness of breath', 'Fever', 'Headache', 'Abdominal pain', 'Dizziness']
const KB = {
  'Chest pain': { conditions: ['Angina', 'Musculoskeletal pain', 'Acid reflux'], specialist: 'Cardiology', base: 'high' },
  'Shortness of breath': { conditions: ['Asthma', 'COPD', 'Anxiety'], specialist: 'Pulmonology', base: 'high' },
  Fever: { conditions: ['Viral infection', 'Bacterial infection', 'Flu'], specialist: 'General Medicine', base: 'moderate' },
  Headache: { conditions: ['Tension headache', 'Migraine', 'Dehydration'], specialist: 'Neurology', base: 'low' },
  'Abdominal pain': { conditions: ['Gastritis', 'IBS', 'Appendicitis'], specialist: 'Gastroenterology', base: 'moderate' },
  Dizziness: { conditions: ['Low blood pressure', 'Inner-ear issue', 'Anemia'], specialist: 'General Medicine', base: 'moderate' },
}
const URGENCY = {
  high: { label: 'Urgent — seek care promptly', tone: 'rose' },
  moderate: { label: 'See a doctor within 24–48h', tone: 'amber' },
  low: { label: 'Self-care, monitor symptoms', tone: 'green' },
}

function escalate(base, duration, severe) {
  const order = ['low', 'moderate', 'high']
  let i = order.indexOf(base)
  if (severe === 'Severe') i = Math.min(2, i + 1)
  if (duration === 'More than a week') i = Math.min(2, i + 1)
  return order[i]
}

function SymptomChecker({ schema }) {
  const { add } = useData()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [symptom, setSymptom] = useState(null)
  const [duration, setDuration] = useState(null)
  const [severity, setSeverity] = useState(null)

  const reset = () => {
    setStep(0)
    setSymptom(null)
    setDuration(null)
    setSeverity(null)
  }

  const kb = symptom ? KB[symptom] : null
  const level = kb ? escalate(kb.base, duration, severity) : null
  const urg = level ? URGENCY[level] : null
  const confidence = (0.72 + (level === 'high' ? 0.16 : level === 'moderate' ? 0.1 : 0.05)).toFixed(2)

  const createTask = () => {
    const record = {
      resourceId: newId('AI'),
      task: `Symptom triage · ${symptom}`,
      kind: 'Triage',
      confidence,
      status: 'Needs review',
    }
    add(schema.key, record, { title: 'Symptom triage sent', sub: `${symptom} · ${record.resourceId}` })
    toast.success('Triage sent to clinician queue', { title: record.resourceId })
    reset()
  }

  return (
    <div className="panel checker">
      <div className="panel-head">
        <span className="ph-icon">
          <Stethoscope size={16} />
        </span>
        AI Symptom Checker
        <button className="ph-action" onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none' }}>
          <RotateCcw size={13} /> Restart
        </button>
      </div>
      <div className="panel-body" style={{ padding: 20 }}>
        <div className="checker-steps">
          <span className={step >= 0 ? 'on' : ''}>1 Symptom</span>
          <span className={step >= 1 ? 'on' : ''}>2 Duration</span>
          <span className={step >= 2 ? 'on' : ''}>3 Severity</span>
          <span className={step >= 3 ? 'on' : ''}>4 Result</span>
        </div>

        {step === 0 && (
          <>
            <p className="checker-q">What is the main symptom?</p>
            <div className="chip-choices">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  className={`choice ${symptom === s ? 'is-sel' : ''}`}
                  onClick={() => {
                    setSymptom(s)
                    setStep(1)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="checker-q">How long have you had it?</p>
            <div className="chip-choices">
              {['Today', 'A few days', 'More than a week'].map((d) => (
                <button
                  key={d}
                  className={`choice ${duration === d ? 'is-sel' : ''}`}
                  onClick={() => {
                    setDuration(d)
                    setStep(2)
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="checker-q">How severe is it?</p>
            <div className="chip-choices">
              {['Mild', 'Moderate', 'Severe'].map((s) => (
                <button
                  key={s}
                  className={`choice ${severity === s ? 'is-sel' : ''}`}
                  onClick={() => {
                    setSeverity(s)
                    setStep(3)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && kb && (
          <div className="checker-result">
            <span className={`pill tone-${urg.tone}`}>{urg.label}</span>
            <div className="result-block">
              <div className="result-k">Possible conditions</div>
              <div className="result-conditions">
                {kb.conditions.map((c) => (
                  <span key={c} className="cond">{c}</span>
                ))}
              </div>
            </div>
            <div className="result-row">
              <div>
                <div className="result-k">Suggested specialist</div>
                <div className="result-v">{kb.specialist}</div>
              </div>
              <div>
                <div className="result-k">Confidence</div>
                <div className="result-v">{confidence}</div>
              </div>
            </div>
            <p className="result-disclaimer">
              This is AI-assisted triage guidance, not a diagnosis. A clinician makes the final decision.
            </p>
            <button className="btn btn-primary" onClick={createTask}>
              Send to clinician <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Assistant() {
  const toast = useToast()
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hi! I’m the MediSuite assistant. Ask me about appointments, medications, or clinic hours.' },
  ])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const answer = (q) => {
    const t = q.toLowerCase()
    if (t.includes('appointment') || t.includes('book'))
      return 'You can book from the Appointments module → “Book” tab. Would you like me to reserve the next available slot?'
    if (t.includes('medic') || t.includes('prescription') || t.includes('refill'))
      return 'Your active prescriptions are in the Prescriptions module. Refills are usually approved within 24 hours.'
    if (t.includes('hour') || t.includes('open') || t.includes('time'))
      return 'Tele-consultations run 24/7. On-site clinics are open 8am–8pm, Mon–Sat.'
    if (t.includes('emergency') || t.includes('urgent'))
      return 'If this is a medical emergency, please call your local emergency number immediately. I can also flag an urgent tele-consult.'
    if (t.includes('lab') || t.includes('result') || t.includes('report'))
      return 'Lab results appear in the Laboratory module once approved. Abnormal values are flagged automatically.'
    return 'I’ve noted that. A care coordinator can follow up — is there anything else I can help with?'
  }

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { from: 'user', text }])
    setDraft('')
    setTimeout(() => setMessages((m) => [...m, { from: 'bot', text: answer(text) }]), 700)
  }

  const quick = ['Book an appointment', 'Refill my medication', 'What are your hours?']

  return (
    <div className="panel assistant">
      <div className="panel-head">
        <span className="ph-icon">
          <MessageSquare size={16} />
        </span>
        AI Assistant
        <span className="ph-action">24/7</span>
      </div>
      <div className="chat-scroll assistant-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg from-${m.from === 'user' ? 'doctor' : 'patient'}`}>
            <span className="chat-who">{m.from === 'user' ? 'You' : 'Assistant'}</span>
            <span className="chat-bubble">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="assistant-quick">
        {quick.map((q) => (
          <button key={q} className="choice sm" onClick={() => { setDraft(q); }}>
            {q}
          </button>
        ))}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input placeholder="Ask the assistant…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn btn-primary" aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

export default function AIStudio({ schema }) {
  const [sub, setSub] = useState('checker')
  return (
    <div>
      <Tabs
        tabs={[
          { key: 'checker', label: 'Symptom Checker', icon: Sparkles },
          { key: 'assistant', label: 'Assistant', icon: MessageSquare },
        ]}
        active={sub}
        onChange={setSub}
      />
      <div style={{ marginTop: 16 }}>
        {sub === 'checker' ? <SymptomChecker schema={schema} /> : <Assistant />}
      </div>
    </div>
  )
}
