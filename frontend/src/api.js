// Capa de datos: TODAS las llamadas a Supabase pasan por aqui.
//
// Sustituye a la version que hablaba con Flask via fetch('/api/...').
// Se conservan a proposito los mismos nombres de funcion y las mismas
// formas de retorno, para que las paginas que solo consumen datos
// (Home, JobDetail, Dashboard, AdminJobs...) no tengan que cambiar.
//
// Diferencia de fondo: aqui ya no hay comprobaciones de permisos. Antes
// el backend decidia con @require_admin; ahora decide RLS en la base de
// datos. Si una consulta devuelve menos filas de las esperadas, o da
// error 42501, es una politica actuando, no un bug del frontend.
import { supabase } from './supabaseClient.js'
import { USER_CACHE_KEY, withClockSkewRetry } from './auth.jsx'

const PER_PAGE = 12

// ---------- Utilidades internas ----------

// Los errores de PostgREST traen codigos poco legibles para el usuario
// final. Aqui se traducen los mas frecuentes.
//
// Excepcion: los triggers del backoffice (jobs_guard, protect_profile_fields)
// lanzan 42501 o P0001 con un mensaje ya escrito para el usuario ("Una
// oferta no puede pasar de Publicada a Borrador."). Ese mensaje se respeta;
// solo se traducen los mensajes tecnicos de Postgres.
const TECHNICAL_MESSAGE = /^(permission denied|new row violates|violates row-level)/i

export function fail(error, fallback = 'Ha ocurrido un error') {
  if (!error) return
  const map = {
    '42501': 'No tienes permiso para hacer esto.',
    '23505': 'Ese registro ya existe.',
    '23503': 'Falta un dato relacionado obligatorio.',
    '23514': 'Alguno de los valores no es valido.',
    PGRST116: 'No se ha encontrado el registro.',
  }
  const readable = error.message && !TECHNICAL_MESSAGE.test(error.message)
  if ((error.code === '42501' || error.code === 'P0001') && readable) {
    throw new Error(error.message)
  }
  throw new Error(map[error.code] || error.message || fallback)
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacriticas)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Necesitas iniciar sesion.')
  return id
}

// Convierte '' en null y numeros de texto en numeros, que es lo que
// espera Postgres (el backend Flask hacia esta limpieza por su cuenta).
function clean(value) {
  return value === '' || value === undefined ? null : value
}

function toNumber(value) {
  const v = clean(value)
  return v === null ? null : Number(v)
}

// ---------- Sesion ----------

// Sincrona a proposito: lee la copia que mantiene AuthProvider, para que
// las paginas puedan pintar el usuario sin esperar a una promesa.
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function clearSession() {
  await supabase.auth.signOut()
  try {
    localStorage.removeItem(USER_CACHE_KEY)
  } catch {
    // sin cache que limpiar
  }
}

// ---------- Autenticacion ----------

export async function register({ name, email, password, career }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // `name` viaja en los metadatos; el trigger handle_new_user() lo
    // copia a profiles.name al crear la fila.
    options: { data: { name } },
  })
  if (error) fail(error, 'No se ha podido crear la cuenta')

  // Si el proyecto exige confirmar el email, signUp no devuelve sesion.
  // No es un error: la cuenta existe y la pagina muestra el siguiente paso.
  if (!data.session) {
    return { pendingConfirmation: true, email }
  }

  if (career) {
    const { error: careerError } = await supabase
      .from('profiles')
      .update({ career })
      .eq('id', data.user.id)
    // La cuenta ya existe: si falla solo la carrera, se puede completar
    // luego desde el perfil, asi que no se aborta el registro.
    if (careerError) console.error('No se pudo guardar la carrera:', careerError.message)
  }

  return fetchMe()
}

export async function login({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'user_banned' || /banned/i.test(error.message)) {
      throw new Error('Tu cuenta está suspendida. Si crees que es un error, escribe al equipo de IAFAM Jobs.')
    }
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message,
    )
  }
  const me = await fetchMe()
  // Perfil suspendido con la cuenta de Auth aún sin bloquear: no se entra.
  if (!me.is_active) {
    await supabase.auth.signOut()
    throw new Error('Tu cuenta está suspendida. Si crees que es un error, escribe al equipo de IAFAM Jobs.')
  }
  return me
}

export async function fetchMe() {
  const { data: sess } = await supabase.auth.getSession()
  const sessionUser = sess.session?.user
  if (!sessionUser) throw new Error('No hay sesion activa.')

  const { data, error } = await withClockSkewRetry(() => supabase
    .from('profiles')
    .select('*')
    .eq('id', sessionUser.id)
    .single())
  if (error) fail(error, 'No se ha podido cargar tu perfil')

  return { ...data, email: data.email || sessionUser.email }
}

// ---------- Catalogos ----------

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) fail(error)
  return data
}

export async function fetchSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name')
  if (error) fail(error)
  return data
}

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name')
  if (error) fail(error)
  return data
}

// ---------- Ofertas (publico) ----------

// Devuelve { data, meta } con la misma forma que daba Flask, para que
// Home.jsx siga funcionando sin cambios.
export async function listJobs(filters = {}) {
  const page = Number(filters.page) > 0 ? Number(filters.page) : 1
  const from = (page - 1) * PER_PAGE

  let query = supabase
    .from('jobs_public')
    .select('*', { count: 'exact' })
    .eq('status', 'ACTIVE')

  const q = (filters.q || '').trim()
  if (q) {
    // Busqueda full-text en espanol sobre titulo + empresa + descripcion
    // (columna `fts`, con indice GIN). 'websearch' admite comillas y -.
    query = query.textSearch('fts', q, { type: 'websearch', config: 'spanish' })
  }
  if (filters.category_id) query = query.eq('category_id', filters.category_id)
  if (filters.level) query = query.eq('experience_level', filters.level)
  if (filters.mode) query = query.eq('work_mode', filters.mode)
  if (filters.type) query = query.eq('employment_type', filters.type)

  const { data, error, count } = await query
    .order('publication_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, from + PER_PAGE - 1)

  if (error) fail(error, 'No se han podido cargar las ofertas')

  const total = count || 0
  return {
    data,
    meta: {
      total,
      page,
      per_page: PER_PAGE,
      pages: Math.ceil(total / PER_PAGE),
    },
  }
}

export async function getJob(id) {
  const { data, error } = await supabase
    .from('jobs_public')
    .select('*')
    .eq('id', id)
    .single()
  if (error) fail(error, 'Oferta no encontrada')
  return data
}

// ---------- Favoritos ----------

export async function addFavorite(jobId) {
  const userId = await currentUserId()
  // upsert + ignoreDuplicates equivale al INSERT OR IGNORE de Flask:
  // guardar dos veces la misma oferta no es un error.
  const { error } = await supabase
    .from('favorites')
    .upsert(
      { user_id: userId, job_id: jobId },
      { onConflict: 'user_id,job_id', ignoreDuplicates: true },
    )
  if (error) fail(error, 'No se ha podido guardar el favorito')
  return { favorite: true }
}

export async function removeFavorite(jobId) {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('job_id', jobId)
  if (error) fail(error, 'No se ha podido quitar el favorito')
  return { favorite: false }
}

// Alterna en una sola llamada al servidor, via la funcion toggle_favorite.
// Reporte de un usuario sobre una oferta publicada. Entra en la bandeja de
// moderación; la base de datos lo fuerza a estado abierto (BO-060) y no
// admite dos reportes abiertos del mismo usuario sobre la misma oferta.
export async function reportJob(jobId, { reason, description }) {
  const userId = await currentUserId()
  const { error } = await supabase.from('reports').insert({
    job_id: jobId,
    user_id: userId,
    reason,
    description: clean(description?.trim()),
  })
  if (error?.code === '23505') {
    throw new Error('Ya reportaste esta oferta. El equipo la está revisando.')
  }
  if (error) fail(error, 'No se ha podido enviar el reporte')
}

export async function toggleFavorite(jobId) {
  const { data, error } = await supabase.rpc('toggle_favorite', {
    p_job_id: jobId,
  })
  if (error) fail(error, 'No se ha podido actualizar el favorito')
  return { favorite: data }
}

// Para pintar el boton "Guardar" con su estado real al abrir una oferta.
// Sin sesion devuelve false en vez de lanzar: no es un error, es anonimo.
export async function isFavorite(jobId) {
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess.session?.user?.id
  if (!userId) return false

  const { data, error } = await supabase
    .from('favorites')
    .select('job_id')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .maybeSingle()
  if (error) fail(error)
  return Boolean(data)
}

export async function fetchFavorites() {
  const userId = await currentUserId()

  const { data: rows, error } = await supabase
    .from('favorites')
    .select('job_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar tus favoritos')
  if (!rows.length) return []

  // jobs_public es una vista, y PostgREST no puede incrustarla desde
  // favorites (no hay clave foranea hacia una vista), asi que se piden
  // las ofertas en una segunda consulta.
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs_public')
    .select('*')
    .in('id', rows.map((r) => r.job_id))
  if (jobsError) fail(jobsError)

  // .in() no respeta el orden de la lista: se reordena para que el
  // favorito mas reciente siga saliendo primero.
  const position = new Map(rows.map((r, i) => [r.job_id, i]))
  return jobs.sort((a, b) => position.get(a.id) - position.get(b.id))
}

// ---------- Perfil ----------

export async function fetchProfile() {
  const [user, favorites] = await Promise.all([fetchMe(), fetchFavorites()])
  return { user, favorites }
}

export async function updateProfile(payload) {
  const userId = await currentUserId()

  // role, is_active y email se omiten a proposito: el trigger
  // protect_profile_fields rechaza cambiarlos desde el propio perfil
  // (BO-001..007 en docs/02-backoffice.md).
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name: clean(payload.name),
      career: clean(payload.career),
      university: clean(payload.university),
      graduation_year: toNumber(payload.graduation_year),
      experience_level: clean(payload.experience_level),
      preferred_mode: clean(payload.preferred_mode),
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) fail(error, 'No se ha podido guardar el perfil')
  return data
}

// ---------- Admin: ofertas ----------
// Estas funciones no comprueban el rol: lo hace la politica
// jobs_write_admin. Un usuario normal recibira error 42501.

export async function adminListJobs() {
  const { data, error } = await supabase
    .from('jobs_public')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar las ofertas')
  return data
}

export async function adminGetJob(id) {
  const { data, error } = await supabase
    .from('jobs_public')
    .select('*')
    .eq('id', id)
    .single()
  if (error) fail(error, 'Oferta no encontrada')

  // La vista trae `skills` como nombres (para pintar). El formulario
  // necesita los ids para premarcar las casillas.
  const { data: rows, error: skillsError } = await supabase
    .from('job_skills')
    .select('skill_id')
    .eq('job_id', id)
  if (skillsError) fail(skillsError)

  return { ...data, skill_ids: rows.map((r) => r.skill_id) }
}

// Columnas de jobs que el frontend puede escribir, con su conversion.
const JOB_FIELDS = {
  title: (v) => v,
  description: (v) => v,
  company_id: toNumber,
  category_id: toNumber,
  location_id: toNumber,
  employment_type: clean,
  work_mode: clean,
  experience_level: clean,
  salary_min: toNumber,
  salary_max: toNumber,
  currency: clean,
  deadline: clean,
  contact_email: clean,
  contact_phone: clean,
  apply_url: clean,
  original_url: clean,
  status: clean,
  verification_status: clean,
}

// Separa los campos propios de la tabla jobs de la lista de skills,
// que vive en la tabla puente job_skills.
//
// Solo se incluyen las claves presentes en el payload, igual que hacia
// update_job() en Flask. Si se enviaran todas, editar una oferta desde el
// formulario (que no tiene location_id, contact_phone ni original_url)
// pondria esas columnas a NULL. En un INSERT, las que falten toman el
// DEFAULT de la tabla (status DRAFT, verification_status PENDING).
function splitJobPayload(payload) {
  const { skill_ids, ...fields } = payload
  const job = {}
  for (const [key, convert] of Object.entries(JOB_FIELDS)) {
    if (key in fields) job[key] = convert(fields[key])
  }
  return {
    job,
    // undefined = no tocar las skills; [] = quitarlas todas.
    skillIds: skill_ids === undefined ? undefined : skill_ids.map(Number),
  }
}

async function replaceJobSkills(jobId, skillIds) {
  const { error: delError } = await supabase
    .from('job_skills')
    .delete()
    .eq('job_id', jobId)
  if (delError) fail(delError)

  if (!skillIds.length) return

  const { error } = await supabase
    .from('job_skills')
    .insert(skillIds.map((skill_id) => ({ job_id: jobId, skill_id })))
  if (error) fail(error, 'No se han podido guardar las tecnologias')
}

export async function adminCreateJob(payload) {
  const { job, skillIds } = splitJobPayload(payload)

  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single()
  if (error) fail(error, 'No se ha podido crear la oferta')

  if (skillIds) await replaceJobSkills(data.id, skillIds)
  return adminGetJob(data.id)
}

export async function adminUpdateJob(id, payload) {
  const { job, skillIds } = splitJobPayload(payload)

  const { error } = await supabase.from('jobs').update(job).eq('id', id)
  if (error) fail(error, 'No se ha podido actualizar la oferta')

  if (skillIds) await replaceJobSkills(id, skillIds)
  return adminGetJob(id)
}

export async function adminDeleteJob(id) {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) fail(error, 'No se ha podido borrar la oferta')
  return { deleted: true }
}

// Transiciones de estado permitidas, leídas de la base de datos (la misma
// tabla que usa el trigger jobs_guard), agrupadas por estado de origen:
//   { DRAFT: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'], ... }
// Así la interfaz nunca ofrece un cambio que la base de datos rechazaría.
export async function fetchJobStatusTransitions() {
  const { data, error } = await supabase
    .from('job_status_transitions')
    .select('from_status, to_status')
  if (error) fail(error, 'No se han podido cargar los estados de las ofertas')

  return data.reduce((acc, { from_status, to_status }) => {
    ;(acc[from_status] ||= []).push(to_status)
    return acc
  }, {})
}

export async function adminSetJobStatus(id, status) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error, 'No se ha podido cambiar el estado')
  return data
}

// ---------- Admin: catalogos ----------

export async function adminCreateCompany(payload) {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: payload.name,
      slug: payload.slug || slugify(payload.name),
      description: clean(payload.description),
      website: clean(payload.website),
      logo_url: clean(payload.logo_url),
      location_id: toNumber(payload.location_id),
    })
    .select()
    .single()
  if (error) fail(error, 'No se ha podido crear la empresa')
  return data
}

export async function adminCreateCategory(payload) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: payload.name, slug: payload.slug || slugify(payload.name) })
    .select()
    .single()
  if (error) fail(error, 'No se ha podido crear la categoria')
  return data
}

export async function adminCreateSkill(payload) {
  const { data, error } = await supabase
    .from('skills')
    .insert({
      name: payload.name,
      slug: payload.slug || slugify(payload.name),
      category_id: toNumber(payload.category_id),
    })
    .select()
    .single()
  if (error) fail(error, 'No se ha podido crear la tecnologia')
  return data
}

// ---------- Admin: estadisticas y usuarios ----------

export async function adminStats() {
  // Una sola llamada en vez de seis COUNT desde el navegador.
  const { data, error } = await supabase.rpc('get_admin_stats')
  if (error) fail(error, 'No se han podido cargar las estadisticas')
  return data
}

export async function adminListUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar los usuarios')
  return data
}

// ---------- Alias sin "admin" ----------
//
// El portal de empresas usa las mismas funciones: quién puede crear, editar
// o cambiar el estado de una oferta lo decide la base de datos (RLS y el
// trigger jobs_guard), no el nombre de la función.
export const createJob = adminCreateJob
export const updateJob = adminUpdateJob
