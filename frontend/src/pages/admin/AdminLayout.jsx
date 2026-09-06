// AdminLayout: estructura del panel de administración.
// Tiene el menú lateral y un <Outlet /> donde React Router renderiza la
// subpágina activa (Dashboard, ofertas, empresas...).
import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <NavLink to="/admin" end>📊 Dashboard</NavLink>
        <NavLink to="/admin/jobs">💼 Ofertas</NavLink>
        <NavLink to="/admin/companies">🏢 Empresas</NavLink>
      </nav>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}