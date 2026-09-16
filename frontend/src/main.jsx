// Punto de arranque de React.
// Importa estilos globales, el componente principal (App) y lo "monta"
// dentro del <div id="root"> del index.html. BrowserRouter = sistema de
// rutas de React Router (gestiona la URL sin recargar la página).
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { SettingsProvider } from './settings.jsx'
import { ToastProvider } from './components/ui/index.js'
import './styles.css'

// AuthProvider envuelve la app para que cualquier componente pueda saber
// quién ha iniciado sesión sin volver a pedírselo a Supabase.
// ToastProvider queda por encima de las rutas: un aviso lanzado justo
// antes de navegar ("Oferta creada") sigue visible en la página nueva.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)