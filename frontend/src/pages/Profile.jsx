// PERFIL: consulta /profile (datos + favoritos) y permite editar los
// campos del perfil. Es un formulario "controlado" relleno con los datos
// que devuelve la API.
import { useEffect, useState } from 'react'
import JobCard from '../components/JobCard.jsx'
import { fetchProfile, getUser, updateProfile } from '../api.js'

export default function Profile() {
  const user = getUser()
  const [form, setForm] = useState({})
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setForm(data.user || {})
        setFavorites(data.favorites || [])
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      const updated = await updateProfile({
        name: form.name, career: form.career, university: form.university,
        graduation_year: form.graduation_year, experience_level: form.experience_level,
        preferred_mode: form.preferred_mode,
      })
      setForm(updated)
      setMsg('✅ Perfil actualizado')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">⏳ Cargando perfil...</div>

  return (
    <div className="stack" style={{ maxWidth: 900, margin: '24px auto' }}>
      <h1>👤 Mi perfil</h1>
      <p className="muted">Logueado como <strong>{user?.email}</strong> · Rol: {user?.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div></div>
      </div>

      <form className="card" onSubmit={handleSave}>
        <h3 style={{ marginTop: 0 }}>Datos personales</h3>
        {msg && <div className={msg.startsWith('✅') ? 'form-success' : 'form-error'}>{msg}</div>}
        <div className="form-group">
          <label>Nombre</label>
          <input value={form.name || ''} onChange={(e) => setField('name', e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Carrera</label>
            <input value={form.career || ''} onChange={(e) => setField('career', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Universidad</label>
            <input value={form.university || ''} onChange={(e) => setField('university', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Año de graduación</label>
            <input
              type="number"
              value={form.graduation_year || ''}
              onChange={(e) => setField('graduation_year', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Nivel</label>
            <select value={form.experience_level || ''} onChange={(e) => setField('experience_level', e.target.value)}>
              <option value="">—</option>
              <option value="INTERNSHIP">Prácticas</option>
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Modalidad preferida</label>
          <select value={form.preferred_mode || ''} onChange={(e) => setField('preferred_mode', e.target.value)}>
            <option value="">—</option>
            <option value="REMOTE">Remoto</option>
            <option value="HYBRID">Híbrido</option>
            <option value="ON_SITE">Presencial</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>

      <div>
        <h3>⭐ Mis favoritos ({favorites.length})</h3>
        {favorites.length === 0 ? (
          <div className="empty">Aún no has guardado ofertas.</div>
        ) : (
          favorites.map((fav) => <JobCard key={fav.id} job={fav} />)
        )}
      </div>
    </div>
  )
}