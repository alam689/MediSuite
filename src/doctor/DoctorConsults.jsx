import { Video, PhoneCall, MessageSquare, Play, Square, CheckCircle2, RotateCcw } from 'lucide-react'
import { useData } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useDoctor } from './DoctorContext.jsx'

const TONE = { Live: 'violet', Waiting: 'amber', Queued: 'blue', Ended: 'rose', Completed: 'green' }
const MODE_ICON = { Video, Audio: PhoneCall, Chat: MessageSquare }

/* Order matters more than it looks: a live call, then whoever has been made
   to wait, then the queue, then what is finished. Sorting by id would put
   the person sitting in a waiting room below a consultation that ended
   yesterday. */
const RANK = { Live: 0, Waiting: 1, Queued: 2, Ended: 3, Completed: 4 }

export default function DoctorConsults() {
  const { mine } = useDoctor()
  const { patch } = useData()
  const toast = useToast()

  const rows = [...mine('telemedicine')].sort(
    (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9)
  )

  const live = rows.filter((r) => r.status === 'Live')
  const waiting = rows.filter((r) => r.status === 'Waiting' || r.status === 'Queued')

  const move = (c, next, message) => {
    patch(
      'telemedicine',
      c.resourceId,
      { status: next, ...(next === 'Live' ? { startedAt: Date.now() } : {}) },
      { title: message, sub: `${c.resourceId} · ${c.patient}` }
    )
    toast.success(message, { title: c.patient })
  }

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Consultations</h1>
          <p className="pf-sub">Your waiting room and virtual queue.</p>
        </div>
      </header>

      <section className="pf-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="pf-card">
          <div className="pf-card-head">
            <Video size={15} /> On call now
          </div>
          <div className="pf-card-big">{live.length}</div>
          <div className="pf-card-line">{live.map((c) => c.patient).join(', ') || 'Nobody'}</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <PhoneCall size={15} /> Waiting
          </div>
          <div className="pf-card-big">{waiting.length}</div>
          <div className="pf-card-line">patients ready to be admitted</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-head">
            <CheckCircle2 size={15} /> Completed
          </div>
          <div className="pf-card-big">{rows.filter((r) => r.status === 'Completed').length}</div>
          <div className="pf-card-line">closed and documented</div>
        </div>
      </section>

      <section className="pf-panel">
        <div className="pf-panel-head">
          <Video size={15} /> Queue
          <span className="count">{rows.length}</span>
        </div>
        <div className="pf-panel-body">
          {rows.length === 0 && (
            <p className="pf-empty">
              <CheckCircle2 size={22} />
              No consultations assigned to you.
            </p>
          )}
          {rows.map((c) => {
            const Icon = MODE_ICON[c.mode] || Video
            return (
              <div className="pf-row" key={c.resourceId}>
                <span className={`pf-dot tone-${TONE[c.status] || 'teal'}`} />
                <div>
                  <div className="pf-row-title">{c.patient}</div>
                  <div className="pf-row-sub">
                    <Icon size={11} style={{ verticalAlign: -1 }} /> {c.mode} ·{' '}
                    {c.reason || 'Consultation'} · {c.resourceId}
                  </div>
                </div>
                <div className="pf-row-actions">
                  {/* The patient asked to come back — surfaced here because
                      the request is worthless if the doctor never sees it. */}
                  {c.resumeRequested && c.status === 'Ended' && (
                    <span className="pill tone-amber">Patient asked to resume</span>
                  )}
                  <span className={`pill tone-${TONE[c.status] || 'teal'}`}>{c.status}</span>
                  {(c.status === 'Waiting' || c.status === 'Queued') && (
                    <button className="pf-btn go" onClick={() => move(c, 'Live', 'Consultation started')}>
                      <Play size={13} /> Admit
                    </button>
                  )}
                  {c.status === 'Live' && (
                    <button className="pf-btn danger" onClick={() => move(c, 'Ended', 'Consultation ended')}>
                      <Square size={13} /> End
                    </button>
                  )}
                  {c.status === 'Ended' && (
                    <>
                      <button className="pf-btn" onClick={() => move(c, 'Live', 'Consultation resumed')}>
                        <RotateCcw size={13} /> Resume
                      </button>
                      <button
                        className="pf-btn ok"
                        onClick={() => move(c, 'Completed', 'Consultation completed')}
                      >
                        <CheckCircle2 size={13} /> Complete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <p className="pf-note">
        <Video size={14} />
        Ending a consultation is reversible until you complete it. Complete is the one that closes
        the encounter — write the note first, from the Notes tab.
      </p>
    </>
  )
}
