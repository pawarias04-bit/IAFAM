// Avisos breves tras una accion ("Oferta guardada"). Sustituye a alert().
//
//   const toast = useToast()
//   toast.success('Oferta guardada')
//   toast.error('No se ha podido guardar')
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

const ToastContext = createContext(null)
const DURATION = 4000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((tone, message) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { id, tone, message }])
    setTimeout(() => dismiss(id), DURATION)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* role=status anuncia el texto a lectores de pantalla sin mover el foco */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === 'error' ? CircleAlert : CircleCheck
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <Icon className="toast-glyph" aria-hidden="true" />
              <span>{t.message}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
                <X aria-hidden="true" />
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
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
