import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Send,
  UserPlus,
  MonitorUp,
  RotateCcw,
  CheckCircle2,
  History,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import './features.css'

export default function TelemedicineConsole({ schema }) {
  const { records, patch } = useData()
  const toast = useToast()
  const rows = records(schema.key)
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const waiting = rows.filter((r) => r.status === 'Waiting' || r.status === 'Queued')
  const live = rows.filter((r) => r.status === 'Live')
  const ended = rows.filter((r) => r.status === 'Ended')

  const [activeId, setActiveId] = useState(live[0]?.resourceId || null)
  const active = rows.find((r) => r.resourceId === activeId) || live[0] || null

  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [endConfirm, setEndConfirm] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'system', text: 'Consultation channel is end-to-end encrypted.' },
  ])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  // Immersive full-screen mode (CSS overlay). Esc exits unless a dialog is open.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !endConfirm) setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, endConfirm])

  useEffect(() => {
    setMessages([
      { from: 'system', text: `Connected with ${active?.patient || 'patient'} · ${active?.mode || 'Video'}` },
    ])
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const admit = (r) => {
    patch(schema.key, r.resourceId, { status: 'Live', resumeRequested: false }, { title: 'Patient admitted', sub: `${r.patient} · ${r.resourceId}` })
    setActiveId(r.resourceId)
    toast.success('Patient admitted to consultation', { title: r.resourceId })
  }

  // End is now gated behind a confirmation modal.
  const requestEnd = () => {
    if (!active) return
    setEndConfirm(true)
  }

  const confirmEnd = () => {
    const consult = active
    setEndConfirm(false)
    if (!consult) return
    patch(schema.key, consult.resourceId, { status: 'Ended' }, { title: 'Consultation ended', sub: `${consult.patient} · ${consult.resourceId}` })
    toast.info('Consultation ended — patient can request to resume', { title: consult.resourceId })
    setActiveId(null)
    // Simulate the patient trying to rejoin after an unexpected drop.
    setTimeout(() => {
      const cur = rowsRef.current.find((r) => r.resourceId === consult.resourceId)
      if (cur && cur.status === 'Ended' && !cur.resumeRequested) {
        patch(schema.key, consult.resourceId, { resumeRequested: true }, { title: 'Resume requested by patient', sub: `${consult.patient} · ${consult.resourceId}` })
        toast.warning(`${consult.patient} is asking to resume`, { title: consult.resourceId })
      }
    }, 6000)
  }

  // Doctor resumes directly, or approves the patient's request.
  const resume = (r, approved) => {
    patch(schema.key, r.resourceId, { status: 'Live', resumeRequested: false }, { title: approved ? 'Resume approved by doctor' : 'Consultation resumed', sub: `${r.patient} · ${r.resourceId}` })
    setActiveId(r.resourceId)
    toast.success(approved ? 'Resume approved — patient reconnected' : 'Consultation resumed', { title: r.resourceId })
  }

  const declineResume = (r) => {
    patch(schema.key, r.resourceId, { resumeRequested: false }, { title: 'Resume declined by doctor', sub: `${r.patient} · ${r.resourceId}` })
    toast.info('Resume request declined', { title: r.resourceId })
  }

  const complete = (r) => {
    patch(schema.key, r.resourceId, { status: 'Completed', resumeRequested: false }, { title: 'Consultation completed', sub: `${r.patient} · ${r.resourceId}` })
    toast.success('Consultation marked complete', { title: r.resourceId })
  }

  const send = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    setMessages((m) => [...m, { from: 'doctor', text }])
    setDraft('')
    setTimeout(() => {
      const replies = [
        'Okay doctor, thank you.',
        'Yes, the symptoms started three days ago.',
        'I understand, I’ll follow the plan.',
        'Should I continue my current medication?',
      ]
      const text2 = replies[Math.floor(Math.random() * replies.length)]
      setMessages((m) => [...m, { from: 'patient', text: text2 }])
    }, 900)
  }

  const view = (
    <div ref={wrapRef} className={`console-wrap ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="console-bar">
        <span className="console-bar-title">
          <Video size={16} /> Live Console
          {live.length > 0 && <span className="pill tone-violet">{live.length} live</span>}
        </span>
        <button className="mini-btn" onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? (
            <>
              <Minimize2 size={13} /> Exit full screen
            </>
          ) : (
            <>
              <Maximize2 size={13} /> Full screen
            </>
          )}
        </button>
      </div>

      <div className="console">
        {/* Left column: waiting room + recently ended */}
        <div className="console-side">
        <aside className="panel">
          <div className="panel-head">
            <span className="ph-icon">
              <UserPlus size={16} />
            </span>
            Waiting Room
            <span className="ph-action">{waiting.length} waiting</span>
          </div>
          <div className="panel-body">
            {waiting.length === 0 && <p className="queue-empty">No patients waiting.</p>}
            {waiting.map((r) => (
              <div className="queue-row" key={r.resourceId}>
                <div>
                  <div className="wl-title">{r.patient}</div>
                  <div className="wl-sub">
                    {r.doctor} · {r.mode}
                  </div>
                </div>
                <button className="btn btn-primary queue-admit" onClick={() => admit(r)}>
                  Admit
                </button>
              </div>
            ))}
          </div>
        </aside>

        {ended.length > 0 && (
          <aside className="panel">
            <div className="panel-head">
              <span className="ph-icon">
                <History size={16} />
              </span>
              Recently Ended
              <span className="ph-action">{ended.length}</span>
            </div>
            <div className="panel-body">
              {ended.map((r) => (
                <div className="ended-row" key={r.resourceId}>
                  <div className="ended-head">
                    <div>
                      <div className="wl-title">{r.patient}</div>
                      <div className="wl-sub">
                        {r.doctor} · {r.mode}
                      </div>
                    </div>
                    {r.resumeRequested && (
                      <span className="pill tone-amber">Wants to resume</span>
                    )}
                  </div>
                  {r.resumeRequested ? (
                    <div className="ended-actions">
                      <button className="mini-btn accent" onClick={() => resume(r, true)}>
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button className="mini-btn" onClick={() => declineResume(r)}>
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="ended-actions">
                      <button className="mini-btn accent" onClick={() => resume(r, false)}>
                        <RotateCcw size={13} /> Resume
                      </button>
                      <button className="mini-btn" onClick={() => complete(r)}>
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Stage */}
      <div className="console-stage">
        {active ? (
          <>
            <div className="stage-video">
              <div className={`vid vid-patient ${camOff ? 'is-off' : ''}`}>
                <span className="vid-avatar">
                  {active.patient
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="vid-name">{active.patient}</span>
                <span className="vid-live">● LIVE</span>
              </div>
              <div className="vid vid-self">
                <span className="vid-avatar sm">DR</span>
                <span className="vid-name">You</span>
                {muted && <MicOff size={14} className="vid-flag" />}
              </div>
            </div>

            <div className="stage-controls">
              <button
                className={`ctrl ${muted ? 'is-active' : ''}`}
                onClick={() => setMuted((m) => !m)}
                title="Toggle mic"
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                className={`ctrl ${camOff ? 'is-active' : ''}`}
                onClick={() => setCamOff((c) => !c)}
                title="Toggle camera"
              >
                {camOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
              <button className="ctrl" title="Share screen" onClick={() => toast.info('Screen sharing started')}>
                <MonitorUp size={18} />
              </button>
              <button className="ctrl ctrl-end" onClick={requestEnd} title="End call">
                <PhoneOff size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="stage-idle">
            <Video size={30} />
            <p>No active consultation.</p>
            <span>Admit a patient from the waiting room, or resume a recently ended call.</span>
          </div>
        )}
      </div>

      {/* Chat */}
      <aside className="console-chat panel">
        <div className="panel-head">
          <span className="ph-icon">
            <Send size={16} />
          </span>
          Secure Chat
        </div>
        <div className="chat-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg from-${m.from}`}>
              {m.from !== 'system' && (
                <span className="chat-who">{m.from === 'doctor' ? 'You' : active?.patient}</span>
              )}
              <span className="chat-bubble">{m.text}</span>
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input
            placeholder={active ? 'Type a message…' : 'No active consult'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!active}
          />
          <button className="btn btn-primary" disabled={!active} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
      </aside>
      </div>

      {/* End-call confirmation */}
      <Modal
        open={endConfirm}
        onClose={() => setEndConfirm(false)}
        title="End consultation?"
        subtitle={active ? `${active.patient} · ${active.resourceId}` : ''}
        width={440}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEndConfirm(false)}>
              Keep call
            </button>
            <button className="btn btn-primary" style={{ background: 'var(--tone-rose)' }} onClick={confirmEnd}>
              <PhoneOff size={15} /> End call
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.55 }}>
          This ends the live session with <strong>{active?.patient}</strong>. The consultation
          moves to <strong>Recently Ended</strong>, where the patient can request to resume — you’ll
          be able to <strong>approve or decline</strong> — or you can resume it yourself. Mark it{' '}
          <strong>Complete</strong> once care is finished.
        </p>
      </Modal>
    </div>
  )

  // When full-screen, portal to <body> so `position: fixed` escapes any
  // transformed ancestor (the workspace's fade-in animation) and fills the viewport.
  return fullscreen ? createPortal(view, document.body) : view
}
