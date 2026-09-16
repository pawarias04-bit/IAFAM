// FICHA DE EMPRESA (BO-052..054): datos editables, verificación, activar o
// desactivar, sus ofertas, notas internas e historial.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, Power, RotateCcw, Trash2, UserPlus, Users, X } from 'lucide-react'
import Notes from '../../components/backoffice/Notes.jsx'
import { EntityHistory } from '../../components/backoffice/History.jsx'
import {
  Alert, Badge, Button, CompanyMark, ConfirmDialog, EmptyState, GlassPanel, Input, Loader,
  ReasonDialog, Select, Textarea, VerificationBadge, useToast,
} from '../../components/ui/index.js'
import {
  deleteCompany, fetchCompany, fetchCompanyJobs, reviewCompany, updateCompany,
} from '../../backofficeApi.js'
import {
  addCompanyMember, fetchCompanyMembers, removeCompanyMember,
} from '../../companyApi.js'
import { useAuth } from '../../auth.jsx'
import { COMPANY_VERIFICATION_LABEL, STATUS_LABEL, formatDateTime, relativeTime } from '../../lib/labels.js'
import { COMPANY_VERIFICATION_TONE } from './AdminCompanies.jsx'

const EDITABLE = ['name', 'website', 'logo_url', 'description']

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState({})
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null) // VERIFY | REJECT | RESET | toggle | delete
  const [historyKey, setHistoryKey] = useState(0)

  const canEdit = can('companies.edit')
  const canVerify = can('companies.verify')

  const load = useCallback(() => {
    return Promise.all([fetchCompany(id), fetchCompanyJobs(id)])
      .then(([c, j]) => {
        setCompany(c)
        setForm(Object.fromEntries(EDITABLE.map((k) => [k, c[k] ?? ''])))
        setJobs(j)
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => { load() }, [load])

  async function refresh(message) {
    toast.success(message)
    await load()
    setHistoryKey((k) => k + 1)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateCompany(company.id, form)
      await refresh('Cambios guardados')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !company) return <Alert>{error}</Alert>
  if (!company) return <Loader label="Cargando empresa…" />

  const dirty = EDITABLE.some((k) => (company[k] ?? '') !== form[k])
  const decisionCopy = {
    VERIFY: {
      title: '¿Verificar esta empresa?', label: 'Cómo se comprobó', required: false,
      placeholder: 'Opcional: web oficial, registro mercantil…', confirm: 'Verificar', tone: 'primary',
      done: 'Empresa verificada',
    },
    REJECT: {
      title: '¿Rechazar la verificación?', label: 'Motivo del rechazo', required: true,
      placeholder: 'No se pudo confirmar que exista…', confirm: 'Rechazar', tone: 'danger',
      done: 'Verificación rechazada',
    },
    RESET: {
      title: 'Quitar la verificación', label: 'Motivo', required: true,
      placeholder: 'Ha cambiado de dueño y hay que revisarla de nuevo…', confirm: 'Quitar verificación',
      tone: 'danger', done: 'La empresa vuelve a estar sin verificar',
    },
  }[dialog]

  return (
    <>
      <Button to="/admin/companies" variant="ghost" size="sm" icon={ArrowLeft} className="back-link">
        Empresas
      </Button>

      <GlassPanel className="profile-head">
        <CompanyMark name={company.name} logoUrl={company.logo_url} size="lg" />
        <div>
          <h1 className="page-title">{company.name}</h1>
          <p className="page-subtitle">
            Añadida {relativeTime(company.created_at).toLowerCase()}
          </p>
        </div>
        <div className="badges">
          <Badge tone={COMPANY_VERIFICATION_TONE[company.verification_status]}>
            {COMPANY_VERIFICATION_LABEL[company.verification_status]}
          </Badge>
          {!company.is_active && <Badge tone="coral">Desactivada</Badge>}
        </div>
      </GlassPanel>

      <div className="detail-columns">
        <div className="stack">
          <GlassPanel as="form" strong onSubmit={save} aria-labelledby="data-title">
            <h2 id="data-title" className="section-title">Datos</h2>
            <div className="form-stack" style={{ marginTop: 16 }}>
              <Alert>{error}</Alert>
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!canEdit} />
              <div className="form-grid">
                <Input label="Sitio web" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} disabled={!canEdit} />
                <Input label="URL del logo" type="url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={!canEdit} />
              </div>
              <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEdit} style={{ minHeight: 96 }} />
              {canEdit && (
                <div>
                  <Button type="submit" loading={saving} disabled={!dirty}>Guardar cambios</Button>
                </div>
              )}
            </div>
          </GlassPanel>

          {(canVerify || canEdit) && (
            <GlassPanel as="section" aria-labelledby="control-title">
              <h2 id="control-title" className="section-title">Control</h2>

              {canVerify && (
                <div className="control-row">
                  <p className="control-text">
                    {company.verified_at
                      ? `Última decisión de verificación: ${formatDateTime(company.verified_at)}.`
                      : 'Verificar muestra el sello de empresa verificada en sus ofertas.'}
                  </p>
                  <div className="row-actions">
                    {company.verification_status !== 'VERIFIED' && (
                      <Button size="sm" icon={CircleCheck} onClick={() => setDialog('VERIFY')}>Verificar</Button>
                    )}
                    {!['REJECTED', 'VERIFIED'].includes(company.verification_status) && (
                      <Button size="sm" variant="ghost" icon={X} className="btn-danger-quiet" onClick={() => setDialog('REJECT')}>Rechazar</Button>
                    )}
                    {['VERIFIED', 'REJECTED'].includes(company.verification_status) && (
                      <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setDialog('RESET')}>Quitar decisión</Button>
                    )}
                  </div>
                </div>
              )}

              {canEdit && (
                <div className="control-row">
                  <p className="control-text">
                    {company.is_active
                      ? 'Desactivarla la oculta del listado público y del formulario de ofertas.'
                      : 'Está desactivada: no aparece en el listado público.'}
                  </p>
                  <Button size="sm" variant={company.is_active ? 'secondary' : 'primary'} icon={Power} onClick={() => setDialog('toggle')}>
                    {company.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              )}

              {can('companies.delete') && (
                <div className="control-row">
                  <p className="control-text">
                    {jobs.length
                      ? `No se puede borrar: tiene ${jobs.length} ${jobs.length === 1 ? 'oferta' : 'ofertas'}. Desactívala.`
                      : 'No tiene ofertas, así que se puede borrar.'}
                  </p>
                  <Button size="sm" variant="ghost" icon={Trash2} className="btn-danger-quiet" disabled={jobs.length > 0} onClick={() => setDialog('delete')}>
                    Borrar
                  </Button>
                </div>
              )}
            </GlassPanel>
          )}

          <GlassPanel flush as="section" aria-labelledby="jobs-title">
            <div className="list-head">
              <div>
                <h2 id="jobs-title" className="section-title">Ofertas</h2>
                <p className="list-count">{jobs.length === 1 ? '1 oferta' : `${jobs.length} ofertas`}</p>
              </div>
            </div>
            {jobs.length === 0 ? (
              <p className="muted-text queue-pad">Esta empresa todavía no tiene ofertas.</p>
            ) : (
              <ul className="simple-list">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link to={`/admin/jobs/${j.id}/edit`} className="cell-title">{j.title}</Link>
                    <span className="badges">
                      <Badge>{STATUS_LABEL[j.status]}</Badge>
                      <VerificationBadge status={j.verification_status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>

        <div className="stack">
          <CompanyTeamPanel companyId={company.id} canEdit={canEdit} />

          <GlassPanel as="section" aria-labelledby="notes-title">
            <h2 id="notes-title" className="section-title">Notas internas</h2>
            <Notes entity="companies" entityId={company.id} />
          </GlassPanel>
          <GlassPanel as="section" aria-labelledby="history-title">
            <h2 id="history-title" className="section-title">Historial</h2>
            <EntityHistory entity="companies" entityId={company.id} refreshKey={historyKey} />
          </GlassPanel>
        </div>
      </div>

      {decisionCopy && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          title={decisionCopy.title}
          reasonLabel={decisionCopy.label}
          reasonRequired={decisionCopy.required}
          placeholder={decisionCopy.placeholder}
          confirmLabel={decisionCopy.confirm}
          tone={decisionCopy.tone}
          onConfirm={async (reason) => {
            await reviewCompany(company.id, dialog, reason)
            await refresh(decisionCopy.done)
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === 'toggle'}
        onClose={() => setDialog(null)}
        title={company.is_active ? '¿Desactivar esta empresa?' : '¿Activar esta empresa?'}
        description={company.is_active
          ? 'Sus ofertas publicadas seguirán existiendo, pero la empresa no aparecerá en el listado público.'
          : 'Volverá a aparecer en el listado público y en el formulario de ofertas.'}
        confirmLabel={company.is_active ? 'Desactivar' : 'Activar'}
        tone={company.is_active ? 'danger' : 'primary'}
        onConfirm={async () => {
          await updateCompany(company.id, { is_active: !company.is_active })
          await refresh(company.is_active ? 'Empresa desactivada' : 'Empresa activada')
        }}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="¿Borrar esta empresa?"
        description={`${company.name} desaparecerá. La auditoría conservará el registro.`}
        confirmLabel="Borrar empresa"
        onConfirm={async () => {
          await deleteCompany(company.id)
          toast.success('Empresa borrada')
          navigate('/admin/companies')
        }}
      />
    </>
  )
}

// Quién puede publicar en nombre de esta empresa (Etapa C). El equipo de
// IAFAM puede añadir o quitar personas con companies.edit; las reglas
// (dejar siempre una administradora) las aplica la base de datos.
function CompanyTeamPanel({ companyId, canEdit }) {
  const toast = useToast()
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    return fetchCompanyMembers(companyId)
      .then((rows) => { setMembers(rows); setError('') })
      .catch((e) => setError(e.message))
  }, [companyId])

  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      await addCompanyMember(companyId, email.trim(), role)
      setEmail('')
      await load()
      toast.success('Persona añadida al equipo de la empresa')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function remove(member) {
    try {
      await removeCompanyMember(companyId, member.user_id)
      await load()
      toast.success('Persona quitada del equipo')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <GlassPanel as="section" aria-labelledby="team-title">
      <h2 id="team-title" className="section-title">Equipo de la empresa</h2>
      <Alert>{error}</Alert>

      {!members && !error && <Loader inline label="Cargando equipo…" />}
      {members?.length === 0 && (
        <EmptyState icon={Users} title="Nadie gestiona esta empresa">
          La creó el equipo de IAFAM. Añade a alguien para que pueda publicar sus ofertas.
        </EmptyState>
      )}
      {members?.length > 0 && (
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.user_id}>
              <CompanyMark name={m.name || m.email} size="sm" />
              <div className="member-text">
                <Link to={`/admin/users/${m.user_id}`} className="cell-title">{m.name || 'Sin nombre'}</Link>
                <p className="cell-sub">{m.email}</p>
              </div>
              <Badge tone={m.role === 'OWNER' ? 'cobalt' : 'neutral'}>
                {m.role === 'OWNER' ? 'Administra' : 'Publica'}
              </Badge>
              {canEdit && (
                <Button
                  variant="ghost" size="sm" icon={X} className="btn-danger-quiet"
                  aria-label={`Quitar a ${m.name || m.email}`}
                  onClick={() => remove(m)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form className="form-stack" style={{ marginTop: 16 }} onSubmit={add}>
          <div className="form-grid">
            <Input
              label="Añadir por email"
              type="email"
              hint="Tiene que estar registrada en IAFAM Jobs."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
            <Button type="submit" variant="secondary" size="sm" icon={UserPlus} loading={adding}>
              Añadir
            </Button>
          </div>
        </form>
      )}
    </GlassPanel>
  )
}
