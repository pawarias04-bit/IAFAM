// PORTAL DE EMPRESAS, panel de una empresa (/empresa/:companyId).
//
// Tres pestañas: sus ofertas, los datos de la empresa y su equipo. Lo que
// puede hacer cada persona lo decide la base de datos; aquí se muestra el
// estado de cada cosa y el motivo cuando el equipo de IAFAM rechaza algo.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, Building2, Clock, ExternalLink, Pencil, Plus, Send, Trash2, TriangleAlert, Undo2,
  UserPlus, X,
} from 'lucide-react'
import {
  Alert, Badge, Button, CompanyMark, ConfirmDialog, EmptyState, GlassPanel, Input, Loader, Select,
  Tabs, Textarea, useToast,
} from '../../components/ui/index.js'
import {
  addCompanyMember, deleteCompanyJobDraft, fetchCompany, fetchCompanyJobs, fetchCompanyMembers,
  removeCompanyMember, requestVerification, setCompanyJobStatus, setCompanyMemberRole,
  updateMyCompany,
} from '../../companyApi.js'
import { useAuth } from '../../auth.jsx'
import { useSetting } from '../../settings.jsx'
import {
  COMPANY_VERIFICATION_LABEL, STATUS_LABEL, formatDate, relativeTime,
} from '../../lib/labels.js'
import { COMPANY_VERIFICATION_TONE } from '../admin/AdminCompanies.jsx'

const STATUS_TONE = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'amber',
  ACTIVE: 'teal',
  REJECTED: 'coral',
  CLOSED: 'neutral',
  EXPIRED: 'neutral',
}

export default function CompanyHome() {
  const { companyId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'jobs'
  const [company, setCompany] = useState(null)
  const [error, setError] = useState('')

  const loadCompany = useCallback(() => {
    return fetchCompany(companyId)
      .then((c) => { setCompany(c); setError('') })
      .catch((e) => setError(e.message))
  }, [companyId])

  useEffect(() => { loadCompany() }, [loadCompany])

  if (error && !company) return <Alert>{error}</Alert>
  if (!company) return <Loader label="Cargando tu empresa…" />

  const verification = company.verification_status

  return (
    <>
      <GlassPanel className="profile-head">
        <CompanyMark name={company.name} logoUrl={company.logo_url} size="lg" />
        <div>
          <h1 className="page-title">{company.name}</h1>
          <p className="page-subtitle">Tu espacio para publicar ofertas en IAFAM Jobs.</p>
        </div>
        <Badge tone={COMPANY_VERIFICATION_TONE[verification]} icon={verification === 'VERIFIED' ? BadgeCheck : Clock}>
          {COMPANY_VERIFICATION_LABEL[verification]}
        </Badge>
      </GlassPanel>

      {verification === 'PENDING' && (
        <Alert tone="success">
          Estamos revisando tu empresa. Puedes preparar ofertas y enviarlas a revisión mientras tanto.
        </Alert>
      )}
      {verification === 'REJECTED' && (
        <Alert>
          No pudimos verificar tu empresa.
          {company.review_note ? ` Motivo: ${company.review_note}` : ''} Corrige los datos en la
          pestaña Empresa y vuelve a solicitarla.
        </Alert>
      )}

      <Tabs
        label="Secciones de la empresa"
        tabs={[
          { value: 'jobs', label: 'Ofertas' },
          { value: 'company', label: 'Empresa' },
          { value: 'team', label: 'Equipo' },
        ]}
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
      />

      {tab === 'jobs' && <CompanyJobs company={company} />}
      {tab === 'company' && <CompanyData company={company} onSaved={loadCompany} />}
      {tab === 'team' && <CompanyTeam company={company} />}
    </>
  )
}

// ---------- Ofertas ----------

function CompanyJobs({ company }) {
  const toast = useToast()
  const requireReview = useSetting('moderation.company_jobs_require_review', true) !== false
  const canPublishDirectly = !requireReview && company.verification_status === 'VERIFIED'
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(() => {
    return fetchCompanyJobs(company.id)
      .then((rows) => { setJobs(rows); setError('') })
      .catch((e) => setError(e.message))
  }, [company.id])

  useEffect(() => { load() }, [load])

  async function changeStatus(job, status, message) {
    setBusy(job.id)
    try {
      await setCompanyJobStatus(job.id, status)
      await load()
      toast.success(message)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (error) return <Alert>{error}</Alert>
  if (!jobs) return <Loader label="Cargando tus ofertas…" />

  return (
    <>
      <div className="panel-head">
        <p className="muted-text">
          {requireReview
            ? 'Cada oferta la revisa el equipo de IAFAM antes de publicarse.'
            : 'Tus ofertas se publican sin revisión previa.'}
        </p>
        <Button to={`/empresa/${company.id}/ofertas/nueva`} icon={Plus}>Nueva oferta</Button>
      </div>

      <GlassPanel flush>
        {jobs.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Todavía no tienes ofertas"
            action={<Button to={`/empresa/${company.id}/ofertas/nueva`} icon={Plus}>Crear la primera</Button>}
          >
            Puedes guardarla como borrador y enviarla a revisión cuando esté lista.
          </EmptyState>
        )}

        {jobs.length > 0 && (
          <ul className="queue-list">
            {jobs.map((job) => (
              <li key={job.id} className="queue-item company-job">
                <div className="queue-body">
                  <div className="queue-title-row">
                    <h3 className="queue-title">{job.title}</h3>
                    <span className="queue-when">Actualizada {relativeTime(job.updated_at).toLowerCase()}</span>
                  </div>
                  <div className="badges">
                    <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                    {job.status === 'ACTIVE' && job.deadline && (
                      <Badge>Hasta {formatDate(job.deadline)}</Badge>
                    )}
                  </div>

                  {job.status === 'REJECTED' && (
                    <p className="job-note">
                      <TriangleAlert aria-hidden="true" />
                      {job.review_note || 'El equipo no publicó esta oferta.'}
                    </p>
                  )}

                  <div className="queue-actions">
                    <Button size="sm" variant="secondary" icon={Pencil} to={`/empresa/${company.id}/ofertas/${job.id}`}>
                      Editar
                    </Button>

                    {['DRAFT', 'REJECTED'].includes(job.status) && (
                      <Button
                        size="sm"
                        icon={canPublishDirectly ? Send : Send}
                        loading={busy === job.id}
                        onClick={() => changeStatus(
                          job,
                          canPublishDirectly ? 'ACTIVE' : 'PENDING_REVIEW',
                          canPublishDirectly ? 'Oferta publicada' : 'Enviada a revisión',
                        )}
                      >
                        {canPublishDirectly ? 'Publicar' : 'Enviar a revisión'}
                      </Button>
                    )}

                    {job.status === 'PENDING_REVIEW' && (
                      <Button size="sm" variant="ghost" icon={Undo2} loading={busy === job.id}
                        onClick={() => changeStatus(job, 'DRAFT', 'Retirada de revisión')}>
                        Retirar de revisión
                      </Button>
                    )}

                    {job.status === 'ACTIVE' && (
                      <>
                        <Button size="sm" variant="ghost" icon={ExternalLink} to={`/jobs/${job.id}`}>
                          Ver publicada
                        </Button>
                        <Button size="sm" variant="ghost" icon={X} loading={busy === job.id}
                          onClick={() => changeStatus(job, 'CLOSED', 'Oferta cerrada')}>
                          Cerrar
                        </Button>
                      </>
                    )}

                    {['CLOSED', 'EXPIRED'].includes(job.status) && (
                      <Button size="sm" variant="secondary" icon={Send} loading={busy === job.id}
                        onClick={() => changeStatus(
                          job,
                          canPublishDirectly ? 'ACTIVE' : 'PENDING_REVIEW',
                          canPublishDirectly ? 'Oferta publicada de nuevo' : 'Enviada a revisión',
                        )}>
                        Volver a publicar
                      </Button>
                    )}

                    {job.status === 'DRAFT' && (
                      <Button size="sm" variant="ghost" icon={Trash2} className="btn-danger-quiet"
                        onClick={() => setToDelete(job)}>
                        Borrar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="¿Borrar este borrador?"
        description={toDelete && `“${toDelete.title}” se borrará. Solo se pueden borrar borradores.`}
        confirmLabel="Borrar borrador"
        onConfirm={async () => {
          await deleteCompanyJobDraft(toDelete.id)
          await load()
          toast.success('Borrador borrado')
        }}
      />
    </>
  )
}

// ---------- Datos de la empresa ----------

function CompanyData({ company, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: company.name,
    website: company.website ?? '',
    logo_url: company.logo_url ?? '',
    description: company.description ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [asking, setAsking] = useState(false)

  const dirty = useMemo(() => (
    form.name !== company.name ||
    form.website !== (company.website ?? '') ||
    form.logo_url !== (company.logo_url ?? '') ||
    form.description !== (company.description ?? '')
  ), [form, company])

  const renaming = company.verification_status === 'VERIFIED' &&
    (form.name !== company.name || form.website !== (company.website ?? ''))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateMyCompany(company.id, form)
      await onSaved()
      toast.success(renaming ? 'Guardado. Tu empresa vuelve a revisión.' : 'Datos guardados')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function ask() {
    setAsking(true)
    try {
      await requestVerification(company.id)
      await onSaved()
      toast.success('Verificación solicitada')
    } catch (err) {
      setError(err.message)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="stack">
      <GlassPanel as="form" strong onSubmit={save}>
        <h2 className="section-title">Datos de la empresa</h2>
        <div className="form-stack" style={{ marginTop: 16 }}>
          <Alert>{error}</Alert>
          {renaming && (
            <Alert tone="success">
              Al cambiar el nombre o la web de una empresa verificada, la verificación vuelve a
              revisarse.
            </Alert>
          )}
          <Input label="Nombre" value={form.name} required maxLength={120}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="form-grid">
            <Input label="Sitio web" type="url" placeholder="https://" value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <Input label="URL del logo" type="url" placeholder="https://" value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          </div>
          <Textarea label="A qué se dedica" value={form.description} style={{ minHeight: 96 }}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <Button type="submit" loading={saving} disabled={!dirty}>Guardar cambios</Button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel as="section">
        <h2 className="section-title">Verificación</h2>
        <div className="control-row">
          <p className="control-text">
            {company.verification_status === 'VERIFIED'
              ? 'Tu empresa está verificada: tus ofertas muestran el sello.'
              : company.verification_status === 'PENDING'
                ? 'Ya la estamos revisando. Te avisamos en cuanto haya respuesta.'
                : 'Solicítala para que tus ofertas muestren el sello de empresa verificada.'}
          </p>
          {['UNVERIFIED', 'REJECTED'].includes(company.verification_status) && (
            <Button variant="secondary" icon={BadgeCheck} loading={asking} onClick={ask}>
              Solicitar verificación
            </Button>
          )}
        </div>
      </GlassPanel>
    </div>
  )
}

// ---------- Equipo ----------

function CompanyTeam({ company }) {
  const { user } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [adding, setAdding] = useState(false)
  const [toRemove, setToRemove] = useState(null)

  const load = useCallback(() => {
    return fetchCompanyMembers(company.id)
      .then((rows) => { setMembers(rows); setError('') })
      .catch((e) => setError(e.message))
  }, [company.id])

  useEffect(() => { load() }, [load])

  const isOwner = members?.some((m) => m.user_id === user?.id && m.role === 'OWNER')

  async function add(e) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      await addCompanyMember(company.id, email.trim(), role)
      setEmail('')
      await load()
      toast.success('Persona añadida al equipo')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function changeRole(member, nextRole) {
    try {
      await setCompanyMemberRole(company.id, member.user_id, nextRole)
      await load()
      toast.success('Rol actualizado')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (error && !members) return <Alert>{error}</Alert>
  if (!members) return <Loader label="Cargando el equipo…" />

  return (
    <div className="stack">
      <GlassPanel flush as="section" aria-label="Equipo">
        <div className="list-head">
          <div>
            <h2 className="section-title">Quién puede publicar</h2>
            <p className="list-count">
              {members.length === 1 ? '1 persona' : `${members.length} personas`}
            </p>
          </div>
        </div>
        <ul className="simple-list">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="cell-main">
                <CompanyMark name={m.name || m.email} size="sm" />
                <span>
                  <span className="cell-title-plain">{m.name || 'Sin nombre'}</span>
                  <p className="cell-sub">{m.email}</p>
                </span>
              </span>
              <span className="row-actions">
                <Badge tone={m.role === 'OWNER' ? 'cobalt' : 'neutral'}>
                  {m.role === 'OWNER' ? 'Administra' : 'Publica'}
                </Badge>
                {isOwner && m.user_id !== user?.id && (
                  <Button size="sm" variant="ghost"
                    onClick={() => changeRole(m, m.role === 'OWNER' ? 'MEMBER' : 'OWNER')}>
                    {m.role === 'OWNER' ? 'Quitar administración' : 'Hacer administradora'}
                  </Button>
                )}
                {(isOwner || m.user_id === user?.id) && (
                  <Button size="sm" variant="ghost" icon={X} className="btn-danger-quiet"
                    aria-label={`Quitar a ${m.name || m.email}`}
                    onClick={() => setToRemove(m)} />
                )}
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>

      {isOwner && (
        <GlassPanel as="form" strong onSubmit={add}>
          <h2 className="section-title">Añadir a alguien</h2>
          <p className="form-section-text">
            Tiene que estar registrada en IAFAM Jobs con ese email.
          </p>
          <div className="form-stack">
            <Alert>{error}</Alert>
            <div className="form-grid">
              <Input label="Email" type="email" value={email} required
                onChange={(e) => setEmail(e.target.value)} />
              <Select
                label="Qué podrá hacer"
                options={[
                  { value: 'MEMBER', label: 'Publicar y editar ofertas' },
                  { value: 'OWNER', label: 'Además, gestionar el equipo' },
                ]}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <div>
              <Button type="submit" variant="secondary" icon={UserPlus} loading={adding}>
                Añadir al equipo
              </Button>
            </div>
          </div>
        </GlassPanel>
      )}

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        title={toRemove?.user_id === user?.id ? '¿Salir de esta empresa?' : '¿Quitar a esta persona?'}
        description={toRemove?.user_id === user?.id
          ? 'Perderás el acceso a sus ofertas.'
          : `${toRemove?.name || toRemove?.email} dejará de poder publicar ofertas de esta empresa.`}
        confirmLabel={toRemove?.user_id === user?.id ? 'Salir' : 'Quitar'}
        onConfirm={async () => {
          const leaving = toRemove.user_id === user?.id
          await removeCompanyMember(company.id, toRemove.user_id)
          if (leaving) window.location.href = '/'
          else {
            await load()
            toast.success('Persona quitada del equipo')
          }
        }}
      />
    </div>
  )
}
