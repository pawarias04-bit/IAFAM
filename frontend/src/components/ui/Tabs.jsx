// Pestañas con contador opcional. Accesibles con teclado: flechas para
// moverse entre pestañas (patrón WAI-ARIA "tabs" con activación manual).
import { useRef } from 'react'

export default function Tabs({ tabs, value, onChange, label }) {
  const refs = useRef([])

  function onKeyDown(e, index) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + tabs.length) % tabs.length
    refs.current[next]?.focus()
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
            {tab.count > 0 && <span className="count-pill">{tab.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
