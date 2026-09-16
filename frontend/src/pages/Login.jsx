// ACCESO: email y contraseña.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { Alert, Button, GlassPanel, Input } from '../components/ui/index.js'
import { login } from '../api.js'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { notice } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login({ email, password })
      navigate(['ADMIN', 'MODERATOR'].includes(user.role) ? '/admin' : '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <GlassPanel strong className="auth-card">
        <h1 className="auth-title">Inicia sesión</h1>
        <p className="auth-text">Retoma tu búsqueda y consulta las ofertas que guardaste.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Alert>{error || notice}</Alert>
          <Input
            label="Email"
            type="email"
            icon={Mail}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Contraseña"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={loading} block>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="auth-foot">
          ¿Aún no tienes cuenta? <Link to="/register">Crea una gratis</Link>
        </p>
      </GlassPanel>
    </div>
  )
}
