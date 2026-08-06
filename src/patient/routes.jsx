import { Routes, Route, Navigate } from 'react-router-dom'
import { PatientProvider } from './PatientContext.jsx'
import PatientShell from './PatientShell.jsx'
import PatientHome from './PatientHome.jsx'
import FindDoctor from './FindDoctor.jsx'
import BedSearch from './BedSearch.jsx'
import MyConsult from './MyConsult.jsx'
import MyRecords from './MyRecords.jsx'
import MyPrescriptions from './MyPrescriptions.jsx'
import MyPayments from './MyPayments.jsx'
import MyProfile from './MyProfile.jsx'

export default function PatientRoutes() {
  return (
    <PatientProvider>
      <Routes>
        <Route element={<PatientShell />}>
          <Route index element={<PatientHome />} />
          <Route path="doctors" element={<FindDoctor />} />
          <Route path="beds" element={<BedSearch />} />
          <Route path="consult" element={<MyConsult />} />
          <Route path="records" element={<MyRecords />} />
          <Route path="prescriptions" element={<MyPrescriptions />} />
          <Route path="payments" element={<MyPayments />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="*" element={<Navigate to="/patient" replace />} />
        </Route>
      </Routes>
    </PatientProvider>
  )
}
