// Contexto de sesion.
//
// Antes el usuario se leia de localStorage de forma sincrona y ya estaba.
// Con Supabase la sesion se restaura de forma asincrona al cargar la
// pagina, asi que hace falta un estado `loading`: sin el, los guardias de
// ruta redirigirian a /login durante el parpadeo inicial aunque la sesion
// fuese valida.
//
// Se mantiene ademas una copia del perfil en localStorage (USER_CACHE_KEY)
// para que api.getUser() siga siendo sincrono y las paginas que lo usan
// (Profile, JobDetail) no tengan que cambiar.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

export const USER_CACHE_KEY = 'iafam_user'

const STAFF_ROLES = ['ADMIN', 'MODERATOR']

const AuthContext = createContext({
  user: null,
  loading: true,
  isStaff: false,
  can: () => false,
  updateUser: () => {},
  notice: '',
})

export const SUSPENDED_NOTICE = 'Tu cuenta está suspendida. Si crees que es un error, escribe al equipo de IAFAM Jobs.'

// Lee el perfil de la tabla profiles y los permisos del usuario
// (my_permissions, ver docs/02-backoffice.md). Devuelve null si no hay
// fila de perfil (por ejemplo, si el trigger de creacion fallase).
// Justo después de iniciar sesión, Supabase a veces rechaza el token recién
// emitido con "JWT issued at future" (desfase de reloj de unos segundos
// entre Auth y la API). Se reintenta una vez en lugar de dejar al usuario
// sin perfil.
const isClockSkew = (error) => /issued at future/i.test(error?.message || '')

export async function withClockSkewRetry(run) {
  const first = await run()
  const failed = Array.isArray(first) ? first.some((r) => isClockSkew(r.error)) : isClockSkew(first.error)
  if (!failed) return first
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return run()
}

async function loadProfile(sessionUser) {
  if (!sessionUser) return null

  const [profileRes, permsRes, companiesRes] = await withClockSkewRetry(() => Promise.all([
    supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle(),
    supabase.rpc('my_permissions'),
    // Empresas de las que forma parte: con esto la barra de navegación
    // decide si muestra el portal de empresas.
    supabase.from('company_members').select('company_id, role'),
  ]))

  if (profileRes.error) {
    console.error('No se pudo cargar el perfil:', profileRes.error.message)
    return null
  }
  if (!profileRes.data) return null

  // Sin permisos la app sigue funcionando como usuario normal; el panel
  // simplemente no mostrara acciones. La base de datos manda igualmente.
  if (permsRes.error) {
    console.error('No se pudieron cargar los permisos:', permsRes.error.message)
  }

  const data = profileRes.data
  return {
    ...data,
    // El email vive en auth.users; profiles.email es solo una copia.
    email: data.email || sessionUser.email,
    permissions: permsRes.data || [],
    companies: companiesRes.data || [],
  }
}

function cacheUser(user) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_CACHE_KEY)
  } catch {
    // Modo incognito o almacenamiento lleno: la app funciona igual,
    // solo se pierde el atajo sincrono de getUser().
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Mensaje para la pantalla de acceso (p. ej. cuenta suspendida).
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    // onAuthStateChange dispara tambien con la sesion inicial restaurada,
    // asi que cubre el arranque y los login/logout posteriores.
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const profile = await loadProfile(session?.user)
        if (!active) return

        // BO-005/081: un perfil suspendido no mantiene la sesión. Auth ya
        // bloquea nuevos accesos, pero un token emitido antes de la
        // suspensión sigue siendo válido hasta que caduca: se cierra aquí.
        // Fuera del callback (setTimeout) para no llamar a Auth desde dentro.
        if (profile && !profile.is_active) {
          setNotice(SUSPENDED_NOTICE)
          setUser(null)
          cacheUser(null)
          setLoading(false)
          setTimeout(() => supabase.auth.signOut(), 0)
          return
        }

        if (profile) setNotice('')
        setUser(profile)
        cacheUser(profile)
        setLoading(false)
      },
    )

    // Salvaguarda: si no hay sesion que restaurar, onAuthStateChange emite
    // igualmente, pero pedimos la sesion para no quedarnos en loading si
    // algo va mal en la restauracion.
    supabase.auth.getSession().then(({ data }) => {
      if (active && !data.session) {
        setUser(null)
        cacheUser(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Tras editar el perfil, para que la barra de navegacion muestre el
  // nombre nuevo sin recargar la pagina.
  const updateUser = useCallback((changes) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...changes }
      cacheUser(next)
      return next
    })
  }, [])

  // can('jobs.delete') solo decide qué se MUESTRA. Si alguien fuerza la
  // acción igualmente, la rechaza la base de datos (RLS y triggers).
  const can = useCallback(
    (permission) => Boolean(user?.is_active && user.permissions?.includes(permission)),
    [user],
  )
  const isStaff = Boolean(user?.is_active && STAFF_ROLES.includes(user.role))

  return (
    <AuthContext.Provider value={{ user, loading, isStaff, can, updateUser, notice }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
