// DETALLE DE OFERTA: descripción completa a la izquierda y, a la derecha,
// las condiciones y las acciones (postularse, guardar, contactar, reportar).
// Lee el :id de la URL con useParams (/jobs/123).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bookmark, BookmarkCheck, Briefcase, CalendarClock, CalendarDays,
  BadgeCheck, ExternalLink, FileSearch, Flag, GraduationCap, Mail, MapPin, Wallet,
} from 'lucide-react'
import {
  Badge, Button, CompanyMark, EmptyState, GlassPanel, Loader, ReasonDialog, Select,
  VerificationBadge, useToast,
} from '../components/ui/index.js'
import { getJob, isFavorite, reportJob, toggleFavorite } from '../api.js'
import { useAuth } from '../auth.jsx'
import {
  LEVEL_LABEL, MODE_LABEL, REPORT_REASON_LABEL, TYPE_LABEL, formatDate, formatSalary, toOptions,
} from '../lib/labels.js'

export default function JobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('FAKE')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getJob(id)
      .then((j) => { if (!cancelled) { setJob(j); setNotFound(false) } })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  // El estado real del favorito, para que el botón no mienta al entrar.
  useEffect(() => {
    if (!user) { setSaved(false); return }
    let cancelled = false
    isFavorite(Number(id))
      .then((v) => { if (!cancelled) setSaved(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id, user])

  async function handleSave() {
    setSaving(true)
    try {
      const { favorite } = await toggleFavorite(job.id)
      setSaved(favorite)
      toast.success(favorite ? 'Oferta guardada en tu perfil' : 'Oferta quitada de guardadas')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader label="Cargando oferta…" />

  if (notFound || !job) {
    return (
      <GlassPanel style={{ marginTop: 40 }}>
        <EmptyState
          icon={FileSearch}
          title="Esta oferta ya no está disponible"
          action={<Button to="/" variant="secondary" icon={ArrowLeft}>Ver ofertas publicadas</Button>}
        >
          Puede que se haya cerrado o que el enlace esté incompleto.
        </EmptyState>
      </GlassPanel>
    )
  }

  const salary = formatSalary(job)
  const facts = [
    salary && { icon: Wallet, label: 'Salario', value: salary },
    job.work_mode && { icon: MapPin, label: 'Modalidad', value: MODE_LABEL[job.work_mode] },
    job.employment_type && { icon: Briefcase, label: 'Contrato', value: TYPE_LABEL[job.employment_type] },
    job.experience_level && { icon: GraduationCap, label: 'Nivel', value: LEVEL_LABEL[job.experience_level] },
    job.publication_date && { icon: CalendarDays, label: 'Publicada', value: formatDate(job.publication_date) },
    job.deadline && { icon: CalendarClock, label: 'Fecha límite', value: formatDate(job.deadline) },
  ].filter(Boolean)

  return (
    <>
      <Button to="/" variant="ghost" size="sm" icon={ArrowLeft} className="back-link">
        Ofertas
      </Button>

      <div className="detail">
        <GlassPanel as="article" strong className="detail-main">
          <div className="detail-company">
            <CompanyMark name={job.company_name} logoUrl={job.company_logo_url} size="lg" />
            <span className="detail-company-name">
              {job.company_name || 'Empresa sin nombre'}
              {job.company_verification_status === 'VERIFIED' && (
                <Badge tone="teal" icon={BadgeCheck}>Empresa verificada</Badge>
              )}
            </span>
          </div>

          <h1 className="detail-title">{job.title}</h1>

          <div className="badges">
            <VerificationBadge status={job.verification_status} />
            {job.category_name && <Badge>{job.category_name}</Badge>}
          </div>

          <section className="prose-section">
            <h2 className="section-title">Descripción</h2>
            <p className="prose">{job.description}</p>
          </section>

          {job.skills?.length > 0 && (
            <section className="prose-section">
              <h2 className="section-title">Tecnologías que piden</h2>
              <ul className="skills">
                {job.skills.map((s) => <li key={s} className="skill">{s}</li>)}
              </ul>
            </section>
          )}
        </GlassPanel>

        <GlassPanel as="aside" className="detail-aside" aria-label="Condiciones y acciones">
          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="fact">
                  <Icon aria-hidden="true" />
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="aside-actions">
            {job.apply_url && (
              <Button href={job.apply_url} target="_blank" rel="noreferrer" icon={ExternalLink} size="lg" block>
                Postularme
              </Button>
            )}
            {user && (
              <Button
                variant="secondary"
                icon={saved ? BookmarkCheck : Bookmark}
                onClick={handleSave}
                loading={saving}
                aria-pressed={saved}
                block
              >
                {saved ? 'Guardada' : 'Guardar'}
              </Button>
            )}
            {job.contact_email && (
              <Button href={`mailto:${job.contact_email}`} variant={job.apply_url ? 'ghost' : 'secondary'} icon={Mail} block>
                Escribir a la empresa
              </Button>
            )}
          </div>

          {!user && (
            <p className="aside-note">
              <Link to="/login">Inicia sesión</Link> para guardar esta oferta y encontrarla luego en tu perfil.
            </p>
          )}

          {user && job.status === 'ACTIVE' && (
            <button type="button" className="link-button report-link" onClick={() => setReporting(true)}>
              <Flag aria-hidden="true" />
              Reportar un problema con esta oferta
            </button>
          )}
        </GlassPanel>
      </div>

      <ReasonDialog
        open={reporting}
        onClose={() => setReporting(false)}
        title="Reportar esta oferta"
        description="El equipo la revisará. No se lo decimos a la empresa."
        reasonLabel="Qué has visto"
        reasonHint="Cuantos más detalles, más rápido se resuelve."
        reasonRequired={false}
        placeholder="Me pidieron pagar para hacer la entrevista…"
        confirmLabel="Enviar reporte"
        onConfirm={async (description) => {
          await reportJob(job.id, { reason: reportReason, description })
          toast.success('Reporte enviado. Gracias por avisar.')
        }}
      >
        <Select
          label="Problema"
          options={toOptions(REPORT_REASON_LABEL)}
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          required
        />
      </ReasonDialog>
    </>
  )
}
