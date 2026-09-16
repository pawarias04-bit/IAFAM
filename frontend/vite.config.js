// Vite configuración
//
// Ya no hay proxy /api: el backend Flask desapareció y el navegador habla
// directamente con Supabase, que envía las cabeceras CORS necesarias.
// La URL y la clave del proyecto se leen de .env.local (variables VITE_*).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
