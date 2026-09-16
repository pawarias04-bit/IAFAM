// Textos visibles para los valores de los enums de la base de datos.
// Antes cada pagina tenia su propia copia; ahora hay una sola fuente.

export const LEVEL_LABEL = {
  INTERNSHIP: 'Prácticas',
  JUNIOR: 'Junior',
  MID: 'Semi senior',
  SENIOR: 'Senior',
}

export const MODE_LABEL = {
  REMOTE: 'Remoto',
  HYBRID: 'Híbrido',
  ON_SITE: 'Presencial',
}

export const TYPE_LABEL = {
  FULL_TIME: 'Tiempo completo',
  PART_TIME: 'Medio tiempo',
  INTERNSHIP: 'Pasantía',
  FREELANCE: 'Freelance',
  CONTRACT: 'Contrato',
}

export const STATUS_LABEL = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'En revisión',
  ACTIVE: 'Publicada',
  EXPIRED: 'Expirada',
  CLOSED: 'Cerrada',
  REJECTED: 'Rechazada',
}

export const VERIFICATION_LABEL = {
  VERIFIED: 'Verificada',
  PENDING: 'Sin verificar',
  REPORTED: 'Reportada',
}

export const ROLE_LABEL = {
  USER: 'Usuario',
  MODERATOR: 'Moderador',
  ADMIN: 'Administrador',
}

// Estados con los que puede nacer una oferta (BO-030). Lo impone el
// trigger jobs_guard; aquí solo se usa para no ofrecer otros.
export const NEW_JOB_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE']

// Convierte un objeto { VALOR: 'Texto' } en opciones para <Select>.
export function toOptions(labels) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

// Opciones de estado para una oferta que ya existe: el estado actual más
// los destinos permitidos desde él (fetchJobStatusTransitions).
export function statusOptionsFor(current, transitions) {
  const targets = transitions?.[current] || []
  return [current, ...targets].map((value) => ({ value, label: STATUS_LABEL[value] || value }))
}

// Las columnas DATE llegan como 'YYYY-MM-DD'. new Date() las interpreta
// en UTC y, en zonas horarias americanas, se verian un dia antes.
function parseDate(value) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
}

export function formatDate(value) {
  if (!value) return ''
  return parseDate(value).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "Hace 3 días", para que el listado se lea de un vistazo.
export function timeAgo(value) {
  if (!value) return ''
  const days = Math.floor((Date.now() - parseDate(value).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  return formatDate(value)
}

export function formatSalary(job) {
  const { salary_min: min, salary_max: max, currency } = job
  if (!min && !max) return ''
  const fmt = (n) => Number(n).toLocaleString('es')
  const range = min && max ? `${fmt(min)} – ${fmt(max)}` : fmt(min || max)
  return currency ? `${range} ${currency}` : range
}

// ---------- Backoffice ----------

export const COMPANY_VERIFICATION_LABEL = {
  UNVERIFIED: 'Sin verificar',
  PENDING: 'Pendiente de revisión',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada',
}

export const REPORT_REASON_LABEL = {
  FAKE: 'Falsa o sospechosa de estafa',
  DUPLICATE: 'Duplicada',
  EXPIRED: 'Ya no está vigente',
  INCORRECT: 'Datos incorrectos',
  BROKEN_LINK: 'El enlace no funciona',
}

export const REPORT_STATUS_LABEL = {
  OPEN: 'Abierto',
  RESOLVED: 'Resuelto',
  DISMISSED: 'Descartado',
}

export const SOURCE_TYPE_LABEL = {
  MANUAL: 'Carga manual',
  API: 'API',
  RSS: 'RSS',
  WEB: 'Web',
  UNIVERSITY: 'Universidad',
  IMPORT: 'Importación',
}

// Nombres de tabla tal como los guarda la auditoría.
export const ENTITY_LABEL = {
  jobs: 'Oferta',
  job_skills: 'Tecnologías de oferta',
  companies: 'Empresa',
  profiles: 'Usuario',
  categories: 'Área',
  skills: 'Tecnología',
  locations: 'Ubicación',
  sources: 'Fuente',
  reports: 'Reporte',
  role_permissions: 'Permiso de rol',
  app_settings: 'Configuración',
  internal_notes: 'Nota interna',
}

export const ACTION_LABEL = {
  INSERT: 'Creó',
  UPDATE: 'Modificó',
  DELETE: 'Eliminó',
}

// Nombres legibles de columnas para los cambios de la auditoría.
export const FIELD_LABEL = {
  title: 'Título', description: 'Descripción', company_id: 'Empresa', category_id: 'Área',
  location_id: 'Ubicación', employment_type: 'Contrato', work_mode: 'Modalidad',
  experience_level: 'Nivel', salary_min: 'Salario mínimo', salary_max: 'Salario máximo',
  currency: 'Moneda', publication_date: 'Fecha de publicación', deadline: 'Fecha límite',
  status: 'Estado', verification_status: 'Verificación', verified_at: 'Verificada el',
  verified_by: 'Verificada por', contact_email: 'Email de contacto', contact_phone: 'Teléfono',
  apply_url: 'Enlace para postularse', original_text: 'Texto original', original_url: 'URL original',
  name: 'Nombre', slug: 'Identificador', website: 'Sitio web', logo_url: 'Logo',
  is_active: 'Activo', role: 'Rol', email: 'Email', career: 'Carrera', university: 'Universidad',
  graduation_year: 'Año de graduación', preferred_mode: 'Modalidad preferida',
  reason: 'Motivo', resolution_note: 'Resolución', resolved_at: 'Resuelto el',
  resolved_by: 'Resuelto por', skill_id: 'Tecnología', job_id: 'Oferta', user_id: 'Usuario',
  permission: 'Permiso', key: 'Clave', value: 'Valor', updated_by: 'Modificado por',
  body: 'Texto', entity: 'Sobre', entity_id: 'Ficha', author_id: 'Autor',
  city: 'Ciudad', region: 'Región', country: 'País', type: 'Tipo', url: 'URL',
  created_at: 'Creado el', id: 'Id',
}

// Traduce el valor de un campo auditado a texto legible. Algunos campos
// significan cosas distintas según la tabla (el "PENDING" de verificación
// de una oferta no es el de una empresa), de ahí las excepciones por entidad.
const VALUE_LABELS = {
  status: STATUS_LABEL,
  verification_status: VERIFICATION_LABEL,
  role: ROLE_LABEL,
  experience_level: LEVEL_LABEL,
  work_mode: MODE_LABEL,
  preferred_mode: MODE_LABEL,
  employment_type: TYPE_LABEL,
  reason: REPORT_REASON_LABEL,
  type: SOURCE_TYPE_LABEL,
}

const ENTITY_VALUE_LABELS = {
  companies: { verification_status: COMPANY_VERIFICATION_LABEL },
  reports: { status: REPORT_STATUS_LABEL },
}

export function formatAuditValue(entity, field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const labels = ENTITY_VALUE_LABELS[entity]?.[field] || VALUE_LABELS[field]
  if (labels?.[value]) return labels[value]
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  return text.length > 140 ? `${text.slice(0, 140)}…` : text
}

export function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// "Hace 5 min", "Hace 3 h", "Ayer"… para marcas de tiempo con hora.
export function relativeTime(value) {
  if (!value) return ''
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  return formatDate(value)
}
