// App.jsx define las rutas de la aplicación.
// React Router mapea la URL a un componente. Navegamos con <Link> sin
// recargar la página (SPA = Single Page Application).
import { lazy, Suspense } from 'react'
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Briefcase, LayoutDashboard, Lock, LogOut, Search } from 'lucide-react'
import Home from './pages/Home.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Profile from './pages/Profile.jsx'
// El backoffice se carga bajo demanda: quien solo busca empleo no descarga
// su código.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const Moderation = lazy(() => import('./pages/admin/Moderation.jsx'))
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs.jsx'))
const JobForm = lazy(() => import('./pages/admin/JobForm.jsx'))
const AdminCompanies = lazy(() => import('./pages/admin/AdminCompanies.jsx'))
const CompanyDetail = lazy(() => import('./pages/admin/CompanyDetail.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'))
const UserDetail = lazy(() => import('./pages/admin/UserDetail.jsx'))
const AdminCatalogs = lazy(() => import('./pages/admin/AdminCatalogs.jsx'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit.jsx'))
const AdminPermissions = lazy(() => import('./pages/admin/AdminPermissions.jsx'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'))

// Portal de empresas (Etapa C), también bajo demanda.
const CompanyPortal = lazy(() => import('./pages/company/CompanyPortal.jsx'))
const CompanyHome = lazy(() => import('./pages/company/CompanyHome.jsx'))
const CompanyJobForm = lazy(() => import('./pages/company/CompanyJobForm.jsx'))
import { Button, CompanyMark, EmptyState, GlassPanel, Loader } from './components/ui/index.js'
import { clearSession } from './api.js'
import { useAuth } from './auth.jsx'
import { useFeature } from './settings.jsx'

// ---------- Guardias de rutas (equivalente a require_auth/admin) ----------
//
// `loading` es imprescindible: Supabase restaura la sesión de forma
// asíncrona al cargar la página. Sin esperar, un usuario con sesión
// válida sería expulsado a /login cada vez que recarga.

// Si NO hay sesión, redirige a /login.
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader label="Comprobando sesión…" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Backoffice: administradores y moderadores activos. Si no, redirige a /.
// Ojo: esto solo cuida la navegación. Quien manda de verdad es RLS en la
// base de datos: aunque alguien fuerce la URL /admin, las consultas le
// devolverán error 42501 o ninguna fila.
function RequireStaff({ children }) {
  const { user, loading, isStaff } = useAuth()
  if (loading) return <Loader label="Comprobando sesión…" />
  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/" replace />
  return children
}

// Dentro del backoffice: la sección exige al menos uno de estos permisos.
// Sin él se explica por qué, en lugar de mostrar errores de la base de datos.
function RequirePermission({ any, children }) {
  const { can } = useAuth()
  if (any.some(can)) return children
  return (
    <GlassPanel style={{ marginTop: 8 }}>
      <EmptyState icon={Lock} title="Esta sección no está disponible para tu rol">
        Si la necesitas, pide a un administrador que te conceda el permiso.
      </EmptyState>
    </GlassPanel>
  )
}

// ---------- Fondo y barra de navegación ----------

// Manchas de color detrás del cristal. Es decoración pura: aria-hidden.
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="pebble pebble-aqua" />
      <span className="pebble pebble-cobalt" />
      <span className="pebble pebble-amber" />
      <span className="pebble pebble-sage" />
    </div>
  )
}

// Logotipo: una lente sobre dos fragmentos de vidrio de mar.
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="9" width="15" height="15" rx="5" fill="#8fd8cc" transform="rotate(-12 9.5 16.5)" />
      <rect x="13" y="4" width="13" height="13" rx="4.5" fill="#f0c674" transform="rotate(10 19.5 10.5)" />
      <circle cx="17" cy="17" r="8.5" fill="rgba(255,255,255,.55)" stroke="#0c7470" strokeWidth="2.5" />
      <path d="M23.2 23.2 29 29" stroke="#0c7470" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Navbar() {
  const { user, isStaff } = useAuth()
  // El enlace al portal aparece si está abierto o si ya formas parte de
  // alguna empresa (así nadie se queda fuera si se cierra el registro).
  const portalOpen = useFeature('company_portal')
  const showPortal = user && (portalOpen || user.companies?.length > 0)

  async function handleLogout() {
    await clearSession()
    window.location.href = '/'
  }

  return (
    <header className="nav shell">
      <GlassPanel as="nav" className="nav-bar" aria-label="Principal">
        <Link to="/" className="brand" aria-label="IAFAM Jobs, inicio">
          <BrandMark />
          <span className="brand-name">IAFAM <span>Jobs</span></span>
        </Link>

        <div className="nav-links">
          {/* En móvil se oculta: el logotipo ya lleva al inicio. */}
          <NavLink to="/" end className="nav-link nav-link-home">
            <Search aria-hidden="true" />
            <span className="nav-link-text">Ofertas</span>
          </NavLink>
          {showPortal && (
            <NavLink to="/empresa" className="nav-link">
              <Briefcase aria-hidden="true" />
              <span className="nav-link-text">Empresas</span>
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/admin" className="nav-link">
              <LayoutDashboard aria-hidden="true" />
              <span className="nav-link-text">Panel</span>
            </NavLink>
          )}
        </div>

        <div className="nav-user">
          {user ? (
            <>
              <Link to="/profile" className="nav-profile" aria-label={`Tu perfil: ${user.name || user.email}`}>
                <CompanyMark name={user.name || user.email} size="sm" />
                <span className="nav-profile-name">{user.name || 'Mi perfil'}</span>
              </Link>
              <Button variant="ghost" size="md" icon={LogOut} onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión" />
            </>
          ) : (
            <>
              <Button to="/login" variant="ghost">Entrar</Button>
              <Button to="/register">Crear cuenta</Button>
            </>
          )}
        </div>
      </GlassPanel>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Backdrop />
      <Navbar />
      <main className="main shell">
        <Suspense fallback={<Loader label="Cargando…" />}>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Portal de empresas */}
          <Route path="/empresa" element={<RequireAuth><CompanyPortal /></RequireAuth>} />
          <Route path="/empresa/:companyId" element={<RequireAuth><CompanyHome /></RequireAuth>} />
          <Route path="/empresa/:companyId/ofertas/nueva" element={<RequireAuth><CompanyJobForm /></RequireAuth>} />
          <Route path="/empresa/:companyId/ofertas/:jobId" element={<RequireAuth><CompanyJobForm /></RequireAuth>} />

          {/* Con sesión */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          {/* Backoffice: administradores y moderadores */}
          <Route
            path="/admin"
            element={
              <RequireStaff>
                <AdminLayout />
              </RequireStaff>
            }
          >
            <Route index element={<RequirePermission any={['dashboard.view']}><Dashboard /></RequirePermission>} />
            <Route path="moderation" element={<Moderation />} />
            <Route path="jobs" element={<RequirePermission any={['jobs.view_all']}><AdminJobs /></RequirePermission>} />
            <Route path="jobs/new" element={<RequirePermission any={['jobs.edit']}><JobForm /></RequirePermission>} />
            <Route path="jobs/:id/edit" element={<RequirePermission any={['jobs.edit', 'jobs.publish', 'jobs.verify']}><JobForm /></RequirePermission>} />
            <Route path="companies" element={<RequirePermission any={['companies.edit', 'companies.view_all']}><AdminCompanies /></RequirePermission>} />
            <Route path="companies/:id" element={<RequirePermission any={['companies.edit', 'companies.view_all', 'companies.verify']}><CompanyDetail /></RequirePermission>} />
            <Route path="users" element={<RequirePermission any={['users.view']}><AdminUsers /></RequirePermission>} />
            <Route path="users/:id" element={<RequirePermission any={['users.view']}><UserDetail /></RequirePermission>} />
            <Route path="catalogs" element={<RequirePermission any={['catalog.edit', 'jobs.view_all']}><AdminCatalogs /></RequirePermission>} />
            <Route path="audit" element={<RequirePermission any={['audit.view']}><AdminAudit /></RequirePermission>} />
            <Route path="permissions" element={<RequirePermission any={['users.change_role', 'settings.edit']}><AdminPermissions /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission any={['settings.edit']}><AdminSettings /></RequirePermission>} />
          </Route>

          {/* Cualquier otra ruta → Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </>
  )
}
