import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import Workspace from '../components/Workspace.jsx'
import Dashboard from './Dashboard.jsx'

/* The administrator console is the heaviest chunk in the app — the generic
   Workspace pulls in every module's form, table and feature surface. Nobody
   but an administrator should pay for it. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="m/:key" element={<Workspace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  )
}
