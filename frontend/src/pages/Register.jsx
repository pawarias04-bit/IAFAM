// REGISTRO: crea la cuenta. Envía nombre, email, contraseña y carrera.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api.js'

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '', career: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        career: form.career || undefined,
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card form-card">
      <h2>Crear cuenta</h2>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre</label>
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Carrera (opcional)</label>
          <input value={form.career} onChange={(e) => setField('career', e.target.value)} placeholder="Ingeniería Informática..." />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirmar</label>
            <input type="password" value={form.confirm} onChange={(e) => setField('confirm', e.target.value)} required />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  )
}