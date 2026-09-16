// OFERTAS (backoffice): todas, en cualquier estado. Se puede cambiar el
// estado desde la tabla, editar y eliminar (con confirmación).
//
// Cada acción aparece solo con su permiso (jobs.publish, jobs.edit,
// jobs.delete) y el selector de estado solo ofrece las transiciones que
// la base de datos acepta desde el estado actual.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Briefcase, History, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { HistoryModal } from '../../components/backoffice/History.jsx'
import {
  Alert, Button, CompanyMark, ConfirmDialog, EmptyState, GlassPanel, Input, Loader, Select,
  VerificationBadge, useToast,
} from '../../components/ui/index.js'
import {
  adminDeleteJob, adminListJobs, adminSetJobStatus, fetchJobStatusTransitions,
} from '../../api.js'
import { useAuth } from '../../auth.jsx'
import {
  LEVEL_LABEL, STATUS_LABEL, VERIFICATION_LABEL, formatDate, statusOptionsFor, toOptions,
} from '../../lib/labels.js'

export default function AdminJobs() {
  const toast = useToast()
  const { can } = useAuth()
  const [jobs, setJobs] = useState([])
  const [transitions, setTransitions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  // Filtros en la URL: el Resumen enlaza, por ejemplo, a ?status=PENDING_REVIEW
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const statusFilter = params.get('status') || ''
  const verificationFilter = params.get('verification') || ''

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((j) =>
      (!term || j.title.toLowerCase().includes(term) || (j.company_name || '').toLowerCase().includes(term)) &&
      (!statusFilter || j.status === statusFilter) &&
      (!verificationFilter || j.verification_status === verificationFilter))
  }, [jobs, search, statusFilter, verificationFilter])

  const load = useCallback(() => {
    return Promise.all([adminListJobs(), fetchJobStatusTransitions()])
      .then(([data, map]) => { setJobs(data); setTransitions(map); setError('') })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function changeStatus(job, status) {
    const previous = job.status
    // Optimista: la tabla cambia al instante y se revierte si falla.
    setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, status } : j)))
    try {
      await adminSetJobStatus(job.id, status)
      toast.success(`Estado cambiado a ${STATUS_LABEL[status]}`)
    } catch (e) {
      setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, status: previous } : j)))
      toast.error(e.message)
    }
  }

  async function confirmDelete() {
    await adminDeleteJob(toDelete.id)
    setJobs((list) => list.filter((j) => j.id !== toDelete.id))
    toast.success('Oferta eliminada')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Ofertas</h1>
          <p className="page-subtitle">Solo las publicadas son visibles para el público.</p>
        </div>
        {can('jobs.edit') && <Button to="/admin/jobs/new" icon={Plus}>Publicar oferta</Button>}
      </div>

      <GlassPanel className="toolbar">
        <Input
          icon={Search}
          type="search"
          aria-label="Buscar ofertas"
          placeholder="Título o empresa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="toolbar-grow"
        />
        <Select
          aria-label="Estado"
          placeholder="Cualquier estado"
          options={toOptions(STATUS_LABEL)}
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
        />
        <Select
          aria-label="Verificación"
          placeholder="Cualquier verificación"
          options={toOptions(VERIFICATION_LABEL)}
          value={verificationFilter}
          onChange={(e) => setFilter('verification', e.target.value)}
        />
      </GlassPanel>

      <Alert>{error}</Alert>

      <GlassPanel flush>
        {loading && <Loader label="Cargando ofertas…" />}

        {!loading && !error && jobs.length === 0 && (
          <EmptyState
            icon={Briefcase}
            title="No hay ofertas todavía"
            action={can('jobs.edit') && <Button to="/admin/jobs/new" icon={Plus}>Publicar la primera</Button>}
          >
            Las que crees aparecerán aquí, publicadas o como borrador.
          </EmptyState>
        )}

        {!loading && jobs.length > 0 && visible.length === 0 && (
          <EmptyState icon={Search} title="Ninguna oferta coincide">
            Cambia la búsqueda o los filtros.
          </EmptyState>
        )}

        {!loading && visible.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Oferta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Verificación</th>
                  <th scope="col">Nivel</th>
                  <th scope="col">Creada</th>
                  <th scope="col"><span className="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="cell-main">
                        <CompanyMark name={job.company_name} logoUrl={job.company_logo_url} size="sm" />
                        <div>
                          <Link to={`/jobs/${job.id}`} className="cell-title">{job.title}</Link>
                          <p className="cell-sub">{job.company_name || 'Sin empresa'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Select
                        aria-label={`Estado de ${job.title}`}
                        options={statusOptionsFor(job.status, transitions)}
                        value={job.status}
                        onChange={(e) => changeStatus(job, e.target.value)}
                        disabled={!can('jobs.publish')}
                      />
                    </td>
                    <td><VerificationBadge status={job.verification_status} /></td>
                    <td>{LEVEL_LABEL[job.experience_level] || '—'}</td>
                    <td className="num cell-nowrap">{formatDate(job.created_at)}</td>
                    <td>
                      <div className="cell-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={History}
                          aria-label={`Historial de ${job.title}`}
                          onClick={() => setHistoryFor(job)}
                        />
                        {can('jobs.edit') && (
                          <Button
                            to={`/admin/jobs/${job.id}/edit`}
                            variant="ghost"
                            size="sm"
                            icon={Pencil}
                            aria-label={`Editar ${job.title}`}
                          />
                        )}
                        {can('jobs.delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            className="btn-danger-quiet"
                            aria-label={`Eliminar ${job.title}`}
                            onClick={() => setToDelete(job)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      <HistoryModal
        open={Boolean(historyFor)}
        onClose={() => setHistoryFor(null)}
        entity="jobs"
        entityId={historyFor?.id}
        title={historyFor ? `Historial: ${historyFor.title}` : undefined}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar esta oferta?"
        description={toDelete && `“${toDelete.title}” desaparecerá del listado y de los favoritos de quien la guardó. No se puede deshacer.`}
        confirmLabel="Eliminar oferta"
      />
    </>
  )
}
