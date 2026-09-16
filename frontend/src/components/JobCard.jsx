// Fila de oferta para listados (inicio y favoritos). Solo presenta.
// Va dentro de un <ul className="job-list"> sobre un panel de cristal:
// una hoja con filas se escanea mejor que una rejilla de tarjetas.
import { Link } from 'react-router-dom'
import { BadgeCheck, Briefcase, GraduationCap, MapPin } from 'lucide-react'
import { CompanyMark, VerificationBadge } from './ui/index.js'
import { LEVEL_LABEL, MODE_LABEL, TYPE_LABEL, timeAgo } from '../lib/labels.js'

const MAX_SKILLS = 4

export default function JobCard({ job }) {
  const extraSkills = (job.skills?.length || 0) - MAX_SKILLS

  return (
    <Link to={`/jobs/${job.id}`} className="job-row">
      <span className="job-row-mark">
        <CompanyMark name={job.company_name} logoUrl={job.company_logo_url} />
      </span>

      <div className="job-row-body">
        <h3 className="job-row-title">{job.title}</h3>
        <p className="job-row-company">
          {job.company_name || 'Empresa sin nombre'}
          {job.company_verification_status === 'VERIFIED' && (
            <BadgeCheck className="verified-mark" role="img" aria-label="Empresa verificada" />
          )}
        </p>

        <ul className="meta">
          {job.work_mode && (
            <li><MapPin aria-hidden="true" />{MODE_LABEL[job.work_mode]}</li>
          )}
          {job.employment_type && (
            <li><Briefcase aria-hidden="true" />{TYPE_LABEL[job.employment_type]}</li>
          )}
          {job.experience_level && (
            <li><GraduationCap aria-hidden="true" />{LEVEL_LABEL[job.experience_level]}</li>
          )}
        </ul>

        {job.skills?.length > 0 && (
          <ul className="skills" aria-label="Tecnologías">
            {job.skills.slice(0, MAX_SKILLS).map((s) => (
              <li key={s} className="skill">{s}</li>
            ))}
            {extraSkills > 0 && <li className="skill">+{extraSkills}</li>}
          </ul>
        )}
      </div>

      <div className="job-row-side">
        <VerificationBadge status={job.verification_status} />
        {job.publication_date && <span>{timeAgo(job.publication_date)}</span>}
      </div>
    </Link>
  )
}

export function JobRowSkeleton() {
  return (
    <div className="job-row-skeleton" aria-hidden="true">
      <span className="skeleton" style={{ width: 46, height: 46, borderRadius: 12 }} />
      <div>
        <span className="skeleton" style={{ width: '55%', height: 18 }} />
        <span className="skeleton" style={{ width: '30%', height: 14, marginTop: 8 }} />
        <span className="skeleton" style={{ width: '70%', height: 14, marginTop: 14 }} />
      </div>
    </div>
  )
}
