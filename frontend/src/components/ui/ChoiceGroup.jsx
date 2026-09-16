// Grupo de opciones en forma de píldora.
//
// Modo simple (por defecto): se comporta como un grupo de radios que se
// puede desmarcar; volver a pulsar la opción activa la quita. Pensado
// para filtros, donde "sin filtro" es un estado válido.
//
// Modo `multiple`: cada píldora es un interruptor (aria-pressed) y `value`
// es un array. Pensado para seleccionar skills.
import { useId } from 'react'
import { Check } from 'lucide-react'

export default function ChoiceGroup({ legend, options, value, onChange, multiple = false, className = '' }) {
  const legendId = useId()

  function isSelected(optionValue) {
    return multiple ? value.includes(optionValue) : String(value) === String(optionValue)
  }

  function toggle(optionValue) {
    if (multiple) {
      onChange(
        isSelected(optionValue)
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue],
      )
    } else {
      onChange(isSelected(optionValue) ? '' : String(optionValue))
    }
  }

  return (
    <div
      className={`filter-group ${className}`}
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={legend ? legendId : undefined}
    >
      {legend && <p id={legendId} className="filter-legend">{legend}</p>}
      <div className="choice-group">
        {options.map((o) => {
          const selected = isSelected(o.value)
          const stateProps = multiple
            ? { 'aria-pressed': selected }
            : { role: 'radio', 'aria-checked': selected }
          return (
            <button
              key={o.value}
              type="button"
              className="choice"
              onClick={() => toggle(o.value)}
              {...stateProps}
            >
              {multiple && selected && <Check aria-hidden="true" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
