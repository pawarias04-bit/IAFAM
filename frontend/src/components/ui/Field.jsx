// Campos de formulario con etiqueta, ayuda y error ya conectados por id
// (aria-describedby), para no repetir ese cableado en cada pagina.
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

function FieldShell({ id, label, hint, error, required, className = '', children }) {
  return (
    <div className={`field ${error ? 'field-invalid' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error
        ? <p id={`${id}-msg`} className="field-error">{error}</p>
        : hint && <p id={`${id}-msg`} className="field-hint">{hint}</p>}
    </div>
  )
}

function describedBy(id, error, hint) {
  return error || hint ? `${id}-msg` : undefined
}

export function Input({ label, hint, error, className, icon: Icon, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <div className={`control ${Icon ? 'control-with-icon' : ''}`}>
        {Icon && <Icon className="control-icon" aria-hidden="true" />}
        <input
          id={id}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
        />
      </div>
    </FieldShell>
  )
}

export function Textarea({ label, hint, error, className, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <textarea
        id={id}
        className="input textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </FieldShell>
  )
}

// `options`: [{ value, label }]. `placeholder` añade la opcion vacia.
export function Select({ label, hint, error, className, options = [], placeholder, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required} className={className}>
      <div className="control">
        <select
          id={id}
          className="input select"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="select-caret" aria-hidden="true" />
      </div>
    </FieldShell>
  )
}
