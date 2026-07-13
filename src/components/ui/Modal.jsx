import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/* Centered modal dialog. side=true renders a right-side drawer instead. */
export default function Modal({ open, title, subtitle, onClose, children, footer, side = false, width }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={`modal-scrim ${side ? 'is-side' : ''}`} onClick={onClose}>
      <div
        className={`modal ${side ? 'modal-side' : ''}`}
        style={width ? { maxWidth: width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
