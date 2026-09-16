// Modal accesible y reutilizable.
//
// - Se monta en document.body con un portal, asi ningun overflow/z-index
//   del padre lo recorta.
// - Escape y clic en el fondo cierran (salvo `dismissible={false}`).
// - El foco entra al abrir, queda atrapado dentro con Tab y vuelve al
//   elemento que lo abrio al cerrar.
// - Bloquea el scroll de la pagina mientras esta abierto.
// - `variant="sheet"` lo convierte en panel inferior en movil (filtros).
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',        // sm | md | lg
  variant = 'dialog', // dialog | sheet
  dismissible = true,
  initialFocusRef,
  children,
}) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef(null)
  // onClose suele ser una funcion nueva en cada render; con una ref el
  // efecto no se re-ejecuta (ni roba el foco) cada vez que el padre pinta.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current

    const target =
      initialFocusRef?.current ||
      dialog.querySelector('[data-autofocus]') ||
      dialog.querySelector(FOCUSABLE) ||
      dialog
    target.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKeyDown(e) {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return

      const items = [...dialog.querySelectorAll(FOCUSABLE)]
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, dismissible, initialFocusRef])

  if (!open) return null

  return createPortal(
    <div
      className={`modal-backdrop modal-${variant}`}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`modal modal-${size}`}
      >
        <header className="modal-header">
          <div>
            {title && <h2 id={titleId} className="modal-title">{title}</h2>}
            {description && <p id={descId} className="modal-description">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
