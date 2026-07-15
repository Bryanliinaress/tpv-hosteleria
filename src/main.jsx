import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSync } from './lib/sync'
import { backendV2, initV2 } from './lib/v2'

// Arranque de datos: backend multi-tenant (v2, tablas+RPC) si está activado,
// o la sincronización clásica del blob (demo) si no.
if (backendV2) initV2()
else initSync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
