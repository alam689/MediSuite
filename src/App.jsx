import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import Workspace from './components/Workspace.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PatientShell from './patient/PatientShell.jsx'
import PatientHome from './patient/PatientHome.jsx'
import FindDoctor from './patient/FindDoctor.jsx'
import BedSearch from './patient/BedSearch.jsx'
import MyRecords from './patient/MyRecords.jsx'
import MyPrescriptions from './patient/MyPrescriptions.jsx'
import MyConsult from './patient/MyConsult.jsx'
import MyPayments from './patient/MyPayments.jsx'
import MyProfile from './patient/MyProfile.jsx'
import HospitalShell from './hospital/HospitalShell.jsx'
import HospitalHome from './hospital/HospitalHome.jsx'
import HospitalBeds from './hospital/HospitalBeds.jsx'
import HospitalAppointments from './hospital/HospitalAppointments.jsx'
import HospitalStaff from './hospital/HospitalStaff.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* Clinician workspace */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="m/:key" element={<Workspace />} />
      </Route>

      {/* Patient portal — blueprint §8.4 */}
      <Route path="/patient" element={<PatientShell />}>
        <Route index element={<PatientHome />} />
        <Route path="doctors" element={<FindDoctor />} />
        <Route path="beds" element={<BedSearch />} />
        <Route path="consult" element={<MyConsult />} />
        <Route path="records" element={<MyRecords />} />
        <Route path="prescriptions" element={<MyPrescriptions />} />
        <Route path="payments" element={<MyPayments />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>

      {/* Hospital admin — scoped to a single facility */}
      <Route path="/hospital" element={<HospitalShell />}>
        <Route index element={<HospitalHome />} />
        <Route path="beds" element={<HospitalBeds />} />
        <Route path="appointments" element={<HospitalAppointments />} />
        <Route path="staff" element={<HospitalStaff />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
