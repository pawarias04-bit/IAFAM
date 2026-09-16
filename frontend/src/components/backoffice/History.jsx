// Historial de cambios a partir de filas de audit_log (BO-090).
//
//   <HistoryList entries={rows} />                   lista ya cargada
//   <EntityHistory entity="jobs" entityId={12} />    carga el de una ficha
//   <HistoryModal entity="jobs" entityId={12} … />   lo mismo, en un modal
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { Alert, EmptyState, Loader, Modal } from '../ui/index.js'
import { fetchEntityHistory } from '../../backofficeApi.js'
import {
  ACTION_LABEL, ENTITY_LABEL, FIELD_LABEL, ROLE_LABEL, formatAuditValue, formatDateTime,
  relativeTime,
} from '../../lib/labels.js'

// Campos que no aportan nada al leer un cambio: identificadores internos
// y autores (el autor ya aparece arriba de cada entrada).
const HIDDEN_FIELDS = new Set([
  'id', 'created_at', 'updated_by', 'verified_by', 'resolved_by', 'author_id', 'user_id',
])

// Dónde está la ficha de cada tipo de registro en el backoffice.
const ENTITY_LINK = {
  jobs: (id) => `/admin/jobs/${id}/edit`,
  job_skills: (id) => `/admin/jobs/${id}/edit`,
  companies: (id) => `/admin/companies/${id}`,
  profiles: (id) => `/admin/users/${id}`,
}

function ChangeRows({ entity, action, changes }) {
  const entries = Object.entries(changes || {}).filter(([field]) => !HIDDEN_FIELDS.has(field))
  if (!entries.length) return null

  return (
    <dl className="changes">
      {entries.map(([field, value]) => (
        <div key={field} className="change">
          <dt>{FIELD_LABEL[field] || field}</dt>
          {action === 'UPDATE' ? (
            <dd>
              <span className="change-old">{formatAuditValue(entity, field, value?.old)}</span>
              <span className="change-arrow" aria-label="pasa a">→</span>
              <span className="change-new">{formatAuditValue(entity, field, value?.new)}</span>
            </dd>
          ) : (
            <dd>{field === 'entity' ? ENTITY_LABEL[value] || value : formatAuditValue(entity, field, value)}</dd>
          )}
        </div>
      ))}
    </dl>
  )
}

export function HistoryList({ entries, showEntity = false }) {
  return (
    <ol className="history">
      {entries.map((e) => (
        <li key={e.id} className="history-item">
          <div className="history-head">
            <p className="history-who">
              <strong>{e.actor_name || e.actor_email || (e.actor_id ? 'Usuario eliminado' : 'Sistema')}</strong>
              {e.actor_role && <span className="history-role">{ROLE_LABEL[e.actor_role]}</span>}
            </p>
            <time dateTime={e.occurred_at} title={formatDateTime(e.occurred_at)} className="history-when">
              {relativeTime(e.occurred_at)}
            </time>
          </div>
          <p className="history-what">
            {ACTION_LABEL[e.action]} {(ENTITY_LABEL[e.entity] || e.entity).toLowerCase()}
            {showEntity && e.entity_id && ENTITY_LINK[e.entity] && e.action !== 'DELETE' && (
              <> <Link to={ENTITY_LINK[e.entity](e.entity_id)} className="history-ref">abrir ficha</Link></>
            )}
          </p>
          {e.reason && <blockquote className="history-reason">{e.reason}</blockquote>}
          <ChangeRows entity={e.entity} action={e.action} changes={e.changes} />
        </li>
      ))}
    </ol>
  )
}

export function EntityHistory({ entity, entityId, refreshKey }) {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    fetchEntityHistory(entity, entityId)
      .then((rows) => { if (!cancelled) setEntries(rows) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [entity, entityId, refreshKey])

  if (error) return <Alert>{error}</Alert>
  if (!entries) return <Loader inline label="Cargando historial…" />
  if (!entries.length) {
    return (
      <EmptyState icon={History} title="Sin cambios registrados">
        Los cambios aparecerán aquí a partir de ahora.
      </EmptyState>
    )
  }
  return <HistoryList entries={entries} />
}

export function HistoryModal({ open, onClose, entity, entityId, title }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Historial de cambios'} size="lg">
      {open && <EntityHistory entity={entity} entityId={entityId} />}
    </Modal>
  )
}
