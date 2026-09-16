// Campos de una oferta, compartidos por el formulario del backoffice y el
// del portal de empresas. Fuera quedan el estado y la verificación, que
// cada formulario resuelve a su manera (el equipo los elige; la empresa
// envía a revisión).
import { ChoiceGroup, Input, Select, Textarea } from './ui/index.js'
import { LEVEL_LABEL, MODE_LABEL, TYPE_LABEL, toOptions } from '../lib/labels.js'

// Valores iniciales de los campos de contenido.
export const JOB_CONTENT_EMPTY = {
  title: '', description: '', company_id: '', category_id: '',
  experience_level: '', work_mode: '', employment_type: 'FULL_TIME',
  salary_min: '', salary_max: '', currency: '', deadline: '',
  contact_email: '', apply_url: '', skill_ids: [],
}

// Lo que se envía a la base de datos desde cualquiera de los dos formularios.
export function jobContentPayload(form) {
  return {
    title: form.title,
    description: form.description,
    company_id: Number(form.company_id),
    category_id: form.category_id ? Number(form.category_id) : null,
    experience_level: form.experience_level || null,
    work_mode: form.work_mode || null,
    employment_type: form.employment_type || null,
    salary_min: form.salary_min || null,
    salary_max: form.salary_max || null,
    currency: form.currency || null,
    deadline: form.deadline || null,
    contact_email: form.contact_email || null,
    apply_url: form.apply_url || null,
    skill_ids: form.skill_ids,
  }
}

// Comprobaciones que no hace la base de datos pero conviene avisar antes.
export function validateJobContent(form) {
  const errors = {}
  if (form.salary_min && form.salary_max && Number(form.salary_min) > Number(form.salary_max)) {
    errors.salary_max = 'Debe ser mayor o igual que el mínimo.'
  }
  if (!form.apply_url && !form.contact_email) {
    errors.apply_url = 'Indica un enlace o un email; si no, nadie podrá postularse.'
  }
  return errors
}

export default function JobFields({
  form,
  setField,
  companies = [],
  categories = [],
  skills = [],
  fieldErrors = {},
  lockCompany = false,
}) {
  return (
    <>
      <section className="form-section">
        <h2 className="form-section-title">La oferta</h2>
        <p className="form-section-text">Lo que verá primero quien busca empleo.</p>
        <div className="form-grid">
          <Input
            label="Puesto"
            placeholder="Desarrollador backend junior"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            required
            className="span-2"
          />
          {!lockCompany && (
            <Select
              label="Empresa"
              placeholder="Elige una empresa"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              value={form.company_id}
              onChange={(e) => setField('company_id', e.target.value)}
              hint={companies.length === 0 ? 'Primero crea la empresa en la sección Empresas.' : undefined}
              required
            />
          )}
          <Select
            label="Área"
            placeholder="Sin área"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={form.category_id}
            onChange={(e) => setField('category_id', e.target.value)}
          />
          <Textarea
            label="Descripción"
            placeholder="Responsabilidades, requisitos, qué ofrece la empresa…"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            required
            className="span-2"
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Condiciones</h2>
        <p className="form-section-text">Sirven para los filtros de búsqueda.</p>
        <div className="form-grid">
          <Select
            label="Nivel"
            placeholder="Sin indicar"
            options={toOptions(LEVEL_LABEL)}
            value={form.experience_level}
            onChange={(e) => setField('experience_level', e.target.value)}
          />
          <Select
            label="Modalidad"
            placeholder="Sin indicar"
            options={toOptions(MODE_LABEL)}
            value={form.work_mode}
            onChange={(e) => setField('work_mode', e.target.value)}
          />
          <Select
            label="Tipo de contrato"
            options={toOptions(TYPE_LABEL)}
            value={form.employment_type}
            onChange={(e) => setField('employment_type', e.target.value)}
          />
          <Input
            label="Fecha límite"
            type="date"
            value={form.deadline}
            onChange={(e) => setField('deadline', e.target.value)}
          />
          <Input
            label="Salario mínimo"
            type="number"
            min="0"
            inputMode="numeric"
            value={form.salary_min}
            onChange={(e) => setField('salary_min', e.target.value)}
          />
          <Input
            label="Salario máximo"
            type="number"
            min="0"
            inputMode="numeric"
            error={fieldErrors.salary_max}
            value={form.salary_max}
            onChange={(e) => setField('salary_max', e.target.value)}
          />
          <Input
            label="Moneda"
            placeholder="USD, EUR, CUP"
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value.toUpperCase())}
            maxLength={5}
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Tecnologías</h2>
        <p className="form-section-text">Marca las que pide la oferta.</p>
        <ChoiceGroup
          multiple
          options={skills.map((s) => ({ value: s.id, label: s.name }))}
          value={form.skill_ids}
          onChange={(v) => setField('skill_ids', v)}
        />
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Cómo postularse</h2>
        <p className="form-section-text">Indica al menos una forma de contacto.</p>
        <div className="form-grid">
          <Input
            label="Enlace para postularse"
            type="url"
            placeholder="https://empresa.com/empleo/123"
            error={fieldErrors.apply_url}
            value={form.apply_url}
            onChange={(e) => setField('apply_url', e.target.value)}
          />
          <Input
            label="Email de contacto"
            type="email"
            value={form.contact_email}
            onChange={(e) => setField('contact_email', e.target.value)}
          />
        </div>
      </section>
    </>
  )
}
