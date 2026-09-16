// PORTAL DE EMPRESAS: crear o editar una oferta propia.
//
// La empresa no elige el estado: guarda un borrador o lo envía a revisión.
// Publicar directamente solo es posible si la plataforma no exige revisión
// y la empresa está verificada (lo comprueba jobs_guard de todas formas).
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, TriangleAlert } from 'lucide-react'
import JobFields, {
  JOB_CONTENT_EMPTY, jobContentPayload, validateJobContent,
} from '../../components/JobFields.jsx'
import { Alert, Button, GlassPanel, Loader, useToast } from '../../components/ui/index.js'
import { createJob, fetchCategories, fetchSkills, updateJob } from '../../api.js'
import { fetchCompany, fetchCompanyJob, setCompanyJobStatus } from '../../companyApi.js'
import { useSetting } from '../../settings.jsx'
import { STATUS_LABEL } from '../../lib/labels.js'

function withoutNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null))
}

export default function CompanyJobForm() {
  const { companyId, jobId } = useParams()
  const isEdit = Boolean(jobId)
  const navigate = useNavigate()
  const toast = useToast()
  const requireReview = useSetting('moderation.company_jobs_require_review', true) !== false

  const [company, setCompany] = useState(null)
  const [form, setForm] = useState({ ...JOB_CONTENT_EMPTY, company_id: companyId })
  const [savedStatus, setSavedStatus] = useState(null)
  const [categories, setCategories] = useState([])
  const [skills, setSkills] = useState([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    const tasks = [fetchCompany(companyId), fetchCategories(), fetchSkills()]
    if (isEdit) tasks.push(fetchCompanyJob(jobId))

    Promise.all(tasks)
      .then(([c, cats, sks, job]) => {
        setCompany(c)
        setCategories(cats)
        setSkills(sks)
        if (job) {
          setForm({
            ...JOB_CONTENT_EMPTY,
            ...withoutNulls(job),
            company_id: job.company_id,
            skill_ids: job.skill_ids || [],
          })
          setSavedStatus(job.status)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [companyId, jobId, isEdit])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const canPublishDirectly = !requireReview && company?.verification_status === 'VERIFIED'
  // Guardar una oferta ya publicada la devuelve a revisión (BO-124).
  const backToReview = isEdit && savedStatus === 'ACTIVE' && requireReview

  async function save(submitForReview) {
    setError('')
    const errors = validateJobContent(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(submitForReview ? 'submit' : 'draft')
    try {
      const payload = { ...jobContentPayload(form), company_id: Number(companyId) }
      let id = jobId

      if (isEdit) {
        await updateJob(jobId, payload)
      } else {
        // Nace como borrador; enviar a revisión es el paso siguiente.
        const created = await createJob({ ...payload, status: 'DRAFT' })
        id = created.id
      }

      if (submitForReview) {
        await setCompanyJobStatus(id, canPublishDirectly ? 'ACTIVE' : 'PENDING_REVIEW')
        toast.success(canPublishDirectly ? 'Oferta publicada' : 'Oferta enviada a revisión')
      } else {
        toast.success(backToReview ? 'Guardada. Vuelve a revisión antes de publicarse.' : 'Borrador guardado')
      }
      navigate(`/empresa/${companyId}`)
    } catch (err) {
      setError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving('')
    }
  }

  if (loading) return <Loader label="Cargando…" />
  if (error && !company) return <Alert>{error}</Alert>

  const alreadyInReview = savedStatus === 'PENDING_REVIEW'

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(!alreadyInReview) }}>
      <Button to={`/empresa/${companyId}`} variant="ghost" size="sm" icon={ArrowLeft} className="back-link">
        {company?.name}
      </Button>

      <div className="page-head">
        <div>
          <h1 className="page-title">{isEdit ? 'Editar oferta' : 'Nueva oferta'}</h1>
          <p className="page-subtitle">
            {isEdit && savedStatus
              ? `Ahora mismo está en estado ${STATUS_LABEL[savedStatus]}.`
              : 'Puedes guardarla como borrador y enviarla a revisión cuando esté lista.'}
          </p>
        </div>
      </div>

      <GlassPanel strong>
        <Alert>{error}</Alert>
        {backToReview && (
          <p className="job-note">
            <TriangleAlert aria-hidden="true" />
            Al guardar, la oferta dejará de estar visible y volverá a revisión.
          </p>
        )}

        <JobFields
          form={form}
          setField={setField}
          categories={categories}
          skills={skills}
          fieldErrors={fieldErrors}
          lockCompany
        />
      </GlassPanel>

      <GlassPanel strong className="form-actions">
        <p className="form-actions-note">
          {alreadyInReview
            ? 'La oferta sigue en revisión; guardar no la publica.'
            : canPublishDirectly
              ? 'Puedes publicarla directamente.'
              : 'El equipo de IAFAM la revisa antes de publicarla.'}
        </p>
        <Button variant="ghost" onClick={() => navigate(`/empresa/${companyId}`)} disabled={Boolean(saving)}>
          Cancelar
        </Button>
        <Button
          variant="secondary"
          icon={Save}
          loading={saving === 'draft'}
          disabled={Boolean(saving)}
          onClick={() => save(false)}
        >
          {isEdit ? 'Guardar' : 'Guardar borrador'}
        </Button>
        {!alreadyInReview && (
          <Button type="submit" icon={Send} loading={saving === 'submit'} disabled={Boolean(saving)}>
            {canPublishDirectly ? 'Guardar y publicar' : 'Guardar y enviar a revisión'}
          </Button>
        )}
      </GlassPanel>
    </form>
  )
}
