// Interruptor on/off. Para ajustes que se aplican al pulsar, sin botón de
// guardar (la configuración y la matriz de permisos).
import { LoaderCircle } from 'lucide-react'

export default function Switch({ checked, onChange, label, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb">
        {busy && <LoaderCircle className="spin" aria-hidden="true" />}
      </span>
    </button>
  )
}
