// INICIO: buscador, filtros y listado de ofertas publicadas.
//
// Estado:
//   query    → lo que se escribe en el buscador (se aplica con retardo)
//   filters  → filtros aplicados a la consulta (q, área, nivel, modalidad,
//              tipo y página)
//   result   → { data, meta } devuelto por listJobs()
import { useEffect, useRef, useState } from 'react'
import { SearchX, Search, SlidersHorizontal } from 'lucide-react'
import JobCard, { JobRowSkeleton } from '../components/JobCard.jsx'
import {
  Alert, Button, ChoiceGroup, EmptyState, GlassPanel, Input, Modal, Pagination,
} from '../components/ui/index.js'
import { fetchCategories, listJobs } from '../api.js'
import { LEVEL_LABEL, MODE_LABEL, TYPE_LABEL, toOptions } from '../lib/labels.js'

const EMPTY_FILTERS = { q: '', category_id: '', level: '', mode: '', type: '', page: 1 }
const SEARCH_DELAY = 350

// De dónde llegan hoy las ofertas (Documento Maestro, §2). Se dibujan
// dispersas alrededor del buscador: una entra en el cristal por el borde
// superior y otra queda debajo, esmerilada. Las tres primeras son las
// únicas que se ven en pantallas medianas.
const SOURCES = [
  { label: 'Web de la empresa', x: '29%', y: '72%', r: '-4deg', fx: '-20px', fy: '-60px' },
  { label: 'Un contacto', x: '42%', y: '79.5%', r: '-6deg', fx: '40px', fy: '50px' },
  { label: 'Redes profesionales', x: '66%', y: '88%', r: '4deg', fx: '-50px', fy: '40px' },
  { label: 'Grupos de mensajería', x: '60%', y: '12%', r: '-5deg', fx: '60px', fy: '-50px' },
  { label: 'Bolsa de empleo', x: '80%', y: '28%', r: '5deg', fx: '90px', fy: '-10px' },
  { label: 'Un profesor', x: '63%', y: '40%', r: '3deg', fx: '40px', fy: '10px' },
  { label: 'Comunidad universitaria', x: '72%', y: '56%', r: '-3deg', fx: '80px', fy: '30px' },
  { label: 'Feria de empleo', x: '86%', y: '74%', r: '6deg', fx: '70px', fy: '60px' },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [result, setResult] = useState({ data: [], meta: { total: 0, pages: 0, page: 1 } })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const resultsRef = useRef(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  // El buscador espera a que se deje de escribir para no lanzar una
  // consulta por cada tecla.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: query, page: 1 }))
    }, SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [query, filters.q])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listJobs(filters)
      .then((res) => { if (!cancelled) { setResult(res); setError('') } })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters])

  // Cambiar un filtro vuelve a la página 1; cambiar de página no.
  function setFilter(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  function goToPage(page) {
    setFilters((prev) => ({ ...prev, page }))
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function clearFilters() {
    setQuery('')
    setFilters(EMPTY_FILTERS)
  }

  function submitSearch(e) {
    e.preventDefault()
    setFilters((prev) => ({ ...prev, q: query, page: 1 }))
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeCount = ['category_id', 'level', 'mode', 'type'].filter((k) => filters[k]).length
  const { total, pages, page } = result.meta
  const hasFilters = activeCount > 0 || filters.q

  const filterControls = (
    <>
      <ChoiceGroup
        legend="Área"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={filters.category_id}
        onChange={(v) => setFilter('category_id', v)}
      />
      <ChoiceGroup
        legend="Nivel"
        options={toOptions(LEVEL_LABEL)}
        value={filters.level}
        onChange={(v) => setFilter('level', v)}
      />
      <ChoiceGroup
        legend="Modalidad"
        options={toOptions(MODE_LABEL)}
        value={filters.mode}
        onChange={(v) => setFilter('mode', v)}
      />
      <ChoiceGroup
        legend="Tipo de contrato"
        options={toOptions(TYPE_LABEL)}
        value={filters.type}
        onChange={(v) => setFilter('type', v)}
      />
    </>
  )

  return (
    <>
      <section className="hero">
        <ul className="hero-sources" aria-hidden="true">
          {SOURCES.map((s, i) => (
            <li
              key={s.label}
              className="source"
              style={{
                '--x': s.x, '--y': s.y, '--r': s.r, '--fx': s.fx, '--fy': s.fy,
                '--d': `${i * 60}ms`,
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>

        <h1 className="hero-title">Todas tus oportunidades. En un solo lugar.</h1>
        <p className="hero-lede">
          Empleo y prácticas en informática que hoy andan repartidos entre
          grupos, webs y contactos. Cada oferta indica si ya está verificada.
        </p>

        <form className="lens" role="search" onSubmit={submitSearch}>
          <Input
            icon={Search}
            type="search"
            aria-label="Buscar ofertas"
            placeholder="Puesto, tecnología o empresa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" size="lg">Buscar</Button>
        </form>

        <p className="hero-count" aria-live="polite">
          {!loading && !error && !hasFilters && (
            total === 1 ? '1 oferta publicada' : `${total} ofertas publicadas`
          )}
        </p>
      </section>

      <div className="results" ref={resultsRef} style={{ scrollMarginTop: 'var(--nav-offset)' }}>
        <GlassPanel as="aside" className="filters" aria-label="Filtros">
          <div className="filters-head">
            <h2 className="section-title">Filtrar</h2>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters((p) => ({ ...EMPTY_FILTERS, q: p.q }))}>
                Quitar filtros
              </Button>
            )}
          </div>
          {filterControls}
        </GlassPanel>

        <GlassPanel flush as="section" aria-labelledby="results-title">
          <div className="list-head">
            <div>
              <h2 id="results-title" className="section-title">
                {filters.q ? `Resultados para “${filters.q}”` : 'Ofertas recientes'}
              </h2>
              {!loading && !error && (
                <p className="list-count">
                  {total === 1 ? '1 oferta' : `${total} ofertas`}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={SlidersHorizontal}
              className="filters-toggle"
              onClick={() => setSheetOpen(true)}
            >
              {activeCount > 0 ? `Filtros (${activeCount})` : 'Filtros'}
            </Button>
          </div>

          {error && (
            <div style={{ padding: 22 }}>
              <Alert>{error}</Alert>
            </div>
          )}

          {loading && (
            <div aria-busy="true" aria-label="Cargando ofertas">
              <JobRowSkeleton />
              <JobRowSkeleton />
              <JobRowSkeleton />
            </div>
          )}

          {!loading && !error && result.data.length === 0 && (
            <EmptyState
              icon={SearchX}
              title={hasFilters ? 'Ninguna oferta coincide' : 'Aún no hay ofertas publicadas'}
              action={hasFilters && (
                <Button variant="secondary" onClick={clearFilters}>Borrar búsqueda y filtros</Button>
              )}
            >
              {hasFilters
                ? 'Prueba con menos filtros o con otra palabra, por ejemplo una tecnología.'
                : 'Vuelve pronto: el equipo publica ofertas nuevas cada semana.'}
            </EmptyState>
          )}

          {!loading && result.data.length > 0 && (
            <ul className="job-list">
              {result.data.map((job) => (
                <li key={job.id}><JobCard job={job} /></li>
              ))}
            </ul>
          )}

          {!loading && <Pagination page={page} pages={pages} onChange={goToPage} />}
        </GlassPanel>
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtrar ofertas"
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFilters((p) => ({ ...EMPTY_FILTERS, q: p.q }))} disabled={!activeCount}>
              Quitar filtros
            </Button>
            <Button onClick={() => setSheetOpen(false)}>
              {loading ? 'Ver ofertas' : `Ver ${total} ${total === 1 ? 'oferta' : 'ofertas'}`}
            </Button>
          </>
        }
      >
        {filterControls}
      </Modal>
    </>
  )
}
