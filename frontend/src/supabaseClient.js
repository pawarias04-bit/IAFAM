// Cliente unico de Supabase para toda la aplicacion.
//
// Sustituye al antiguo proxy /api -> Flask: ahora el navegador habla
// directamente con Supabase (PostgREST + Auth). Lo que antes protegia
// un decorador @require_admin en Python, ahora lo protegen las politicas
// RLS de la base de datos.
//
// La clave anon es publica y va embebida en el bundle: eso es correcto y
// esperado. No da ningun permiso por si misma; todo lo decide RLS.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Copia frontend/.env.example a frontend/.env.local y rellenalos.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,     // guarda la sesion en localStorage
    autoRefreshToken: true,   // renueva el JWT antes de que caduque
    detectSessionInUrl: true, // procesa el enlace de confirmacion por email
  },
})
