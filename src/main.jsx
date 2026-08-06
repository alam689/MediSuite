import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { DataProvider } from './store/DataStore.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import './styles/index.css'
import './components/ui/ui.css'

/* Only the providers every route needs live here. The per-stakeholder
   scoping providers (patient, doctor, hospital, pharmacy, lab) mount inside
   their own guarded route in App.jsx — a pharmacist's branch selection has
   no business being constructed while a patient is signed in. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
)
