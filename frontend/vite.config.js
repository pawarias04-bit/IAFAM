// Vite configuración
// PROXY: el frontend corre en http://localhost:5173 y el backend Flask en
// http://localhost:5000. Sin proxy, el navegador bloquearía las llamadas
// por CORS. Con esto, toda petición a /api/* desde el frontend se reenvía
// automáticamente al backend. Así en el código usamos "/api/jobs" (relativo)
// en vez de "http://localhost:5000/api/jobs" (absoluto).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})