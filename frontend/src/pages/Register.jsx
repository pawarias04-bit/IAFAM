// REGISTRO: crea la cuenta con nombre, email, contraseña y carrera.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Alert, Button, EmptyState, GlassPanel, Input } from '../components/ui/index.js'
import { register } from '../api.js'

const MIN_PASSWORD = 8

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', career: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const navigate = useNavigate()

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const errors = {}
    if (form.password.length < MIN_PASSWORD) {
      errors.password = `Usa al menos ${MIN_PASSWORD} caracteres.`
    }
    if (form.password !== form.confirm) {
      errors.confirm = 'No coincide con la contraseña.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        career: form.career || undefined,
      })
      if (result.pendingConfirmation) setPendingEmail(result.email)
      else navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (pendingEmail) {
    return (
      <div className="auth">
        <GlassPanel strong className="auth-card">
          <EmptyState
            icon={MailCheck}
            title="Confirma tu email"
            action={<Button to="/login" variant="secondary">Ir a iniciar sesión</Button>}
          >
            Te enviamos un enlace a {pendingEmail}. Ábrelo para activar la cuenta y
            después inicia sesión.
          </EmptyState>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="auth">
      <GlassPanel strong className="auth-card">
        <h1 className="auth-title">Crea tu cuenta</h1>
        <p className="auth-text">Guarda las ofertas que te interesan y tenlas a mano cuando vayas a postularte.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Alert>{error}</Alert>
          <Input
            label="Nombre"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            required
          />
          <Input
            label="Carrera"
            placeholder="Ingeniería Informática"
            value={form.career}
            onChange={(e) => setField('career', e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
            error={fieldErrors.password}
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            required
          />
          <Input
            label="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.confirm}
            value={form.confirm}
            onChange={(e) => setField('confirm', e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={loading} block>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="auth-foot">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </GlassPanel>
    </div>
  )
}
