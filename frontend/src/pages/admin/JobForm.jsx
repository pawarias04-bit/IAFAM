// FORMULARIO DE OFERTA (backoffice): sirve para crear (/admin/jobs/new) y
// editar (/admin/jobs/:id/edit). Detecta el modo viendo si hay :id.
//
// Los campos de contenido son los mismos que usa el portal de empresas
// (components/JobFields.jsx); aquí se añade la sección de publicación, que
// solo controla el equipo.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import JobFields, {
  JOB_CONTENT_EMPTY, jobContentPayload, validateJobContent,
} from '../../components/JobFields.jsx'
import {
  Alert, Button, GlassPanel, Loader, Select, useToast,
} from '../../components/ui/index.js'
import {
  adminCreateJob, adminGetJob, adminUpdateJob, fetchCategories,
  fetchCompanies, fetchJobStatusTransitions, fetchSkills,
} from '../../api.js'
import { useAuth } from '../../auth.jsx'
import {
  NEW_JOB_STATUSES, STATUS_LABEL, VERIFICATION_LABEL, statusOptionsFor, toOptions,
} from '../../lib/labels.js'

const EMPTY = { ...JOB_CONTENT_EMPTY, status: 'DRAFT', verification_status: 'PENDING' }

// Postgres devuelve null en las columnas vacias, y un <input value={null}>
// deja de ser controlado (React avisa en consola). Se quitan esas claves
// para que prevalezca el '' de EMPTY.
function withoutNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null))
}

// Una oferta nueva nace como Borrador o En revisión; Publicada solo si el
// rol puede publicar (BO-030 y BO-033).
function newStatusOptions(canPublish) {
  return NEW_JOB_STATUSES
    .filter((s) => s !== 'ACTIVE' || canPublish)
    .map((value) => ({ value, label: STATUS_LABEL[value] }))
}

export default function JobForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()
  const canPublish = can('jobs.publish')
  const canVerify = can('jobs.verify')

  const [form, setForm] = useState(EMPTY)
  // Estado con el que se cargó la oferta: las transiciones se calculan
  // desde aquí, no desde lo que se va eligiendo en el formulario.
  const [savedStatus, setSavedStatus] = useState(null)
  const [transitions, setTransitions] = useState({})
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [skills, setSkills] = useState([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchCompanies(), fetchCategories(), fetchSkills(), fetchJobStatusTransitions()])
      .then(([c, cat, s, t]) => { setCompanies(c); setCategories(cat); setSkills(s); setTransitions(t) })
      .catch((e) => setError(e.message))

    if (isEdit) {
      adminGetJob(id)
        // skill_ids son los ids (para premarcar las casillas); job.skills
        // son los nombres, que solo sirven para mostrar.
        .then((job) => {
          setForm({ ...EMPTY, ...withoutNulls(job), skill_ids: job.skill_ids || [] })
          setSavedStatus(job.status)
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id, isEdit])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const errors = validateJobContent(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    const payload = {
      ...jobContentPayload(form),
      status: form.status,
      verification_status: form.verification_status,
    }

    setSaving(true)
    try {
      if (isEdit) await adminUpdateJob(id, payload)
      else await adminCreateJob(payload)
      toast.success(isEdit ? 'Cambios guardados' : 'Oferta creada')
      navigate('/admin/jobs')
    } catch (err) {
      setError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader label="Cargando oferta…" />

  return (
    <form onSubmit={handleSubmit}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEdit ? 'Editar oferta' : 'Publicar oferta'}</h1>
          <p className="page-subtitle">
            Los campos con asterisco son obligatorios. El resto ayuda a que la encuentren.
          </p>
        </div>
      </div>

      <GlassPanel strong>
        <Alert>{error}</Alert>

        <JobFields
          form={form}
          setField={setField}
          companies={companies}
          categories={categories}
          skills={skills}
          fieldErrors={fieldErrors}
        />

        <section className="form-section">
          <h2 className="form-section-title">Publicación</h2>
          <p className="form-section-text">Solo las ofertas con estado Publicada aparecen en el buscador.</p>
          <div className="form-grid">
            <Select
              label="Estado"
              options={isEdit ? statusOptionsFor(savedStatus, transitions) : newStatusOptions(canPublish)}
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              disabled={isEdit && !canPublish}
              hint={isEdit && !canPublish ? 'Tu rol no puede cambiar el estado.' : undefined}
            />
            <Select
              label="Verificación"
              options={toOptions(VERIFICATION_LABEL)}
              value={form.verification_status}
              onChange={(e) => setField('verification_status', e.target.value)}
              disabled={!canVerify}
              hint={!canVerify ? 'Tu rol no puede verificar ofertas.' : undefined}
            />
          </div>
        </section>
      </GlassPanel>

      <GlassPanel strong className="form-actions">
        <Button variant="ghost" onClick={() => navigate('/admin/jobs')} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Guardar cambios' : 'Crear oferta'}
        </Button>
      </GlassPanel>
    </form>
  )
}
