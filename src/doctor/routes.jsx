import { Routes, Route, Navigate } from 'react-router-dom'
import { DoctorProvider } from './DoctorContext.jsx'
import DoctorShell from './DoctorShell.jsx'
import DoctorHome from './DoctorHome.jsx'
import DoctorSchedule from './DoctorSchedule.jsx'
import DoctorPatients from './DoctorPatients.jsx'
import DoctorConsults from './DoctorConsults.jsx'
import DoctorNotes from './DoctorNotes.jsx'
import DoctorPrescribe from './DoctorPrescribe.jsx'
import PrescriptionPad from './pad/PrescriptionPad.jsx'
import DoctorLabs from './DoctorLabs.jsx'
import DoctorEarnings from './DoctorEarnings.jsx'
import DoctorProfile from './DoctorProfile.jsx'

/* The whole doctor portal as one lazy-loaded chunk — provider, shell and
   every page. Splitting per page would produce a dozen tiny requests for
   someone who is going to open most of them anyway; splitting per portal
   means a patient never downloads any of this. */
export default function DoctorRoutes() {
  return (
    <DoctorProvider>
      <Routes>
        <Route element={<DoctorShell />}>
          <Route index element={<DoctorHome />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="consults" element={<DoctorConsults />} />
          <Route path="notes" element={<DoctorNotes />} />
          <Route path="prescriptions" element={<DoctorPrescribe />} />
          <Route path="pad" element={<PrescriptionPad />} />
          <Route path="labs" element={<DoctorLabs />} />
          <Route path="earnings" element={<DoctorEarnings />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="*" element={<Navigate to="/doctor" replace />} />
        </Route>
      </Routes>
    </DoctorProvider>
  )
}
