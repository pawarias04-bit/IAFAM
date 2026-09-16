// Capa de datos del portal de empresas (docs/02-backoffice.md, Etapa C).
//
// Las reglas están en la base de datos: quién pertenece a qué empresa
// (company_members + RLS) y qué puede hacer con sus ofertas (jobs_guard).
// Aquí solo se envían los datos y se traducen los errores.
import { supabase } from './supabaseClient.js'
import { fail } from './api.js'

// ---------- Empresa y equipo ----------

// Empresas de las que formo parte, con mi rol en cada una.
//
// Hace falta filtrar por user_id: el equipo de una empresa se ve entre sí
// (política company_members_read), así que sin el filtro saldría una fila
// por cada compañero y la misma empresa repetida.
export async function fetchMyCompanies() {
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess.session?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from('company_members')
    .select('role, created_at, company:companies ( * )')
    .eq('user_id', userId)
    .order('created_at')
  if (error) fail(error, 'No se han podido cargar tus empresas')
  return (data || [])
    .filter((m) => m.company)
    .map((m) => ({ ...m.company, my_role: m.role }))
}

export async function createCompanyAccount({ name, website, description, logo_url: logoUrl }) {
  const { data, error } = await supabase.rpc('create_company_account', {
    p_name: name,
    p_website: website || null,
    p_description: description || null,
    p_logo_url: logoUrl || null,
  })
  if (error) fail(error, 'No se ha podido crear la empresa')
  return data // id de la empresa
}

export async function fetchCompany(companyId) {
  const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (error) fail(error, 'Empresa no encontrada')
  return data
}

// Solo nombre, web, logo y descripción: lo demás lo cambia el equipo de
// IAFAM (lo impone companies_guard).
export async function updateMyCompany(companyId, values) {
  const clean = (v) => (v === '' || v === undefined ? null : v)
  const { data, error } = await supabase
    .from('companies')
    .update({
      name: values.name,
      website: clean(values.website),
      logo_url: clean(values.logo_url),
      description: clean(values.description),
    })
    .eq('id', companyId)
    .select()
    .single()
  if (error) fail(error, 'No se han podido guardar los cambios')
  return data
}

export async function requestVerification(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .update({ verification_status: 'PENDING' })
    .eq('id', companyId)
    .select()
    .single()
  if (error) fail(error, 'No se ha podido solicitar la verificación')
  return data
}

export async function fetchCompanyMembers(companyId) {
  const { data, error } = await supabase.rpc('list_company_members', { p_company_id: companyId })
  if (error) fail(error, 'No se ha podido cargar el equipo')
  return data
}

export async function addCompanyMember(companyId, email, role = 'MEMBER') {
  const { error } = await supabase.rpc('add_company_member', {
    p_company_id: companyId,
    p_email: email,
    p_role: role,
  })
  if (error) fail(error, 'No se ha podido añadir a esa persona')
}

export async function setCompanyMemberRole(companyId, userId, role) {
  const { error } = await supabase.rpc('set_company_member_role', {
    p_company_id: companyId,
    p_user_id: userId,
    p_role: role,
  })
  if (error) fail(error, 'No se ha podido cambiar el rol')
}

export async function removeCompanyMember(companyId, userId) {
  const { error } = await supabase.rpc('remove_company_member', {
    p_company_id: companyId,
    p_user_id: userId,
  })
  if (error) fail(error, 'No se ha podido quitar a esa persona')
}

// ---------- Ofertas de la empresa ----------

// Se lee de `jobs` (no de la vista) porque incluye review_note: el motivo
// del rechazo, que solo ve la empresa y el equipo de IAFAM.
export async function fetchCompanyJobs(companyId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, status, verification_status, review_note, publication_date, deadline, created_at, updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
  if (error) fail(error, 'No se han podido cargar tus ofertas')
  return data
}

export async function fetchCompanyJob(jobId) {
  const [jobRes, skillsRes] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', jobId).single(),
    supabase.from('job_skills').select('skill_id').eq('job_id', jobId),
  ])
  if (jobRes.error) fail(jobRes.error, 'Oferta no encontrada')
  if (skillsRes.error) fail(skillsRes.error)
  return { ...jobRes.data, skill_ids: skillsRes.data.map((s) => s.skill_id) }
}

export async function setCompanyJobStatus(jobId, status) {
  const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId)
  if (error) fail(error, 'No se ha podido cambiar el estado de la oferta')
}

export async function deleteCompanyJobDraft(jobId) {
  const { error } = await supabase.from('jobs').delete().eq('id', jobId)
  if (error) fail(error, 'No se ha podido borrar el borrador')
}
