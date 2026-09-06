// App.jsx define las rutas de la aplicación.
// React Router mapea la URL a un componente. Navegamos con <Link> sin
// recargar la página (SPA = Single Page Application).
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Profile from './pages/Profile.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import AdminJobs from './pages/admin/AdminJobs.jsx'
import JobForm from './pages/admin/JobForm.jsx'
import AdminCompanies from './pages/admin/AdminCompanies.jsx'
import { clearSession, getUser } from './api.js'

// ---------- Guardias de rutas (equivalente a require_auth/admin) ----------

// Si NO hay sesión, redirige a /login.
function RequireAuth({ children }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Si no hay sesión o no es admin, redirige a /.
function RequireAdmin({ children }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />
  return children
}

// ---------- Barra de navegación ----------

function Navbar() {
  const user = getUser()

  function handleLogout() {
    clearSession()
    window.location.href = '/'
  }

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          IAFAM<span> Jobs</span>
        </Link>
        <div className="links">
          {user ? (
            <>
              <Link to="/profile">
                {user.name}
                {user.role === 'ADMIN' && (
                  <span className="badge-admin">ADMIN</span>
                )}
              </Link>
              {user.role === 'ADMIN' && <Link to="/admin">Panel</Link>}
              <button className="link" onClick={handleLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Iniciar sesión</Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Regístrate
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Con sesión */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          {/* Solo administrador */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="jobs/new" element={<JobForm />} />
            <Route path="jobs/:id/edit" element={<JobForm />} />
            <Route path="companies" element={<AdminCompanies />} />
          </Route>

          {/* Cualquier otra ruta → Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}