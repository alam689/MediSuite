import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import RequireRole from './auth/RequireRole.jsx'

/* One chunk per portal, fetched only when a role that may see it arrives.

   The guard sits *outside* the lazy element on purpose: a patient who types
   /lab is redirected before the laboratory chunk is ever requested. Login
   stays eager — it is the first paint for every visitor. */
const AdminRoutes = lazy(() => import('./pages/adminRoutes.jsx'))
const PatientRoutes = lazy(() => import('./patient/routes.jsx'))
const DoctorRoutes = lazy(() => import('./doctor/routes.jsx'))
const PharmacyRoutes = lazy(() => import('./pharmacy/routes.jsx'))
const LabRoutes = lazy(() => import('./lab/routes.jsx'))
const HospitalRoutes = lazy(() => import('./hospital/routes.jsx'))

/* Deliberately quiet. The chunks are small and local, so a spinner would
   flash for a frame and read as jank; an empty frame reads as nothing. */
function PortalLoading() {
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} aria-busy="true" />
}

export default function App() {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Administrator console — every module, platform-wide. */}
        <Route
          path="/app/*"
          element={
            <RequireRole roles={['admin']}>
              <AdminRoutes />
            </RequireRole>
          }
        />

        {/* Patient portal — blueprint §4.1 */}
        <Route
          path="/patient/*"
          element={
            <RequireRole roles={['patient']}>
              <PatientRoutes />
            </RequireRole>
          }
        />

        {/* Doctor workspace — one clinician's caseload. Blueprint §4.2 */}
        <Route
          path="/doctor/*"
          element={
            <RequireRole roles={['doctor']}>
              <DoctorRoutes />
            </RequireRole>
          }
        />

        {/* Pharmacy — one dispensary. Blueprint §4.5 */}
        <Route
          path="/pharmacy/*"
          element={
            <RequireRole roles={['pharmacy']}>
              <PharmacyRoutes />
            </RequireRole>
          }
        />

        {/* Diagnostic centre — one laboratory. Blueprint §4.4 */}
        <Route
          path="/lab/*"
          element={
            <RequireRole roles={['lab']}>
              <LabRoutes />
            </RequireRole>
          }
        />

        {/* Hospital admin — one facility. Blueprint §4.6 */}
        <Route
          path="/hospital/*"
          element={
            <RequireRole roles={['hospital']}>
              <HospitalRoutes />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
