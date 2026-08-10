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
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../components/ui/Toast.jsx'
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

const FLEET = [
  { id: 'AMB-201', type: 'ICU', operator: 'Metro General Hospital', phone: '+880 17 1552 0041', lat: 23.804, lng: 90.398, status: 'Available', fee: '৳1,500 base' },
  { id: 'AMB-202', type: 'Basic life support', operator: 'HeartCare Diagnostic', phone: '+880 17 1552 0042', lat: 23.799, lng: 90.421, status: 'Available', fee: '৳900 base' },
  { id: 'AMB-203', type: 'ICU', operator: 'City Emergency Service', phone: '+880 17 1552 0043', lat: 23.783, lng: 90.414, status: 'Available', fee: '৳1,400 base' },
  { id: 'AMB-204', type: 'Freezer', operator: 'Metro General Hospital', phone: '+880 17 1552 0044', lat: 23.78, lng: 90.395, status: 'Available', fee: '৳2,000 base' },
  { id: 'AMB-205', type: 'Basic life support', operator: 'Respira Clinic', phone: '+880 17 1552 0045', lat: 23.797, lng: 90.403, status: 'On another trip', fee: '৳900 base' },
  { id: 'AMB-206', type: 'NICU (newborn)', operator: 'City Emergency Service', phone: '+880 17 1552 0046', lat: 23.788, lng: 90.426, status: 'Available', fee: '৳2,200 base' },
]

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

const ACTIVE_KEY = 'medisuite-ambulance.active'
const readActive = () => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY))
  } catch {
    return null
  }
}

/* Where the dispatched ambulance is right now, interpolated by elapsed
   time. Straight-line on the map — road routing needs a routing service. */
function trackedPosition(active) {
  const amb = FLEET.find((f) => f.id === active.id)
  if (!amb) return null
  const p = Math.min(1, (Date.now() - active.startedAt) / (active.etaMin * 60000))
  return {
    lat: amb.lat + (PATIENT.lat - amb.lat) * p,
    lng: amb.lng + (PATIENT.lng - amb.lng) * p,
    p,
  }
}

const chipIcon = (a, { tracked, selected }) =>
  L.divIcon({
    className: 'amb-div',
    html: `<div class="amb-chip ${tracked ? 'tracked' : a.status !== 'Available' ? 'busy' : 'available'} ${
      selected ? 'selected' : ''
    }">${a.id.slice(-3)}</div>`,
    iconSize: [36, 26],
    iconAnchor: [18, 13],
  })

export default function AmbulanceService() {
  const toast = useToast()
  const [view, setView] = useState('list') // 'list' | 'map'
  const [selected, setSelected] = useState(null)
  const [active, setActive] = useState(readActive)
  const [, setTick] = useState(0) // re-render clock while tracking

  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const ambMarkers = useRef({})
  const routeRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])

  const rows = useMemo(() => [...FLEET].sort((a, b) => distanceKm(a) - distanceKm(b)), [])

  const pos = active ? trackedPosition(active) : null
  const arrived = !!pos && pos.p >= 1
  const minutesLeft = active
    ? Math.max(0, Math.ceil(active.etaMin - (Date.now() - active.startedAt) / 60000))
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
    }
  }, [view])

  /* Sync ambulance markers and the route line on every render while the
     map is up — six markers at 1 Hz, cheap and always consistent. */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const a of FLEET) {
      const isTracked = active?.id === a.id
      const at = isTracked && pos ? pos : a
      const icon = chipIcon(a, { tracked: isTracked, selected: selected === a.id })
      let m = ambMarkers.current[a.id]
      if (!m) {
        m = L.marker([at.lat, at.lng], { icon })
          .addTo(map)
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

  const request = (amb) => {
    if (active) return toast.warning('An ambulance is already on the way — cancel it first.')
    const rec = { id: amb.id, startedAt: Date.now(), etaMin: etaMinutes(amb) }
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(rec))
    setActive(rec)
    setView('map')
    setSelected(amb.id)
    toast.success(`${amb.id} dispatched — ETA ${rec.etaMin} min`, { title: amb.operator })
  }

  const clearActive = (msg) => {
    localStorage.removeItem(ACTIVE_KEY)
    setActive(null)
    if (msg) toast.info(msg)
  }

  const activeAmb = active ? FLEET.find((f) => f.id === active.id) : null
  const selectedAmb = FLEET.find((f) => f.id === selected)

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
          </div>
          <span className="amb-eta">
            {arrived ? 'Here' : `${minutesLeft} min`}
            {!arrived && <small> ETA</small>}
          </span>
          <button
            className="btn btn-ghost"
            style={{ height: 34 }}
            onClick={() => clearActive(arrived ? undefined : 'Request cancelled.')}
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
              const isActive = active?.id === a.id
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
        <>
          <div className="amb-map-wrap">
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
            </div>
          </div>

          {selectedAmb && (
            <section className="pt-panel" style={{ marginTop: 14 }}>
              <div className="pt-panel-body">
                <div className="pt-row">
                  <div>
                    <div className="pt-row-title">
                      {selectedAmb.id} — {selectedAmb.type}
                    </div>
                    <div className="pt-row-sub">
                      {selectedAmb.operator} · {distanceKm(selectedAmb).toFixed(1)} km away · ETA ~
                      {etaMinutes(selectedAmb)} min · {selectedAmb.fee}
                    </div>
                  </div>
                  <div className="pt-row-right">
                    <a
                      className="btn btn-ghost"
                      style={{ height: 34 }}
                      href={`tel:${selectedAmb.phone.replace(/\s/g, '')}`}
                    >
                      <Phone size={14} /> Call
                    </a>
                    <button
                      className="btn btn-primary"
                      style={{ height: 34 }}
                      disabled={selectedAmb.status !== 'Available' || !!active}
                      onClick={() => request(selectedAmb)}
                    >
                      Request this ambulance
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <p className="pt-privacy" style={{ marginTop: 14 }}>
        Map © OpenStreetMap contributors. Distances and arrival times are estimates based on
        straight-line distance and city traffic. The driver may call you to confirm the pickup
        point.
      </p>
    </>
  )
}
