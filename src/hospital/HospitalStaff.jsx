import { useMemo, useState } from 'react'
import { Clock, Star, ShieldCheck, AlertTriangle, Plus, Pencil, UserMinus } from 'lucide-react'
import { useData, newId } from '../store/DataStore.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Modal from '../components/ui/Modal.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useHospital } from './HospitalContext.jsx'
import ChamberForm from './ChamberForm.jsx'

export default function HospitalStaff() {
  const { facility, facilityLabel, isAll, staff, chambersOf, appointments } = useHospital()
  const { records, add, update } = useData()
  const toast = useToast()

  const [form, setForm] = useState(null) // { mode, doctor?, chamber? }
  const [removing, setRemoving] = useState(null)

  const doctors = records('doctors')

  /* Practitioners who exist on the platform but don't yet sit here. */
  const candidates = useMemo(
    () => doctors.filter((d) => !(d.chambers || []).some((c) => c?.name === facility)),
    [doctors, facility]
  )

  const loadFor = (d) =>
    appointments.filter((a) => (d.name || '').includes((a.doctor || '').replace('Dr. ', ''))).length

  const save = (payload) => {
    const { mode, tab, existingName, newDoctor, chamber } = payload

    if (mode === 'edit') {
      const d = form.doctor
      // Replace this facility's chamber, leave the doctor's other sites alone.
      const chambers = (d.chambers || []).map((c) => (c?.name === facility ? { ...c, ...chamber } : c))
      update('doctors', { ...d, chambers }, {
        title: 'Chamber hours updated',
        sub: `${d.name} · ${facility} · ${chamber.days}`,
      })
      toast.success('Hours updated', { title: d.name })
    } else if (tab === 'existing') {
      const d = doctors.find((x) => x.name === existingName)
      if (!d) return
      update('doctors', { ...d, chambers: [...(d.chambers || []), chamber] }, {
        title: 'Practitioner added to facility',
        sub: `${d.name} · ${facility}`,
      })
      toast.success(`${d.name} added to ${facility}`, { title: chamber.days })
    } else {
      const record = {
        ...newDoctor,
        resourceId: newId('DR'),
        // Never verified from here: a facility signing off its own doctors'
        // credentials is the thing this separation prevents.
        status: 'In review',
        rating: '—',
        photo: '',
        degrees: [],
        awards: [],
        documents: [],
        chambers: [chamber],
      }
      add('doctors', record, {
        title: 'Practitioner registered — licence in review',
        sub: `${record.name} · ${facility}`,
      })
      toast.success(`${record.name} registered`, { title: 'Licence sent for review' })
    }
    setForm(null)
  }

  const confirmRemove = () => {
    const d = removing
    const chambers = (d.chambers || []).filter((c) => c?.name !== facility)
    // The practitioner record survives — only their chamber here ends.
    update('doctors', { ...d, chambers }, {
      title: 'Practitioner removed from facility',
      sub: `${d.name} · ${facility}`,
    })
    toast.info(`${d.name} no longer sits at ${facility}`, { title: 'Removed from facility' })
    setRemoving(null)
  }

  return (
    <>
      <header className="hs-head hs-head-row">
        <div>
          <h1 className="hs-title">Practitioners</h1>
          <p className="hs-sub">
            {isAll
              ? 'Doctors across all clinics, with the sites they sit at.'
              : `Doctors who hold a chamber at ${facilityLabel}.`}
          </p>
        </div>
        {!isAll && (
          <button className="btn btn-primary" onClick={() => setForm({ mode: 'add' })}>
            <Plus size={16} /> Add practitioner
          </button>
        )}
      </header>

      {isAll && (
        <p className="hs-note">
          <AlertTriangle size={13} />
          Choose a single clinic to add or update its practitioners — a doctor may sit at several
          sites, so “their hours” is ambiguous from a group view.
        </p>
      )}

      {staff.length === 0 ? (
        <div className="hs-panel">
          <p className="hs-empty">No practitioners list a chamber at {facilityLabel}.</p>
        </div>
      ) : (
        <div className="hs-staff">
          {staff.map((d) => {
            const rooms = chambersOf(d)
            const unverified = d.status === 'In review'
            return (
              <article className="hs-doc" key={d.resourceId}>
                <div className="hs-doc-top">
                  <Avatar src={d.photo} name={d.name} size={44} />
                  <div>
                    <div className="hs-row-title">{d.name}</div>
                    <div className="hs-row-sub">
                      {d.specialization} · {d.resourceId}
                    </div>
                  </div>
                  <span className={`pill tone-${d.status === 'Available' ? 'green' : d.status === 'On leave' ? 'rose' : d.status === 'In review' ? 'amber' : 'blue'}`}>
                    {d.status}
                  </span>
                </div>

                {rooms.length > 0 && (
                  <div className="hs-doc-rooms">
                    {rooms.map((c) => (
                      <span className="hs-doc-hours" key={c.name}>
                        <Clock size={12} />
                        {isAll && <b>{c.name} · </b>}
                        {c.days} · {c.from}–{c.to}
                      </span>
                    ))}
                  </div>
                )}

                <div className="hs-doc-meta">
                  <span>
                    <Star size={11} /> {d.rating || '—'}
                  </span>
                  <span>Fee {d.fee || '—'}</span>
                  <span>{loadFor(d)} booked here</span>
                </div>

                {!isAll && (
                  <div className="hs-doc-actions">
                    <button
                      className="hs-btn"
                      onClick={() => setForm({ mode: 'edit', doctor: d, chamber: rooms[0] })}
                    >
                      <Pencil size={13} /> Edit hours
                    </button>
                    <button className="hs-btn danger" onClick={() => setRemoving(d)}>
                      <UserMinus size={13} /> Remove
                    </button>
                  </div>
                )}

                {/* Licence state is the platform's decision, not this desk's —
                    surfaced so a facility knows who is not yet cleared to
                    practise, but it can't be approved from here. */}
                <div className={`hs-doc-lic ${unverified ? 'warn' : ''}`}>
                  {unverified ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                  {unverified
                    ? 'Licence under review by the platform admin'
                    : `Licence ${d.license || 'on file'}`}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {form && (
        <ChamberForm
          open
          mode={form.mode}
          doctor={form.doctor}
          chamber={form.chamber}
          facility={facility}
          candidates={candidates}
          onClose={() => setForm(null)}
          onSave={save}
          // Remount per target so the form starts from that chamber's values.
          key={`${form.mode}-${form.doctor?.resourceId || 'new'}`}
        />
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        width={430}
        title="Remove from this facility?"
        subtitle={removing?.name}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setRemoving(null)}>
              Keep
            </button>
            <button className="btn btn-primary" style={{ background: 'var(--tone-rose)' }} onClick={confirmRemove}>
              Remove
            </button>
          </>
        }
      >
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{removing?.name}</strong> will no longer sit at{' '}
          {facility} and patients won't be able to book them here.
          <br />
          <br />
          Their practitioner record and any other clinics they attend are unaffected — this only
          ends their chamber at this facility. Existing appointments already booked here are
          <strong> not</strong> cancelled; review them under Appointments.
        </p>
      </Modal>
    </>
  )
}
