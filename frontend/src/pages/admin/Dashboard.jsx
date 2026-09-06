// Dashboard admin: KPIs del documento maestro
// (total, activas, pendientes, expiradas, reportadas, usuarios).
import { useEffect, useState } from 'react'
import { adminStats } from '../../api.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminStats().then(setStats).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="form-error">{error}</div>
  if (!stats) return <div className="loading">⏳ Cargando estadísticas...</div>

  const cards = [
    { num: stats.total_jobs, label: 'Ofertas totales', color: '#2563eb' },
    { num: stats.active_jobs, label: 'Ofertas activas', color: '#16a34a' },
    { num: stats.pending_jobs, label: 'Pendientes', color: '#d97706' },
    { num: stats.expired_jobs, label: 'Expiradas', color: '#64748b' },
    { num: stats.reported_jobs, label: 'Reportadas', color: '#dc2626' },
    { num: stats.total_users, label: 'Usuarios', color: '#7c3aed' },
  ]

  return (
    <div>
      <div className="page-head">
        <h1>📊 Dashboard</h1>
      </div>

      <div className="kpi-grid">
        {cards.map((c) => (
          <div className="kpi" key={c.label}>
            <div className="num" style={{ color: c.color }}>{c.num}</div>
            <div className="label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Acciones rápidas</h3>
        <div className="row">
          <a className="btn btn-primary" href="/admin/jobs/new">+ Nueva oferta</a>
          <a className="btn btn-outline" href="/admin/jobs">Ver todas las ofertas</a>
        </div>
      </div>
    </div>
  )
}