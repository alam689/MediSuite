import { Routes, Route, Navigate } from 'react-router-dom'
import { PatientProvider } from './PatientContext.jsx'
import PatientShell from './PatientShell.jsx'
import PatientHome from './PatientHome.jsx'
import FindDoctor from './FindDoctor.jsx'
import BedSearch from './BedSearch.jsx'
import AmbulanceService from './AmbulanceService.jsx'
import MyConsult from './MyConsult.jsx'
import MyRecords from './MyRecords.jsx'
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
          <Route path="ambulance" element={<AmbulanceService />} />
          <Route path="consult" element={<MyConsult />} />
          <Route path="records" element={<MyRecords />} />
          {/* Old top-level pages, now tabs of My records — keep the URLs
              working for notifications and bookmarks. */}
          <Route path="reports" element={<Navigate to="/patient/records?tab=reports" replace />} />
          <Route path="vaccines" element={<Navigate to="/patient/records?tab=vaccines" replace />} />
          <Route
            path="prescriptions"
            element={<Navigate to="/patient/records?tab=prescriptions" replace />}
          />
          <Route path="payments" element={<MyPayments />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="*" element={<Navigate to="/patient" replace />} />
        </Route>
      </Routes>
    </PatientProvider>
  )
}
