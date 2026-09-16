// Ajustes públicos de la plataforma (app_settings con is_public).
//
// Sirven para encender o apagar funciones sin desplegar: el portal de
// empresas, las alertas… Se leen una vez al cargar la aplicación.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

const SettingsContext = createContext({ settings: {}, loading: true })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('No se pudo cargar la configuración:', error.message)
        setSettings(Object.fromEntries((data || []).map((s) => [s.key, s.value])))
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

// useFeature('company_portal') → true/false. Mientras carga devuelve false,
// así que nada aparece a medias.
export function useFeature(name) {
  const { settings } = useContext(SettingsContext)
  return settings[`features.${name}`] === true
}

export function useSetting(key, fallback = null) {
  const { settings } = useContext(SettingsContext)
  return settings[key] ?? fallback
}
