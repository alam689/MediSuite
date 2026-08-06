import { Routes, Route, Navigate } from 'react-router-dom'
import { PharmacyProvider } from './PharmacyContext.jsx'
import PharmacyShell from './PharmacyShell.jsx'
import PharmacyHome from './PharmacyHome.jsx'
import PharmacyQueue from './PharmacyQueue.jsx'
import PharmacyInventory from './PharmacyInventory.jsx'
import PharmacyDeliveries from './PharmacyDeliveries.jsx'

export default function PharmacyRoutes() {
  return (
    <PharmacyProvider>
      <Routes>
        <Route element={<PharmacyShell />}>
          <Route index element={<PharmacyHome />} />
          <Route path="queue" element={<PharmacyQueue />} />
          <Route path="inventory" element={<PharmacyInventory />} />
          <Route path="deliveries" element={<PharmacyDeliveries />} />
          <Route path="*" element={<Navigate to="/pharmacy" replace />} />
        </Route>
      </Routes>
    </PharmacyProvider>
  )
}
