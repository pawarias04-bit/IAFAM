// AUDITORÍA (BO-091): todo lo que ha cambiado, quién y por qué. Solo con
// audit.view. Los filtros viven en la URL.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { HistoryList } from '../../components/backoffice/History.jsx'
import {
  Alert, Button, EmptyState, GlassPanel, Input, Loader, Pagination, Select,
} from '../../components/ui/index.js'
import { searchAudit } from '../../backofficeApi.js'
import { ENTITY_LABEL, toOptions } from '../../lib/labels.js'

const ACTION_OPTIONS = [
  { value: 'INSERT', label: 'Creaciones' },
  { value: 'UPDATE', label: 'Modificaciones' },
  { value: 'DELETE', label: 'Eliminaciones' },
]

export default function AdminAudit() {
  const [params, setParams] = useSearchParams()
  const filters = {
    entity: params.get('entity') || '',
    action: params.get('action') || '',
    actorId: params.get('actor') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    page: Number(params.get('page')) || 1,
  }
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
    let cancelled = false
    setResult(null)
    searchAudit(filters)
      .then((r) => { if (!cancelled) { setResult(r); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const hasFilters = ['entity', 'action', 'actor', 'from', 'to'].some((k) => params.get(k))

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="page-subtitle">
            {result ? `${result.total} ${result.total === 1 ? 'cambio registrado' : 'cambios registrados'}` : 'Registro de cambios de toda la plataforma.'}
          </p>
        </div>
      </div>

      <GlassPanel className="toolbar">
        <Select
          aria-label="Qué"
          placeholder="Todo"
          options={toOptions(ENTITY_LABEL)}
          value={filters.entity}
          onChange={(e) => setFilter('entity', e.target.value)}
        />
        <Select
          aria-label="Acción"
          placeholder="Cualquier acción"
          options={ACTION_OPTIONS}
          value={filters.action}
          onChange={(e) => setFilter('action', e.target.value)}
        />
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(e) => setFilter('from', e.target.value)}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          onChange={(e) => setFilter('to', e.target.value)}
        />
        {hasFilters && (
          <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>Quitar filtros</Button>
        )}
      </GlassPanel>

      {filters.actorId && (
        <Alert tone="success">
          Mostrando solo los cambios de una persona.{' '}
          <button type="button" className="link-button" onClick={() => setFilter('actor', '')}>Ver de todos</button>
        </Alert>
      )}
      <Alert>{error}</Alert>

      <GlassPanel>
        {!result && !error && <Loader label="Consultando auditoría…" />}
        {result?.rows.length === 0 && (
          <EmptyState icon={ScrollText} title={hasFilters ? 'Nada coincide con los filtros' : 'Todavía no hay cambios registrados'}>
            {hasFilters ? 'Amplía las fechas o quita algún filtro.' : 'Cada cambio en la plataforma quedará registrado aquí.'}
          </EmptyState>
        )}
        {result?.rows.length > 0 && <HistoryList entries={result.rows} showEntity />}
        {result && (
          <Pagination page={filters.page} pages={result.pages} onChange={(p) => setFilter('page', String(p))} />
        )}
      </GlassPanel>
    </>
  )
}
