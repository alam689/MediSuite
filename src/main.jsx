import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { DataProvider } from './store/DataStore.jsx'
import { PatientProvider } from './patient/PatientContext.jsx'
import { HospitalProvider } from './hospital/HospitalContext.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import './styles/index.css'
import './components/ui/ui.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <PatientProvider>
          <HospitalProvider>
            <ToastProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </HospitalProvider>
        </PatientProvider>
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
)
