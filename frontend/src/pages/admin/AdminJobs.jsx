// AdminJobs: listado de TODAS las ofertas (cualquier estado) con acciones:
// editar, cambiar estado y eliminar.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDeleteJob, adminListJobs, adminSetJobStatus } from '../../api.js'

const STATUS_LABEL = {
  DRAFT: 'Borrador', PENDING_REVIEW: 'Pendiente', ACTIVE: 'Activa',
  EXPIRED: 'Expirada', CLOSED: 'Cerrada', REJECTED: 'Rechazada',
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    adminListJobs()
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function changeStatus(job, status) {
    await adminSetJobStatus(job.id, status)
    load()
  }

  async function remove(job) {
    if (!confirm(`¿Eliminar la oferta "${job.title}"? Esta acción no se puede deshacer.`)) return
    await adminDeleteJob(job.id)
    load()
  }

  return (
    <div>
      <div className="page-head">
        <h1>💼 Ofertas</h1>
        <Link to="/admin/jobs/new" className="btn btn-primary">+ Nueva</Link>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="loading">⏳ Cargando...</div>}

      {!loading && jobs.length === 0 && <div className="empty">No hay ofertas todavía.</div>}

      {!loading && jobs.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Título</th>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Verificación</th>
                <th>Nivel</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td><Link to={`/jobs/${job.id}`}>{job.title}</Link></td>
                  <td>{job.company_name || '—'}</td>
                  <td>
                    <select
                      value={job.status}
                      onChange={(e) => changeStatus(job, e.target.value)}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td>{job.verification_status}</td>
                  <td>{job.experience_level || '—'}</td>
                  <td>
                    <div className="row">
                      <Link to={`/admin/jobs/${job.id}/edit`} className="btn btn-outline btn-sm">Editar</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(job)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}