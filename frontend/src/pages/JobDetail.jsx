// DETALLE DE OFERTA: muestra la información completa de una oferta.
// Usa useParams (React Router) para leer el :id de la URL (/jobs/123).
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { addFavorite, getJob, getUser, removeFavorite } from '../api.js'

const LEVEL_LABEL = {
  INTERNSHIP: 'Prácticas', JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior',
}
const MODE_LABEL = {
  REMOTE: 'Remoto', HYBRID: 'Híbrido', ON_SITE: 'Presencial',
}
const TYPE_LABEL = {
  FULL_TIME: 'Tiempo completo', PART_TIME: 'Medio tiempo',
  INTERNSHIP: 'Pasantía', FREELANCE: 'Freelance', CONTRACT: 'Contrato',
}
const VERIF_LABEL = {
  VERIFIED: '🟢 Verificada', PENDING: '🟡 Pendiente', REPORTED: '🔴 Reportada',
}

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favorited, setFavorited] = useState(false)
  const user = getUser()

  useEffect(() => {
    let cancelled = false
    getJob(id)
      .then((j) => { if (!cancelled) { setJob(j); setError('') } })
      .catch(() => { if (!cancelled) setError('Oferta no encontrada') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="loading">⏳ Cargando oferta...</div>
  if (error) return <div className="empty"><strong>{error}</strong></div>
  if (!job) return null

  async function toggleFavorite() {
    try {
      if (favorited) { await removeFavorite(job.id); setFavorited(false) }
      else { await addFavorite(job.id); setFavorited(true) }
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="detail card">
      <div className="tags">
        {job.category_name && <span className="chip chip-soft">{job.category_name}</span>}
        <span className={verifClass(job.verification_status)}>
          {VERIF_LABEL[job.verification_status]}
        </span>
      </div>

      <h1 className="title">{job.title}</h1>
      <div className="company">{job.company_name || 'Empresa'}</div>

      <dl className="kv">
        {job.experience_level && (
          <>
            <dt>Nivel</dt><dd>{LEVEL_LABEL[job.experience_level]}</dd>
          </>
        )}
        {job.work_mode && (
          <>
            <dt>Modalidad</dt><dd>{MODE_LABEL[job.work_mode]}</dd>
          </>
        )}
        {job.employment_type && (
          <>
            <dt>Tipo</dt><dd>{TYPE_LABEL[job.employment_type]}</dd>
          </>
        )}
        {job.salary_min && (
          <>
            <dt>Salario</dt>
            <dd>{job.salary_min} — {job.salary_max || '—'} {job.currency || ''}</dd>
          </>
        )}
        {job.publication_date && (
          <>
            <dt>Publicada</dt><dd>{job.publication_date}</dd>
          </>
        )}
        {job.deadline && (
          <>
            <dt>Fecha límite</dt><dd>{job.deadline}</dd>
          </>
        )}
      </dl>

      <div className="section">
        <h3>Descripción</h3>
        <p className="description">{job.description}</p>
      </div>

      {job.skills?.length > 0 && (
        <div className="section">
          <h3>Tecnologías</h3>
          <div className="tags">
            {job.skills.map((s) => <span key={s} className="chip chip-skill">{s}</span>)}
          </div>
        </div>
      )}

      <div className="action-bar">
        {user && (
          <button className={`btn ${favorited ? 'btn-outline' : 'btn-primary'}`} onClick={toggleFavorite}>
            {favorited ? '★ Guardado' : '☆ Guardar oferta'}
          </button>
        )}
        {job.apply_url && (
          <a
            className="btn btn-outline"
            href={job.apply_url}
            target="_blank"
            rel="noreferrer"
          >
            Postularme →
          </a>
        )}
        {job.contact_email && (
          <a className="btn btn-outline" href={`mailto:${job.contact_email}`}>
            Contactar: {job.contact_email}
          </a>
        )}
      </div>

      {!user && (
        <p className="muted" style={{ marginTop: 16 }}>
          Inicia sesión para guardar ofertas en tus favoritos.
        </p>
      )}
    </div>
  )
}

function verifClass(status) {
  if (status === 'VERIFIED') return 'chip chip-verified'
  if (status === 'REPORTED') return 'chip chip-reported'
  return 'chip chip-pending'
}