// Servicio de API: TODAS las llamadas al backend pasan por aquí.
// Es el equivalente a models.py pero del lado del frontend.
// 
// Conceptos:
// - fetch(url, { method, headers, body }) = la función nativa del navegador
//   para hacer peticiones HTTP (como curl/requests de Python).
// - Token JWT: lo guardamos en localStorage (persiste entre recargas).
//   Se adjunta automáticamente en la cabecera Authorization de cada
//   petición autenticada.

const API = '/api'

const BASE_HEADERS = { 'Content-Type': 'application/json' }

// ---------- Gestión del token ----------

export function getToken() {
  return localStorage.getItem('iafam_token')
}

export function getUser() {
  const raw = localStorage.getItem('iafam_user')
  return raw ? JSON.parse(raw) : null
}

export function setSession(token, user) {
  localStorage.setItem('iafam_token', token)
  localStorage.setItem('iafam_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('iafam_token')
  localStorage.removeItem('iafam_user')
}

// ---------- Helper interno de peticiones ----------

// headers() construye las cabeceras; si hay token, lo añade.
function headers(extra = {}) {
  const h = { ...BASE_HEADERS, ...extra }
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// request() hace el fetch, y si la respuesta no es 2xx lanza un Error
// con el mensaje que devuelve el backend (visible en la UI).
async function request(url, options = {}) {
  const resp = await fetch(`${API}${url}`, options)
  let body
  try {
    body = await resp.json()
  } catch {
    body = null
  }
  if (!resp.ok) {
    const msg = body?.error?.message || `Error HTTP ${resp.status}`
    if (resp.status === 401) clearSession() // token inválido → cerrar sesión
    throw new Error(msg)
  }
  return body
}

// ---------- Autenticación ----------

export async function register(payload) {
  const body = await request('/auth/register', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  setSession(body.data.token, body.data.user)
  return body.data.user
}

export async function login(payload) {
  const body = await request('/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  setSession(body.data.token, body.data.user)
  return body.data.user
}

export async function fetchMe() {
  const body = await request('/auth/me', { headers: headers() })
  return body.data
}

// ---------- Catálogos ----------

export async function fetchCategories() {
  const body = await request('/categories', { headers: headers() })
  return body.data
}

export async function fetchSkills() {
  const body = await request('/skills', { headers: headers() })
  return body.data
}

export async function fetchCompanies() {
  const body = await request('/companies', { headers: headers() })
  return body.data
}

// ---------- Ofertas (público) ----------

// listJobs construye una query string con los filtros elegidos.
export async function listJobs(filters = {}) {
  const qs = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  })
  const body = await request(`/jobs?${qs.toString()}`, { headers: headers() })
  return body
}

export async function getJob(id) {
  const body = await request(`/jobs/${id}`, { headers: headers() })
  return body.data
}

// ---------- Favoritos ----------

export async function addFavorite(jobId) {
  const body = await request(`/jobs/${jobId}/favorite`, {
    method: 'POST',
    headers: headers(),
  })
  return body.data
}

export async function removeFavorite(jobId) {
  const body = await request(`/jobs/${jobId}/favorite`, {
    method: 'DELETE',
    headers: headers(),
  })
  return body.data
}

export async function fetchFavorites() {
  const body = await request('/favorites', { headers: headers() })
  return body.data
}

// ---------- Perfil ----------

export async function updateProfile(payload) {
  const body = await request('/profile', {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function fetchProfile() {
  const body = await request('/profile', { headers: headers() })
  return body.data
}

// ---------- Admin: ofertas ----------

export async function adminListJobs() {
  const body = await request('/admin/jobs', { headers: headers() })
  return body.data
}

export async function adminGetJob(id) {
  const body = await request(`/admin/jobs/${id}`, { headers: headers() })
  return body.data
}

export async function adminCreateJob(payload) {
  const body = await request('/admin/jobs', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function adminUpdateJob(id, payload) {
  const body = await request(`/admin/jobs/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function adminDeleteJob(id) {
  const body = await request(`/admin/jobs/${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  return body.data
}

export async function adminSetJobStatus(id, status) {
  const body = await request(`/admin/jobs/${id}/status`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status }),
  })
  return body.data
}

// ---------- Admin: catálogos ----------

export async function adminCreateCompany(payload) {
  const body = await request('/admin/companies', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function adminCreateCategory(payload) {
  const body = await request('/admin/categories', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function adminCreateSkill(payload) {
  const body = await request('/admin/skills', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  return body.data
}

// ---------- Admin: estadísticas y usuarios ----------

export async function adminStats() {
  const body = await request('/admin/stats', { headers: headers() })
  return body.data
}

export async function adminListUsers() {
  const body = await request('/admin/users', { headers: headers() })
  return body.data
}