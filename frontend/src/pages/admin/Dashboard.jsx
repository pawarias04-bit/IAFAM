// RESUMEN del backoffice. Arriba, lo que espera una decisión hoy (con
// enlace directo a cada bandeja); debajo, las cifras del Documento Maestro
// agrupadas por lo que responden.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, CircleCheck, Flag, Inbox, Plus } from 'lucide-react'
import { Alert, Button, GlassPanel, Loader } from '../../components/ui/index.js'
import { adminStats } from '../../api.js'
import { useAuth } from '../../auth.jsx'

export default function Dashboard() {
  const { can } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminStats().then(setStats).catch((e) => setError(e.message))
  }, [])

  const pending = stats ? [
    can('jobs.publish') && {
      icon: Inbox, count: stats.pending_jobs, to: '/admin/moderation?tab=jobs',
      one: 'oferta espera revisión', many: 'ofertas esperan revisión',
    },
    can('reports.view') && {
      icon: Flag, count: stats.open_reports, to: '/admin/moderation?tab=reports',
      one: 'reporte sin resolver', many: 'reportes sin resolver',
    },
    can('companies.verify') && {
      icon: Building2, count: stats.pending_companies, to: '/admin/moderation?tab=companies',
      one: 'empresa por verificar', many: 'empresas por verificar',
    },
  ].filter(Boolean) : []
  const pendingTotal = pending.reduce((sum, p) => sum + p.count, 0)

  const groups = stats && [
    {
      title: 'Ofertas',
      metrics: [
        { label: 'En total', value: stats.total_jobs },
        { label: 'Publicadas', value: stats.active_jobs },
        { label: 'En revisión', value: stats.pending_jobs },
        { label: 'Expiradas', value: stats.expired_jobs },
      ],
    },
    {
      title: 'Calidad',
      metrics: [
        { label: 'Ofertas reportadas', value: stats.reported_jobs, alert: stats.reported_jobs > 0 },
        { label: 'Reportes sin resolver', value: stats.open_reports, alert: stats.open_reports > 0 },
      ],
    },
    {
      title: 'Comunidad',
      metrics: [
        { label: 'Usuarios', value: stats.total_users },
        { label: 'Suspendidos', value: stats.suspended_users },
        { label: 'Empresas', value: stats.total_companies },
      ],
    },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="page-subtitle">Lo pendiente primero; las cifras, después.</p>
        </div>
        {can('jobs.edit') && <Button to="/admin/jobs/new" icon={Plus}>Publicar oferta</Button>}
      </div>

      <Alert>{error}</Alert>
      {!stats && !error && <Loader label="Calculando cifras…" />}

      {stats && pending.length > 0 && (
        <GlassPanel as="section" className="today" aria-labelledby="today-title">
          <h2 id="today-title" className="section-title">Pendiente hoy</h2>
          {pendingTotal === 0 ? (
            <p className="today-clear">
              <CircleCheck aria-hidden="true" />
              Nada espera una decisión. La bandeja está al día.
            </p>
          ) : (
            <ul className="today-list">
              {pending.map(({ icon: Icon, count, to, one, many }) => (
                <li key={to}>
                  <Link to={to} className={`today-item ${count ? '' : 'is-zero'}`}>
                    <Icon aria-hidden="true" />
                    <span className="today-count num">{count}</span>
                    <span>{count === 1 ? one : many}</span>
                    <ChevronRight className="today-go" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      )}

      {groups && (
        <div className="metric-groups">
          {groups.map((group) => (
            <GlassPanel as="section" key={group.title} aria-label={group.title}>
              <h2 className="section-title">{group.title}</h2>
              <dl className="metrics">
                {group.metrics.map((m) => (
                  <div key={m.label} className={`metric ${m.alert ? 'metric-alert' : ''}`}>
                    <dt>{m.label}</dt>
                    <dd>{m.value ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </GlassPanel>
          ))}
        </div>
      )}
    </>
  )
}
