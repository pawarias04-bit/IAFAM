// JobForm: formulario de oferta, sirve para CREAR (/admin/jobs/new) y
// EDITAR (/admin/jobs/:id/edit). Detecta el modo viendo si hay :id en la URL.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateJob, adminGetJob, adminUpdateJob, fetchCategories,
  fetchCompanies, fetchSkills,
} from '../../api.js'

const EMPTY = {
  title: '', description: '', company_id: '', category_id: '',
  experience_level: '', work_mode: '', employment_type: 'FULL_TIME',
  salary_min: '', salary_max: '', currency: '', deadline: '',
  contact_email: '', apply_url: '', status: 'DRAFT',
  verification_status: 'PENDING', skill_ids: [],
}

export default function JobForm() {
  const { id } = useParams()          // si existe id → modo edición
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [skills, setSkills] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    Promise.all([fetchCompanies(), fetchCategories(), fetchSkills()])
      .then(([c, cat, s]) => { setCompanies(c); setCategories(cat); setSkills(s) })
      .catch((e) => setError(e.message))

    if (isEdit) {
      adminGetJob(id)
        .then((job) => setForm({ ...EMPTY, ...job, skill_ids: job.skills || [] }))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id, isEdit])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // toogleSkill mantiene la lista de skill_ids seleccionados.
  function toggleSkill(skillId) {
    setForm((prev) => {
      const has = prev.skill_ids.includes(skillId)
      return {
        ...prev,
        // Si ya está, se quita de la lista; si no, se agrega.
        skill_ids: has ? prev.skill_ids.filter((s) => s !== skillId)
                        : [...prev.skill_ids, skillId],
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = {
      title: form.title, description: form.description,
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
      status: form.status, verification_status: form.verification_status,
      skill_ids: form.skill_ids,
    }
    try {
      if (isEdit) await adminUpdateJob(id, payload)
      else await adminCreateJob(payload)
      navigate('/admin/jobs')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading">⏳ Cargando oferta...</div>

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <h1>{isEdit ? '✏️ Editar oferta' : '➕ Nueva oferta'}</h1>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label>Título *</label>
          <input value={form.title} onChange={(e) => setField('title', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Descripción *</label>
          <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} required />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Empresa *</label>
            <select value={form.company_id} onChange={(e) => setField('company_id', e.target.value)} required>
              <option value="">Selecciona...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Área</label>
            <select value={form.category_id} onChange={(e) => setField('category_id', e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Nivel</label>
            <select value={form.experience_level} onChange={(e) => setField('experience_level', e.target.value)}>
              <option value="">—</option>
              <option value="INTERNSHIP">Prácticas</option>
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>
          <div className="form-group">
            <label>Modalidad</label>
            <select value={form.work_mode} onChange={(e) => setField('work_mode', e.target.value)}>
              <option value="">—</option>
              <option value="REMOTE">Remoto</option>
              <option value="HYBRID">Híbrido</option>
              <option value="ON_SITE">Presencial</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.employment_type} onChange={(e) => setField('employment_type', e.target.value)}>
              <option value="FULL_TIME">Tiempo completo</option>
              <option value="PART_TIME">Medio tiempo</option>
              <option value="INTERNSHIP">Pasantía</option>
              <option value="FREELANCE">Freelance</option>
              <option value="CONTRACT">Contrato</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fecha límite</label>
            <input type="date" value={form.deadline} onChange={(e) => setField('deadline', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Salario mínimo</label>
            <input type="number" value={form.salary_min} onChange={(e) => setField('salary_min', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Salario máximo</label>
            <input type="number" value={form.salary_max} onChange={(e) => setField('salary_max', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Moneda</label>
            <input value={form.currency} onChange={(e) => setField('currency', e.target.value)} placeholder="USD, EUR, CUP..." />
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              <option value="DRAFT">Borrador</option>
              <option value="PENDING_REVIEW">Pendiente de revisión</option>
              <option value="ACTIVE">Activa (publicada)</option>
              <option value="CLOSED">Cerrada</option>
              <option value="REJECTED">Rechazada</option>
            </select>
          </div>
          <div className="form-group">
            <label>Verificación</label>
            <select value={form.verification_status} onChange={(e) => setField('verification_status', e.target.value)}>
              <option value="PENDING">Pendiente 🟡</option>
              <option value="VERIFIED">Verificada 🟢</option>
              <option value="REPORTED">Reportada 🔴</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email de contacto</label>
            <input type="email" value={form.contact_email} onChange={(e) => setField('contact_email', e.target.value)} />
          </div>
          <div className="form-group">
            <label>URL de postulación</label>
            <input value={form.apply_url} onChange={(e) => setField('apply_url', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="form-group">
          <label>Tecnologías / skills</label>
          <div className="tags">
            {skills.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`chip ${form.skill_ids.includes(s.id) ? 'chip-skill' : 'chip-soft'}`}
                onClick={() => toggleSkill(s.id)}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {form.skill_ids.includes(s.id) ? '✓ ' : ''}{s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" type="submit">
            {isEdit ? 'Guardar cambios' : 'Crear oferta'}
          </button>
          <button className="btn btn-outline" type="button" onClick={() => navigate('/admin/jobs')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}