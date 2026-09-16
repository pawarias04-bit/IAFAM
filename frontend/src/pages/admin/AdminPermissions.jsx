// ROLES Y PERMISOS (BO-010): qué puede hacer cada rol. Solo el
// administrador cambia la matriz, y cada cambio queda en la auditoría.
// El rol Administrador tiene todos los permisos siempre (no es editable),
// para que nadie pueda dejar la plataforma sin control.
//
// El rol Usuario no aparece a propósito: los permisos del backoffice son
// para el equipo, y darle uno a todos los usuarios registrados sería un
// error fácil de cometer con un clic.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Alert, GlassPanel, Loader, Switch, useToast } from '../../components/ui/index.js'
import { fetchPermissionMatrix, setRolePermission } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'

const EDITABLE_ROLES = [
  { value: 'MODERATOR', label: 'Moderador' },
]

export default function AdminPermissions() {
  const { user } = useAuth()
  const toast = useToast()
  const [matrix, setMatrix] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null) // "ROLE:permission"
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    fetchPermissionMatrix().then(setMatrix).catch((e) => setError(e.message))
  }, [])

  const modules = useMemo(() => {
    if (!matrix) return []
    const groups = new Map()
    for (const p of matrix.permissions) {
      if (!groups.has(p.module)) groups.set(p.module, [])
      groups.get(p.module).push(p)
    }
    return [...groups.entries()]
  }, [matrix])

  async function toggle(role, permission, enabled) {
    const key = `${role}:${permission.code}`
    setBusy(key)
    try {
      await setRolePermission(role, permission.code, enabled)
      setMatrix((m) => {
        const granted = new Set(m.granted)
        if (enabled) granted.add(key)
        else granted.delete(key)
        return { ...m, granted }
      })
      toast.success(`${enabled ? 'Concedido' : 'Retirado'}: ${permission.description.toLowerCase()}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Roles y permisos</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Los cambios se aplican al momento a todas las personas con ese rol.'
              : 'Solo un administrador puede cambiar los permisos.'}
          </p>
        </div>
      </div>

      <Alert>{error}</Alert>

      <GlassPanel flush>
        {!matrix && !error && <Loader label="Cargando permisos…" />}
        {matrix && (
          <div className="table-scroll">
            <table className="table permissions-table">
              <thead>
                <tr>
                  <th scope="col">Permiso</th>
                  <th scope="col" className="cell-center">Administrador</th>
                  {EDITABLE_ROLES.map((r) => (
                    <th key={r.value} scope="col" className="cell-center">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map(([module, perms]) => (
                  <Fragment key={module}>
                    <tr className="table-group">
                      <th scope="rowgroup" colSpan={2 + EDITABLE_ROLES.length}>{module}</th>
                    </tr>
                    {perms.map((p) => (
                      <tr key={p.code}>
                        <th scope="row" className="permission-name">
                          {p.description}
                          <code>{p.code}</code>
                        </th>
                        <td className="cell-center">
                          <Switch checked label={`Administrador: ${p.description}`} disabled onChange={() => {}} />
                        </td>
                        {EDITABLE_ROLES.map((r) => {
                          const key = `${r.value}:${p.code}`
                          return (
                            <td key={r.value} className="cell-center">
                              <Switch
                                checked={matrix.granted.has(key)}
                                label={`${r.label}: ${p.description}`}
                                disabled={!isAdmin || (busy && busy !== key)}
                                busy={busy === key}
                                onChange={(enabled) => toggle(r.value, p, enabled)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </>
  )
}
