import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { DataProvider } from './store/DataStore.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import './styles/index.css'
import './components/ui/ui.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
)
