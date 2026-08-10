import { Routes, Route, Navigate } from 'react-router-dom'
import { AmbulanceProvider } from './AmbulanceContext.jsx'
import AmbulanceShell from './AmbulanceShell.jsx'
import AmbulanceHome from './AmbulanceHome.jsx'
import AmbulanceFleet from './AmbulanceFleet.jsx'
import AmbulanceDrivers from './AmbulanceDrivers.jsx'
import AmbulanceTrips from './AmbulanceTrips.jsx'
import './ambulance-portal.css'

export default function AmbulanceRoutes() {
  return (
    <AmbulanceProvider>
      <Routes>
        <Route element={<AmbulanceShell />}>
          <Route index element={<AmbulanceHome />} />
          <Route path="fleet" element={<AmbulanceFleet />} />
          <Route path="drivers" element={<AmbulanceDrivers />} />
          <Route path="trips" element={<AmbulanceTrips />} />
          <Route path="*" element={<Navigate to="/ambulance" replace />} />
        </Route>
      </Routes>
    </AmbulanceProvider>
  )
}
