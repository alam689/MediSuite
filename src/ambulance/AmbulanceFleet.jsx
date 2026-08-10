import { useState } from 'react'
import {
  Ambulance,
  Plus,
  Phone,
  MapPin,
  IdCard,
  AlertTriangle,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import { AMBULANCE_TYPES, AMBULANCE_STATUSES } from '../data/schemas.js'
import { useAmbulance, daysLeft, LICENCE_WARN_DAYS } from './AmbulanceContext.jsx'

/* =====================================================================
   Enlistment — the operator's own record of every vehicle they offer, and
   the crew that comes with it.

   A vehicle and its driver are enlisted together on one form on purpose.
   The patient app dispatches a *vehicle*, but what turns up is a driver
   with a licence, and an enlistment that records only the van lets an
   operator put an unlicensed driver on the road without the form ever
   asking. Licence expiry is checked here and again on the driver roster.
   ===================================================================== */

const TONE = {
  Available: 'green',
  'On another trip': 'amber',
  'Off duty': 'blue',
  Maintenance: 'rose',
}

const blank = {
  regNo: '',
  unitType: AMBULANCE_TYPES[1],
  phone: '',
  baseFee: '',
  station: '',
  driverName: '',
  driverPhone: '',
  driverLicense: '',
  licenseExpiry: '',
  driverExperience: '',
  paramedic: 'No',
  status: 'Available',
}

/* Dhaka, roughly — a new vehicle needs somewhere to sit on the patient's
   map until real telematics feed a position. Spread slightly so two
   vehicles enlisted the same afternoon don't stack on one pixel. */
const spawnPoint = (n) => ({
  lat: 23.79 + ((n % 5) - 2) * 0.006,
  lng: 90.407 + ((n % 3) - 1) * 0.008,
})

export default function AmbulanceFleet() {
  const { operator, fleet } = useAmbulance()
  const { add, patch, remove } = useData()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [draft, setDraft] = useState(null) // {...fields, resourceId?}
  const [error, setError] = useState('')
  const [retiring, setRetiring] = useState(null)

  const needle = q.trim().toLowerCase()
  const rows = needle
    ? fleet.filter((a) =>
        [a.regNo, a.resourceId, a.unitType, a.driverName, a.station]
          .some((v) => String(v || '').toLowerCase().includes(needle))
      )
    : fleet

  const openNew = () => {
    setError('')
    setDraft({ ...blank })
  }

  const openEdit = (a) => {
    setError('')
    setDraft({
      resourceId: a.resourceId,
      regNo: a.regNo || '',
      unitType: a.unitType || AMBULANCE_TYPES[1],
      phone: a.phone || '',
      baseFee: a.baseFee || '',
      station: a.station || '',
      driverName: a.driverName || '',
      driverPhone: a.driverPhone || '',
      driverLicense: a.driverLicense || '',
      licenseExpiry: a.licenseExpiry || '',
      driverExperience: a.driverExperience ?? '',
      paramedic: a.paramedic || 'No',
      status: a.status || 'Available',
    })
  }

  const save = () => {
    const d = draft
    if (!d.regNo.trim()) return setError('Give the vehicle its registration number.')
    if (!d.phone.trim()) return setError('A dispatch number is what the patient calls — it is required.')
    if (!d.driverName.trim()) return setError('Name the driver. A vehicle is enlisted with its crew, not on its own.')
    if (!d.driverPhone.trim()) return setError("Give the driver's own number — dispatch cannot reach the vehicle without it.")
    if (!d.driverLicense.trim()) return setError('Record the driving licence number.')

    const fields = {
      regNo: d.regNo.trim(),
      unitType: d.unitType,
      phone: d.phone.trim(),
      baseFee: d.baseFee.trim(),
      station: d.station.trim(),
      driverName: d.driverName.trim(),
      driverPhone: d.driverPhone.trim(),
      driverLicense: d.driverLicense.trim(),
      licenseExpiry: d.licenseExpiry,
      driverExperience: d.driverExperience === '' ? '' : Number(d.driverExperience),
      paramedic: d.paramedic,
      status: d.status,
      updatedAt: Date.now(),
    }

    if (d.resourceId) {
      patch('ambulances', d.resourceId, fields, {
        title: 'Ambulance details updated',
        sub: `${d.resourceId} · ${fields.regNo} · ${fields.driverName}`,
      })
      toast.success('Enlistment updated.', { title: fields.regNo })
    } else {
      const resourceId = newId('AMB')
      add(
        'ambulances',
        { resourceId, operator, ...spawnPoint(fleet.length), ...fields },
        { title: 'Ambulance enlisted', sub: `${resourceId} · ${fields.regNo} · ${operator}` }
      )
      toast.success(`${fields.regNo} enlisted — patients can request it now.`, { title: resourceId })
    }
    setDraft(null)
  }

  /* Retiring removes the vehicle from what patients can request. It is
     blocked while a trip is under way — the record is what the patient is
     tracking, and deleting it mid-journey leaves them watching nothing. */
  const retire = () => {
    const a = retiring
    setRetiring(null)
    remove('ambulances', a.resourceId, {
      title: 'Ambulance removed from the fleet',
      sub: `${a.resourceId} · ${a.regNo} · ${operator}`,
    })
    toast.info(`${a.regNo} removed from the fleet.`)
  }

  const setStatus = (a, status) => {
    patch('ambulances', a.resourceId, { status, updatedAt: Date.now() }, {
      title: `Vehicle ${status.toLowerCase()}`,
      sub: `${a.resourceId} · ${a.regNo}`,
    })
  }

  const expiredCount = fleet.filter((a) => {
    const left = daysLeft(a.licenseExpiry)
    return left !== null && left < 0
  }).length

  return (
    <>
      <header className="pf-head">
        <div>
          <h1 className="pf-title">Fleet</h1>
          <p className="pf-sub">
            {operator} — {fleet.length} vehicle(s) enlisted,{' '}
            {fleet.filter((a) => a.status === 'Available').length} available right now.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> Enlist ambulance
        </button>
      </header>

      {expiredCount > 0 && (
        <div className="pf-warn" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{expiredCount} vehicle(s)</strong> have a driver whose licence has expired. They
            are still shown to patients while on duty — take them off duty or change the driver.
          </span>
        </div>
      )}

      <label style={{ display: 'block', maxWidth: 380, marginBottom: 14, position: 'relative' }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
          }}
        />
        <input
          className="pf-input"
          style={{ paddingLeft: 34 }}
          placeholder="Search registration, type, driver or station"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {rows.length === 0 ? (
        <section className="pf-panel">
          <div className="pf-panel-body">
            <p className="pf-empty">
              {fleet.length === 0
                ? 'No vehicles enlisted yet. Press Enlist ambulance to add your first one — patients see it as soon as it is on duty.'
                : `Nothing matches "${q}".`}
            </p>
          </div>
        </section>
      ) : (
        <div className="pf-grid">
          {rows.map((a) => {
            const left = daysLeft(a.licenseExpiry)
            const expired = left !== null && left < 0
            const expiring = left !== null && left >= 0 && left <= LICENCE_WARN_DAYS
            const onTrip = a.status === 'On another trip'
            return (
              <div
                className="pf-tile"
                key={a.resourceId}
                style={{ '--tc': `var(--tone-${TONE[a.status] || 'teal'})` }}
              >
                <div className="pf-tile-top">
                  <div>
                    <div className="pf-tile-title">{a.regNo}</div>
                    <div className="pf-tile-sub">
                      {a.unitType} · {a.resourceId}
                    </div>
                  </div>
                  <span className={`pill tone-${TONE[a.status] || 'teal'}`}>{a.status}</span>
                </div>

                <div className="pf-tile-meta" style={{ marginTop: 10 }}>
                  {a.station && (
                    <span>
                      <MapPin size={12} /> {a.station}
                    </span>
                  )}
                  <span>
                    <Phone size={12} /> {a.phone}
                  </span>
                  {a.baseFee && <span>{a.baseFee}</span>}
                </div>

                {/* The crew, on the vehicle card — dispatching without
                    knowing who is driving is the failure this prevents. */}
                <div className={`amb-crew ${expired ? 'bad' : expiring ? 'warn' : ''}`}>
                  <IdCard size={14} />
                  <div>
                    <b>{a.driverName}</b>
                    <span>
                      {a.driverPhone} · licence {a.driverLicense}
                      {a.driverExperience !== '' && a.driverExperience !== undefined
                        ? ` · ${a.driverExperience} yrs`
                        : ''}
                      {a.paramedic === 'Yes' ? ' · paramedic on board' : ''}
                    </span>
                    {left !== null && (
                      <em>
                        {expired
                          ? `Licence expired ${Math.abs(left)} day(s) ago — do not dispatch`
                          : expiring
                            ? `Licence expires in ${left} day(s)`
                            : `Licence valid for ${left} more day(s)`}
                      </em>
                    )}
                  </div>
                </div>

                <div className="pf-tile-foot" style={{ gap: 8 }}>
                  <button className="pf-btn" onClick={() => openEdit(a)}>
                    <Pencil size={13} /> Edit
                  </button>
                  {a.status === 'Available' && (
                    <button className="pf-btn" onClick={() => setStatus(a, 'Off duty')}>
                      Take off duty
                    </button>
                  )}
                  {(a.status === 'Off duty' || a.status === 'Maintenance') && (
                    <button className="pf-btn ok" onClick={() => setStatus(a, 'Available')}>
                      Put on duty
                    </button>
                  )}
                  {a.status !== 'Maintenance' && !onTrip && (
                    <button className="pf-btn" onClick={() => setStatus(a, 'Maintenance')}>
                      Maintenance
                    </button>
                  )}
                  <button
                    className="pf-btn danger"
                    disabled={onTrip}
                    title={onTrip ? 'This vehicle is on a trip — finish it first' : 'Remove from the fleet'}
                    onClick={() => setRetiring(a)}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="pf-note" style={{ marginTop: 16 }}>
        <Ambulance size={13} />
        <span>
          Only vehicles on duty appear on the patient's ambulance map. Position is a fixed station
          point in this build — a real deployment feeds it from the vehicle's own tracker, and the
          map is only ever as truthful as that feed.
        </span>
      </p>

      {/* ---- Enlist / edit ---- */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.resourceId ? `Edit ${draft.regNo || 'vehicle'}` : 'Enlist an ambulance'}
        subtitle={operator}
        width={620}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save}>
              {draft?.resourceId ? 'Save changes' : 'Enlist vehicle'}
            </button>
          </>
        }
      >
        {draft && (
          <>
            <p className="pf-step">Vehicle</p>
            <div className="pf-form">
              <label className="pf-field">
                <span>Registration no. *</span>
                <input
                  className="pf-input"
                  autoFocus
                  value={draft.regNo}
                  placeholder="e.g. DHA-CES-208"
                  onChange={(e) => setDraft({ ...draft, regNo: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Vehicle type</span>
                <select
                  className="pf-input"
                  value={draft.unitType}
                  onChange={(e) => setDraft({ ...draft, unitType: e.target.value })}
                >
                  {AMBULANCE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Dispatch phone *</span>
                <input
                  className="pf-input"
                  value={draft.phone}
                  placeholder="+880 …"
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Base fare</span>
                <input
                  className="pf-input"
                  value={draft.baseFee}
                  placeholder="e.g. ৳900 base"
                  onChange={(e) => setDraft({ ...draft, baseFee: e.target.value })}
                />
              </label>
              <label className="pf-field full">
                <span>Home station</span>
                <input
                  className="pf-input"
                  value={draft.station}
                  placeholder="Where it waits between calls"
                  onChange={(e) => setDraft({ ...draft, station: e.target.value })}
                />
              </label>
            </div>

            <p className="pf-step">Driver</p>
            <div className="pf-form">
              <label className="pf-field">
                <span>Driver name *</span>
                <input
                  className="pf-input"
                  value={draft.driverName}
                  onChange={(e) => setDraft({ ...draft, driverName: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Driver phone *</span>
                <input
                  className="pf-input"
                  value={draft.driverPhone}
                  onChange={(e) => setDraft({ ...draft, driverPhone: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Driving licence no. *</span>
                <input
                  className="pf-input"
                  value={draft.driverLicense}
                  onChange={(e) => setDraft({ ...draft, driverLicense: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Licence expiry</span>
                <input
                  className="pf-input"
                  type="date"
                  value={draft.licenseExpiry}
                  onChange={(e) => setDraft({ ...draft, licenseExpiry: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Years driving</span>
                <input
                  className="pf-input"
                  type="number"
                  min="0"
                  value={draft.driverExperience}
                  onChange={(e) => setDraft({ ...draft, driverExperience: e.target.value })}
                />
              </label>
              <label className="pf-field">
                <span>Paramedic on board</span>
                <select
                  className="pf-input"
                  value={draft.paramedic}
                  onChange={(e) => setDraft({ ...draft, paramedic: e.target.value })}
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </label>
              <label className="pf-field">
                <span>Status</span>
                <select
                  className="pf-input"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  {AMBULANCE_STATUSES.filter((s) => s !== 'On another trip').map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            {error && <span className="pf-err">{error}</span>}
            <p className="pf-hint">
              Everything here is shown to a patient choosing an ambulance, except the licence
              number — that is kept for your records and the regulator's.
            </p>
          </>
        )}
      </Modal>

      {/* ---- Remove ---- */}
      <Modal
        open={!!retiring}
        onClose={() => setRetiring(null)}
        title="Remove from the fleet?"
        subtitle={retiring ? `${retiring.regNo} · ${retiring.resourceId}` : ''}
        width={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setRetiring(null)}>
              Keep it
            </button>
            <button className="btn btn-ghost pf-danger-btn" onClick={retire}>
              Remove
            </button>
          </>
        }
      >
        {retiring && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {retiring.regNo} stops being offered to patients immediately. Its past trips stay in the
            log — a completed journey is a record, not a listing. If the vehicle is only off the
            road for a while, use <b>Maintenance</b> instead.
          </p>
        )}
      </Modal>
    </>
  )
}
