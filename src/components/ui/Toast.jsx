import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
}
const tones = {
  success: 'green',
  info: 'blue',
  warning: 'amber',
  error: 'rose',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'success', opts = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setToasts((t) => [...t, { id, message, type, ...opts }])
      setTimeout(() => remove(id), opts.duration || 3200)
    },
    [remove]
  )

  const api = {
    push,
    success: (m, o) => push(m, 'success', o),
    info: (m, o) => push(m, 'info', o),
    warning: (m, o) => push(m, 'warning', o),
    error: (m, o) => push(m, 'error', o),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info
          return (
            <div className={`toast tone-${tones[t.type]}`} key={t.id}>
              <span className="toast-icon">
                <Icon size={17} />
              </span>
              <div className="toast-body">
                {t.title && <div className="toast-title">{t.title}</div>}
                <div className="toast-msg">{t.message}</div>
              </div>
              <button className="toast-close" onClick={() => remove(t.id)}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
