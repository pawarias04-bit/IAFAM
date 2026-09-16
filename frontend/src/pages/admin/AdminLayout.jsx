// Estructura del backoffice: menú lateral de cristal y un <Outlet /> donde
// React Router pinta la sección activa.
//
// Cada enlace aparece si el rol tiene al menos uno de sus permisos. El menú
// se agrupa en "Operación" (el trabajo diario) y "Sistema" (cómo está
// configurada la plataforma), y Moderación muestra cuántos pendientes hay.
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Briefcase, Building2, Inbox, LayoutDashboard, ScrollText, Settings, ShieldCheck, Tags, Users,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/index.js'
import { fetchModerationCounts } from '../../backofficeApi.js'
import { useAuth } from '../../auth.jsx'
import { MODERATION_CHANGED } from './Moderation.jsx'

const GROUPS = [
  {
    label: 'Operación',
    links: [
      { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true, perms: ['dashboard.view'] },
      { to: '/admin/moderation', label: 'Moderación', icon: Inbox, perms: ['jobs.publish', 'reports.view', 'companies.verify'], badge: true },
      { to: '/admin/jobs', label: 'Ofertas', icon: Briefcase, perms: ['jobs.view_all'] },
      { to: '/admin/companies', label: 'Empresas', icon: Building2, perms: ['companies.edit', 'companies.view_all'] },
      { to: '/admin/users', label: 'Usuarios', icon: Users, perms: ['users.view'] },
    ],
  },
  {
    label: 'Sistema',
    links: [
      { to: '/admin/catalogs', label: 'Catálogos', icon: Tags, perms: ['catalog.edit', 'jobs.view_all'] },
      { to: '/admin/audit', label: 'Auditoría', icon: ScrollText, perms: ['audit.view'] },
      { to: '/admin/permissions', label: 'Roles y permisos', icon: ShieldCheck, perms: ['users.change_role', 'settings.edit'] },
      { to: '/admin/settings', label: 'Configuración', icon: Settings, perms: ['settings.edit'] },
    ],
  },
]

export default function AdminLayout() {
  const { can } = useAuth()
  const [pending, setPending] = useState(0)

  // Solo cuenta lo que este rol puede resolver.
  const loadPending = useCallback(() => {
    fetchModerationCounts()
      .then((c) => setPending(
        (can('jobs.publish') ? c.jobs : 0) +
        (can('reports.view') ? c.reports : 0) +
        (can('companies.verify') ? c.companies : 0),
      ))
      .catch(() => {})
  }, [can])

  useEffect(() => {
    loadPending()
    window.addEventListener(MODERATION_CHANGED, loadPending)
    return () => window.removeEventListener(MODERATION_CHANGED, loadPending)
  }, [loadPending])

  const groups = GROUPS
    .map((g) => ({ ...g, links: g.links.filter((l) => l.perms.some(can)) }))
    .filter((g) => g.links.length)

  return (
    <div className="admin">
      <GlassPanel as="nav" className="admin-nav" aria-label="Backoffice">
        {groups.map((group) => (
          <div key={group.label} className="admin-nav-group">
            <p className="admin-nav-label">{group.label}</p>
            {group.links.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                <Icon aria-hidden="true" />
                {label}
                {badge && pending > 0 && (
                  <span className="count-pill" aria-label={`${pending} pendientes`}>{pending}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </GlassPanel>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  )
}
