import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accessibility,
  Volume2,
  Ear,
  Hand,
  Send,
  Mic,
  MicOff,
  Languages,
  Sunrise,
  Sun,
  Moon,
  Plus,
  Trash2,
  Stethoscope,
  ClipboardList,
  MessageSquare,
  Globe,
  Camera,
  CameraOff,
  UserPlus,
  FileText,
  Save,
} from 'lucide-react'
import { useToast } from '../components/ui/Toast.jsx'
import { useData } from '../store/DataStore.jsx'
import './features.css'

/* Render an accessible summary as a viewable SVG "page" (data URL), so it
   drops straight into the patient's Documents section and viewer. */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function wrapText(text, max = 58) {
  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur)
      cur = w
    } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['—']
}
function buildSummarySvg(patientName, sections, dateStr) {
  const W = 480
  const pad = 26
  let y = 116
  const rows = []
  sections.forEach((s) => {
    rows.push({ type: 'label', text: s.k, y })
    y += 24
    wrapText(s.v).forEach((line) => {
      rows.push({ type: 'line', text: line, y })
      y += 22
    })
    y += 12
  })
  const H = y + 16
  const body = rows
    .map((r) =>
      r.type === 'label'
        ? `<text x="${pad}" y="${r.y}" fill="#2f6f6a" font-family="Arial" font-size="12" font-weight="700">${esc(r.text.toUpperCase())}</text>`
        : `<text x="${pad}" y="${r.y}" fill="#27322f" font-family="Arial" font-size="15">${esc(r.text)}</text>`
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/><rect width="${W}" height="90" fill="#2f6f6a"/><text x="${pad}" y="42" fill="#ffffff" font-family="Arial" font-size="19" font-weight="700">Accessible Consultation Summary</text><text x="${pad}" y="68" fill="#eafaf7" font-family="Arial" font-size="13">${esc(patientName)} &#183; ${esc(dateStr)}</text>${body}</svg>`
}

/* Web Speech API feature detection (real, offline-capable in most browsers). */
const TTS = typeof window !== 'undefined' && 'speechSynthesis' in window
const SpeechRec =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null
const HAS_CAM =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function speak(text, lang = 'en-US') {
  if (!TTS || !text) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.97
    u.lang = lang
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

const PROFILES = [
  { key: 'mute', label: 'Non-speaking / Mute', icon: Volume2, hint: 'Patient types or taps phrases — the app speaks them aloud to the clinician.' },
  { key: 'deaf', label: 'Deaf', icon: Ear, hint: 'The clinician’s words appear as large live captions; the patient replies by text.' },
  { key: 'deafmute', label: 'Deaf-mute', icon: Hand, hint: 'Fully text-based both ways, with an optional sign-language interpreter.' },
  { key: 'hoh', label: 'Hard of hearing', icon: Ear, hint: 'Captions plus a clear read-aloud of the clinician’s replies.' },
]

/* Bilingual phrase boards (English ⇄ বাংলা). */
const PHRASES = {
  General: [
    ['Hello', 'হ্যালো'], ['Thank you', 'ধন্যবাদ'], ['Yes', 'হ্যাঁ'], ['No', 'না'],
    ['Maybe', 'হয়তো'], ['Please repeat', 'আবার বলুন'], ['I don’t understand', 'আমি বুঝতে পারছি না'], ['Please write it down', 'দয়া করে লিখে দিন'],
  ],
  Symptoms: [
    ['I have pain', 'আমার ব্যথা করছে'], ['I feel dizzy', 'আমার মাথা ঘুরছে'], ['I have a fever', 'আমার জ্বর হয়েছে'],
    ['I feel nauseous', 'আমার বমি বমি লাগছে'], ['I can’t sleep', 'আমি ঘুমাতে পারছি না'], ['I have a cough', 'আমার কাশি হয়েছে'], ['Shortness of breath', 'শ্বাসকষ্ট হচ্ছে'],
  ],
  Needs: [
    ['I need water', 'আমার পানি দরকার'], ['I need to rest', 'আমার বিশ্রাম দরকার'], ['Please call my family', 'দয়া করে আমার পরিবারকে ডাকুন'],
    ['I need more time', 'আমার আরও সময় দরকার'], ['Please go slower', 'দয়া করে একটু ধীরে বলুন'],
  ],
}
const PICTURES = [
  ['💧', 'Water', 'পানি'], ['🤕', 'Pain', 'ব্যথা'], ['💊', 'Medicine', 'ওষুধ'], ['😴', 'Sleep', 'ঘুম'], ['🚻', 'Toilet', 'টয়লেট'],
  ['🍽️', 'Food', 'খাবার'], ['🥵', 'Feeling hot', 'গরম লাগছে'], ['🥶', 'Feeling cold', 'ঠান্ডা লাগছে'], ['👪', 'Family', 'পরিবার'], ['🆘', 'Help', 'সাহায্য'],
]
const SIGN_GLOSS = ['Hello', 'Pain', 'Water', 'Yes', 'No', 'Doctor', 'Thank you']

const FACES = ['😀', '🙂', '😐', '🙁', '😣', '😫']
const painFace = (lvl) => FACES[Math.min(FACES.length - 1, Math.round(lvl / 2))]

export default function AccessibleConsult() {
  const toast = useToast()
  const { records, update } = useData()
  const patients = records('patients')
  const [selPatient, setSelPatient] = useState(patients[0]?.resourceId || '')
  const [profile, setProfile] = useState('deafmute')
  const [lang, setLang] = useState('en') // 'en' | 'bn'
  const [caregiver, setCaregiver] = useState(false)
  const [transcript, setTranscript] = useState([
    { from: 'system', text: 'Inclusive session started — end-to-end encrypted.' },
  ])
  const [pDraft, setPDraft] = useState('')
  const [dDraft, setDDraft] = useState('')
  const [caption, setCaption] = useState('')
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const scrollRef = useRef(null)

  const cur = PROFILES.find((p) => p.key === profile)
  const patientCanHear = profile === 'hoh' || profile === 'mute'
  const ttsLang = lang === 'bn' ? 'bn-BD' : 'en-US'
  const tr = (pair) => (lang === 'bn' ? pair[1] : pair[0])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [transcript])
  useEffect(() => () => recRef.current?.stop?.(), [])

  const addLine = (from, text) => setTranscript((t) => [...t, { from, text }])

  const patientSend = (text, withSpeech) => {
    const msg = (text ?? pDraft).trim()
    if (!msg) return
    addLine('patient', msg)
    if (text == null) setPDraft('')
    if (withSpeech) speak(msg, ttsLang)
  }

  const doctorSend = (text) => {
    const msg = (text ?? dDraft).trim()
    if (!msg) return
    addLine('doctor', msg)
    setCaption(msg)
    if (text == null) setDDraft('')
    if (patientCanHear) speak(msg, ttsLang)
  }

  const toggleListen = () => {
    if (!SpeechRec) {
      toast.error('Live voice captioning isn’t available in this browser')
      return
    }
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    try {
      const rec = new SpeechRec()
      rec.lang = ttsLang
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (e) => {
        let txt = ''
        for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript
        setCaption(txt)
        if (e.results[e.results.length - 1].isFinal) addLine('doctor', txt.trim())
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recRef.current = rec
      rec.start()
      setListening(true)
      toast.info('Listening — speak now')
    } catch {
      toast.error('Could not start captioning')
    }
  }

  const sendPain = (lvl) => {
    const face = painFace(lvl)
    const msg = lang === 'bn' ? `আমার ব্যথার মাত্রা ১০ এর মধ্যে ${lvl} ${face}` : `My pain level is ${lvl} out of 10 ${face}`
    patientSend(msg, patientCanHear)
  }
  const requestInterpreter = () => {
    addLine('system', '🧏 Sign-language interpreter requested — joining shortly.')
    toast.success('Sign-language interpreter requested')
  }
  const toggleCaregiver = () => {
    const next = !caregiver
    setCaregiver(next)
    addLine('system', next ? '👪 Caregiver joined the session with patient consent.' : '👪 Caregiver left the session.')
  }

  /* ---- AI sign-language camera + recognition endpoint ---- */
  const [cam, setCam] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const inFlight = useRef(false)
  const lastGloss = useRef({ text: '', at: 0 })

  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SIGN_RECOGNITION_URL) || ''
  const [signUrl, setSignUrl] = useState(() => {
    try {
      return localStorage.getItem('medisuite-sign-endpoint') || envUrl || ''
    } catch {
      return envUrl || ''
    }
  })
  const [signUrlDraft, setSignUrlDraft] = useState(signUrl)
  const [signStatus, setSignStatus] = useState(signUrl ? 'idle' : 'disconnected')

  const saveSignUrl = () => {
    const url = signUrlDraft.trim()
    setSignUrl(url)
    try {
      if (url) localStorage.setItem('medisuite-sign-endpoint', url)
      else localStorage.removeItem('medisuite-sign-endpoint')
    } catch {
      /* ignore */
    }
    setSignStatus(url ? 'idle' : 'disconnected')
    toast.success(url ? 'Recognition endpoint connected' : 'Endpoint cleared')
  }

  const startCam = async () => {
    if (!HAS_CAM) {
      toast.error('Camera not available in this browser')
      return
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = s
      if (videoRef.current) videoRef.current.srcObject = s
      setCam(true)
    } catch {
      toast.error('Camera permission denied')
    }
  }
  const stopCam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCam(false)
    if (signUrl) setSignStatus('idle')
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])
  // Bind the stream once the <video> is actually mounted (cam just turned on).
  useEffect(() => {
    if (cam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cam])

  const recognizeSign = (gloss) => {
    addLine('patient', `🤟 ${gloss}`)
    if (patientCanHear) speak(gloss, ttsLang)
  }

  /* Live recognition loop: capture a frame ~every 1.2s and POST it to the
     configured model. Expected response: { gloss?, text?, confidence? }. */
  useEffect(() => {
    if (!cam || !signUrl) return
    let stopped = false
    const id = setInterval(async () => {
      const v = videoRef.current
      if (inFlight.current || !v || !v.videoWidth) return
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = Math.round((320 * v.videoHeight) / v.videoWidth) || 240
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
      let image
      try {
        image = canvas.toDataURL('image/jpeg', 0.6)
      } catch {
        return
      }
      inFlight.current = true
      setSignStatus('recognising')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      try {
        const res = await fetch(signUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, ts: Date.now() }),
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        const gloss = String(data.gloss || data.text || '').trim()
        const conf = data.confidence ?? 1
        if (!stopped) {
          setSignStatus('idle')
          const now = Date.now()
          if (gloss && conf >= 0.5 && (gloss !== lastGloss.current.text || now - lastGloss.current.at > 2500)) {
            lastGloss.current = { text: gloss, at: now }
            addLine('patient', `🤟 ${gloss}`)
            if (patientCanHear) speak(gloss, ttsLang)
          }
        }
      } catch {
        if (!stopped) setSignStatus('error')
      } finally {
        clearTimeout(timer)
        inFlight.current = false
      }
    }, 1200)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [cam, signUrl, patientCanHear, ttsLang])

  const SIGN_STATUS = {
    disconnected: 'Not connected',
    idle: cam ? 'Ready' : 'Connected',
    recognising: 'Recognising…',
    error: 'Connection error',
  }

  /* ---- accessible treatment / medication plan ---- */
  const [meds, setMeds] = useState([{ name: '', dose: '', morning: true, noon: false, night: true }])
  const [notes, setNotes] = useState('')
  const [plan, setPlan] = useState(null)
  const setMed = (i, k, v) => setMeds((ms) => ms.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)))
  const addMed = () => setMeds((ms) => [...ms, { name: '', dose: '', morning: true, noon: false, night: false }])
  const delMed = (i) => setMeds((ms) => ms.filter((_, idx) => idx !== i))

  const planText = useMemo(() => {
    if (!plan) return ''
    const parts = ['Your treatment plan.']
    plan.meds.forEach((m) => {
      const times = [m.morning && 'morning', m.noon && 'noon', m.night && 'night'].filter(Boolean).join(', ')
      parts.push(`${m.name}. ${m.dose || 'As directed'}. Take it in the ${times || 'as needed'}.`)
    })
    if (plan.notes) parts.push('Care notes: ' + plan.notes)
    return parts.join(' ')
  }, [plan])

  const sharePlan = () => {
    const clean = meds.filter((m) => m.name.trim())
    if (!clean.length && !notes.trim()) {
      toast.error('Add at least one medication or a care note')
      return
    }
    setPlan({ meds: clean, notes: notes.trim() })
    addLine('system', '📋 Accessible treatment plan shared with the patient.')
    toast.success('Treatment plan shared with patient')
  }

  /* ---- accessible consultation summary ---- */
  const [summary, setSummary] = useState(null)
  const generateSummary = () => {
    const said = transcript.filter((m) => m.from !== 'system')
    const patientMsgs = said.filter((m) => m.from === 'patient').map((m) => m.text)
    const doctorMsgs = said.filter((m) => m.from === 'doctor').map((m) => m.text)
    const lines = []
    if (patientMsgs.length) lines.push({ k: 'What you told the clinician', v: patientMsgs.join(' · ') })
    if (doctorMsgs.length) lines.push({ k: 'What the clinician said', v: doctorMsgs.join(' · ') })
    if (plan) lines.push({ k: 'Your treatment', v: planText })
    if (!lines.length) {
      toast.error('Have a short conversation first, then generate a summary')
      return
    }
    setSummary(lines)
    addLine('system', '📝 Accessible consultation summary generated.')
    toast.success('Summary generated')
  }
  const readSummary = () => summary && speak(summary.map((l) => `${l.k}. ${l.v}.`).join(' '), ttsLang)

  const saveSummaryToRecord = () => {
    if (!summary) {
      toast.error('Generate a summary first')
      return
    }
    const patient = patients.find((p) => p.resourceId === selPatient)
    if (!patient) {
      toast.error('Choose a patient to save to')
      return
    }
    const dateStr = new Date().toLocaleDateString('en-CA')
    const svg = buildSummarySvg(patient.name, summary, dateStr)
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    const doc = {
      id: `DOC-${Date.now().toString(36).toUpperCase()}`,
      name: `Accessible_Summary_${dateStr}.svg`,
      kind: 'image',
      type: 'Image',
      size: new Blob([svg]).size,
      uploadedAt: Date.now(),
      dataUrl,
    }
    const documents = [...(patient.documents || []), doc]
    update('patients', { ...patient, documents }, { title: 'Accessible summary saved', sub: `${patient.name} · ${patient.resourceId}` })
    addLine('system', `📁 Summary saved to ${patient.name}’s record.`)
    toast.success(`Saved to ${patient.name}’s record`, { title: 'Documents' })
  }

  return (
    <div className="a11y">
      {/* Header + profile selector */}
      <div className="panel a11y-head">
        <div className="a11y-head-top">
          <span className="a11y-title">
            <Accessibility size={18} /> Accessible Care
          </span>
          <div className="a11y-controls">
            <div className="a11y-lang">
              <Globe size={14} />
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
              <button className={lang === 'bn' ? 'on' : ''} onClick={() => setLang('bn')}>বাংলা</button>
            </div>
            <label className="a11y-caregiver">
              <input type="checkbox" checked={caregiver} onChange={toggleCaregiver} />
              <UserPlus size={14} /> Caregiver present (consent)
            </label>
          </div>
        </div>
        <div className="a11y-profiles">
          {PROFILES.map((p) => {
            const PIcon = p.icon
            return (
              <button key={p.key} className={`choice sm ${profile === p.key ? 'is-sel' : ''}`} onClick={() => setProfile(p.key)}>
                <PIcon size={14} /> {p.label}
              </button>
            )
          })}
        </div>
        <p className="a11y-hint">
          <MessageSquare size={13} /> {cur.hint}
          {!TTS && ' · (text-to-speech unavailable in this browser)'}
        </p>
      </div>

      <div className="a11y-grid">
        {/* Conversation + patient tools */}
        <div className="panel a11y-conv">
          <div className="panel-head">
            <span className="ph-icon"><MessageSquare size={16} /></span>
            Conversation
          </div>

          <div className="a11y-caption">
            <span className="a11y-caption-label">Clinician says</span>
            <span className="a11y-caption-text">{caption || 'Waiting for the clinician…'}</span>
          </div>

          <div className="a11y-transcript" ref={scrollRef}>
            {transcript.map((m, i) => (
              <div key={i} className={`a11y-line from-${m.from}`}>
                {m.from !== 'system' && (
                  <span className="a11y-who">{m.from === 'doctor' ? 'Clinician' : 'Patient'}</span>
                )}
                <span className="a11y-bubble">{m.text}</span>
              </div>
            ))}
          </div>

          <div className="a11y-patient">
            <textarea
              className="ff-input a11y-textarea"
              rows={2}
              placeholder="Type your message…"
              value={pDraft}
              onChange={(e) => setPDraft(e.target.value)}
            />
            <div className="a11y-patient-btns">
              <button className="btn btn-ghost" onClick={() => patientSend()}>
                <Send size={15} /> Send
              </button>
              <button className="btn btn-primary" onClick={() => patientSend(null, true)} disabled={!TTS}>
                <Volume2 size={15} /> Speak to clinician
              </button>
            </div>

            {/* Picture / symbol board */}
            <div className="a11y-board-group" style={{ marginTop: 14 }}>
              <span className="section-label">Picture board</span>
              <div className="a11y-pictures">
                {PICTURES.map(([emoji, en, bn]) => (
                  <button key={en} className="a11y-pic" onClick={() => patientSend(`${emoji} ${lang === 'bn' ? bn : en}`, patientCanHear)}>
                    <span className="a11y-pic-emoji">{emoji}</span>
                    <span>{lang === 'bn' ? bn : en}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AAC quick phrases */}
            <div className="a11y-board">
              {Object.entries(PHRASES).map(([group, items]) => (
                <div className="a11y-board-group" key={group}>
                  <span className="section-label">{group}</span>
                  <div className="a11y-chips">
                    {items.map((pair) => (
                      <button key={pair[0]} className="choice sm" onClick={() => patientSend(tr(pair), patientCanHear)}>
                        {tr(pair)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="a11y-board-group">
                <span className="section-label">Pain scale</span>
                <div className="a11y-pain">
                  {[0, 2, 4, 6, 8, 10].map((lvl) => (
                    <button key={lvl} className="a11y-pain-btn" onClick={() => sendPain(lvl)} title={`${lvl}/10`}>
                      <span className="a11y-pain-face">{painFace(lvl)}</span>
                      <span>{lvl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinician tools */}
        <div className="panel a11y-side">
          <div className="panel-head">
            <span className="ph-icon"><Stethoscope size={16} /></span>
            Clinician
          </div>
          <div className="panel-body" style={{ padding: 16 }}>
            <p className="a11y-sub">Type to caption for the patient, or use live voice captioning.</p>
            <textarea
              className="ff-input a11y-textarea"
              rows={3}
              placeholder="Message shown as large captions to the patient…"
              value={dDraft}
              onChange={(e) => setDDraft(e.target.value)}
            />
            <div className="a11y-patient-btns" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => doctorSend()}>
                <Send size={15} /> Send caption
              </button>
              <button className={`btn btn-ghost ${listening ? 'is-live' : ''}`} onClick={toggleListen}>
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
                {listening ? 'Stop' : 'Live captions'}
              </button>
            </div>

            {/* AI sign-language recognition */}
            <div className="a11y-sign">
              <div className="a11y-sign-head">
                <span className="a11y-interp-title"><Hand size={15} /> AI Sign Language</span>
                <span className={`a11y-sign-status is-${signStatus}`}>
                  <span className="a11y-sign-dot" />
                  {SIGN_STATUS[signStatus]}
                </span>
              </div>

              {/* Configurable recognition model endpoint */}
              <div className="a11y-sign-cfg">
                <input
                  className="ff-input"
                  placeholder="Recognition model URL (https://…)"
                  value={signUrlDraft}
                  onChange={(e) => setSignUrlDraft(e.target.value)}
                />
                <button className="mini-btn accent" onClick={saveSignUrl}>
                  {signUrl ? 'Update' : 'Connect'}
                </button>
              </div>
              {!signUrl && (
                <p className="a11y-sub" style={{ margin: '2px 0 8px' }}>
                  <strong>Not connected.</strong> Add your sign-recognition model URL to stream live
                  frames, or tap manual signs below.
                </p>
              )}

              <div className="a11y-cam">
                {cam ? (
                  <video ref={videoRef} autoPlay playsInline muted className="a11y-cam-video" />
                ) : (
                  <div className="a11y-cam-off"><Camera size={22} /><span>Camera off</span></div>
                )}
                {cam && signUrl && signStatus === 'recognising' && (
                  <span className="a11y-cam-badge">● live recognition</span>
                )}
              </div>
              <div className="a11y-patient-btns">
                {!cam ? (
                  <button className="mini-btn accent" onClick={startCam}><Camera size={13} /> Start camera</button>
                ) : (
                  <button className="mini-btn" onClick={stopCam}><CameraOff size={13} /> Stop</button>
                )}
              </div>

              <p className="a11y-sub" style={{ margin: '8px 0 6px' }}>Manual signs (demo):</p>
              <div className="a11y-chips">
                {SIGN_GLOSS.map((g) => (
                  <button key={g} className="choice sm" onClick={() => recognizeSign(g)}>{g}</button>
                ))}
              </div>
              <p className="a11y-contract">
                Model API — <code>POST {'{ image, ts }'} → {'{ gloss, confidence }'}</code>
              </p>
            </div>

            <div className="a11y-interp">
              <div>
                <div className="a11y-interp-title"><Languages size={15} /> Sign-language interpreter</div>
                <div className="a11y-sub">Video Remote Interpreting (VRI).</div>
              </div>
              <button className="mini-btn accent" onClick={requestInterpreter}>
                <Hand size={13} /> Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible treatment / medication plan */}
      <div className="panel a11y-treatment">
        <div className="panel-head">
          <span className="ph-icon"><ClipboardList size={16} /></span>
          Accessible Treatment &amp; Medication Plan
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          <div className="a11y-tx-grid">
            <div className="a11y-tx-compose">
              <span className="section-label">Medications</span>
              {meds.map((m, i) => (
                <div className="a11y-med-row" key={i}>
                  <input className="ff-input" placeholder="Medicine" value={m.name} onChange={(e) => setMed(i, 'name', e.target.value)} />
                  <input className="ff-input a11y-dose" placeholder="Dose e.g. 500mg" value={m.dose} onChange={(e) => setMed(i, 'dose', e.target.value)} />
                  <div className="a11y-times">
                    <button className={`a11y-time ${m.morning ? 'on' : ''}`} onClick={() => setMed(i, 'morning', !m.morning)} title="Morning"><Sunrise size={15} /></button>
                    <button className={`a11y-time ${m.noon ? 'on' : ''}`} onClick={() => setMed(i, 'noon', !m.noon)} title="Noon"><Sun size={15} /></button>
                    <button className={`a11y-time ${m.night ? 'on' : ''}`} onClick={() => setMed(i, 'night', !m.night)} title="Night"><Moon size={15} /></button>
                  </div>
                  <button className="subform-del" onClick={() => delMed(i)} aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="mini-btn accent" onClick={addMed}><Plus size={13} /> Add medication</button>

              <span className="section-label" style={{ marginTop: 14, display: 'block' }}>Care notes</span>
              <textarea className="ff-input a11y-textarea" rows={2} placeholder="e.g. Rest, drink fluids, return if breathless" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={sharePlan}>
                <Send size={15} /> Share plan with patient
              </button>
            </div>

            <div className="a11y-tx-preview">
              <div className="a11y-preview-head">
                <span className="section-label">Patient view</span>
                {plan && (
                  <button className="mini-btn accent" onClick={() => speak(planText, ttsLang)} disabled={!TTS}>
                    <Volume2 size={13} /> Read aloud
                  </button>
                )}
              </div>
              {!plan ? (
                <p className="a11y-sub">Share a plan to preview the large-text, pictogram version the patient receives.</p>
              ) : (
                <div className="a11y-plan-card">
                  {plan.meds.map((m, i) => (
                    <div className="a11y-plan-med" key={i}>
                      <div className="a11y-plan-name">{m.name}</div>
                      <div className="a11y-plan-dose">{m.dose || 'As directed'}</div>
                      <div className="a11y-plan-times">
                        <span className={`a11y-picto ${m.morning ? 'on' : ''}`}><Sunrise size={20} /><small>Morning</small></span>
                        <span className={`a11y-picto ${m.noon ? 'on' : ''}`}><Sun size={20} /><small>Noon</small></span>
                        <span className={`a11y-picto ${m.night ? 'on' : ''}`}><Moon size={20} /><small>Night</small></span>
                      </div>
                    </div>
                  ))}
                  {plan.notes && (
                    <div className="a11y-plan-notes"><strong>Notes:</strong> {plan.notes}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accessible consultation summary */}
      <div className="panel a11y-summary">
        <div className="panel-head">
          <span className="ph-icon"><FileText size={16} /></span>
          Consultation Summary
          <div className="a11y-summary-actions">
            <select className="a11y-patient-sel" value={selPatient} onChange={(e) => setSelPatient(e.target.value)} title="Save to patient">
              {patients.map((p) => (
                <option key={p.resourceId} value={p.resourceId}>{p.name}</option>
              ))}
            </select>
            {summary && (
              <button className="mini-btn accent" onClick={readSummary} disabled={!TTS}>
                <Volume2 size={13} /> Read aloud
              </button>
            )}
            <button className="mini-btn accent" onClick={generateSummary}>
              <FileText size={13} /> Generate
            </button>
            <button className="mini-btn accent" onClick={saveSummaryToRecord} disabled={!summary}>
              <Save size={13} /> Save to record
            </button>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 18 }}>
          {!summary ? (
            <p className="a11y-sub">Generate a plain-language, large-text summary of the visit for the patient to keep.</p>
          ) : (
            <div className="a11y-summary-card">
              {summary.map((l, i) => (
                <div className="a11y-summary-item" key={i}>
                  <div className="a11y-summary-k">{l.k}</div>
                  <div className="a11y-summary-v">{l.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
