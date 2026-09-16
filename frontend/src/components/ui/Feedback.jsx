// Estados de la interfaz que no son contenido: carga, vacio, error y
// paginacion. Juntos porque son pequeños y siempre aparecen en pareja.
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import Button from './Button.jsx'

export function Loader({ label = 'Cargando…', inline = false }) {
  return (
    <div className={inline ? 'loader loader-inline' : 'loader'} role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

// Un vacio siempre propone la siguiente accion (`action`).
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state-glyph" aria-hidden="true">
          <Icon />
        </span>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {children && <p className="empty-state-text">{children}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'error', children }) {
  if (!children) return null
  return (
    <p className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Paginación">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <span className="pagination-status">
        Página {page} de {pages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="btn-icon-end"
      >
        Siguiente
        <ChevronRight className="btn-glyph" aria-hidden="true" />
      </Button>
    </nav>
  )
}
