// MODERACIÓN: bandeja única de lo que espera una decisión del equipo
// (BO-050..064). Tres pestañas, cada una visible solo con su permiso:
//   Ofertas en revisión   → jobs.publish
//   Reportes abiertos     → reports.view (resolver: reports.resolve)
//   Empresas por verificar → companies.verify
//
// Cada decisión pasa por una función de la base de datos que valida,
// exige motivo cuando toca y lo deja en la auditoría.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, CircleCheck, ExternalLink, Flag, Inbox, Pencil, X } from 'lucide-react'
import {
  Alert, Badge, Button, CompanyMark, EmptyState, GlassPanel, Loader, ReasonDialog, Select, Tabs,
  VerificationBadge, useToast,
} from '../../components/ui/index.js'
import {
  fetchModerationCounts, fetchOpenReports, fetchPendingCompanies, fetchPendingJobs, moderateJob,
  resolveReport, reviewCompany,
} from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import {
  COMPANY_VERIFICATION_LABEL, LEVEL_LABEL, MODE_LABEL, REPORT_REASON_LABEL, STATUS_LABEL,
  relativeTime,
} from '../../lib/labels.js'
import { COMPANY_VERIFICATION_TONE } from './AdminCompanies.jsx'

// Avisa al menú lateral para que actualice el contador de pendientes.
export const MODERATION_CHANGED = 'iafam:moderation-changed'
const notifyChanged = () => window.dispatchEvent(new Event(MODERATION_CHANGED))

const JOB_ACTIONS = [
  { value: 'NONE', label: 'No cambiar la oferta' },
  { value: 'MARK_REPORTED', label: 'Marcarla como reportada' },
  { value: 'CLOSE_JOB', label: 'Cerrarla (deja de ser visible)' },
]

export default function Moderation() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [counts, setCounts] = useState({})

  const tabs = useMemo(() => [
    can('jobs.publish') && { value: 'jobs', label: 'Ofertas en revisión', count: counts.jobs },
    can('reports.view') && { value: 'reports', label: 'Reportes', count: counts.reports },
    can('companies.verify') && { value: 'companies', label: 'Empresas por verificar', count: counts.companies },
  ].filter(Boolean), [can, counts])

  const active = tabs.find((t) => t.value === params.get('tab'))?.value || tabs[0]?.value

  const loadCounts = useCallback(() => {
    fetchModerationCounts().then(setCounts).catch(() => {})
  }, [])

  useEffect(() => {
    loadCounts()
    window.addEventListener(MODERATION_CHANGED, loadCounts)
    return () => window.removeEventListener(MODERATION_CHANGED, loadCounts)
  }, [loadCounts])

  if (!tabs.length) {
    return (
      <GlassPanel style={{ marginTop: 8 }}>
        <EmptyState icon={Inbox} title="No tienes nada que moderar">
          Tu rol no incluye permisos de moderación.
        </EmptyState>
      </GlassPanel>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Moderación</h1>
          <p className="page-subtitle">Lo más antiguo aparece primero.</p>
        </div>
      </div>

      <Tabs
        label="Bandejas de moderación"
        tabs={tabs}
        value={active}
        onChange={(tab) => setParams({ tab }, { replace: true })}
      />

      <GlassPanel flush className="queue">
        {active === 'jobs' && <JobQueue />}
        {active === 'reports' && <ReportQueue canResolve={can('reports.resolve')} />}
        {active === 'companies' && <CompanyQueue />}
      </GlassPanel>
    </>
  )
}

// Carga una lista y permite quitar un elemento cuando se decide sobre él.
function useQueue(loader) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loader().then(setItems).catch((e) => setError(e.message))
  }, [loader])

  const remove = (id) => {
    setItems((list) => list.filter((i) => i.id !== id))
    notifyChanged()
  }
  return { items, error, remove }
}

// ---------- Ofertas ----------

function JobQueue() {
  const toast = useToast()
  const { items, error, remove } = useQueue(fetchPendingJobs)
  const [dialog, setDialog] = useState(null) // { job, decision }
  const [expanded, setExpanded] = useState(null)

  if (error) return <div className="queue-pad"><Alert>{error}</Alert></div>
  if (!items) return <Loader label="Cargando ofertas en revisión…" />
  if (!items.length) {
    return (
      <EmptyState icon={CircleCheck} title="No hay ofertas esperando revisión">
        Cuando alguien envíe una oferta a revisión aparecerá aquí.
      </EmptyState>
    )
  }

  const approving = dialog?.decision === 'APPROVE'

  return (
    <>
      <ul className="queue-list">
        {items.map((job) => (
          <li key={job.id} className="queue-item">
            <CompanyMark name={job.company_name} logoUrl={job.company_logo_url} />
            <div className="queue-body">
              <div className="queue-title-row">
                <h3 className="queue-title">{job.title}</h3>
                <span className="queue-when">Enviada {relativeTime(job.created_at).toLowerCase()}</span>
              </div>
              <p className="queue-sub">{job.company_name || 'Sin empresa'}</p>
              <div className="badges">
                <VerificationBadge status={job.verification_status} />
                {job.company_verification_status && job.company_verification_status !== 'VERIFIED' && (
                  <Badge tone={COMPANY_VERIFICATION_TONE[job.company_verification_status]}>
                    Empresa: {COMPANY_VERIFICATION_LABEL[job.company_verification_status].toLowerCase()}
                  </Badge>
                )}
                {job.category_name && <Badge>{job.category_name}</Badge>}
                {job.experience_level && <Badge>{LEVEL_LABEL[job.experience_level]}</Badge>}
                {job.work_mode && <Badge>{MODE_LABEL[job.work_mode]}</Badge>}
              </div>
              <p className={`queue-text ${expanded === job.id ? 'is-expanded' : ''}`}>{job.description}</p>
              {job.description?.length > 220 && (
                <button type="button" className="link-button" onClick={() => setExpanded(expanded === job.id ? null : job.id)}>
                  {expanded === job.id ? 'Ver menos' : 'Leer la descripción completa'}
                </button>
              )}
              <div className="queue-actions">
                <Button size="sm" icon={CircleCheck} onClick={() => setDialog({ job, decision: 'APPROVE' })}>
                  Publicar
                </Button>
                <Button size="sm" variant="ghost" icon={X} className="btn-danger-quiet" onClick={() => setDialog({ job, decision: 'REJECT' })}>
                  Rechazar
                </Button>
                <Button size="sm" variant="ghost" icon={Pencil} to={`/admin/jobs/${job.id}/edit`}>
                  Editar antes
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ReasonDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={approving ? '¿Publicar esta oferta?' : '¿Rechazar esta oferta?'}
        description={dialog && `“${dialog.job.title}”${approving ? ' será visible para todo el mundo.' : ' no se publicará.'}`}
        reasonLabel={approving ? 'Nota' : 'Motivo del rechazo'}
        reasonRequired={!approving}
        placeholder={approving ? 'Opcional' : 'Faltan requisitos, empresa no identificada…'}
        confirmLabel={approving ? 'Publicar oferta' : 'Rechazar oferta'}
        tone={approving ? 'primary' : 'danger'}
        onConfirm={async (reason) => {
          await moderateJob(dialog.job.id, dialog.decision, reason)
          remove(dialog.job.id)
          toast.success(approving ? 'Oferta publicada' : 'Oferta rechazada')
        }}
      />
    </>
  )
}

// ---------- Reportes ----------

function ReportQueue({ canResolve }) {
  const toast = useToast()
  const { items, error, remove } = useQueue(fetchOpenReports)
  const [dialog, setDialog] = useState(null) // { report, outcome }
  const [jobAction, setJobAction] = useState('NONE')

  if (error) return <div className="queue-pad"><Alert>{error}</Alert></div>
  if (!items) return <Loader label="Cargando reportes…" />
  if (!items.length) {
    return (
      <EmptyState icon={Flag} title="No hay reportes abiertos">
        Los reportes que envíen los usuarios sobre ofertas publicadas aparecerán aquí.
      </EmptyState>
    )
  }

  const resolving = dialog?.outcome === 'RESOLVED'

  return (
    <>
      <ul className="queue-list">
        {items.map((report) => (
          <li key={report.id} className="queue-item">
            <span className="queue-icon tone-coral" aria-hidden="true"><Flag /></span>
            <div className="queue-body">
              <div className="queue-title-row">
                <h3 className="queue-title">{REPORT_REASON_LABEL[report.reason]}</h3>
                <span className="queue-when">{relativeTime(report.created_at)}</span>
              </div>
              <p className="queue-sub">
                Sobre <Link to={`/jobs/${report.job?.id}`}>{report.job?.title || 'oferta eliminada'}</Link>
                {report.job?.company?.name && ` de ${report.job.company.name}`}
              </p>
              <div className="badges">
                {report.job && <Badge>{STATUS_LABEL[report.job.status]}</Badge>}
                {report.job && <VerificationBadge status={report.job.verification_status} />}
              </div>
              {report.description
                ? <blockquote className="history-reason">{report.description}</blockquote>
                : <p className="muted-text">Sin comentario.</p>}
              <p className="queue-meta">
                Reportado por {report.reporter?.name || report.reporter?.email || 'un usuario eliminado'}
              </p>
              {canResolve && (
                <div className="queue-actions">
                  <Button size="sm" icon={CircleCheck} onClick={() => { setJobAction('NONE'); setDialog({ report, outcome: 'RESOLVED' }) }}>
                    Dar por válido
                  </Button>
                  <Button size="sm" variant="ghost" icon={X} onClick={() => setDialog({ report, outcome: 'DISMISSED' })}>
                    Descartar
                  </Button>
                  {report.job && (
                    <Button size="sm" variant="ghost" icon={ExternalLink} to={`/jobs/${report.job.id}`}>
                      Ver oferta
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ReasonDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={resolving ? 'Dar el reporte por válido' : 'Descartar el reporte'}
        description={resolving
          ? 'El reporte tenía razón. Decide qué pasa con la oferta.'
          : 'La oferta es correcta y no cambia.'}
        reasonLabel="Resolución"
        placeholder={resolving ? 'Confirmado con la empresa: la vacante ya está cubierta.' : 'Revisada: la oferta es legítima.'}
        confirmLabel={resolving ? 'Resolver reporte' : 'Descartar reporte'}
        tone={resolving ? 'primary' : 'secondary'}
        onConfirm={async (note) => {
          await resolveReport(dialog.report.id, {
            outcome: dialog.outcome,
            note,
            jobAction: resolving ? jobAction : 'NONE',
          })
          remove(dialog.report.id)
          toast.success(resolving ? 'Reporte resuelto' : 'Reporte descartado')
        }}
      >
        {resolving && (
          <Select
            label="Qué hacer con la oferta"
            options={JOB_ACTIONS}
            value={jobAction}
            onChange={(e) => setJobAction(e.target.value)}
          />
        )}
      </ReasonDialog>
    </>
  )
}

// ---------- Empresas ----------

function CompanyQueue() {
  const toast = useToast()
  const { items, error, remove } = useQueue(fetchPendingCompanies)
  const [dialog, setDialog] = useState(null) // { company, decision }

  if (error) return <div className="queue-pad"><Alert>{error}</Alert></div>
  if (!items) return <Loader label="Cargando empresas…" />
  if (!items.length) {
    return (
      <EmptyState icon={Building2} title="No hay empresas por verificar">
        Cuando una empresa pida la verificación aparecerá aquí.
      </EmptyState>
    )
  }

  const verifying = dialog?.decision === 'VERIFY'

  return (
    <>
      <ul className="queue-list">
        {items.map((company) => (
          <li key={company.id} className="queue-item">
            <CompanyMark name={company.name} logoUrl={company.logo_url} />
            <div className="queue-body">
              <div className="queue-title-row">
                <h3 className="queue-title">{company.name}</h3>
                <span className="queue-when">{relativeTime(company.created_at)}</span>
              </div>
              {company.website && (
                <p className="queue-sub">
                  <a href={company.website} target="_blank" rel="noreferrer">
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              )}
              {company.description && <p className="queue-text">{company.description}</p>}
              <div className="queue-actions">
                <Button size="sm" icon={CircleCheck} onClick={() => setDialog({ company, decision: 'VERIFY' })}>
                  Verificar
                </Button>
                <Button size="sm" variant="ghost" icon={X} className="btn-danger-quiet" onClick={() => setDialog({ company, decision: 'REJECT' })}>
                  Rechazar
                </Button>
                <Button size="sm" variant="ghost" icon={ExternalLink} to={`/admin/companies/${company.id}`}>
                  Abrir ficha
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ReasonDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={verifying ? '¿Verificar esta empresa?' : '¿Rechazar la verificación?'}
        description={dialog && (verifying
          ? `${dialog.company.name} mostrará el sello de empresa verificada.`
          : `${dialog.company.name} quedará como no verificada.`)}
        reasonLabel={verifying ? 'Cómo se comprobó' : 'Motivo del rechazo'}
        reasonRequired={!verifying}
        placeholder={verifying ? 'Opcional: web oficial, registro mercantil, llamada…' : 'No se pudo confirmar que exista…'}
        confirmLabel={verifying ? 'Verificar empresa' : 'Rechazar'}
        tone={verifying ? 'primary' : 'danger'}
        onConfirm={async (reason) => {
          await reviewCompany(dialog.company.id, dialog.decision, reason)
          remove(dialog.company.id)
          toast.success(verifying ? 'Empresa verificada' : 'Verificación rechazada')
        }}
      />
    </>
  )
}
