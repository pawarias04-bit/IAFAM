// Capa de datos del backoffice (docs/02-backoffice.md, Etapa B).
//
// Separada de api.js porque solo la usa el panel. Igual que allí, no hay
// comprobaciones de permisos en el cliente: las hacen RLS, los triggers y
// las funciones de la base de datos, que además dejan la auditoría.
import { supabase } from './supabaseClient.js'
import { fail } from './api.js'

// Las funciones RPC con motivo lo guardan en la auditoría; '' no aporta nada.
const reasonOrNull = (reason) => (reason && reason.trim()) || null

// ---------- Resumen y bandeja ----------

export async function fetchModerationCounts() {
  const { data, error } = await supabase.rpc('moderation_counts')
  if (error) fail(error, 'No se han podido cargar los pendientes')
  return data
}

export async function fetchPendingJobs() {
  const { data, error } = await supabase
    .from('jobs_public')
    .select('*')
    .eq('status', 'PENDING_REVIEW')
    .order('created_at', { ascending: true }) // la más antigua primero
  if (error) fail(error, 'No se han podido cargar las ofertas pendientes')
  return data
}

export async function moderateJob(jobId, decision, reason) {
  const { error } = await supabase.rpc('moderate_job', {
    p_job_id: jobId,
    p_decision: decision,
    p_reason: reasonOrNull(reason),
  })
  if (error) fail(error, 'No se ha podido moderar la oferta')
}

export async function fetchOpenReports() {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      id, reason, description, created_at,
      reporter:profiles!reports_user_id_fkey ( id, name, email ),
      job:jobs ( id, title, status, verification_status, company:companies ( id, name ) )
    `)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: true })
  if (error) fail(error, 'No se han podido cargar los reportes')
  return data
}

export async function resolveReport(reportId, { outcome, note, jobAction = 'NONE' }) {
  const { error } = await supabase.rpc('resolve_report', {
    p_report_id: reportId,
    p_outcome: outcome,
    p_note: note,
    p_job_action: jobAction,
  })
  if (error) fail(error, 'No se ha podido resolver el reporte')
}

export async function fetchPendingCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('verification_status', 'PENDING')
    .order('created_at', { ascending: true })
  if (error) fail(error, 'No se han podido cargar las empresas pendientes')
  return data
}

export async function reviewCompany(companyId, decision, reason) {
  const { error } = await supabase.rpc('review_company', {
    p_company_id: companyId,
    p_decision: decision,
    p_reason: reasonOrNull(reason),
  })
  if (error) fail(error, 'No se ha podido actualizar la verificación')
}

// ---------- Historial y notas ----------

export async function fetchEntityHistory(entity, entityId) {
  const { data, error } = await supabase.rpc('entity_history', {
    p_entity: entity,
    p_entity_id: String(entityId),
  })
  if (error) fail(error, 'No se ha podido cargar el historial')
  return data
}

export async function fetchNotes(entity, entityId) {
  const { data, error } = await supabase
    .from('internal_notes')
    .select('id, body, created_at, author_id, author:profiles ( name, email )')
    .eq('entity', entity)
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar las notas')
  return data
}

export async function addNote(entity, entityId, body) {
  const { data: sess } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('internal_notes')
    .insert({
      entity,
      entity_id: String(entityId),
      body: body.trim(),
      author_id: sess.session?.user?.id,
    })
    .select('id, body, created_at, author_id, author:profiles ( name, email )')
    .single()
  if (error) fail(error, 'No se ha podido guardar la nota')
  return data
}

export async function deleteNote(noteId) {
  const { error } = await supabase.from('internal_notes').delete().eq('id', noteId)
  if (error) fail(error, 'No se ha podido borrar la nota')
}

// ---------- Auditoría ----------

export const AUDIT_PAGE_SIZE = 50

export async function searchAudit({ entity, action, actorId, from, to, page = 1 } = {}) {
  const { data, error } = await supabase.rpc('audit_search', {
    p_entity: entity || null,
    p_action: action || null,
    p_actor_id: actorId || null,
    p_from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
    // "hasta" incluye el día elegido completo
    p_to: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString() : null,
    p_limit: AUDIT_PAGE_SIZE,
    p_offset: (page - 1) * AUDIT_PAGE_SIZE,
  })
  if (error) fail(error, 'No se ha podido consultar la auditoría')
  const total = data[0]?.total_count ?? 0
  return { rows: data, total, pages: Math.ceil(total / AUDIT_PAGE_SIZE) }
}

// ---------- Usuarios ----------

export const USERS_PAGE_SIZE = 25

export async function listUsers({ search, role, status, page = 1 } = {}) {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search || null,
    p_role: role || null,
    p_active: status === 'active' ? true : status === 'suspended' ? false : null,
    p_limit: USERS_PAGE_SIZE,
    p_offset: (page - 1) * USERS_PAGE_SIZE,
  })
  if (error) fail(error, 'No se han podido cargar los usuarios')
  const total = data[0]?.total_count ?? 0
  return { rows: data, total, pages: Math.ceil(total / USERS_PAGE_SIZE) }
}

export async function fetchUserDetail(userId) {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: userId })
  if (error) fail(error, 'No se ha podido cargar el usuario')
  return data
}

export async function setUserRole(userId, role, reason) {
  const { error } = await supabase.rpc('set_user_role', {
    p_user_id: userId,
    p_role: role,
    p_reason: reason,
  })
  if (error) fail(error, 'No se ha podido cambiar el rol')
}

// Suspender también bloquea el inicio de sesión en Supabase Auth, y eso
// exige service_role: por eso pasa por la Edge Function manage-user.
export async function setUserActive(userId, active, reason) {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: active ? 'reactivate' : 'suspend', user_id: userId, reason: reasonOrNull(reason) },
  })
  if (error) {
    let message = 'No se ha podido cambiar el acceso del usuario'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      // respuesta sin JSON: se queda el mensaje genérico
    }
    throw new Error(message)
  }
  return data
}

// ---------- Empresas ----------

export async function listCompaniesAdmin() {
  const { data, error } = await supabase
    .from('companies')
    .select('*, jobs(count)')
    .order('name')
  if (error) fail(error, 'No se han podido cargar las empresas')
  return data.map(({ jobs, ...c }) => ({ ...c, job_count: jobs?.[0]?.count ?? 0 }))
}

export async function fetchCompany(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()
  if (error) fail(error, 'Empresa no encontrada')
  return data
}

export async function updateCompany(companyId, changes) {
  const clean = (v) => (v === '' || v === undefined ? null : v)
  const patch = {}
  for (const key of ['name', 'description', 'website', 'logo_url', 'is_active']) {
    if (key in changes) patch[key] = key === 'is_active' ? changes[key] : clean(changes[key])
  }
  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', companyId)
    .select()
    .single()
  if (error) fail(error, 'No se ha podido guardar la empresa')
  return data
}

export async function deleteCompany(companyId) {
  const { error } = await supabase.from('companies').delete().eq('id', companyId)
  if (error) fail(error, 'No se ha podido borrar la empresa')
}

export async function fetchCompanyJobs(companyId) {
  const { data, error } = await supabase
    .from('jobs_public')
    .select('id, title, status, verification_status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar las ofertas de la empresa')
  return data
}

// ---------- Roles y permisos ----------

export async function fetchPermissionMatrix() {
  const [perms, grants] = await Promise.all([
    supabase.from('permissions').select('*').order('module').order('code'),
    supabase.from('role_permissions').select('role, permission'),
  ])
  if (perms.error) fail(perms.error, 'No se han podido cargar los permisos')
  if (grants.error) fail(grants.error, 'No se han podido cargar los permisos')
  const granted = new Set(grants.data.map((g) => `${g.role}:${g.permission}`))
  return { permissions: perms.data, granted }
}

export async function setRolePermission(role, permission, enabled) {
  const query = enabled
    ? supabase.from('role_permissions').insert({ role, permission })
    : supabase.from('role_permissions').delete().eq('role', role).eq('permission', permission)
  const { error } = await query
  if (error) fail(error, 'No se ha podido cambiar el permiso')
}

// ---------- Configuración ----------

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*, editor:profiles!app_settings_updated_by_fkey ( name, email )')
    .order('key')
  if (error) fail(error, 'No se ha podido cargar la configuración')
  return data
}

export async function updateSetting(key, value) {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ value })
    .eq('key', key)
    .select('*, editor:profiles!app_settings_updated_by_fkey ( name, email )')
    .single()
  if (error) fail(error, 'No se ha podido guardar el ajuste')
  return data
}

// ---------- Catálogos ----------

// Qué columnas edita el backoffice en cada catálogo.
export const CATALOGS = {
  categories: { fields: ['name', 'slug'], order: 'name' },
  skills: { fields: ['name', 'slug', 'category_id'], order: 'name' },
  locations: { fields: ['city', 'region', 'country'], order: 'country' },
  sources: { fields: ['name', 'type', 'url', 'is_active'], order: 'name' },
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function catalogPayload(table, values) {
  const payload = {}
  for (const field of CATALOGS[table].fields) {
    if (!(field in values)) continue
    const v = values[field]
    payload[field] = v === '' ? null : field === 'category_id' && v !== null ? Number(v) : v
  }
  // El slug se deriva del nombre si no se indica.
  if (CATALOGS[table].fields.includes('slug') && !payload.slug && payload.name) {
    payload.slug = slugify(payload.name)
  }
  return payload
}

export async function listCatalog(table) {
  const { data, error } = await supabase.from(table).select('*').order(CATALOGS[table].order)
  if (error) fail(error, 'No se ha podido cargar el catálogo')
  return data
}

export async function saveCatalogItem(table, id, values) {
  const payload = catalogPayload(table, values)
  const query = id
    ? supabase.from(table).update(payload).eq('id', id)
    : supabase.from(table).insert(payload)
  const { data, error } = await query.select().single()
  if (error) fail(error, 'No se ha podido guardar')
  return data
}

export async function deleteCatalogItem(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) fail(error, 'No se ha podido borrar')
}
