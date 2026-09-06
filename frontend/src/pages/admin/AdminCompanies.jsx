// AdminCompanies: listar empresas y crear una nueva.
import { useEffect, useState } from 'react'
import { adminCreateCompany, fetchCompanies } from '../../api.js'

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([])
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetchCompanies().then(setCompanies).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setMsg('')
    try {
      await adminCreateCompany({ name, website: website || undefined })
      setName('')
      setWebsite('')
      setMsg(`✅ Empresa "${name}" creada`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-head"><h1>🏢 Empresas</h1></div>

      <form className="card" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Crear empresa</h3>
        {error && <div className="form-error">{error}</div>}
        {msg && <div className="form-success">{msg}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Sitio web</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <button className="btn btn-primary">+ Crear empresa</button>
      </form>

      {loading && <div className="loading">⏳ Cargando...</div>}
      {!loading && companies.length === 0 && <div className="empty">No hay empresas todavía.</div>}

      {!loading && companies.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Nombre</th><th>Sitio web</th><th>Creada</th></tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.website ? <a href={c.website} target="_blank" rel="noreferrer">{c.website}</a> : '—'}</td>
                  <td>{c.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}