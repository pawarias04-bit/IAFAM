// Punto de arranque de React.
// Importa estilos globales, el componente principal (App) y lo "monta"
// dentro del <div id="root"> del index.html. BrowserRouter = sistema de
// rutas de React Router (gestiona la URL sin recargar la página).
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)