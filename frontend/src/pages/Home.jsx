// HOME: lista de ofertas públicas con búsqueda y filtros.
// Estados del componente:
//   filters  → los filtros elegidos (q, category_id, level, mode, type)
//   data     → la respuesta de la API (lista + paginación)
//   loading  → bandera para mostrar "Cargando..."
//   error    → mensaje de error si algo falla
import { useEffect, useState } from 'react'
import JobCard from '../components/JobCard.jsx'
import { fetchCategories, listJobs } from '../api.js'

const EMPTY_FILTERS = { q: '', category_id: '', level: '', mode: '', type: '' }

export default function Home() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [data, setData] = useState({ data: [], meta: { total: 0, pages: 0, page: 1 } })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cargar categorías una sola vez al montar la página ([] = solo al inicio)
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  // Recargar ofertas cuando cambia algún filtro o la página.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listJobs(filters)
      .then((res) => { if (!cancelled) { setData(res); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true } // limpia la petición si el componente se desmonta
  }, [filters, filters.page])

  function setField(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value, page: '' }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  const page = data.meta.page || 1
  const pages = data.meta.pages || 0

  return (
    <div>
      <div className="page-head">
        <h1>🌍 Ofertas recientes</h1>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="toolbar">
        <input
          type="search"
          placeholder="🔎 Buscar (Python, Data Analyst, QA...)"
          value={filters.q}
          onChange={(e) => setField('q', e.target.value)}
        />
        <div className="row">
          <select
            value={filters.category_id}
            onChange={(e) => setField('category_id', e.target.value)}
          >
            <option value="">Área</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select value={filters.level} onChange={(e) => setField('level', e.target.value)}>
            <option value="">Nivel</option>
            <option value="INTERNSHIP">Prácticas</option>
            <option value="JUNIOR">Junior</option>
            <option value="MID">Mid</option>
            <option value="SENIOR">Senior</option>
          </select>

          <select value={filters.mode} onChange={(e) => setField('mode', e.target.value)}>
            <option value="">Modalidad</option>
            <option value="REMOTE">Remoto</option>
            <option value="HYBRID">Híbrido</option>
            <option value="ON_SITE">Presencial</option>
          </select>

          <select value={filters.type} onChange={(e) => setField('type', e.target.value)}>
            <option value="">Tipo</option>
            <option value="FULL_TIME">Tiempo completo</option>
            <option value="PART_TIME">Medio tiempo</option>
            <option value="INTERNSHIP">Pasantía</option>
            <option value="FREELANCE">Freelance</option>
            <option value="CONTRACT">Contrato</option>
          </select>

          <button className="btn btn-outline" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="loading">⏳ Cargando ofertas...</div>}

      {!loading && !error && data.data.length === 0 && (
        <div className="empty">
          <p><strong>No hay ofertas con esos filtros.</strong></p>
          <p className="muted">Prueba con otros criterios o limpia los filtros.</p>
        </div>
      )}

      {data.data.map((job) => <JobCard key={job.id} job={job} />)}

      {/* Paginación */}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', margin: '20px 0' }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setField('page', String(page - 1))}
          >
            ← Anterior
          </button>
          <span className="muted">Página {page} de {pages}</span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= pages}
            onClick={() => setField('page', String(page + 1))}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}