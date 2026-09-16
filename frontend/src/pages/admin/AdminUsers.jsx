// USUARIOS: búsqueda y filtros (BO-082). La ficha de cada usuario está en
// UserDetail.jsx.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import {
  Alert, Badge, CompanyMark, EmptyState, GlassPanel, Input, Loader, Pagination, Select,
} from '../../components/ui/index.js'
import { listUsers } from '../../backofficeApi.js'
import { ROLE_LABEL, relativeTime, toOptions } from '../../lib/labels.js'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
]
const SEARCH_DELAY = 350

export default function AdminUsers() {
  // Los filtros viven en la URL: se pueden compartir y sobreviven a "Atrás".
  const [params, setParams] = useSearchParams()
  const filters = {
    search: params.get('q') || '',
    role: params.get('role') || '',
    status: params.get('status') || '',
    page: Number(params.get('page')) || 1,
  }
  const [query, setQuery] = useState(filters.search)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (query === filters.search) return
    const t = setTimeout(() => setFilter('q', query.trim()), SEARCH_DELAY)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    let cancelled = false
    setResult(null)
    listUsers(filters)
      .then((r) => { if (!cancelled) { setResult(r); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">
            {result ? `${result.total} ${result.total === 1 ? 'persona' : 'personas'}` : 'Cuentas registradas en la plataforma.'}
          </p>
        </div>
      </div>

      <GlassPanel className="toolbar">
        <Input
          icon={Search}
          type="search"
          aria-label="Buscar usuarios"
          placeholder="Nombre o email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="toolbar-grow"
        />
        <Select
          aria-label="Rol"
          placeholder="Todos los roles"
          options={toOptions(ROLE_LABEL)}
          value={filters.role}
          onChange={(e) => setFilter('role', e.target.value)}
        />
        <Select
          aria-label="Estado"
          placeholder="Cualquier estado"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </GlassPanel>

      <Alert>{error}</Alert>

      <GlassPanel flush>
        {!result && !error && <Loader label="Buscando usuarios…" />}

        {result?.rows.length === 0 && (
          <EmptyState icon={Users} title="Nadie coincide con la búsqueda">
            Prueba con otra parte del nombre o del email.
          </EmptyState>
        )}

        {result?.rows.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último acceso</th>
                  <th scope="col">Alta</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-main">
                        <CompanyMark name={u.name || u.email} size="sm" />
                        <div>
                          <Link to={`/admin/users/${u.id}`} className="cell-title">{u.name || 'Sin nombre'}</Link>
                          <p className="cell-sub">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.role === 'USER' ? ROLE_LABEL.USER : <Badge tone="cobalt">{ROLE_LABEL[u.role]}</Badge>}
                    </td>
                    <td>
                      {u.is_active ? <Badge tone="teal">Activo</Badge> : <Badge tone="coral">Suspendido</Badge>}
                    </td>
                    <td className="cell-nowrap">{u.last_sign_in_at ? relativeTime(u.last_sign_in_at) : 'Nunca'}</td>
                    <td className="cell-nowrap">{relativeTime(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <Pagination page={filters.page} pages={result.pages} onChange={(p) => setFilter('page', String(p))} />
        )}
      </GlassPanel>
    </>
  )
}
