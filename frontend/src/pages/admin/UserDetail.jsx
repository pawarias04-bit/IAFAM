// FICHA DE USUARIO (BO-080..083): datos, acceso, actividad, rol, suspensión,
// notas internas e historial.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Ban, RotateCcw, ScrollText, ShieldCheck } from 'lucide-react'
import Notes from '../../components/backoffice/Notes.jsx'
import { EntityHistory } from '../../components/backoffice/History.jsx'
import {
  Alert, Badge, Button, CompanyMark, GlassPanel, Loader, ReasonDialog, Select, useToast,
} from '../../components/ui/index.js'
import { fetchUserDetail, setUserActive, setUserRole } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import {
  LEVEL_LABEL, MODE_LABEL, ROLE_LABEL, formatDateTime, relativeTime, toOptions,
} from '../../lib/labels.js'

export default function UserDetail() {
  const { id } = useParams()
  const { user: me, can } = useAuth()
  const toast = useToast()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // 'role' | 'suspend' | 'reactivate'
  const [nextRole, setNextRole] = useState('')
  const [historyKey, setHistoryKey] = useState(0)

  const load = useCallback(() => {
    return fetchUserDetail(id)
      .then((d) => { setDetail(d); setNextRole(d.profile.role); setError('') })
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => { load() }, [load])

  async function afterChange(message) {
    toast.success(message)
    await load()
    setHistoryKey((k) => k + 1)
  }

  if (error && !detail) return <Alert>{error}</Alert>
  if (!detail) return <Loader label="Cargando usuario…" />

  const { profile, access, activity } = detail
  const isMe = profile.id === me?.id
  const bannedInAuth = access.banned_until && new Date(access.banned_until) > new Date()
  // Las reglas finas (solo un admin toca a otro admin, nadie se suspende a
  // sí mismo) las aplica la base de datos; aquí solo se evita ofrecerlas.
  const touchesAdmin = profile.role === 'ADMIN' && me?.role !== 'ADMIN'
  const canChangeRole = can('users.change_role') && !isMe && !touchesAdmin
  const canSuspend = can('users.suspend') && !isMe && !touchesAdmin
  const roleOptions = toOptions(ROLE_LABEL).filter((o) => o.value !== 'ADMIN' || me?.role === 'ADMIN')

  return (
    <>
      <Button to="/admin/users" variant="ghost" size="sm" icon={ArrowLeft} className="back-link">
        Usuarios
      </Button>

      <GlassPanel className="profile-head">
        <CompanyMark name={profile.name || profile.email} size="lg" />
        <div>
          <h1 className="page-title">{profile.name || 'Sin nombre'}</h1>
          <p className="page-subtitle">{profile.email}</p>
        </div>
        <div className="badges">
          {profile.role !== 'USER' && <Badge tone="cobalt">{ROLE_LABEL[profile.role]}</Badge>}
          {profile.is_active ? <Badge tone="teal">Activo</Badge> : <Badge tone="coral">Suspendido</Badge>}
        </div>
      </GlassPanel>

      {!profile.is_active && !bannedInAuth && (
        <Alert>
          El perfil está suspendido pero la cuenta de acceso no está bloqueada. Reactiva y vuelve a
          suspender para sincronizarlas.
        </Alert>
      )}

      <div className="detail-columns">
        <div className="stack">
          <GlassPanel as="section" aria-labelledby="access-title">
            <h2 id="access-title" className="section-title">Acceso y actividad</h2>
            <dl className="kv-grid">
              <div><dt>Alta</dt><dd title={formatDateTime(access.created_at)}>{relativeTime(access.created_at)}</dd></div>
              <div><dt>Último acceso</dt><dd>{access.last_sign_in_at ? relativeTime(access.last_sign_in_at) : 'Nunca'}</dd></div>
              <div><dt>Email confirmado</dt><dd>{access.email_confirmed_at ? 'Sí' : 'No'}</dd></div>
              <div><dt>Ofertas guardadas</dt><dd className="num">{activity.favorites}</dd></div>
              <div><dt>Postulaciones</dt><dd className="num">{activity.applications}</dd></div>
              <div><dt>Reportes enviados</dt><dd className="num">{activity.reports_sent}</dd></div>
            </dl>
          </GlassPanel>

          <GlassPanel as="section" aria-labelledby="profile-title">
            <h2 id="profile-title" className="section-title">Perfil</h2>
            <dl className="kv-grid">
              <div><dt>Carrera</dt><dd>{profile.career || '—'}</dd></div>
              <div><dt>Universidad</dt><dd>{profile.university || '—'}</dd></div>
              <div><dt>Graduación</dt><dd>{profile.graduation_year || '—'}</dd></div>
              <div><dt>Nivel</dt><dd>{LEVEL_LABEL[profile.experience_level] || '—'}</dd></div>
              <div><dt>Modalidad preferida</dt><dd>{MODE_LABEL[profile.preferred_mode] || '—'}</dd></div>
            </dl>
          </GlassPanel>

          {(can('users.change_role') || can('users.suspend')) && (
            <GlassPanel as="section" aria-labelledby="control-title">
              <h2 id="control-title" className="section-title">Control de la cuenta</h2>
              {isMe && <p className="muted-text">Es tu propia cuenta: los cambios de rol y acceso los hace otro administrador.</p>}
              {touchesAdmin && <p className="muted-text">Solo un administrador puede cambiar a otro administrador.</p>}

              {can('users.change_role') && (
                <div className="control-row">
                  <Select
                    label="Rol"
                    options={roleOptions}
                    value={nextRole}
                    onChange={(e) => setNextRole(e.target.value)}
                    disabled={!canChangeRole}
                  />
                  <Button
                    variant="secondary"
                    icon={ShieldCheck}
                    disabled={!canChangeRole || nextRole === profile.role}
                    onClick={() => setDialog('role')}
                  >
                    Cambiar rol
                  </Button>
                </div>
              )}

              {can('users.suspend') && (
                <div className="control-row">
                  <p className="control-text">
                    {profile.is_active
                      ? 'Suspender bloquea el inicio de sesión y retira todos sus permisos.'
                      : 'La cuenta está suspendida y no puede iniciar sesión.'}
                  </p>
                  {profile.is_active ? (
                    <Button variant="danger" icon={Ban} disabled={!canSuspend} onClick={() => setDialog('suspend')}>
                      Suspender
                    </Button>
                  ) : (
                    <Button variant="secondary" icon={RotateCcw} disabled={!canSuspend} onClick={() => setDialog('reactivate')}>
                      Reactivar
                    </Button>
                  )}
                </div>
              )}
            </GlassPanel>
          )}
        </div>

        <div className="stack">
          <GlassPanel as="section" aria-labelledby="notes-title">
            <h2 id="notes-title" className="section-title">Notas internas</h2>
            <Notes entity="profiles" entityId={profile.id} />
          </GlassPanel>

          <GlassPanel as="section" aria-labelledby="history-title">
            <div className="panel-head">
              <h2 id="history-title" className="section-title">Historial de su cuenta</h2>
              {can('audit.view') && (
                <Button to={`/admin/audit?actor=${profile.id}`} variant="ghost" size="sm" icon={ScrollText}>
                  Lo que ha hecho
                </Button>
              )}
            </div>
            <EntityHistory entity="profiles" entityId={profile.id} refreshKey={historyKey} />
          </GlassPanel>
        </div>
      </div>

      <ReasonDialog
        open={dialog === 'role'}
        onClose={() => { setDialog(null); setNextRole(profile.role) }}
        title="Cambiar el rol"
        description={`${profile.name || profile.email} pasará de ${ROLE_LABEL[profile.role]} a ${ROLE_LABEL[nextRole]}.`}
        placeholder="Se incorpora al equipo de moderación…"
        confirmLabel="Cambiar rol"
        onConfirm={async (reason) => {
          await setUserRole(profile.id, nextRole, reason)
          await afterChange('Rol actualizado')
        }}
      />

      <ReasonDialog
        open={dialog === 'suspend'}
        onClose={() => setDialog(null)}
        title="¿Suspender esta cuenta?"
        description="No podrá iniciar sesión y perderá sus permisos. Puedes reactivarla después."
        placeholder="Publicó ofertas falsas de forma repetida…"
        confirmLabel="Suspender cuenta"
        tone="danger"
        onConfirm={async (reason) => {
          await setUserActive(profile.id, false, reason)
          await afterChange('Cuenta suspendida')
        }}
      />

      <ReasonDialog
        open={dialog === 'reactivate'}
        onClose={() => setDialog(null)}
        title="Reactivar esta cuenta"
        description="Podrá volver a iniciar sesión con los permisos de su rol."
        reasonLabel="Nota"
        reasonRequired={false}
        placeholder="Opcional"
        confirmLabel="Reactivar cuenta"
        onConfirm={async (reason) => {
          await setUserActive(profile.id, true, reason)
          await afterChange('Cuenta reactivada')
        }}
      />
    </>
  )
}
