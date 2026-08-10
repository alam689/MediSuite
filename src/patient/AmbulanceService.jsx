import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Ambulance,
  MapPin,
  Phone,
  List,
  Map as MapIcon,
  X,
  Navigation,
  CheckCircle2,
  Siren,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../components/ui/Toast.jsx'
import { useData, newId } from '../store/DataStore.jsx'
import { usePatient } from './PatientContext.jsx'
import './ambulance.css'

/* =====================================================================
   Ambulance near me — list view, real map view (Leaflet + OpenStreetMap,
   both free), and live tracking.

   The fleet is still seeded — a real deployment swaps it for a dispatch
   API feeding the same shapes. Tracking stays a pure function of time:
   the active request stores who was dispatched and when, and the marker
   position is interpolated from elapsed time, so it survives reloads and
   tab switches with nothing to reconcile.
   ===================================================================== */

/* The demo assumes the patient is at Gulshan-2 circle ("near me" without
   a geolocation prompt); real usage reads navigator.geolocation. */
const PATIENT = { lat: 23.7925, lng: 90.4078, place: 'Gulshan-2, Dhaka' }

const MIN_PER_KM = 3 // ~20 km/h through city traffic

/* The fleet is whatever ambulance operators have enlisted, read live from
   the shared store — the same records they edit in their own portal. A
   vehicle off duty or in maintenance is not offered at all: showing one a
   patient cannot have is worse than a shorter list. */
const OFF_ROAD = new Set(['Off duty', 'Maintenance'])
const normalise = (r) => ({
  id: r.resourceId,
  type: r.unitType,
  operator: r.operator,
  phone: r.phone,
  lat: Number(r.lat),
  lng: Number(r.lng),
  status: r.status,
  fee: r.baseFee,
  regNo: r.regNo,
  driver: r.driverName,
  driverPhone: r.driverPhone,
  paramedic: r.paramedic === 'Yes',
})

const HOSPITALS = [
  { name: 'Metro General', lat: 23.8047, lng: 90.3973 },
  { name: 'HeartCare', lat: 23.7996, lng: 90.4218 },
  { name: 'Respira Clinic', lat: 23.7975, lng: 90.4022 },
]

/* Equirectangular distance — plenty for a few km within one city. */
function distanceKm(a) {
  const dLat = (a.lat - PATIENT.lat) * 110.57
  const dLng = (a.lng - PATIENT.lng) * 111.32 * Math.cos((PATIENT.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}
const etaMinutes = (a) => Math.max(2, Math.round(distanceKm(a) * MIN_PER_KM))

/* A trip the operator has not closed yet. The trip record *is* the state:
   it survives a reload, and it ends the moment the control room marks the
   trip complete or cancels it — which is exactly what should happen to a
   tracker for a vehicle that is no longer coming. */
const LIVE_TRIP = new Set(['Dispatched', 'Arrived'])

/* Where the dispatched ambulance is right now, interpolated by elapsed
   time. Straight-line on the map — road routing needs a routing service. */
function trackedPosition(trip, fleet) {
  const amb = fleet.find((f) => f.id === trip.ambulanceId)
  if (!amb) return null
  const p = Math.min(1, (Date.now() - trip.requestedAt) / ((trip.etaMin || 5) * 60000))
  return {
    lat: amb.lat + (PATIENT.lat - amb.lat) * p,
    lng: amb.lng + (PATIENT.lng - amb.lng) * p,
    p,
  }
}

/* The vehicle glyph is lucide's ambulance, inlined because Leaflet markers
   are raw HTML rather than React children. */
const AMB_GLYPH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M10 10H6"/>
  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
  <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/>
  <path d="M8 8v4"/><path d="M9 18h6"/>
  <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
</svg>`

/* A pin whose tip marks the vehicle's position, carrying the ambulance
   sign; the unit number rides underneath so a patient can still match the
   marker to the row they were reading in list view. */
const ambulanceIcon = (a, { tracked, selected }) =>
  L.divIcon({
    className: 'amb-div',
    html: `<div class="amb-mark ${
      tracked ? 'tracked' : a.status !== 'Available' ? 'busy' : 'available'
    } ${selected ? 'selected' : ''}">
      <span class="amb-mark-body">${AMB_GLYPH}</span>
      <span class="amb-mark-id">${a.id.slice(-3)}</span>
    </div>`,
    iconSize: [46, 54],
    iconAnchor: [23, 40],
    popupAnchor: [0, -38],
  })

export default function AmbulanceService() {
  const toast = useToast()
  const { records, add, patch } = useData()
  const { me, name, mine } = usePatient()
  const [view, setView] = useState('list') // 'list' | 'map'
  const [selected, setSelected] = useState(null)
  const [, setTick] = useState(0) // re-render clock while tracking

  const fleet = useMemo(
    () => records('ambulances').filter((r) => !OFF_ROAD.has(r.status)).map(normalise),
    [records]
  )
  /* One live trip at a time, and it is the store's answer, not a local
     copy: if the operator completes or cancels it, this patient's tracker
     ends with it. */
  const active = mine('ambulanceTrips').find((t) => LIVE_TRIP.has(t.status)) || null

  const [full, setFull] = useState(false)

  const wrapRef = useRef(null)
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  /* Whether the browser granted real fullscreen — iOS Safari refuses it on
     anything but <video>, so we keep a fixed-overlay fallback. */
  const nativeFull = useRef(false)
  const ambMarkers = useRef({})
  const routeRef = useRef(null)
  /* Markers are bound once, so the popup builder has to be reached through
     a ref — a captured closure would freeze this render's dispatch state. */
  const popupRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])

  const rows = useMemo(() => [...fleet].sort((a, b) => distanceKm(a) - distanceKm(b)), [fleet])

  const pos = active ? trackedPosition(active, fleet) : null
  /* Arrival is whichever comes first: the clock running out, or the crew
     saying so from the dispatch board. Their word outranks the estimate. */
  const arrived = active?.status === 'Arrived' || (!!pos && pos.p >= 1)
  const minutesLeft = active
    ? Math.max(0, Math.ceil((active.etaMin || 0) - (Date.now() - active.requestedAt) / 60000))
    : 0

  /* Create the Leaflet map when the map view opens; tear it down when the
     container unmounts (switching back to list view). */
  useEffect(() => {
    if (view !== 'map' || mapRef.current || !mapEl.current) return
    const map = L.map(mapEl.current, { center: [PATIENT.lat, PATIENT.lng], zoom: 14 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    L.marker([PATIENT.lat, PATIENT.lng], {
      icon: L.divIcon({
        className: 'amb-div',
        html: '<span class="amb-pin"><i class="pulse"></i><i class="dot"></i></span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      interactive: false,
      zIndexOffset: -100,
    }).addTo(map)

    for (const h of HOSPITALS) {
      L.marker([h.lat, h.lng], {
        icon: L.divIcon({ className: 'amb-div', html: '<div class="amb-hosp">H</div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
        interactive: false,
        zIndexOffset: -200,
      })
        .addTo(map)
        .bindTooltip(h.name, { permanent: false })
    }

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      ambMarkers.current = {}
      routeRef.current = null
      if (document.fullscreenElement) document.exitFullscreen()
      nativeFull.current = false
      setFull(false)
    }
  }, [view])

  /* Fullscreen: real Fullscreen API where it exists, a fixed overlay where
     it doesn't. Either way Leaflet has to re-measure — it caches the
     container size and would otherwise paint tiles for the old box. */
  const toggleFull = () => {
    const el = wrapRef.current
    if (!el) return
    if (full) {
      if (nativeFull.current && document.fullscreenElement) document.exitFullscreen()
      else setFull(false)
      nativeFull.current = false
      return
    }
    setFull(true)
    const p = el.requestFullscreen?.()
    if (p) p.then(() => (nativeFull.current = true)).catch(() => (nativeFull.current = false))
  }

  useEffect(() => {
    const onChange = () => {
      // Esc / the browser's own exit control leaves via this path.
      if (!document.fullscreenElement && nativeFull.current) {
        nativeFull.current = false
        setFull(false)
      }
      mapRef.current?.invalidateSize()
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && !nativeFull.current) setFull(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize())
    return () => cancelAnimationFrame(id)
  }, [full])

  /* Sync ambulance markers and the route line on every render while the
     map is up — six markers at 1 Hz, cheap and always consistent. */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    /* A vehicle that left the fleet (taken off duty, or removed by its
       operator) has to lose its marker too, or the map keeps showing an
       ambulance nobody can send. */
    for (const [id, m] of Object.entries(ambMarkers.current)) {
      if (fleet.some((f) => f.id === id)) continue
      m.remove()
      delete ambMarkers.current[id]
    }
    for (const a of fleet) {
      const isTracked = active?.ambulanceId === a.id
      const at = isTracked && pos ? pos : a
      const icon = ambulanceIcon(a, { tracked: isTracked, selected: selected === a.id })
      let m = ambMarkers.current[a.id]
      if (!m) {
        m = L.marker([at.lat, at.lng], { icon })
          .addTo(map)
          /* Content is a function so Leaflet rebuilds it on every open —
             the popup then reflects the current dispatch state instead of
             whatever was true when the marker was first created. */
          .bindPopup(() => popupRef.current(a), { minWidth: 236 })
          .on('click', () => setSelected(a.id))
        ambMarkers.current[a.id] = m
      } else {
        m.setLatLng([at.lat, at.lng])
        m.setIcon(icon)
      }
    }
    if (routeRef.current) {
      routeRef.current.remove()
      routeRef.current = null
    }
    if (pos && !arrived) {
      routeRef.current = L.polyline(
        [
          [pos.lat, pos.lng],
          [PATIENT.lat, PATIENT.lng],
        ],
        { color: '#e08a2e', weight: 3, dashArray: '7 6' }
      ).addTo(map)
    }
  })

  /* Requesting writes a trip the operator's dispatch board picks up, and
     marks the vehicle busy so nobody else is offered it. Two records
     because they answer different questions — whose journey is this, and
     which vehicles are free — and both sides must agree immediately. */
  const request = (amb) => {
    if (active) return toast.warning('An ambulance is already on the way — cancel it first.')
    if (amb.status !== 'Available') return toast.warning(`${amb.id} is on another trip.`)
    const etaMin = etaMinutes(amb)
    const tripId = newId('TRIP')
    add(
      'ambulanceTrips',
      {
        resourceId: tripId,
        patient: name,
        patientId: me?.resourceId,
        phone: me?.phone || '',
        ambulanceId: amb.id,
        operator: amb.operator,
        pickup: PATIENT.place,
        destination: '',
        unitType: amb.type,
        etaMin,
        status: 'Dispatched',
        requestedAt: Date.now(),
      },
      { title: 'Ambulance requested by patient', sub: `${name} · ${amb.id} · ${PATIENT.place}` }
    )
    patch('ambulances', amb.id, { status: 'On another trip', updatedAt: Date.now() }, {
      title: 'Vehicle dispatched',
      sub: `${amb.id} · ${amb.regNo || ''} · ${name}`,
    })
    setView('map')
    setSelected(amb.id)
    toast.success(`${amb.id} dispatched — ETA ${etaMin} min`, { title: amb.operator })
  }

  /* Closing the trip from this side releases the vehicle exactly as the
     operator's board does — whoever ends it, the fleet has to agree. */
  const closeTrip = (status, msg) => {
    if (!active) return
    patch('ambulanceTrips', active.resourceId, {
      status,
      ...(status === 'Completed' ? { completedAt: Date.now() } : { cancelledBy: name }),
    }, {
      title: status === 'Completed' ? 'Trip completed' : 'Ambulance request cancelled by patient',
      sub: `${active.resourceId} · ${name} · ${active.ambulanceId}`,
    })
    const veh = records('ambulances').find((r) => r.resourceId === active.ambulanceId)
    if (veh && veh.status === 'On another trip') {
      patch('ambulances', veh.resourceId, { status: 'Available', updatedAt: Date.now() }, {
        title: 'Vehicle back on duty',
        sub: `${veh.resourceId} · ${veh.regNo || ''}`,
      })
    }
    if (msg) toast.info(msg)
  }

  /* Marker popup: the same facts the list row carries, next to the vehicle
     the patient just tapped. Built as DOM rather than rendered through
     React because Leaflet owns the popup element's lifecycle. */
  const popupContent = (a) => {
    const isTracked = active?.ambulanceId === a.id
    const busy = a.status !== 'Available'
    const state = isTracked ? 'Coming to you' : a.status
    const tel = a.phone.replace(/\s/g, '')

    const el = document.createElement('div')
    el.className = 'amb-pop'
    el.innerHTML = `
      <div class="amb-pop-head">
        <span class="amb-pop-id">${a.id}</span>
        <span class="amb-pop-state ${isTracked ? 'tracked' : busy ? 'busy' : 'ok'}">${state}</span>
      </div>
      <div class="amb-pop-type">${a.type}</div>
      <div class="amb-pop-op">${a.operator}${a.regNo ? ` · ${a.regNo}` : ''}</div>
      <div class="amb-pop-meta">
        <span>${distanceKm(a).toFixed(1)} km away</span>
        <span>ETA ~${isTracked ? minutesLeft : etaMinutes(a)} min</span>
        <span>${a.fee || ''}</span>
      </div>
      ${
        a.driver
          ? `<div class="amb-pop-meta"><span>Driver ${a.driver}${
              a.paramedic ? ' · paramedic on board' : ''
            }</span></div>`
          : ''
      }
      <a class="amb-pop-tel" href="tel:${tel}">${a.phone}</a>
    `

    const actions = document.createElement('div')
    actions.className = 'amb-pop-actions'

    const call = document.createElement('a')
    call.className = 'btn btn-ghost'
    call.href = `tel:${tel}`
    call.textContent = 'Call'

    const req = document.createElement('button')
    req.className = 'btn btn-primary'
    req.textContent = isTracked ? 'On the way' : 'Request'
    req.disabled = busy || !!active
    req.addEventListener('click', () => {
      mapRef.current?.closePopup()
      request(a)
    })

    actions.append(call, req)
    el.append(actions)

    if (busy && !isTracked) {
      const note = document.createElement('div')
      note.className = 'amb-pop-note'
      note.textContent = 'This ambulance is on another trip.'
      el.append(note)
    } else if (active && !isTracked) {
      const note = document.createElement('div')
      note.className = 'amb-pop-note'
      note.textContent = `${active.ambulanceId} is already on the way — cancel it first.`
      el.append(note)
    }

    return el
  }
  popupRef.current = popupContent

  const activeAmb = active ? fleet.find((f) => f.id === active.ambulanceId) : null

  return (
    <>
      <header className="pt-head">
        <div>
          <h1 className="pt-title">Ambulance</h1>
          <p className="pt-sub">Find an ambulance near you, request one, and track it on the map.</p>
        </div>
      </header>

      {/* Requesting here is for transport and transfers. A collapsing
          patient needs the emergency number, not a web form. */}
      <div className="pt-callout" style={{ marginBottom: 14 }}>
        <span className="pt-callout-icon">
          <Siren size={18} />
        </span>
        <div>
          <div className="pt-callout-title">Life-threatening emergency?</div>
          <div className="pt-callout-sub">
            Call your local emergency service first. This page is for hospital transfers and
            non-critical transport.
          </div>
        </div>
      </div>

      {active && activeAmb && (
        <div className={`amb-track ${arrived ? 'arrived' : ''}`}>
          {arrived ? <CheckCircle2 size={22} /> : <Navigation size={22} />}
          <div>
            <div className="amb-track-title">
              {arrived
                ? `${activeAmb.id} has arrived at your location`
                : `${activeAmb.id} is on the way`}
            </div>
            <div className="amb-track-sub">
              {activeAmb.type} · {activeAmb.operator} ·{' '}
              <a href={`tel:${activeAmb.phone.replace(/\s/g, '')}`}>{activeAmb.phone}</a>
            </div>
            {/* Who is actually driving, and the number that reaches them —
                the crew the operator enlisted, not just the switchboard. */}
            {activeAmb.driver && (
              <div className="amb-track-sub">
                Driver {activeAmb.driver}
                {activeAmb.driverPhone && (
                  <>
                    {' · '}
                    <a href={`tel:${activeAmb.driverPhone.replace(/\s/g, '')}`}>
                      {activeAmb.driverPhone}
                    </a>
                  </>
                )}
                {activeAmb.regNo ? ` · ${activeAmb.regNo}` : ''}
                {activeAmb.paramedic ? ' · paramedic on board' : ''}
              </div>
            )}
          </div>
          <span className="amb-eta">
            {arrived ? 'Here' : `${minutesLeft} min`}
            {!arrived && <small> ETA</small>}
          </span>
          <button
            className="btn btn-ghost"
            style={{ height: 34 }}
            onClick={() =>
              closeTrip(arrived ? 'Completed' : 'Cancelled', arrived ? undefined : 'Request cancelled.')
            }
          >
            <X size={14} /> {arrived ? 'Done' : 'Cancel'}
          </button>
        </div>
      )}

      <div className="pt-chips" style={{ marginBottom: 14 }}>
        <button className={`pt-chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>
          <List size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          List view
        </button>
        <button className={`pt-chip ${view === 'map' ? 'on' : ''}`} onClick={() => setView('map')}>
          <MapIcon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Map view
        </button>
        <span className="pt-row-sub" style={{ alignSelf: 'center', marginLeft: 6 }}>
          <MapPin size={12} style={{ verticalAlign: -2 }} /> Near {PATIENT.place}
        </span>
      </div>

      {view === 'list' && (
        <section className="pt-panel">
          <div className="pt-panel-head">
            <Ambulance size={16} /> Ambulances near you
            <span className="count">{rows.length}</span>
          </div>
          <div className="pt-panel-body">
            {rows.map((a) => {
              const busy = a.status !== 'Available'
              const isActive = active?.ambulanceId === a.id
              return (
                <div className="pt-row" key={a.id}>
                  <div>
                    <div className="pt-row-title">
                      {a.id} — {a.type}
                    </div>
                    <div className="pt-row-sub">
                      {a.operator} · {distanceKm(a).toFixed(1)} km away · ETA ~{etaMinutes(a)} min ·{' '}
                      {a.fee}
                    </div>
                  </div>
                  <div className="pt-row-right">
                    <span className={`pill tone-${isActive ? 'amber' : busy ? 'blue' : 'green'}`}>
                      {isActive ? 'Coming to you' : a.status}
                    </span>
                    <a
                      className="btn btn-ghost"
                      style={{ height: 34 }}
                      href={`tel:${a.phone.replace(/\s/g, '')}`}
                    >
                      <Phone size={14} /> Call
                    </a>
                    <button
                      className="btn btn-primary"
                      style={{ height: 34 }}
                      disabled={busy || !!active}
                      onClick={() => request(a)}
                    >
                      Request
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {view === 'map' && (
        <div className={`amb-map-wrap ${full ? 'is-full' : ''}`} ref={wrapRef}>
          <button
            type="button"
            className="amb-full-btn"
            onClick={toggleFull}
            aria-pressed={full}
            title={full ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {full ? 'Exit full screen' : 'Full screen'}
          </button>
          <div ref={mapEl} className="amb-real-map" />
          <div className="amb-legend">
            <span>
              <i style={{ background: '#2ea87c' }} /> Available
            </span>
            <span>
              <i style={{ background: '#e08a2e' }} /> Coming to you
            </span>
            <span>
              <i style={{ background: '#8a94a6' }} /> On another trip
            </span>
            <span>
              <i style={{ background: '#2e86d1' }} /> Hospital / you
            </span>
            <span className="amb-legend-hint">Tap an ambulance for details</span>
          </div>
        </div>
      )}

      <p className="pt-privacy" style={{ marginTop: 14 }}>
        Map © OpenStreetMap contributors. Distances and arrival times are estimates based on
        straight-line distance and city traffic. The driver may call you to confirm the pickup
        point.
      </p>
    </>
  )
}
