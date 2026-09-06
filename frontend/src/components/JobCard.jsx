// JobCard: tarjeta reutilizable que muestra una oferta.
// Recibe un objeto `job` y devuelve HTML. Es un componente "tonto":
// solo presenta, no carga datos. Lo usamos en Home, favoritos, etc.
import { Link } from 'react-router-dom'

const LEVEL_LABEL = {
  INTERNSHIP: 'Prácticas',
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
}

const MODE_LABEL = {
  REMOTE: '🌐 Remoto',
  HYBRID: '💠 Híbrido',
  ON_SITE: '📍 Presencial',
}

const VERIF_LABEL = {
  VERIFIED: '🟢 Verificada',
  PENDING: '🟡 Pendiente',
  REPORTED: '🔴 Reportada',
}

export default function JobCard({ job }) {
  const levelClass = job.experience_level ? LEVEL_LABEL[job.experience_level] : null
  const modeClass = job.work_mode ? MODE_LABEL[job.work_mode] : null

  return (
    <Link to={`/jobs/${job.id}`} className="card job-card">
      <h3 className="title">{job.title}</h3>
      <div className="company">{job.company_name || 'Empresa'}</div>

      <div className="tags">
        {job.category_name && <span className="chip chip-soft">{job.category_name}</span>}
        {levelClass && <span className="chip chip-soft">{levelClass}</span>}
        {modeClass && <span className="chip chip-loc">{modeClass}</span>}
        {job.skills?.slice(0, 4).map((s) => (
          <span key={s} className="chip chip-skill">{s}</span>
        ))}
      </div>

      <div className="meta">
        {job.publication_date && <span>📅 {job.publication_date}</span>}
        <span className={verifClass(job.verification_status)}>
          {VERIF_LABEL[job.verification_status] || '—'}
        </span>
      </div>
    </Link>
  )
}

function verifClass(status) {
  if (status === 'VERIFIED') return 'chip chip-verified'
  if (status === 'REPORTED') return 'chip chip-reported'
  return 'chip chip-pending'
}