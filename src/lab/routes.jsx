import { Routes, Route, Navigate } from 'react-router-dom'
import { LabProvider } from './LabContext.jsx'
import LabShell from './LabShell.jsx'
import LabHome from './LabHome.jsx'
import LabOrders from './LabOrders.jsx'
import LabBench from './LabBench.jsx'
import LabReports from './LabReports.jsx'

export default function LabRoutes() {
  return (
    <LabProvider>
      <Routes>
        <Route element={<LabShell />}>
          <Route index element={<LabHome />} />
          <Route path="orders" element={<LabOrders />} />
          <Route path="bench" element={<LabBench />} />
          <Route path="reports" element={<LabReports />} />
          <Route path="*" element={<Navigate to="/lab" replace />} />
        </Route>
      </Routes>
    </LabProvider>
  )
}
