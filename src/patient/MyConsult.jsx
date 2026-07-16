import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  CalendarPlus,
  Accessibility,
  ShieldCheck,
} from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { usePatient } from './PatientContext.jsx'

const initials = (n = '') =>
  n.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

/* Mirrors the clinician console's state machine from the patient's side:
     Queued  → you haven't checked in
     Waiting → checked in, waiting to be admitted
     Live    → the doctor admitted you
     Ended   → call finished; you may ask to rejoin
   The doctor admits — the patient cannot self-admit. That asymmetry is the
   whole point of a waiting room, so it's enforced here, not just styled. */
const STEPS = [
  { key: 'checkin', label: 'Check in' },
  { key: 'wait', label: 'Waiting room' },
  { key: 'live', label: 'With your doctor' },
]

export default function MyConsult() {
  const { name, me, mine } = usePatient()
  const { patch } = useData()
  const toast = useToast()

  const consults = mine('telemedicine')
  const active =
    consults.find((c) => c.status === 'Live') ||
    consults.find((c) => c.status === 'Waiting') ||
    consults.find((c) => c.status === 'Queued') ||
    consults.find((c) => c.status === 'Ended') ||
    null

  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [endConfirm, setEndConfirm] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (active?.status === 'Live') {
      setMessages([{ from: 'system', text: 'You are connected. This channel is encrypted.' }])
    }
  }, [active?.status, active?.resourceId])

  const checkIn = () => {
    patch('telemedicine', active.resourceId, { status: 'Waiting' }, {
      title: 'Patient checked in',
      sub: `${name} · ${active.resourceId}`,
    })
    toast.success('You are checked in — your doctor will admit you shortly', {
      title: active.resourceId,
    })
  }

  const askResume = () => {
    patch('telemedicine', active.resourceId, { resumeRequested: true }, {
      title: 'Resume requested by patient',
      sub: `${name} · ${active.resourceId}`,
    })
    toast.info('Your doctor has been asked to reopen the call', { title: active.resourceId })
  }

  /* Leaving ends the call for the clinician too, and a mis-tap in a video
     room is easy. Confirm first — the console asks the doctor the same
     question before it lets them hang up. */
  const confirmLeave = () => {
    setEndConfirm(false)
    patch('telemedicine', active.resourceId, { status: 'Ended' }, {
      title: 'Patient left the consultation',
      sub: `${name} · ${active.resourceId}`,
    })
    toast.info('You left the consultation — you can ask to rejoin', { title: active.resourceId })
  }

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [...m, { from: 'me', text }])
    setDraft('')
  }

  const status = active?.status
  const stepIndex = status === 'Live' ? 2 : status === 'Waiting' ? 1 : 0

  if (!active) {
    return (
      <>
        <header className="pt-head">
          <div>
            <h1 className="pt-title">Consultation</h1>
            <p className="pt-sub">Your video appointments appear here.</p>
          </div>
        </header>
        <div className="pt-panel">
          <div className="pt-empty" style={{ padding: 40 }}>
            <Video size={28} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              No consultation scheduled
            </p>
            <p style={{ marginTop: 4 }}>Book an appointment and it will show up here when it's time.</p>
            <Link to="/patient/doctors" className="btn btn-primary" style={{ marginTop: 16 }}>
              <CalendarPlus size={15} /> Find a doctor
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Consultation</h1>
          <p className="pt-sub">
            {active.doctor} · {active.mode} · {active.reason || 'Consultation'}
          </p>
        </div>
        <span className={`pill tone-${status === 'Live' ? 'violet' : status === 'Waiting' ? 'amber' : 'blue'}`}>
          {status === 'Live' ? 'In consultation' : status === 'Waiting' ? 'Waiting to be admitted' : status}
        </span>
      </header>

      <div className="pt-two">
        <div>
          <div className="pt-stage">
            {status === 'Live' ? (
              <>
                <div className="pt-doc-tile">
                  <div className="pt-doc-avatar">{initials(active.doctor)}</div>
                </div>
                <span className="pt-live-flag">● LIVE</span>
                <div className="pt-self-tile">{camOff ? 'Camera off' : 'You'}</div>
              </>
            ) : (
              <div className="pt-stage-idle">
                <Video size={30} />
                <p>
                  {status === 'Waiting'
                    ? 'Waiting for your doctor'
                    : status === 'Ended'
                      ? 'This call has ended'
                      : 'Not checked in yet'}
                </p>
                <span>
                  {status === 'Waiting'
                    ? `${active.doctor} will admit you shortly. You can keep this page open.`
                    : status === 'Ended'
                      ? 'You can ask your doctor to reopen it if you were cut off.'
                      : 'Check in when you are ready and your doctor will admit you.'}
                </span>
              </div>
            )}
          </div>

          <div className="pt-call-controls">
            {status === 'Queued' && (
              <button className="btn btn-primary" onClick={checkIn}>
                Check in now
              </button>
            )}
            {status === 'Waiting' && (
              <button className="btn btn-ghost" disabled>
                Waiting for your doctor to admit you…
              </button>
            )}
            {status === 'Live' && (
              <>
                <button className="icon-btn" onClick={() => setMuted((m) => !m)} aria-label="Toggle microphone">
                  {muted ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
                <button className="icon-btn" onClick={() => setCamOff((c) => !c)} aria-label="Toggle camera">
                  {camOff ? <VideoOff size={17} /> : <Video size={17} />}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: 'var(--tone-rose)' }}
                  onClick={() => setEndConfirm(true)}
                >
                  <PhoneOff size={15} /> Leave
                </button>
              </>
            )}
            {status === 'Ended' && !active.resumeRequested && (
              <button className="btn btn-primary" onClick={askResume}>
                Ask to rejoin
              </button>
            )}
            {status === 'Ended' && active.resumeRequested && (
              <button className="btn btn-ghost" disabled>
                Waiting for your doctor to approve…
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <section className="pt-panel">
            <div className="pt-panel-head">Your visit</div>
            <div className="pt-steps">
              {STEPS.map((s, i) => (
                <div
                  className={`pt-step ${i < stepIndex ? 'done' : ''} ${i === stepIndex ? 'on' : ''}`}
                  key={s.key}
                >
                  <span className="pt-step-dot">{i < stepIndex ? '✓' : i + 1}</span>
                  {s.label}
                </div>
              ))}
            </div>
          </section>

          <section className="pt-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="pt-panel-head">
              <Send size={15} /> Message your doctor
            </div>
            <div
              ref={scrollRef}
              style={{ padding: 12, display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}
            >
              {messages.length === 0 && (
                <p className="pt-empty" style={{ padding: 8 }}>
                  {status === 'Live' ? 'Say hello.' : 'Chat opens when your consultation starts.'}
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    justifySelf: m.from === 'me' ? 'end' : 'start',
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 13,
                    background: m.from === 'me' ? 'var(--primary)' : 'var(--surface-2)',
                    color: m.from === 'me' ? 'var(--primary-contrast)' : 'var(--text-muted)',
                    border: m.from === 'me' ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
              <input
                className="pt-search"
                style={{ height: 38 }}
                placeholder={status === 'Live' ? 'Type a message…' : 'Not in a call'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={status !== 'Live'}
              />
              <button className="btn btn-primary" style={{ height: 38, padding: '0 14px' }} disabled={status !== 'Live'} aria-label="Send">
                <Send size={15} />
              </button>
            </form>
          </section>

          {me?.communication && me.communication !== 'Standard' && (
            <p className="pt-privacy">
              <Accessibility size={14} />
              Your record notes: <strong style={{ color: 'var(--text)' }}>{me.communication}</strong>.
              Your clinician has accessible consultation tools available.
            </p>
          )}
          <p className="pt-privacy">
            <ShieldCheck size={14} />
            Nothing is recorded unless you're asked and you agree.
          </p>
        </div>
      </div>

      <Modal
        open={endConfirm}
        onClose={() => setEndConfirm(false)}
        width={440}
        title="Leave the consultation?"
        subtitle={active ? `${active.doctor} · ${active.resourceId}` : ''}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEndConfirm(false)}>
              Stay in the call
            </button>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--tone-rose)' }}
              onClick={confirmLeave}
            >
              <PhoneOff size={15} /> Leave call
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          This ends the call for <strong>{active?.doctor}</strong> as well, not just on your screen.
          <br />
          <br />
          If you were cut off or leave by mistake, you can <strong>ask to rejoin</strong> — your
          doctor has to approve it, so you may have to wait.
        </p>
      </Modal>
    </>
  )
}
