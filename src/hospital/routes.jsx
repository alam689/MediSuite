import { Routes, Route, Navigate } from 'react-router-dom'
import { HospitalProvider } from './HospitalContext.jsx'
import HospitalShell from './HospitalShell.jsx'
import HospitalHome from './HospitalHome.jsx'
import HospitalBeds from './HospitalBeds.jsx'
import HospitalAdmissions from './HospitalAdmissions.jsx'
import HospitalAppointments from './HospitalAppointments.jsx'
import HospitalStaff from './HospitalStaff.jsx'
import HospitalDepartments from './HospitalDepartments.jsx'
import HospitalRevenue from './HospitalRevenue.jsx'

export default function HospitalRoutes() {
  return (
    <HospitalProvider>
      <Routes>
        <Route element={<HospitalShell />}>
          <Route index element={<HospitalHome />} />
          <Route path="beds" element={<HospitalBeds />} />
          <Route path="admissions" element={<HospitalAdmissions />} />
          <Route path="appointments" element={<HospitalAppointments />} />
          <Route path="staff" element={<HospitalStaff />} />
          <Route path="departments" element={<HospitalDepartments />} />
          <Route path="revenue" element={<HospitalRevenue />} />
          <Route path="*" element={<Navigate to="/hospital" replace />} />
        </Route>
      </Routes>
    </HospitalProvider>
  )
}
